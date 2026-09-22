import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requireProjectRole } from "@/lib/auth/dal";
import { authorizeUrl } from "@/lib/supabase/management";

/**
 * Begins the Supabase OAuth flow for one project.
 *
 * `state` defends the callback against a forged authorisation being planted on
 * a signed-in tenant; the PKCE `code_verifier` defends the code itself against
 * being used by anyone who intercepts it. Both are held in httpOnly cookies —
 * never in the URL, and never in a store the browser can read.
 *
 * The project slug rides along in the same cookie as the state rather than in
 * the redirect URI, because the redirect URI has to match byte for byte at the
 * token exchange and must not vary per project.
 */

export const dynamic = "force-dynamic";

const FLOW_COOKIE = "supabase_oauth_flow";
const FLOW_TTL_SECONDS = 600;

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("project");
  if (!slug) {
    return NextResponse.json({ error: "Missing project" }, { status: 400 });
  }

  // Connecting a database is an owner's decision, not a collaborator's.
  await requireProjectRole(slug, "OWNER");

  const state = base64url(randomBytes(32));
  const codeVerifier = base64url(randomBytes(64));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest(),
  );

  (await cookies()).set(
    FLOW_COOKIE,
    JSON.stringify({ state, codeVerifier, slug }),
    {
      httpOnly: true,
      sameSite: "lax", // the callback is a cross-site navigation back from Supabase
      secure: process.env.NODE_ENV === "production",
      path: "/api/connect/supabase",
      maxAge: FLOW_TTL_SECONDS,
    },
  );

  return NextResponse.redirect(authorizeUrl(state, codeChallenge));
}
