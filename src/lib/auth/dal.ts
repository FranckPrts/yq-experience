import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession, type SessionUser } from "./session";
import type { Role } from "@/generated/prisma/enums";

/**
 * The data access layer — the one place that answers "who is this, and may
 * they?".
 *
 * Next's own guidance is the reason this exists rather than a check per page:
 * a Server Action is a POST endpoint against the page that declares it, and is
 * reachable by anyone who can send that POST. A page having checked says
 * nothing about the action beneath it. So **every** action and loader calls in
 * here for itself, and none of them trust the caller.
 *
 * `cache` memoizes within a single render pass, so a layout and three
 * components asking the same question cost one query.
 */

export const currentUser = cache(async (): Promise<SessionUser | null> => {
  return readSession();
});

export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    redirect(
      returnTo ? `/signin?next=${encodeURIComponent(returnTo)}` : "/signin",
    );
  }
  return user;
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  // Deliberately the same 404 a non-existent page gives: whether an admin area
  // exists is not something a signed-in non-admin needs confirmed.
  if (!user.isPlatformAdmin) notFound();
  return user;
}

const RANK: Record<Role, number> = {
  VIEWER: 1,
  COLLABORATOR: 2,
  OWNER: 3,
};

export type ProjectAccess = {
  user: SessionUser;
  projectId: string;
  slug: string;
  /** A platform admin gets OWNER-equivalent standing without a membership row. */
  role: Role;
  viaPlatformAdmin: boolean;
};

/**
 * Authorises the user for one project at or above `minimum`.
 *
 * Membership is the source of truth; ownership is not special-cased, because
 * `createProject` always writes an OWNER membership alongside `ownerId`.
 */
export async function requireProjectRole(
  slug: string,
  minimum: Role = "VIEWER",
): Promise<ProjectAccess> {
  // `/p/[id]` is the old single-tenant planet route; sending someone there
  // after sign-in would strand them.
  const user = await requireUser(`/projects/${slug}`);

  const project = await db.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      members: { where: { userId: user.id }, select: { role: true } },
    },
  });
  if (!project) notFound();

  const membership = project.members[0];

  if (user.isPlatformAdmin) {
    return {
      user,
      projectId: project.id,
      slug: project.slug,
      role: membership?.role ?? "OWNER",
      viaPlatformAdmin: !membership,
    };
  }

  // Not a member: answer exactly as if the project did not exist, so the set of
  // slugs in use cannot be probed by a signed-in stranger.
  if (!membership) notFound();
  if (RANK[membership.role] < RANK[minimum]) notFound();

  return {
    user,
    projectId: project.id,
    slug: project.slug,
    role: membership.role,
    viaPlatformAdmin: false,
  };
}

/** Projects the signed-in user can see. Platform admins see everything. */
export async function visibleProjects(user: SessionUser) {
  return db.project.findMany({
    where: user.isPlatformAdmin
      ? undefined
      : { members: { some: { userId: user.id } } },
    select: {
      slug: true,
      name: true,
      openForParticipation: true,
      members: { where: { userId: user.id }, select: { role: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
