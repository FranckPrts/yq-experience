"use client";

import { useMemo } from "react";
import Leaderboard from "@/components/Leaderboard";
import StarCanvasClient from "@/components/StarCanvasClient";
import { buildGlobalLeaderboard } from "@/lib/leaderboard";
import { PAPER_COLOR, VOID_COLOR } from "@/lib/theme";
import { useScoreboard } from "@/lib/use-scoreboard";

/**
 * The global board: every star's best run, ranked. Reached directly by URL —
 * it carries no navigation of its own.
 */
export default function LeaderboardPage() {
  const { scores, planetById, loading, error } = useScoreboard();

  const rows = useMemo(
    () => buildGlobalLeaderboard(scores, planetById),
    [scores, planetById],
  );

  return (
    <div
      className="font-terminal relative min-h-dvh"
      style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
    >
      {/* The same noisy void the flow sits on, with no star in it. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient intensity={0} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-16 pt-6">
        <header>
          <h1 className="text-lg">scoreboard</h1>
          <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-dim">
            the best run of every star, across the whole experience
          </p>
        </header>

        <div className="mt-10">
          {loading ? (
            <p className="text-sm text-dim">loading...</p>
          ) : (
            <Leaderboard
              rows={rows}
              emptyMessage="no runs recorded yet — the board fills in as pairs sync up"
            />
          )}
        </div>

        {error && <p className="mt-6 text-sm text-red-300">{error}</p>}
      </main>
    </div>
  );
}
