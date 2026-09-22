"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";

export type SettingsState = { saved?: boolean; error?: string };

/**
 * Every action re-authorises. The role required differs by what is being
 * changed, mirroring `YQVisual.ts`'s split: a collaborator may edit the content
 * of a project, but the fields that decide who sees it — its name in a URL, and
 * whether participants can reach it at all — stay with the owner.
 */

export async function renameProject(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId } = await requireProjectRole(slug, "OWNER");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "A project needs a name." };
  if (name.length > 120) return { error: "That name is too long." };

  // The slug is deliberately left alone: it is in participant URLs, and a link
  // handed out at an event must not stop working because someone fixed a typo.
  await db.project.update({ where: { id: projectId }, data: { name } });

  revalidatePath(`/projects/${slug}`);
  return { saved: true };
}

export async function setOpenForParticipation(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId } = await requireProjectRole(slug, "OWNER");
  const open = formData.get("open") === "true";

  await db.project.update({
    where: { id: projectId },
    data: { openForParticipation: open },
  });

  revalidatePath(`/projects/${slug}`);
}
