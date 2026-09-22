import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The starter visual, read from `visuals/starter/`.
 *
 * It lives on disk as a real visual rather than as a string in this file, so
 * `npm run visual:check visuals/starter` validates it with the same tooling as
 * everything else. A starter that has quietly drifted out of step with the
 * declaration format is worse than no starter at all.
 */

const STARTER_DIR = path.join(process.cwd(), "visuals", "starter");

export async function starterFile(
  which: "sketch" | "parameters",
): Promise<string> {
  const name = which === "sketch" ? "sketch.js" : "parameters.json";
  return readFile(path.join(STARTER_DIR, name), "utf8");
}
