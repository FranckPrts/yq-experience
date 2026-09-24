"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRole } from "@/lib/auth/dal";
import {
  createInvitation,
  invitationUrl,
  revokeInvitation,
} from "@/lib/auth/invitations";
import { changeMemberRole, removeMember } from "@/lib/projects/members";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

/**
 * Managing co-tenants. Owner-only throughout — who can see and change a project
 * is exactly the kind of decision the owner/collaborator split exists to keep
 * with the owner.
 */

const ROLES: Role[] = ["OWNER", "COLLABORATOR", "VIEWER"];

export type InviteMemberState = { url?: string; error?: string };

export async function inviteMember(
  _prev: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId, user } = await requireProjectRole(slug, "OWNER");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "COLLABORATOR") as Role;
  if (!ROLES.includes(role)) return { error: "Unknown role." };

  // Pinned to an address, unlike a platform admin's link: a project owner is
  // handing access to *their* project, so the link should work for exactly the
  // person they meant and nobody who happens to see it forwarded.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter the email address of the person you are inviting." };
  }

  const { token } = await createInvitation({
    createdById: user.id,
    email,
    projectId,
    role,
  });

  revalidatePath(`/projects/${slug}`);
  // Shown once — only the hash is stored.
  return { url: invitationUrl(token) };
}

export async function revokeMemberInvite(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const { projectId } = await requireProjectRole(slug, "OWNER");

  // Scoped to this project, so an owner cannot revoke invitations to projects
  // they do not own by posting someone else's invitation id.
  const invitation = await db.invitation.findFirst({
    where: { id, projectId },
    select: { id: true },
  });
  if (invitation) await revokeInvitation(invitation.id);

  revalidatePath(`/projects/${slug}`);
}

export type MemberState = { error?: string };

export async function changeRoleAction(
  _prev: MemberState,
  formData: FormData,
): Promise<MemberState> {
  const slug = String(formData.get("slug") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const { projectId } = await requireProjectRole(slug, "OWNER");

  if (!ROLES.includes(role)) return { error: "Unknown role." };

  const result = await changeMemberRole(projectId, userId, role);
  revalidatePath(`/projects/${slug}`);
  return result.ok ? {} : { error: result.error };
}

export async function removeMemberAction(
  _prev: MemberState,
  formData: FormData,
): Promise<MemberState> {
  const slug = String(formData.get("slug") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const { projectId } = await requireProjectRole(slug, "OWNER");

  const result = await removeMember(projectId, userId);
  revalidatePath(`/projects/${slug}`);
  return result.ok ? {} : { error: result.error };
}
