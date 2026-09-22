import { randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import {
  CURRENT_KEY_VERSION,
} from "@/lib/crypto/envelope";
import { exchangeCode, storeTokens } from "@/lib/supabase/management";

export const dynamic = "force-dynamic";

const FLOW_COOKIE = "supabase_oauth_flow";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function back(slug: string | null, error?: string): NextResponse {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3100";
  const path = slug ? `/projects/${slug}` : "/projects";
  const url = new URL(path, base);
  if (error) url.searchParams.set("connect_error", error);
  else url.searchParams.set("connected", "1");
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const raw = jar.get(FLOW_COOKIE)?.value;
  // Single-use whatever happens next: a replayed callback must not find a
  // verifier waiting for it.
  jar.delete(FLOW_COOKIE);

  if (!raw) return back(null, "expired");

  let flow: { state: string; codeVerifier: string; slug: string };
  try {
    flow = JSON.parse(raw);
  } catch {
    return back(null, "expired");
  }

  const params = request.nextUrl.searchParams;
  const denied = params.get("error");
  if (denied) return back(flow.slug, denied);

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !safeEqual(state, flow.state)) {
    return back(flow.slug, "state");
  }

  // The cookie proves the flow; it does not prove the person still may act on
  // this project. Re-authorise rather than trusting what we wrote ten minutes
  // ago — membership can have been revoked in between.
  const { projectId } = await requireProjectRole(flow.slug, "OWNER");

  try {
    const tokens = await exchangeCode(code, flow.codeVerifier);

    // The connection may already exist — reconnecting a project replaces its
    // authorisation without disturbing the target or the keys already resolved.
    const existing = await db.supabaseConnection.findUnique({
      where: { projectId },
      select: { id: true },
    });

    const connectionId = existing?.id ?? randomUUID();
    if (!existing) {
      await db.supabaseConnection.create({
        data: { id: connectionId, projectId, keyVersion: CURRENT_KEY_VERSION },
      });
    }

    await storeTokens(connectionId, tokens);
    return back(flow.slug);
  } catch (error) {
    console.error("[supabase oauth] exchange failed:", error);
    return back(flow.slug, "exchange");
  }
}
