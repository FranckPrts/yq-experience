import "server-only";
import { db } from "@/lib/db";

/**
 * Platform admin is granted, never invited.
 *
 * An invitation is a bearer link — it works for whoever holds it — and admin is
 * the one role where that is not acceptable: it reaches every project. So admin
 * goes only to an account that already exists, by name, from someone who is
 * already an admin. A new person is invited as an ordinary user, signs up, and
 * is promoted afterwards.
 *
 * `npm run admin` remains as the bootstrap and the way back in if every admin
 * is locked out; it needs shell access to the server, which is the point.
 */

export type AdminChange = { ok: true; message: string } | { ok: false; error: string };

export async function listAdmins() {
  return db.user.findMany({
    where: { isPlatformAdmin: true },
    select: { id: true, email: true, displayName: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function grantAdmin(email: string): Promise<AdminChange> {
  const address = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: address },
    select: { id: true, isPlatformAdmin: true },
  });

  // Only an admin can reach this, so saying the account doesn't exist leaks
  // nothing an admin couldn't already see.
  if (!user) {
    return {
      ok: false,
      error: `No account for ${address}. Invite them as a normal user first, then promote them once they have signed up.`,
    };
  }
  if (user.isPlatformAdmin) {
    return { ok: true, message: `${address} is already an administrator.` };
  }

  await db.user.update({
    where: { id: user.id },
    data: { isPlatformAdmin: true },
  });
  return { ok: true, message: `${address} is now an administrator.` };
}

/**
 * Takes effect on sessions already open: `requirePlatformAdmin` reads the flag
 * from the database on every request, so there is nothing cached to wait out.
 */
export async function revokeAdmin(
  targetId: string,
  actorId: string,
): Promise<AdminChange> {
  // Nobody demotes themselves. It is the one way to lock the platform out by
  // accident, and another admin can always do it deliberately.
  if (targetId === actorId) {
    return {
      ok: false,
      error: "You can't remove your own admin access. Ask another administrator.",
    };
  }

  return db.$transaction(async (tx) => {
    const count = await tx.user.count({ where: { isPlatformAdmin: true } });
    if (count <= 1) {
      return { ok: false, error: "There must always be at least one administrator." };
    }
    const target = await tx.user.update({
      where: { id: targetId },
      data: { isPlatformAdmin: false },
      select: { email: true },
    });
    return { ok: true, message: `${target.email} is no longer an administrator.` };
  });
}
