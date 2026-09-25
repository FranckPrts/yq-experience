"use server";

import { requireProjectRole } from "@/lib/auth/dal";
import { setStaged, unstageAll } from "@/lib/spoke/ops";

export type StageState = { error?: string };

/**
 * Collaborators and owners can stage; viewers can watch. Running the room at an
 * event is operational work, and it is exactly what a collaborator is for.
 *
 * No `revalidatePath`: the console learns about the change the same way it
 * learns about the scene un-staging a pair — from Realtime. Treating
 * `is_staged` as observed state rather than state we own is what keeps the two
 * writers from disagreeing.
 */
export async function stageAction(formData: FormData): Promise<StageState> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const staged = formData.get("staged") === "true";
  const { projectId } = await requireProjectRole(slug, "COLLABORATOR");

  const result = await setStaged(projectId, id, staged);
  return result.ok ? {} : { error: result.error };
}

export async function unstageAllAction(formData: FormData): Promise<StageState> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId } = await requireProjectRole(slug, "COLLABORATOR");

  const result = await unstageAll(projectId);
  return result.ok ? {} : { error: result.error };
}
