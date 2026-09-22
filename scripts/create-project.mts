/**
 * Creates a project from the command line, because Phase 2's setup UI does not
 * exist yet. It calls the same `createProject` the UI will, so nothing here is
 * throwaway scaffolding — this is the CLI face of the real path.
 *
 *   npx tsx scripts/create-project.mts \
 *     --owner you@example.com \
 *     --name "Nowadays · CCN 2026" \
 *     --supabase-url https://abc123.supabase.co \
 *     --publishable-key sb_publishable_... \
 *     --secret-key sb_secret_... \
 *     --script visuals/nowadays-star \
 *     --open
 *
 * `--owner` creates the user if they do not exist, printing a generated
 * password once. Secrets are read from argv or, better, from the environment:
 * SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY.
 */

import "dotenv/config";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { db } from "../src/lib/db.ts";
import { createProject } from "../src/lib/projects/create-project.ts";
import { assertValidDefinition } from "../src/lib/params/validate.ts";
import type { Parameter, VisualDefinition } from "../src/lib/params/types.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const flag = (name: string) => process.argv.includes(`--${name}`);

/**
 * Placeholder hashing so a seeded account can exist before Phase 1's auth
 * lands. Real sign-up uses argon2id; this is scrypt with a random salt, stored
 * in the same column, and every account made here should be re-hashed or
 * recreated once the auth path is real.
 */
/**
 * Declarations are JSON, and only JSON.
 *
 * An earlier version also accepted `parameters.js` with a default export, which
 * meant `import()`-ing it — executing a file in order to read a description of
 * some data. That is the wrong shape for a path that will one day take
 * tenant-delivered uploads, and having the CLI and the upload behave
 * differently is how a difference like that survives unnoticed. Prose that
 * needs saying goes in a README beside the file.
 */
async function loadDeclaration(dir: string): Promise<VisualDefinition> {
  const file = path.join(dir, "parameters.json");
  if (!existsSync(file)) {
    throw new Error(`No parameters.json in ${dir}`);
  }
  return JSON.parse(await readFile(file, "utf8")) as VisualDefinition;
}

function placeholderHash(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function main() {
  const ownerEmail = (arg("owner") ?? process.env.SEED_OWNER_EMAIL)
    ?.trim()
    .toLowerCase();
  const name = arg("name");

  if (!ownerEmail || !name) {
    console.error("Required: --owner <email> --name <project name>");
    process.exit(1);
  }

  // Also read .env.local, so the existing single-tenant CCN credentials can be
  // lifted into a project without being retyped. This is exactly the migration
  // those build-time env vars are supposed to make unnecessary.
  dotenv.config({ path: ".env.local", override: false, quiet: true });

  const supabaseUrl =
    arg("supabase-url") ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    arg("publishable-key") ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = arg("secret-key") ?? process.env.SUPABASE_SECRET_KEY;
  const scriptDir = arg("script");

  let owner = await db.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    const password = randomBytes(12).toString("base64url");
    owner = await db.user.create({
      data: { email: ownerEmail, passwordHash: placeholderHash(password) },
    });
    console.log(`\n  Created user ${ownerEmail}`);
    console.log(`  Temporary password (shown once): ${password}\n`);
  }

  let script: { label: string; code: string; parameters: Parameter[] } | undefined;
  let lexicon: unknown;
  if (scriptDir) {
    const dir = path.resolve(process.cwd(), scriptDir);
    const code = await readFile(path.join(dir, "sketch.js"), "utf8");
    const parsed = await loadDeclaration(dir);

    // Fail here rather than at render: a malformed entry shows up as a missing
    // control or a slider pinned to its default, which is nearly invisible.
    assertValidDefinition(parsed);

    script = {
      label: path.basename(dir),
      code,
      parameters: parsed.parameters,
    };
    // The declaration file carries the lexicon for convenience; on the record it
    // belongs to the project, not the script.
    lexicon = parsed.lexicon;
  }

  const project = await createProject({
    ownerId: owner.id,
    name,
    openForParticipation: flag("open"),
    lexicon,
    supabase: supabaseUrl
      ? { projectUrl: supabaseUrl, publishableKey, secretKey }
      : undefined,
    script,
  });

  console.log(`  Project "${project.name}"`);
  console.log(`    slug          ${project.slug}`);
  console.log(`    open          ${project.openForParticipation}`);
  console.log(
    `    supabase      ${project.connection ? `${project.connection.projectRef} (secret ${project.connection.secretKeyEnc ? "encrypted" : "absent"})` : "not connected"}`,
  );
  console.log(
    `    script        ${project.scripts[0] ? `${project.scripts[0].label} v${project.scripts[0].version}, ${(project.scripts[0].parameters as unknown[]).length} parameters` : "none"}`,
  );
  console.log(`    members       ${project.members.length}\n`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
