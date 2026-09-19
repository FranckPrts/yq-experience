"use client";

import { useEffect, useMemo, useState } from "react";
import { indexPlanets, type PlanetById } from "@/lib/leaderboard";
import { listPlanets, normalizePlanet } from "@/lib/planets";
import { listSessionScores } from "@/lib/session-scores";
import { createClient } from "@/utils/supabase/client";
import type { Planet } from "@/lib/types/planet";
import type { SessionScore } from "@/lib/types/session-score";

type Scoreboard = {
  scores: SessionScore[];
  /** Newest first, as the query returns them. */
  planets: Planet[];
  planetById: PlanetById;
  loading: boolean;
  error: string | null;
};

/**
 * Every score plus the planets they point at, kept live.
 *
 * Scores arrive mid-exhibit, so both boards subscribe rather than snapshot —
 * a new run re-ranks the list under the reader. Planets ride along too, so a
 * renamed or freshly created one stops reading as "unknown planet".
 */
export function useScoreboard(): Scoreboard {
  const [scores, setScores] = useState<SessionScore[]>([]);
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([listPlanets(), listSessionScores()])
      .then(([planetRows, scoreRows]) => {
        if (cancelled) return;
        setPlanets(planetRows);
        setScores(scoreRows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "failed to load scores");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const supabase = createClient();
    const channel = supabase
      .channel("scoreboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_scores" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const row = payload.old as SessionScore;
            setScores((prev) => prev.filter((s) => s.id !== row.id));
            return;
          }
          const row = payload.new as SessionScore;
          setScores((prev) =>
            prev.some((s) => s.id === row.id)
              ? prev.map((s) => (s.id === row.id ? row : s))
              : [row, ...prev],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planets" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const row = payload.old as Planet;
            setPlanets((prev) => prev.filter((p) => p.id !== row.id));
            return;
          }
          const row = normalizePlanet(payload.new);
          setPlanets((prev) =>
            prev.some((p) => p.id === row.id)
              ? prev.map((p) => (p.id === row.id ? row : p))
              : [row, ...prev],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  const planetById = useMemo(() => indexPlanets(planets), [planets]);

  return { scores, planets, planetById, loading, error };
}
