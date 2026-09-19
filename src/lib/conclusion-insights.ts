import type { SessionScoreCsvRow } from "@/lib/session-scores-csv";
import type { PlanetById } from "@/lib/leaderboard";

export const STRATEGY_BIN_LABELS: Record<string, string> = {
  mutual_gaze: "mutual gaze",
  shared_mental_content: "shared mental content",
  closed_eye_stillness: "closed-eye stillness",
  rhythmic_motor_sync: "rhythmic motor sync",
  internal_sequencing_auditory: "internal sequencing / auditory",
};

export type StrategyBinStat = {
  bin: string;
  label: string;
  n: number;
  mean: number;
  max: number;
};

export type TopSession = {
  id: string;
  score: number;
  strategy: string;
  strategy_bin: string;
  planetA: { id: string; name: string };
  planetB: { id: string; name: string };
};

function planetName(id: string, planetById: PlanetById): string {
  return planetById.get(id)?.name ?? "unknown star";
}

/** Highest-scoring sessions from the CSV export, with live planet names. */
export function topSessions(
  rows: SessionScoreCsvRow[],
  planetById: PlanetById,
  limit = 5,
): TopSession[] {
  return [...rows]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      score: r.score,
      strategy: r.strategy.trim(),
      strategy_bin: r.strategy_bin,
      planetA: { id: r.planet_a_id, name: planetName(r.planet_a_id, planetById) },
      planetB: { id: r.planet_b_id, name: planetName(r.planet_b_id, planetById) },
    }));
}

/** Mean / max / n per strategy_bin (skips empty bins). */
export function strategyBinStats(rows: SessionScoreCsvRow[]): StrategyBinStat[] {
  const byBin = new Map<string, number[]>();
  for (const r of rows) {
    const bin = r.strategy_bin.trim();
    if (!bin) continue;
    const list = byBin.get(bin) ?? [];
    list.push(r.score);
    byBin.set(bin, list);
  }

  return [...byBin.entries()]
    .map(([bin, scores]) => ({
      bin,
      label: STRATEGY_BIN_LABELS[bin] ?? bin.replaceAll("_", " "),
      n: scores.length,
      mean: scores.reduce((a, b) => a + b, 0) / scores.length,
      max: Math.max(...scores),
    }))
    .sort((a, b) => b.mean - a.mean);
}

/**
 * Short takeaways from the labeled strategies in this export.
 * Written to read like figure captions, not a dashboard.
 */
export function strategyInsights(rows: SessionScoreCsvRow[]): string[] {
  const stats = strategyBinStats(rows);
  if (stats.length === 0) {
    return ["few strategies were labeled in this export — insights will deepen as more pairs write theirs down."];
  }

  const best = stats[0];
  const worst = stats[stats.length - 1];
  const labeled = rows.filter((r) => r.strategy_bin.trim());
  const unlabeled = rows.length - labeled.length;
  const top = [...rows].sort((a, b) => b.score - a.score)[0];

  const lines: string[] = [];

  lines.push(
    `${best.label} leads on average (${best.mean.toFixed(0)}), while ${worst.label} sits lowest (${worst.mean.toFixed(0)}).`,
  );

  if (top?.strategy) {
    const binLabel = top.strategy_bin
      ? STRATEGY_BIN_LABELS[top.strategy_bin] ?? top.strategy_bin
      : "unlabeled";
    lines.push(
      `the single best run (${top.score}) used ${binLabel}: “${top.strategy}”.`,
    );
  }
  return lines;
}
