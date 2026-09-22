import { db } from "@/lib/db";
import { validateParameters } from "@/lib/params/validate";
import type { Parameter } from "@/lib/params/types";

/**
 * Loading a project the way the participant runtime will: the project, its
 * active script, and the declaration that drives the controls.
 *
 * "Active" is the highest script version, which is what makes uploads
 * append-only and a bad one reversible.
 */

export type LoadedProject = {
  id: string;
  slug: string;
  name: string;
  openForParticipation: boolean;
  lexicon: { noun: string; nounPlural: string };
  script: {
    label: string | null;
    version: number;
    code: string;
    parameters: Parameter[];
    extensions: { url: string }[];
  } | null;
  /** Non-empty when the stored declaration fails validation. */
  declarationErrors: string[];
};

const FALLBACK_LEXICON = { noun: "avatar", nounPlural: "avatars" };

function asLexicon(value: unknown): { noun: string; nounPlural: string } {
  if (value && typeof value === "object") {
    const l = value as Record<string, unknown>;
    if (typeof l.noun === "string" && typeof l.nounPlural === "string") {
      return { noun: l.noun, nounPlural: l.nounPlural };
    }
  }
  return FALLBACK_LEXICON;
}

export async function listProjects() {
  return db.project.findMany({
    select: { slug: true, name: true, openForParticipation: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * `slug` picks a project explicitly. With none, the most recently created one
 * wins — so a project made a minute ago is the one you are looking at.
 */
export async function getProject(slug?: string): Promise<LoadedProject | null> {
  const project = await db.project.findFirst({
    where: slug ? { slug } : undefined,
    orderBy: slug ? undefined : { createdAt: "desc" },
    include: {
      scripts: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!project) return null;

  const stored = project.scripts[0];
  // Validate on read, not just on write: a declaration can be edited straight
  // in the database, and a broken one should say so rather than render a
  // controls panel with silent holes in it.
  const declarationErrors = stored
    ? validateParameters(stored.parameters)
    : ["no script uploaded"];

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    openForParticipation: project.openForParticipation,
    lexicon: asLexicon(project.lexicon),
    script: stored
      ? {
          label: stored.label,
          version: stored.version,
          code: stored.code,
          parameters: stored.parameters as unknown as Parameter[],
          extensions: (stored.extensions ?? []) as { url: string }[],
        }
      : null,
    declarationErrors,
  };
}
