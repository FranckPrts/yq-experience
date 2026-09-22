import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * Server-side sessions.
 *
 * The cookie carries a random token; the database stores only its SHA-256. So
 * read access to `sessions` — a backup, a support query, Prisma Studio — does
 * not hand anyone a live session. A plain hash is right here rather than a slow
 * KDF: the token is 256 bits of entropy we generated, not a human-chosen
 * secret, so there is nothing to brute force.
 *
 * Sessions being rows, not signed blobs, is what makes revocation real: signing
 * out deletes, and removing someone from a project takes effect on the session
 * they already hold.
 */

export const SESSION_COOKIE = "constellation_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** Don't write `lastSeenAt` on every request — once an hour is enough. */
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // `lax` rather than `strict`: an invitation link arrives from a mail client,
    // and `strict` would withhold the cookie on that first cross-site
    // navigation, presenting a signed-in user with a signed-out page.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

/** Issues a session and sets the cookie. Returns the raw token, for tests. */
export async function createSession(
  userId: string,
  userAgent?: string | null,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 500) ?? null,
    },
  });

  (await cookies()).set(SESSION_COOKIE, token, cookieOptions());
  return token;
}

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  isPlatformAdmin: boolean;
};

/**
 * Resolves the cookie to a user, or null. Expired rows are deleted on sight so
 * a stale session cannot be resurrected by moving the clock back.
 */
export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          isPlatformAdmin: true,
        },
      },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return session.user;
}

/** Ends this session everywhere: the row goes, and so does the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }
  jar.delete(SESSION_COOKIE);
}

/** Signs a user out of every device — used when a password changes. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
