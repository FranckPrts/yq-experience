"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { coerceLexicon, coerceTheme, FONTS } from "@/lib/theme/project-theme";

export type AppearanceState = { saved?: boolean; error?: string };

/**
 * Saves what a participant sees: the palette, the typeface, and the words.
 *
 * A collaborator may change all of it. This is content — what stays with the
 * owner is the project's name in a URL and whether participants can reach it
 * at all, both of which live on the project page.
 */
export async function saveAppearance(
  _prev: AppearanceState,
  formData: FormData,
): Promise<AppearanceState> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId } = await requireProjectRole(slug, "COLLABORATOR");

  const theme = coerceTheme({
    void: formData.get("void"),
    paper: formData.get("paper"),
    dim: formData.get("dim"),
    font: formData.get("font"),
  });

  const lexicon = coerceLexicon({
    noun: formData.get("noun"),
    nounPlural: formData.get("nounPlural"),
  });

  if (!(theme.font in FONTS)) return { error: "Unknown typeface." };

  await db.project.update({
    where: { id: projectId },
    data: { theme, lexicon },
  });

  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/projects/${slug}/participant-frontend`);
  return { saved: true };
}
