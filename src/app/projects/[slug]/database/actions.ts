"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { aadFor, encryptSecret } from "@/lib/crypto/envelope";
import {
  accessTokenFor,
  fetchProjectKeys,
  getAuthConfig,
  projectUrlFor,
  runQuery,
  SupabaseApiError,
  updateAuthConfig,
} from "@/lib/supabase/management";
import { provisioningSql, SCHEMA_VERSION } from "@/lib/spoke/schema";

export type ConnectionState = { error?: string; saved?: boolean };

/**
 * Points this experiment at one of the account's Supabase projects, and
 * resolves that project's keys.
 *
 * One experiment per Supabase project, strictly — so this is a choice of
 * target, not an addition to a list. Re-running it repoints the experiment,
 * which is a real thing to want when a tenant rehearses on a scratch project
 * before an event.
 */
export async function chooseSupabaseProject(
  _prev: ConnectionState,
  formData: FormData,
): Promise<ConnectionState> {
  const slug = String(formData.get("slug") ?? "");
  const ref = String(formData.get("ref") ?? "").trim();
  const { projectId } = await requireProjectRole(slug, "OWNER");

  if (!ref) return { error: "Choose a Supabase project." };

  const connection = await db.supabaseConnection.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!connection) return { error: "Connect a Supabase account first." };

  try {
    const accessToken = await accessTokenFor(connection.id);
    const keys = await fetchProjectKeys(ref, accessToken);

    if (!keys.publishableKey) {
      // Without it no participant can reach the database at all, so stopping
      // here is kinder than storing a half-connection that fails later.
      return {
        error:
          "Could not read that project's publishable key. Check the OAuth app has project access.",
      };
    }

    await db.supabaseConnection.update({
      where: { id: connection.id },
      data: {
        projectRef: ref,
        projectUrl: projectUrlFor(ref),
        // Public by design — it ships to every participant's browser.
        publishableKey: keys.publishableKey,
        secretKeyEnc: keys.secretKey
          ? encryptSecret(keys.secretKey, aadFor(connection.id, "secretKey"))
          : null,
      },
    });

    revalidatePath(`/projects/${slug}`);
    return { saved: true };
  } catch (error) {
    console.error("[supabase] choose project failed:", error);
    return {
      error:
        error instanceof Error ? error.message : "Could not reach Supabase.",
    };
  }
}

export type ProvisionState = {
  error?: string;
  /** Present when the tables could not be created and must be run by hand. */
  fallbackSql?: string;
  done?: {
    anonEnabled: boolean;
    rateLimit: number | null;
    schemaVersion: number;
  };
};

/**
 * Creates the tables, policies and grants in the tenant's Supabase, then turns
 * on anonymous sign-ins.
 *
 * Whether the Management API will actually run DDL for us is the one external
 * unknown in this whole design, so the failure path is not an afterthought:
 * any refusal hands back the exact SQL to paste into the Supabase SQL editor,
 * and onboarding continues by hand. The statements are idempotent, so running
 * them twice — or finishing by hand after a partial failure — is safe.
 */
export async function provisionDatabase(
  _prev: ProvisionState,
  formData: FormData,
): Promise<ProvisionState> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId } = await requireProjectRole(slug, "OWNER");

  const connection = await db.supabaseConnection.findUnique({
    where: { projectId },
    select: { id: true, projectRef: true },
  });
  if (!connection?.projectRef) {
    return { error: "Choose which Supabase project this targets first." };
  }

  const sql = provisioningSql();
  let accessToken: string;
  try {
    accessToken = await accessTokenFor(connection.id);
  } catch {
    return {
      error: "This Supabase authorisation is no longer valid. Reconnect it.",
      fallbackSql: sql,
    };
  }

  try {
    await runQuery(connection.projectRef, accessToken, sql);
  } catch (error) {
    console.warn("[provision] DDL failed:", error);
    const missing =
      error instanceof SupabaseApiError ? error.missingScopes : null;
    return {
      error: missing
        ? `Your OAuth app is missing the scope ${missing.join(", ")}. Add it, reconnect, and try again — or run the SQL below by hand.`
        : "Supabase would not run the schema. Run the SQL below in your project's SQL editor instead — it does exactly the same thing.",
      fallbackSql: sql,
    };
  }

  // Tables exist from here on. Anonymous sign-ins are a separate call and a
  // separate scope, so a failure here leaves a usable-but-closed project rather
  // than undoing the schema.
  let anonEnabled = false;
  let rateLimit: number | null = null;
  try {
    const updated = await updateAuthConfig(connection.projectRef, accessToken, {
      external_anonymous_users_enabled: true,
    });
    anonEnabled = updated?.external_anonymous_users_enabled ?? true;
    rateLimit = updated?.rate_limit_anonymous_users ?? null;
    if (rateLimit === null) {
      const current = await getAuthConfig(connection.projectRef, accessToken);
      rateLimit = current?.rate_limit_anonymous_users ?? null;
    }
  } catch (error) {
    console.warn("[provision] enabling anonymous sign-ins failed:", error);
  }

  await db.supabaseConnection.update({
    where: { id: connection.id },
    data: {
      provisionedAt: new Date(),
      schemaVersion: SCHEMA_VERSION,
      anonSignInsEnabled: anonEnabled,
    },
  });

  revalidatePath(`/projects/${slug}/database`);
  revalidatePath(`/projects/${slug}`);
  return {
    done: { anonEnabled, rateLimit, schemaVersion: SCHEMA_VERSION },
    error: anonEnabled
      ? undefined
      : "Tables are in place, but anonymous sign-ins could not be enabled. Turn them on in Supabase under Authentication → Providers, or participants will not be able to sign in.",
  };
}

/** Raises the per-IP anonymous sign-in limit, for events behind one network. */
export async function setAnonRateLimit(
  _prev: ProvisionState,
  formData: FormData,
): Promise<ProvisionState> {
  const slug = String(formData.get("slug") ?? "");
  const limit = Number(formData.get("limit"));
  const { projectId } = await requireProjectRole(slug, "OWNER");

  if (!Number.isInteger(limit) || limit < 1) {
    return { error: "Enter a whole number of sign-ins per hour." };
  }

  const connection = await db.supabaseConnection.findUnique({
    where: { projectId },
    select: { id: true, projectRef: true },
  });
  if (!connection?.projectRef) return { error: "Not connected." };

  try {
    const accessToken = await accessTokenFor(connection.id);
    const updated = await updateAuthConfig(connection.projectRef, accessToken, {
      rate_limit_anonymous_users: limit,
    });
    revalidatePath(`/projects/${slug}/database`);
    return {
      done: {
        anonEnabled: updated?.external_anonymous_users_enabled ?? true,
        rateLimit: updated?.rate_limit_anonymous_users ?? limit,
        schemaVersion: SCHEMA_VERSION,
      },
    };
  } catch (error) {
    console.warn("[provision] rate limit update failed:", error);
    return { error: "Supabase would not accept that change." };
  }
}

/**
 * Forgets the authorisation and everything derived from it. The tenant's
 * Supabase project is untouched — this only removes our access to it.
 */
export async function disconnectSupabase(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId } = await requireProjectRole(slug, "OWNER");
  await db.supabaseConnection.deleteMany({ where: { projectId } });
  revalidatePath(`/projects/${slug}`);
}
