import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";

/**
 * Packing a visual as a zip.
 *
 * A visual is a *pair* — a sketch and the declaration describing its controls —
 * and the two only make sense together. Handing over one file at a time invites
 * someone to edit the sketch, forget the declaration, and discover the mismatch
 * at upload. One archive keeps them together.
 *
 * `fflate` rather than a hand-rolled writer: a subtly malformed zip is a
 * miserable thing to debug, and this is 8KB with no dependencies of its own.
 */

const STARTER_DIR = path.join(process.cwd(), "visuals", "starter");

export type BundleFile = { name: string; content: string };

export function zipFiles(files: BundleFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file.name] = strToU8(file.content);
  // level 6 is the usual default: these are small text files, so the tradeoff
  // barely registers either way.
  return zipSync(entries, { level: 6 });
}

export async function starterFile(
  which: "sketch" | "parameters" | "readme",
): Promise<string> {
  const name =
    which === "sketch"
      ? "sketch.js"
      : which === "parameters"
        ? "parameters.json"
        : "README.md";
  return readFile(path.join(STARTER_DIR, name), "utf8");
}

export async function starterBundle(): Promise<BundleFile[]> {
  const [sketch, parameters, readme] = await Promise.all([
    starterFile("sketch"),
    starterFile("parameters"),
    starterFile("readme"),
  ]);
  return [
    { name: "sketch.js", content: sketch },
    { name: "parameters.json", content: parameters },
    { name: "README.md", content: readme },
  ];
}

/** A short note packed with a downloaded project script, so it is self-explaining. */
export function projectReadme(opts: {
  projectName: string;
  slug: string;
  version: number;
}): string {
  return `# ${opts.projectName} — script v${opts.version}

Downloaded from the project "${opts.slug}".

    sketch.js         the p5 sketch as it is running
    parameters.json   the controls the participant gets

Edit either, then upload both back on the project's settings page. Uploading
adds a new version rather than replacing this one, so you can always promote an
earlier version if something goes wrong.

Leaving parameters.json out of an upload keeps the declaration currently in use,
which is what you want when you have only changed the sketch.

The contract the sketch follows — global mode, the \`data\` global, host-only
knobs, and why shaders are inlined rather than loaded — is documented in the
starter bundle, downloadable from the same page.
`;
}
