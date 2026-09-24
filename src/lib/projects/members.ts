import "server-only";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

/**
 * Changing who belongs to a project.
 *
 * One invariant governs all of it: **a project always has at least one owner.**
 * An ownerless project cannot be opened, closed, connected or deleted by anyone
 * short of a platform admin, and would be discovered at the worst moment. Every
 * change below is checked against that inside the same transaction that makes
 * it, so two owners removing each other at once cannot both succeed.
 *
 * `Project.ownerId` is the project's *primary* owner — the foreign key that
 * stops an owning account being deleted out from under a live project. When the
 * person it points at stops being an owner, it moves to one who still is, so the
 * column never names someone with no standing in the project.
 */

export type MemberChange = { ok: true } | { ok: false; error: string };

async function remainingOwners(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  projectId: string,
  excludingUserId: string,
) {
  return tx.membership.findMany({
    where: { projectId, role: "OWNER", userId: { not: excludingUserId } },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
}

async function reassignPrimaryIfNeeded(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  projectId: string,
  departingUserId: string,
  successorUserId: string,
) {
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (project.ownerId === departingUserId) {
    await tx.project.update({
      where: { id: projectId },
      data: { ownerId: successorUserId },
    });
  }
}

export async function changeMemberRole(
  projectId: string,
  userId: string,
  role: Role,
): Promise<MemberChange> {
  return db.$transaction(async (tx) => {
    const member = await tx.membership.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) return { ok: false, error: "That person is not a member." };
    if (member.role === role) return { ok: true };

    if (member.role === "OWNER" && role !== "OWNER") {
      const others = await remainingOwners(tx, projectId, userId);
      if (others.length === 0) {
        return {
          ok: false,
          error:
            "This is the only owner. Make someone else an owner first, so the project is never left without one.",
        };
      }
      await reassignPrimaryIfNeeded(tx, projectId, userId, others[0].userId);
    }

    await tx.membership.update({ where: { id: member.id }, data: { role } });
    return { ok: true };
  });
}

export async function removeMember(
  projectId: string,
  userId: string,
): Promise<MemberChange> {
  return db.$transaction(async (tx) => {
    const member = await tx.membership.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) return { ok: false, error: "That person is not a member." };

    if (member.role === "OWNER") {
      const others = await remainingOwners(tx, projectId, userId);
      if (others.length === 0) {
        return {
          ok: false,
          error:
            "This is the only owner. Make someone else an owner first, so the project is never left without one.",
        };
      }
      await reassignPrimaryIfNeeded(tx, projectId, userId, others[0].userId);
    }

    await tx.membership.delete({ where: { id: member.id } });
    // Removal takes effect on sessions they already hold: every request
    // re-reads membership through `requireProjectRole`, so there is nothing
    // cached to invalidate — their next click simply finds nothing.
    return { ok: true };
  });
}
