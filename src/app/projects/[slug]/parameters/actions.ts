"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { validateParameters } from "@/lib/params/validate";
import { analyzeScript } from "@/lib/params/analyze";
import type { Parameter } from "@/lib/params/types";

export type SaveState = {
  error?: string;
  problems?: string[];
  warnings?: string[];
  saved?: { version: number };
};

/**
 * Saves an edited declaration as a **new script version**, carrying the current
 * code forward unchanged.
 *
 * Editing in place would have been less code, but it would also mean "active =
 * highest version" stopped describing what a participant sees, and that a
 * declaration change — which can break an experience just as thoroughly as a
 * code change — had no way back. A version is cheap; a mid-event mistake with
 * no undo is not.
 */
export async function saveParameters(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId, user } = await requireProjectRole(slug, "COLLABORATOR");

  const raw = String(formData.get("parameters") ?? "");
  let parameters: Parameter[];
  try {
    parameters = JSON.parse(raw) as Parameter[];
  } catch {
    return { error: "The declaration could not be read." };
  }

  // The browser validates as you type, but this is the check that counts — a
  // Server Action is a POST endpoint, reachable without the page that hosts it.
  const problems = validateParameters(parameters);
  if (problems.length) return { problems };

  const current = await db.avatarScript.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });
  if (!current) {
    return { error: "Upload a script before editing its parameters." };
  }

  const analysis = analyzeScript(current.code, parameters);
  const warnings: string[] = [];
  if (analysis.declaredButUnread.length) {
    warnings.push(
      `Declared but not read by the sketch: ${analysis.declaredButUnread.join(", ")}.`,
    );
  }
  if (analysis.readButUndeclared.length) {
    warnings.push(
      `Read by the sketch but not declared: ${analysis.readButUndeclared.join(", ")} — these stay at the sketch's own defaults.`,
    );
  }

  const version = current.version + 1;
  await db.avatarScript.create({
    data: {
      projectId,
      version,
      label: current.label,
      code: current.code,
      parameters: parameters as never,
      extensions: current.extensions as never,
      uploadedById: user.id,
    },
  });

  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/projects/${slug}/parameters`);
  return { saved: { version }, warnings: warnings.length ? warnings : undefined };
}
