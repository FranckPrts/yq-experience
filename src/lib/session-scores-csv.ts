import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Server-side relative path from process.cwd(); public URL is /experiment-snapshot/... */
export const SESSION_SCORES_CSV_PATH =
  "public/experiment-snapshot/session_scores_rows_aug_5_2026.csv";

export type SessionScoreCsvRow = {
  id: string;
  yq_session_id: string;
  planet_a_id: string;
  planet_b_id: string;
  score: number;
  strategy: string;
  strategy_bin: string;
};

/**
 * Minimal CSV line split that respects double-quoted fields (strategies often
 * contain commas).
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

function parseCsv(filename: string): {
  headers: string[];
  rows: string[][];
} {
  const raw = readFileSync(join(process.cwd(), filename), "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(splitCsvLine);
  return { headers, rows };
}

/** Full session-score rows from the exported CSV (for charts + ownership marks). */
export function loadSessionScoreRowsFromCsv(
  filename = SESSION_SCORES_CSV_PATH,
): SessionScoreCsvRow[] {
  const { headers, rows } = parseCsv(filename);
  const idx = (name: string) => headers.indexOf(name);

  const idI = idx("id");
  const yqI = idx("yq_session_id");
  const aI = idx("planet_a_id");
  const bI = idx("planet_b_id");
  const scoreI = idx("score");
  const strategyI = idx("strategy");
  const binI = idx("strategy_bin");

  if (scoreI < 0 || aI < 0 || bI < 0) {
    throw new Error(
      `CSV is missing required columns (score, planet_a_id, planet_b_id): ${filename}`,
    );
  }

  const out: SessionScoreCsvRow[] = [];
  for (const cols of rows) {
    const score = Number(cols[scoreI]);
    if (!Number.isFinite(score)) continue;
    out.push({
      id: cols[idI] ?? "",
      yq_session_id: cols[yqI] ?? "",
      planet_a_id: cols[aI] ?? "",
      planet_b_id: cols[bI] ?? "",
      score,
      strategy: cols[strategyI] ?? "",
      strategy_bin: cols[binI] ?? "",
    });
  }
  return out;
}

/** Load numeric scores from the exported session_scores CSV under public/. */
export function loadSessionScoresFromCsv(
  filename = SESSION_SCORES_CSV_PATH,
): number[] {
  return loadSessionScoreRowsFromCsv(filename).map((r) => r.score);
}
