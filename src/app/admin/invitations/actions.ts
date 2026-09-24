"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import {
  createInvitation,
  invitationUrl,
  revokeInvitation,
} from "@/lib/auth/invitations";
import type { Role } from "@/generated/prisma/enums";
import { grantAdmin, revokeAdmin } from "@/lib/auth/admins";

export type InviteState = { url?: string; error?: string };

/**
 * Every action re-checks for itself. `requirePlatformAdmin` here is not
 * belt-and-braces over the page's check — it is the only check that matters,
 * because this POST endpoint is reachable without the page ever rendering.
 */
export async function createInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const admin = await requirePlatformAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const projectSlug = String(formData.get("projectSlug") ?? "");
  const role = String(formData.get("role") ?? "COLLABORATOR") as Role;
  const ttlDays = Number(formData.get("ttlDays") ?? 14);

  if (!["OWNER", "COLLABORATOR", "VIEWER"].includes(role)) {
    return { error: "Unknown role." };
  }

  let projectId: string | null = null;
  if (projectSlug) {
    const project = await db.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });
    if (!project) return { error: `No project with slug "${projectSlug}".` };
    projectId = project.id;
  }

  const { token } = await createInvitation({
    createdById: admin.id,
    email: email || null,
    projectId,
    role,
    ttlDays: Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 14,
  });

  revalidatePath("/admin/invitations");
  // Shown once. Only the hash is stored, so it cannot be displayed again later.
  return { url: invitationUrl(token) };
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await revokeInvitation(id);
  revalidatePath("/admin/invitations");
}

export type AdminState = { message?: string; error?: string };

/** Promote an existing account. Re-checks admin itself — this is a POST endpoint. */
export async function grantAdminAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requirePlatformAdmin();
  const result = await grantAdmin(String(formData.get("email") ?? ""));
  revalidatePath("/admin/invitations");
  return result.ok ? { message: result.message } : { error: result.error };
}

export async function revokeAdminAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const actor = await requirePlatformAdmin();
  const result = await revokeAdmin(String(formData.get("userId") ?? ""), actor.id);
  revalidatePath("/admin/invitations");
  return result.ok ? { message: result.message } : { error: result.error };
}
