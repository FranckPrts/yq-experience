"use client";

import { TermRule } from "@/components/terminal";
import {
  formatRank,
  formatScore,
  formatTime,
  type LeaderboardRow,
} from "@/lib/leaderboard";

/**
 * The scoreboard, shared by the global board and a participant's own results.
 * Terminal chrome like the rest of the participant flow: hyphen rules instead
 * of borders, a fixed rank rail on the left, the score alone on the right.
 *
 * Each pair reads as `star / star`, both names in their own star's ink.
 */

/** Rank column plus the row gap — sub-lines hang off the same left rail. */
const RAIL = "pl-[calc(2ch+0.75rem)]";

function Row({ row }: { row: LeaderboardRow }) {
  const [a, b] = row.planets;

  return (
    <li>
      <TermRule />
      <div className="py-5">
        <div className="flex items-baseline gap-3">
          <span className="w-[2ch] shrink-0 text-sm tabular-nums text-dim">
            {formatRank(row.rank)}
          </span>
          <p className="min-w-0 flex-1 text-base leading-snug">
            <span style={{ color: a.ink }}>{a.name}</span>
            <span className="px-1.5 text-dim">/</span>
            <span style={{ color: b.ink }}>{b.name}</span>
          </p>
          {/* Margin, not padding — `w-[5ch]` is border-box and `100.0` needs it all. */}
          <span className="ml-1 w-[5ch] shrink-0 text-right text-lg tabular-nums">
            {formatScore(row.score)}
          </span>
        </div>

        <div className={`mt-1.5 ${RAIL}`}>
          <p className="text-xs tabular-nums text-dim">
            {formatTime(row.recordedAt)}
          </p>
          {/* Absent until the strategy column lands — the row just closes up. */}
          {row.strategy && (
            <p className="mt-2.5 max-w-[38ch] text-sm leading-relaxed text-dim">
              {row.strategy}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export default function Leaderboard({
  rows,
  emptyMessage,
}: {
  rows: LeaderboardRow[];
  emptyMessage: string;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 pb-3 text-xs text-dim">
        <span aria-hidden className="w-[2ch] shrink-0" />
        <span className="min-w-0 flex-1">pair</span>
        <span className="w-[5ch] shrink-0 text-right">score</span>
      </div>

      {rows.length === 0 ? (
        <>
          <TermRule />
          <p className="max-w-[34ch] py-6 text-sm leading-relaxed text-dim">
            {emptyMessage}
          </p>
        </>
      ) : (
        <ul>
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      )}

      <TermRule />
    </section>
  );
}
