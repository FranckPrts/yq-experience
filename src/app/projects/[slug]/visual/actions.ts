"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { validateParameters } from "@/lib/params/validate";
import { analyzeScript } from "@/lib/params/analyze";
import { coerceLexicon } from "@/lib/theme/project-theme";
import type { Parameter, VisualDefinition } from "@/lib/params/types";

export type UploadState = {
  error?: string;
  /** Declaration problems, which block the upload. */
  problems?: string[];
  /** Cross-check findings, which do not. */
  warnings?: string[];
  uploaded?: { version: number; parameters: number };
};

/** Scripts are ~20KB; this is a sanity bound, not a target. */
const MAX_SCRIPT_BYTES = 2_000_000;

/**
 * Adds a new script version to a project.
 *
 * Uploads are append-only: this never overwrites: it adds `version + 1` and
 * lets the newest win. A bad upload mid-event is then undone by promoting an
 * earlier version rather than by finding the old file again.
 *
 * Declarations are **parsed, never executed** — `JSON.parse` and nothing else.
 * The CLI briefly accepted a `parameters.js` with a default export, which meant
 * `import()`-ing a delivered file; that path is gone precisely so this one
 * cannot inherit it.
 */
export async function uploadScript(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId, user } = await requireProjectRole(slug, "COLLABORATOR");

  const sketch = formData.get("sketch");
  const declaration = formData.get("declaration");
  const label = String(formData.get("label") ?? "").trim();

  if (!(sketch instanceof File) || sketch.size === 0) {
    return { error: "Choose a sketch.js file." };
  }
  if (sketch.size > MAX_SCRIPT_BYTES) {
    return { error: "That script is larger than 2 MB." };
  }

  const code = await sketch.text();
  if (!code.trim()) return { error: "That script file is empty." };

  // A p5 script in global mode has to define at least `draw`; catching this
  // here is friendlier than a blank canvas and a silent iframe.
  if (!/\bdraw\s*=|\bfunction\s+draw\b/.test(code)) {
    return {
      error:
        "That file does not look like a p5 sketch — no `draw` is defined. Global mode is required (`draw = () => { … }`).",
    };
  }

  let definition: VisualDefinition;
  if (declaration instanceof File && declaration.size > 0) {
    const text = await declaration.text();
    try {
      definition = JSON.parse(text) as VisualDefinition;
    } catch {
      return { error: "parameters.json is not valid JSON." };
    }
  } else {
    // No declaration supplied: keep the one already in use, so re-uploading a
    // tweaked sketch does not silently strip every control.
    const previous = await db.avatarScript.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      select: { parameters: true },
    });
    if (!previous) {
      return {
        error:
          "This project has no declaration yet, so a parameters.json is required with the first upload.",
      };
    }
    definition = { parameters: previous.parameters as unknown as Parameter[] };
  }

  const problems = validateParameters(definition.parameters);
  if (problems.length) {
    return { problems };
  }

  const parameters = definition.parameters;
  const analysis = analyzeScript(code, parameters);
  const warnings: string[] = [];
  if (analysis.declaredButUnread.length) {
    warnings.push(
      `Declared but not read by the sketch: ${analysis.declaredButUnread.join(", ")}. Check the names match.`,
    );
  }
  if (analysis.readButUndeclared.length) {
    warnings.push(
      `Read by the sketch but not declared: ${analysis.readButUndeclared.join(", ")}. These stay at the sketch's own defaults.`,
    );
  }

  const latest = await db.avatarScript.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  await db.avatarScript.create({
    data: {
      projectId,
      version,
      label: label || sketch.name.replace(/\.js$/i, "") || null,
      code,
      parameters: parameters as never,
      extensions: [],
      uploadedById: user.id,
    },
  });

  // A declaration carrying a lexicon updates the project's, since that is where
  // the lexicon lives — but only when one was actually supplied.
  if (declaration instanceof File && declaration.size > 0 && definition.lexicon) {
    await db.project.update({
      where: { id: projectId },
      data: { lexicon: coerceLexicon(definition.lexicon) },
    });
  }

  revalidatePath(`/projects/${slug}`);
  return {
    uploaded: { version, parameters: parameters.length },
    warnings: warnings.length ? warnings : undefined,
  };
}

/**
 * Promotes an earlier version by copying it to the top, rather than deleting
 * what came after. The history stays a record of what actually happened.
 */
export async function promoteScriptVersion(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const version = Number(formData.get("version"));
  const { projectId, user } = await requireProjectRole(slug, "COLLABORATOR");
  if (!Number.isInteger(version)) return;

  const source = await db.avatarScript.findFirst({
    where: { projectId, version },
  });
  if (!source) return;

  const latest = await db.avatarScript.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await db.avatarScript.create({
    data: {
      projectId,
      version: (latest?.version ?? 0) + 1,
      label: source.label ? `${source.label} (from v${source.version})` : null,
      code: source.code,
      parameters: source.parameters as never,
      extensions: source.extensions as never,
      uploadedById: user.id,
    },
  });

  revalidatePath(`/projects/${slug}`);
}
