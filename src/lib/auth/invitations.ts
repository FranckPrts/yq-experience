import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "./password";
import type { Role } from "@/generated/prisma/enums";

/**
 * Invitations.
 *
 * There is no open sign-up route. An account exists only because someone with
 * the standing to invite said it should — a platform admin for a new person, or
 * a project owner for a co-tenant.
 *
 * The link carries a random token; only its SHA-256 is stored, so this table is
 * not a stash of working invitations. As with sessions, a plain hash is right:
 * the token is 256 bits we generated, not a guessable secret.
 */

const DEFAULT_TTL_DAYS = 14;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type NewInvitation = {
  createdById: string;
  /** Restricts the invitation to one address. Omit for a hand-it-over link. */
  email?: string | null;
  projectId?: string | null;
  role?: Role;
  grantsPlatformAdmin?: boolean;
  ttlDays?: number;
};

/**
 * Returns the raw token exactly once — it is not recoverable afterwards. The
 * caller turns it into a URL and delivers it.
 */
export async function createInvitation(input: NewInvitation) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + (input.ttlDays ?? DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000,
  );

  const invitation = await db.invitation.create({
    data: {
      tokenHash: hashToken(token),
      email: input.email?.trim().toLowerCase() || null,
      projectId: input.projectId ?? null,
      role: input.role ?? "COLLABORATOR",
      grantsPlatformAdmin: input.grantsPlatformAdmin ?? false,
      createdById: input.createdById,
      expiresAt,
    },
    include: { project: { select: { slug: true, name: true } } },
  });

  return { invitation, token };
}

export function invitationUrl(token: string, baseUrl?: string): string {
  const base =
    baseUrl ??
    process.env.APP_BASE_URL ??
    `http://localhost:${process.env.PORT ?? 3100}`;
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}

export type InvitationState =
  | { ok: true; invitation: Awaited<ReturnType<typeof findInvitation>> }
  | { ok: false; reason: "unknown" | "expired" | "used" | "revoked" };

async function findInvitation(token: string) {
  return db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { project: { select: { id: true, slug: true, name: true } } },
  });
}

/** Read-only check, for rendering the acceptance page before anything is written. */
export async function inspectInvitation(token: string): Promise<InvitationState> {
  const invitation = await findInvitation(token);
  if (!invitation) return { ok: false, reason: "unknown" };
  if (invitation.revokedAt) return { ok: false, reason: "revoked" };
  if (invitation.acceptedAt) return { ok: false, reason: "used" };
  if (invitation.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, invitation };
}

export type RedeemResult =
  | { ok: true; userId: string; projectSlug: string | null }
  | { ok: false; error: string };

/**
 * Creates the account and consumes the invitation in one transaction, so a
 * failure part-way cannot leave a usable invitation attached to a half-made
 * user — or an account nobody can explain.
 *
 * The invitation is consumed by a conditional update: the row only moves to
 * accepted if it is still unaccepted at that moment, which is what stops two
 * simultaneous redemptions of the same link both succeeding.
 */
export async function redeemInvitation(
  token: string,
  input: { email: string; password: string; displayName?: string },
): Promise<RedeemResult> {
  const state = await inspectInvitation(token);
  if (!state.ok) return { ok: false, error: state.reason };

  const invitation = state.invitation!;
  const email = input.email.trim().toLowerCase();

  if (invitation.email && invitation.email !== email) {
    return { ok: false, error: "This invitation is for a different address." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const userId = await db.$transaction(async (tx) => {
      const consumed = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date() },
      });
      // Someone else redeemed it between our check and this write.
      if (consumed.count !== 1) throw new Error("used");

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          displayName: input.displayName?.trim() || null,
          isPlatformAdmin: invitation.grantsPlatformAdmin,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedById: user.id },
      });

      if (invitation.projectId) {
        await tx.membership.create({
          data: {
            projectId: invitation.projectId,
            userId: user.id,
            role: invitation.role,
            invitedById: invitation.createdById,
          },
        });
      }

      return user.id;
    });

    return { ok: true, userId, projectSlug: invitation.project?.slug ?? null };
  } catch (error) {
    if (error instanceof Error && error.message === "used") {
      return { ok: false, error: "That invitation has already been used." };
    }
    throw error;
  }
}

export async function revokeInvitation(id: string): Promise<void> {
  await db.invitation.updateMany({
    where: { id, acceptedAt: null },
    data: { revokedAt: new Date() },
  });
}
