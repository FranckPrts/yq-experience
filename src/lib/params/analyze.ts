import type { Parameter } from "./types";
import { isRenderParam } from "./types";

/**
 * A cheap, deliberately heuristic cross-check between a declaration and the
 * script it describes.
 *
 * It answers two questions an upload should not have to discover at render
 * time: did we declare a control the sketch never reads, and does the sketch
 * read a knob nobody declared?
 *
 * Both are **warnings, never errors**. A sketch is free to compute a name, and
 * the second case is often deliberate — the fish school reads `size`,
 * `intensity` and `center_y` on purpose and leaves them at its own defaults.
 * Blocking an upload on a regex would be worse than saying nothing.
 */

export type ScriptAnalysis = {
  /** Declared, but no mention found in the script. Likely a typo in the name. */
  declaredButUnread: string[];
  /** Read by the script but not declared — falls back to the sketch's default. */
  readButUndeclared: string[];
};

/** Names the script appears to pull out of its params object. */
function namesReadBy(code: string): Set<string> {
  const found = new Set<string>();
  // `raw.foo` / `data.foo` — the shape both our sketches use via `knobs()`.
  for (const m of code.matchAll(/\b(?:raw|data|params)\.([A-Za-z_$][\w$]*)/g)) {
    found.add(m[1]);
  }
  // `data["foo"]` / `raw['foo']`
  for (const m of code.matchAll(
    /\b(?:raw|data|params)\[\s*["']([^"']+)["']\s*\]/g,
  )) {
    found.add(m[1]);
  }
  return found;
}

export function analyzeScript(
  code: string,
  parameters: Parameter[],
): ScriptAnalysis {
  const read = namesReadBy(code);
  // Only render parameters reach the sketch; `text` answers never do, so their
  // absence from the code is expected rather than suspicious.
  const declared = parameters.filter(isRenderParam).map((p) => p.name);
  const declaredSet = new Set(declared);

  return {
    declaredButUnread: declared.filter((name) => !read.has(name)),
    readButUndeclared: [...read].filter((name) => !declaredSet.has(name)),
  };
}
