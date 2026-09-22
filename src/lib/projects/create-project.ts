import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { aadFor, CURRENT_KEY_VERSION, encryptSecret } from "@/lib/crypto/envelope";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { Parameter } from "@/lib/params/types";

export type SupabaseInput = {
  /** https://<ref>.supabase.co */
  projectUrl: string;
  /** Public by design — ships to participants, pasted into the scene script. */
  publishableKey?: string;
  /** Server-only. Encrypted at rest. */
  secretKey?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
};

export type ScriptInput = {
  label?: string;
  code: string;
  parameters: Parameter[];
  extensions?: { url: string }[];
};

export type NewProject = {
  ownerId: string;
  name: string;
  supabase?: SupabaseInput;
  script?: ScriptInput;
  theme?: unknown;
  lexicon?: unknown;
  openForParticipation?: boolean;
};

/** "https://abc123.supabase.co" → "abc123". */
export function projectRefFromUrl(projectUrl: string): string {
  const host = new URL(projectUrl).hostname;
  const ref = host.split(".")[0];
  if (!ref) throw new Error(`Cannot read a project ref from ${projectUrl}`);
  return ref;
}

/**
 * Creates a project with its owner membership, and optionally its Supabase
 * connection and first script, in one transaction — a half-made project with a
 * connection but no owner row would be unreachable through every access check
 * we are about to write.
 */
export async function createProject(input: NewProject) {
  // Only slugs sharing this base can collide, so there is no need to read the
  // whole table to pick a suffix.
  const base = slugify(input.name);
  const siblings = await db.project.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const slug = uniqueSlug(
    input.name,
    siblings.map((p) => p.slug),
  );

  return db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        slug,
        name: input.name,
        ownerId: input.ownerId,
        openForParticipation: input.openForParticipation ?? false,
        theme: (input.theme ?? undefined) as never,
        lexicon: (input.lexicon ?? undefined) as never,
        members: { create: { userId: input.ownerId, role: "OWNER" } },
      },
    });

    if (input.supabase) {
      const s = input.supabase;
      // The AAD binds each ciphertext to this row and column, so the id has to
      // exist before the secrets are sealed — hence generating it here rather
      // than letting the database default it.
      const connectionId = randomUUID();

      await tx.supabaseConnection.create({
        data: {
          id: connectionId,
          projectId: project.id,
          projectRef: projectRefFromUrl(s.projectUrl),
          projectUrl: s.projectUrl,
          publishableKey: s.publishableKey ?? null,
          keyVersion: CURRENT_KEY_VERSION,
          tokenExpiresAt: s.tokenExpiresAt ?? null,
          secretKeyEnc: s.secretKey
            ? encryptSecret(s.secretKey, aadFor(connectionId, "secretKey"))
            : null,
          accessTokenEnc: s.accessToken
            ? encryptSecret(s.accessToken, aadFor(connectionId, "accessToken"))
            : null,
          refreshTokenEnc: s.refreshToken
            ? encryptSecret(s.refreshToken, aadFor(connectionId, "refreshToken"))
            : null,
        },
      });
    }

    if (input.script) {
      await tx.avatarScript.create({
        data: {
          projectId: project.id,
          version: 1,
          label: input.script.label ?? null,
          code: input.script.code,
          parameters: input.script.parameters as never,
          extensions: (input.script.extensions ?? []) as never,
          uploadedById: input.ownerId,
        },
      });
    }

    return tx.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { connection: true, scripts: true, members: true },
    });
  });
}

/** Appends a new version rather than overwriting, so a bad upload is reversible. */
export async function addScriptVersion(projectId: string, script: ScriptInput, uploadedById?: string) {
  const latest = await db.avatarScript.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return db.avatarScript.create({
    data: {
      projectId,
      version: (latest?.version ?? 0) + 1,
      label: script.label ?? null,
      code: script.code,
      parameters: script.parameters as never,
      extensions: (script.extensions ?? []) as never,
      uploadedById: uploadedById ?? null,
    },
  });
}
