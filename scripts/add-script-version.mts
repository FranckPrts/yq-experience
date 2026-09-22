/**
 * Uploads a visual directory to an existing project as a new script version,
 * because Phase 2's upload UI does not exist yet. It calls the same
 * `addScriptVersion` the UI will.
 *
 *   npx tsx scripts/add-script-version.mts \
 *     --project fish-school-pw-2026 \
 *     --script visuals/fish-school
 *
 * Versions are appended, never overwritten, so a bad upload is undone by
 * uploading the previous directory again — nothing is lost, and the harness
 * simply follows the highest version.
 *
 * This exists because the declaration on disk is not what anything renders:
 * `/dev/sketch` and the participant runtime both read the copy stored with the
 * project. Editing `parameters.json` changes nothing until it is uploaded here.
 */

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db.ts";
import { addScriptVersion } from "../src/lib/projects/create-project.ts";
import { assertValidDefinition } from "../src/lib/params/validate.ts";
import type { Parameter, VisualDefinition } from "../src/lib/params/types.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function loadDeclaration(dir: string): Promise<VisualDefinition> {
  const file = path.join(dir, "parameters.json");
  if (!existsSync(file)) throw new Error(`No parameters.json in ${dir}`);
  return JSON.parse(await readFile(file, "utf8")) as VisualDefinition;
}

/** `name (type)` for one parameter, which is what a reader needs to spot a change. */
function describe(p: Parameter): string {
  return `${p.name} (${p.type})`;
}

async function main() {
  const slug = arg("project");
  const scriptDir = arg("script");

  if (!slug || !scriptDir) {
    console.error(
      "Required: --project <slug> --script <visual directory>\n" +
        "  e.g. --project fish-school-pw-2026 --script visuals/fish-school",
    );
    process.exit(1);
  }

  const project = await db.project.findFirst({
    where: { slug },
    include: { scripts: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!project) throw new Error(`No project with slug "${slug}"`);

  const dir = path.resolve(process.cwd(), scriptDir);
  const code = await readFile(path.join(dir, "sketch.js"), "utf8");
  const parsed = await loadDeclaration(dir);

  // Fail here rather than at render: a malformed entry shows up as a missing
  // control or a slider pinned to its default, which is nearly invisible.
  assertValidDefinition(parsed);

  const previous = project.scripts[0];
  const before = ((previous?.parameters ?? []) as unknown as Parameter[]) ?? [];
  const after = parsed.parameters;

  const beforeNames = new Set(before.map((p) => p.name));
  const afterNames = new Set(after.map((p) => p.name));
  const added = after.filter((p) => !beforeNames.has(p.name));
  const removed = before.filter((p) => !afterNames.has(p.name));

  const created = await addScriptVersion(project.id, {
    label: path.basename(dir),
    code,
    parameters: after,
  });

  console.log(`\n  Project "${project.name}" (${project.slug})`);
  console.log(
    `    script        ${created.label} v${previous?.version ?? 0} → v${created.version}`,
  );
  console.log(`    parameters    ${before.length} → ${after.length}`);
  if (added.length) console.log(`    added         ${added.map(describe).join(", ")}`);
  if (removed.length) console.log(`    removed       ${removed.map(describe).join(", ")}`);
  if (!added.length && !removed.length) {
    console.log(`    names         unchanged (ordering or options may still differ)`);
  }

  // The lexicon rides along in the declaration file but belongs to the project
  // record, so this never rewrites it silently — it only says when they drift.
  const lexicon = parsed.lexicon;
  const stored = project.lexicon as { noun?: string } | null;
  if (lexicon && stored?.noun && lexicon.noun !== stored.noun) {
    console.log(
      `    lexicon       declaration says "${lexicon.noun}", project says "${stored.noun}" — left as the project has it`,
    );
  }
  console.log(`\n  Reload /dev/sketch?project=${project.slug} to see it.\n`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
