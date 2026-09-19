"use client";

import { useMemo } from "react";
import type { PlanetById } from "@/lib/leaderboard";
import type { Planet } from "@/lib/types/planet";
import type { SessionScore } from "@/lib/types/session-score";
import { useStoredIdentity } from "@/lib/use-identity";
import { useScoreboard } from "@/lib/use-scoreboard";

/** One person, however many planets they made. Name and email don't vary. */
export type Creator = { name: string; email: string };

type MyPlanets = {
  /** This device's planets, oldest first — new ones append to the bottom. */
  myPlanets: Planet[];
  /** Taken from their newest planet; null until they have one. */
  creator: Creator | null;
  anonymousId: string | null;
  scores: SessionScore[];
  planetById: PlanetById;
  /** Covers reading localStorage as well as the fetch. */
  loading: boolean;
  error: string | null;
};

/**
 * Everything a participant-facing page needs: their own planets, plus the
 * whole board around them.
 *
 * Planets aren't tracked on the device — only the anonymous id is, and the
 * rows carry it. So "my planets" is a filter over the live list rather than a
 * separate query, and a planet created on another screen (or renamed in
 * admin) shows up here on its own.
 */
export function useMyPlanets(): MyPlanets {
  const { scores, planets, planetById, loading, error } = useScoreboard();
  const { anonymousId, hydrated } = useStoredIdentity();

  const myPlanets = useMemo(() => {
    if (!anonymousId) return [];
    return planets
      .filter((planet) => planet.anonymous_id === anonymousId)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  }, [planets, anonymousId]);

  const creator = useMemo<Creator | null>(() => {
    const newest = myPlanets[myPlanets.length - 1];
    if (!newest) return null;
    return { name: newest.creator_name, email: newest.creator_email };
  }, [myPlanets]);

  return {
    myPlanets,
    creator,
    anonymousId,
    scores,
    planetById,
    loading: loading || !hydrated,
    error,
  };
}
