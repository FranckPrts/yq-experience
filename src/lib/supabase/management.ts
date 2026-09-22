import "server-only";
import { db } from "@/lib/db";
import {
  aadFor,
  decryptSecret,
  encryptSecret,
} from "@/lib/crypto/envelope";

/**
 * The Supabase Management API — the only place that speaks to api.supabase.com.
 *
 * We are the OAuth *client* here: a tenant authorises our app to reach the
 * projects in their own Supabase organisation. The grant is organisation-wide,
 * which is why choosing which project an experiment targets is a separate step
 * from authorising at all.
 *
 * Everything in this module is server-only. The access token, refresh token and
 * secret key never reach a browser — that is the whole of decision 2's
 * "tenant setup is strictly server-side".
 */

const AUTHORIZE_URL = "https://api.supabase.com/v1/oauth/authorize";
const TOKEN_URL = "https://api.supabase.com/v1/oauth/token";
const API = "https://api.supabase.com/v1";

/** Refresh this far before actual expiry, so a call never races the clock. */
const REFRESH_SKEW_MS = 60_000;

export function oauthConfig() {
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.SUPABASE_OAUTH_REDIRECT_URI ??
    `${process.env.APP_BASE_URL ?? "http://localhost:3100"}/api/connect/supabase/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "SUPABASE_OAUTH_CLIENT_ID / SUPABASE_OAUTH_CLIENT_SECRET are not set — see .env.example",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function authorizeUrl(state: string, codeChallenge: string): string {
  const { clientId, redirectUri } = oauthConfig();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  // PKCE is required under OAuth 2.1 whatever the client type.
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

/**
 * Credentials go in the `Authorization` header, not the body — Supabase's docs
 * are explicit, it is the spec's mandatory-to-implement method, and far more
 * infrastructure logs request bodies than logs headers.
 */
function basicAuth(): string {
  const { clientId, clientSecret } = oauthConfig();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase token endpoint returned ${response.status}: ${detail.slice(0, 300)}`,
    );
  }
  return (await response.json()) as TokenResponse;
}

export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const { redirectUri } = oauthConfig();
  // `redirect_uri` must match the authorize request byte for byte.
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  );
}

export async function refreshTokens(
  refreshToken: string,
): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

/** Writes a token pair onto a connection, sealed against that row and column. */
export async function storeTokens(
  connectionId: string,
  tokens: TokenResponse,
): Promise<void> {
  await db.supabaseConnection.update({
    where: { id: connectionId },
    data: {
      accessTokenEnc: encryptSecret(
        tokens.access_token,
        aadFor(connectionId, "accessToken"),
      ),
      refreshTokenEnc: encryptSecret(
        tokens.refresh_token,
        aadFor(connectionId, "refreshToken"),
      ),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
}

/**
 * A usable access token for a connection, refreshing first if it is close to
 * expiring. Refresh rotates both tokens, so the new pair is written back before
 * the caller uses it — otherwise a crash mid-request would leave a refresh
 * token Supabase has already invalidated.
 */
export async function accessTokenFor(connectionId: string): Promise<string> {
  const connection = await db.supabaseConnection.findUniqueOrThrow({
    where: { id: connectionId },
    select: {
      id: true,
      accessTokenEnc: true,
      refreshTokenEnc: true,
      tokenExpiresAt: true,
      keyVersion: true,
    },
  });

  if (!connection.accessTokenEnc || !connection.refreshTokenEnc) {
    throw new Error("This project's Supabase account is not connected.");
  }

  const fresh =
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() - REFRESH_SKEW_MS > Date.now();

  if (fresh) {
    return decryptSecret(
      connection.accessTokenEnc,
      aadFor(connection.id, "accessToken"),
      connection.keyVersion,
    );
  }

  const refreshToken = decryptSecret(
    connection.refreshTokenEnc,
    aadFor(connection.id, "refreshToken"),
    connection.keyVersion,
  );
  const tokens = await refreshTokens(refreshToken);
  await storeTokens(connection.id, tokens);
  return tokens.access_token;
}

/**
 * Carries the status and Supabase's own message, so callers can tell the
 * difference between "this authorisation is dead" and "this app was never
 * granted the scope" — which need opposite advice and are easy to confuse.
 */
export class SupabaseApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    path: string,
  ) {
    super(`Supabase ${path} returned ${status}: ${detail.slice(0, 300)}`);
    this.name = "SupabaseApiError";
  }

  /** The scopes Supabase named as missing, if that is what went wrong. */
  get missingScopes(): string[] | null {
    const match = this.detail.match(/missing required scopes \(([^)]+)\)/i);
    if (!match) return null;
    return match[1].split(/[,\s]+/).filter(Boolean);
  }
}

async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new SupabaseApiError(response.status, detail, path);
  }
  return (await response.json()) as T;
}

/** Scope → the thing we use it for, so a message can say why it is wanted. */
export const SCOPE_PURPOSE: Record<string, string> = {
  projects_read: "list the account's projects",
  secrets_read: "read the project's API keys",
  database_write: "create the tables during provisioning",
  auth_read: "check whether anonymous sign-ins are enabled",
  auth_write: "enable anonymous sign-ins",
};

export type SupabaseProject = {
  id: string;
  ref: string;
  name: string;
  region?: string;
  status?: string;
  organization_id?: string;
};

export async function listSupabaseProjects(
  accessToken: string,
): Promise<SupabaseProject[]> {
  const projects = await apiGet<SupabaseProject[]>("/projects", accessToken);
  return Array.isArray(projects) ? projects : [];
}

export type ProjectKeys = { publishableKey?: string; secretKey?: string };

/**
 * Supabase is mid-migration from `anon`/`service_role` to
 * `publishable`/`secret`, and which pair a project reports depends on when it
 * was created. Match on both vocabularies rather than assuming either, and
 * recognise the `sb_publishable_` / `sb_secret_` prefixes as a fallback.
 */
export async function fetchProjectKeys(
  ref: string,
  accessToken: string,
): Promise<ProjectKeys> {
  const keys = await apiGet<
    { name?: string; type?: string; api_key?: string }[]
  >(`/projects/${ref}/api-keys`, accessToken);

  const out: ProjectKeys = {};
  for (const key of Array.isArray(keys) ? keys : []) {
    const label = `${key.name ?? ""} ${key.type ?? ""}`.toLowerCase();
    const value = key.api_key;
    if (!value) continue;

    if (
      !out.publishableKey &&
      (label.includes("publishable") ||
        label.includes("anon") ||
        value.startsWith("sb_publishable_"))
    ) {
      out.publishableKey = value;
    }
    if (
      !out.secretKey &&
      (label.includes("secret") ||
        label.includes("service_role") ||
        value.startsWith("sb_secret_"))
    ) {
      out.secretKey = value;
    }
  }
  return out;
}

export function projectUrlFor(ref: string): string {
  return `https://${ref}.supabase.co`;
}

async function apiSend<T>(
  method: "POST" | "PATCH",
  path: string,
  accessToken: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new SupabaseApiError(response.status, detail, path);
  }
  // Some endpoints answer 200 with an empty body.
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Runs SQL against the tenant's database. Needs the `database_write` scope,
 * and is the call most likely to be refused — which is why every caller has a
 * copy-pasteable fallback to offer.
 */
export async function runQuery<T = unknown>(
  ref: string,
  accessToken: string,
  query: string,
): Promise<T> {
  return apiSend<T>(
    "POST",
    `/projects/${ref}/database/query`,
    accessToken,
    { query },
  );
}

export type AuthConfig = {
  external_anonymous_users_enabled?: boolean;
  rate_limit_anonymous_users?: number;
};

export async function getAuthConfig(
  ref: string,
  accessToken: string,
): Promise<AuthConfig> {
  return apiGet<AuthConfig>(`/projects/${ref}/config/auth`, accessToken);
}

/**
 * Enables anonymous sign-ins, and optionally raises their per-IP rate limit.
 *
 * The limit matters more than it looks: the default is low enough that a room
 * full of participants behind one conference NAT will hit it, which is exactly
 * the deployment this platform grew out of.
 */
export async function updateAuthConfig(
  ref: string,
  accessToken: string,
  config: AuthConfig,
): Promise<AuthConfig> {
  return apiSend<AuthConfig>(
    "PATCH",
    `/projects/${ref}/config/auth`,
    accessToken,
    config,
  );
}
