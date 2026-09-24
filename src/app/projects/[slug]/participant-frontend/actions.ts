"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { coerceLexicon, coerceTheme, FONTS } from "@/lib/theme/project-theme";
import { COPY_FIELDS, coerceCopy } from "@/lib/theme/project-copy";

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

/**
 * Saves the participant-facing copy. Parsed field by field through
 * `coerceCopy`, so only known keys are stored, each trimmed and length-capped —
 * the form cannot smuggle extra fields into the project row.
 */
export async function saveCopy(
  _prev: AppearanceState,
  formData: FormData,
): Promise<AppearanceState> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId } = await requireProjectRole(slug, "COLLABORATOR");

  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(COPY_FIELDS)) raw[key] = formData.get(key);
  raw.introEnabled = formData.get("introEnabled") === "on";

  await db.project.update({
    where: { id: projectId },
    data: { copy: coerceCopy(raw) },
  });

  revalidatePath(`/projects/${slug}/participant-frontend`);
  revalidatePath(`/e/${slug}`);
  return { saved: true };
}
