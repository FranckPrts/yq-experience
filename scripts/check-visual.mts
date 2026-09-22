/** Dry-runs a visual directory: loads its declaration and validates it. */
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { validateParameters } from "../src/lib/params/validate.ts";
import type { VisualDefinition, Parameter } from "../src/lib/params/types.ts";

const dir = path.resolve(process.cwd(), process.argv[2]);
const json = path.join(dir, "parameters.json");
if (!existsSync(json)) throw new Error(`No parameters.json in ${dir}`);
const def: VisualDefinition = JSON.parse(await readFile(json, "utf8"));
const from = "parameters.json";
const code = await readFile(path.join(dir, "sketch.js"), "utf8");
const errors = validateParameters(def.parameters);
const ps = def.parameters as Parameter[];
const render = ps.filter(p => p.type !== "text");
const declared = new Set(render.map(p => p.name));
const read = new Set([...code.matchAll(/raw\.([a-z_0-9]+)/g)].map(m => m[1]));

console.log(`${path.basename(dir)}  (${from})`);
console.log(`  sketch          ${(code.length/1024).toFixed(1)} KB`);
console.log(`  lexicon         ${def.lexicon ? `${def.lexicon.noun} / ${def.lexicon.nounPlural}` : "none"}`);
console.log(`  parameters      ${ps.length} (${render.length} render + ${ps.length-render.length} text)`);
console.log(`  types used      ${[...new Set(ps.map(p=>p.type))].join(", ")}`);
console.log(`  validation      ${errors.length ? errors.length + " ERROR(S)" : "clean"}`);
errors.forEach(e => console.log(`    - ${e}`));
const unread = [...declared].filter(n => !read.has(n));
const undeclared = [...read].filter(n => !declared.has(n));
console.log(`  declared→sketch ${unread.length ? "UNREAD: " + unread.join(", ") : "all read"}`);
console.log(`  sketch→declared ${undeclared.length ? "falls back to sketch defaults: " + undeclared.join(", ") : "none"}`);
