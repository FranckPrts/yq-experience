"use client";

import { useMemo } from "react";
import ScoreHistogram from "@/components/ScoreHistogram";
import {
  strategyBinStats,
  strategyInsights,
  topSessions,
  STRATEGY_BIN_LABELS,
} from "@/lib/conclusion-insights";
import type { SessionScoreCsvRow } from "@/lib/session-scores-csv";
import { useMyPlanets } from "@/lib/use-my-planets";

type ConclusionChartsProps = {
  rows: SessionScoreCsvRow[];
  /** Explicit session_scores.id values from /results (?run=). */
  runIds?: string[];
  /** Explicit planet UUIDs from /results (?planet=). */
  planetIds?: string[];
};

/**
 * 1970s-style score distribution plate, plus who did best and strategy
 * takeaways. Red dotted lines mark sessions that belong to this participant —
 * preferring IDs passed in the URL, falling back to planets authored on this
 * device.
 */
export default function ConclusionCharts({
  rows,
  runIds = [],
  planetIds = [],
}: ConclusionChartsProps) {
  const { myPlanets, planetById, loading } = useMyPlanets();

  const scores = useMemo(() => rows.map((r) => r.score), [rows]);

  const highlightScores = useMemo(() => {
    const explicitRuns = new Set(runIds);
    const explicitPlanets = new Set(planetIds);
    const hasExplicit =
      explicitRuns.size > 0 || explicitPlanets.size > 0;

    if (hasExplicit) {
      return rows
        .filter(
          (r) =>
            (r.id.length > 0 && explicitRuns.has(r.id)) ||
            explicitPlanets.has(r.planet_a_id) ||
            explicitPlanets.has(r.planet_b_id),
        )
        .map((r) => r.score);
    }

    if (myPlanets.length === 0) return [];
    const mine = new Set(myPlanets.map((p) => p.id));
    return rows
      .filter((r) => mine.has(r.planet_a_id) || mine.has(r.planet_b_id))
      .map((r) => r.score);
  }, [rows, runIds, planetIds, myPlanets]);

  const leaders = useMemo(
    () => topSessions(rows, planetById, 5),
    [rows, planetById],
  );

  const binStats = useMemo(() => strategyBinStats(rows), [rows]);
  const insights = useMemo(() => strategyInsights(rows), [rows]);

  const usingExplicitIds = runIds.length > 0 || planetIds.length > 0;

  return (
    <div className="mt-4 flex flex-col gap-12">
      <div className="flex flex-col gap-10">
        <section>
          <p className="mb-2 text-xs text-dim">
            fig. 1 — histogram · hover a bin
          </p>
          <div>
            <ScoreHistogram
              scores={scores}
              highlightScores={highlightScores}
              binWidth={4}
            />
          </div>
        </section>

        <p className="max-w-[40ch] text-xs leading-relaxed text-dim">
          {loading && !usingExplicitIds
            ? "loading your stars…"
            : highlightScores.length > 0
              ? `red dotted lines mark your ${highlightScores.length} run${highlightScores.length === 1 ? "" : "s"}`
              : usingExplicitIds
                ? "your runs are not in this export yet — red marks appear once the snapshot includes them"
                : "no runs with your stars in this export — red marks appear when you take part"}
        </p>
      </div>

      <section>
        <h3 className="text-sm text-dim">who did best</h3>
        <ol className="mt-4 flex list-none flex-col gap-4 p-0">
          {leaders.map((row, i) => (
            <li key={row.id} className="text-sm leading-relaxed">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-dim tabular-nums">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">
                  {row.planetA.name}
                  <span className="text-dim"> / </span>
                  {row.planetB.name}
                </span>
                <span className="shrink-0 tabular-nums">{row.score}</span>
              </div>
              {row.strategy ? (
                <p className="mt-1 max-w-[42ch] pl-5 text-xs leading-relaxed text-dim">
                  {row.strategy}
                  {row.strategy_bin
                    ? ` · ${STRATEGY_BIN_LABELS[row.strategy_bin] ?? row.strategy_bin}`
                    : ""}
                </p>
              ) : (
                <p className="mt-1 pl-5 text-xs text-dim">strategy unrecorded</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="text-sm text-dim">strategy insights</h3>
        <ul className="mt-4 flex list-none flex-col gap-3 p-0">
          {insights.map((line) => (
            <li
              key={line}
              className="max-w-[42ch] text-sm leading-relaxed text-paper/90"
            >
              {line}
            </li>
          ))}
        </ul>

        {binStats.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm text-dim">mean score by strategy</h3>
            <ul className="mt-3 flex list-none flex-col gap-1.5 p-0 text-xs">
              {binStats.map((s) => {
                const peakMean = binStats[0]?.mean || 1;
                const widthPct = Math.max(
                  4,
                  Math.round((s.mean / peakMean) * 100),
                );
                return (
                  <li key={s.bin} className="relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-paper/20"
                      style={{ width: `${widthPct}%` }}
                      aria-hidden
                    />
                    <div className="relative flex items-baseline justify-between gap-3 px-2 py-1.5">
                      <span className="min-w-0 truncate text-dim">
                        {s.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-paper">
                        {s.mean.toFixed(0)}
                        <span className="text-dim"> · n={s.n}</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
