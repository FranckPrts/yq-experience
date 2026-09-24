"use client";

import Link from "next/link";
import { useMemo } from "react";
import Leaderboard from "@/components/Leaderboard";
import StarCanvasClient from "@/components/StarCanvasClient";
import { TermLinkButton } from "@/components/terminal";
import { buildConclusionHref } from "@/lib/conclusion-params";
import { buildOwnLeaderboard } from "@/lib/leaderboard";
import { PAPER_COLOR, VOID_COLOR } from "@/lib/theme";
import { useMyPlanets } from "@/lib/use-my-planets";
import { hueToCss } from "@/lib/types/star";

const EMPTY_MESSAGE =
  "participate in the experience to start seeing your results with different pairs and strategies";

/**
 * A participant's own board: every run any of their stars took part in, best
 * first. Same component as the global page — the star on the left of each `/`
 * is always one of theirs, and its color says which.
 */
export default function ResultsPage() {
  const { myPlanets, scores, planetById, loading, error } = useMyPlanets();

  const planetIds = useMemo(
    () => new Set(myPlanets.map((planet) => planet.id)),
    [myPlanets],
  );

  const myScores = useMemo(
    () =>
      scores.filter(
        (s) => planetIds.has(s.planet_a_id) || planetIds.has(s.planet_b_id),
      ),
    [scores, planetIds],
  );

  const rows = useMemo(
    () => buildOwnLeaderboard(scores, planetById, planetIds),
    [scores, planetById, planetIds],
  );

  const conclusionHref = useMemo(
    () =>
      buildConclusionHref(
        myScores.map((s) => s.id),
        myPlanets.map((p) => p.id),
      ),
    [myScores, myPlanets],
  );

  const hasPostedResults = myScores.length > 0;

  return (
    <div
      className="font-terminal relative min-h-dvh"
      style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
    >
      {/* Grain only — the list is the subject here, not the star. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient intensity={0} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-16 pt-6">
        <header className="flex items-baseline justify-between gap-3">
          <h1 className="text-lg">your results</h1>
          <Link
            href="/"
            className="shrink-0 text-xs text-dim underline underline-offset-4 hover:text-paper/80"
          >
            back
          </Link>
        </header>

        {loading ? (
          <p className="mt-10 text-sm text-dim">loading...</p>
        ) : myPlanets.length === 0 ? (
          <div className="mt-10">
            <p className="max-w-[34ch] text-sm leading-relaxed text-dim">
              no star on this device yet — create one to take part in the
              experience
            </p>
            <Link
              href="/"
              className="mt-6 inline-block text-sm underline underline-offset-4"
            >
              create your star
            </Link>
          </div>
        ) : (
          <>
            {/* Which stars are yours, in their own ink — the same color they
                carry on the left of every row below. */}
            <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="shrink-0 text-sm text-dim">
                {myPlanets.length === 1 ? "star_name :" : "your stars :"}
              </span>
              {myPlanets.map((planet) => (
                <span
                  key={planet.id}
                  className="text-base"
                  style={{ color: hueToCss(planet.params.hue, 45, 90) }}
                  title={planet.name}
                >
                  {planet.name}
                </span>
              ))}
            </div>

            <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-dim">
              every pair you have synced with, best run first
            </p>

            {hasPostedResults && (
              <div className="mt-8 flex flex-col gap-4 border border-paper/25 px-4 py-4">
                <p className="max-w-[34ch] text-sm leading-relaxed">
                  {myScores.length === 1
                    ? "your result has been posted"
                    : `${myScores.length} results have been posted`}
                </p>
                <p className="max-w-[34ch] text-xs leading-relaxed text-dim">
                  see how your runs sit in the full score distribution
                </p>
                <TermLinkButton
                  href={conclusionHref}
                  className="w-full text-center"
                >
                  see the conclusion
                </TermLinkButton>
              </div>
            )}

            <div className="mt-10">
              <Leaderboard rows={rows} emptyMessage={EMPTY_MESSAGE} />
            </div>
          </>
        )}

        {error && <p className="mt-6 text-sm text-red-300">{error}</p>}
      </main>
    </div>
  );
}
