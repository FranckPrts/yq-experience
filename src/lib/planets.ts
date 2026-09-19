import { createClient } from "@/utils/supabase/client";
import { MAX_STAGED } from "@/lib/constants";
import type {
  Planet,
  PlanetAnswers,
  PlanetInsert,
  PlanetUpdate,
} from "@/lib/types/planet";
import { toStarParams } from "@/lib/types/star";

/** Ensures answers jsonb is a plain object; arrays/scalars become `{}`. */
export function toPlanetAnswers(value: unknown): PlanetAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as PlanetAnswers) };
}

/**
 * Normalize jsonb columns on read: answers stay open-ended; params are
 * coerced into the fixed StarParams shape.
 */
export function normalizePlanet(row: unknown): Planet {
  const planet = row as Planet;
  return {
    ...planet,
    answers: toPlanetAnswers(planet.answers),
    params: toStarParams(planet.params),
  };
}

export async function listPlanets(): Promise<Planet[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizePlanet);
}

export async function getPlanet(id: string): Promise<Planet | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizePlanet(data) : null;
}

export async function createPlanet(payload: PlanetInsert): Promise<Planet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizePlanet(data);
}

export async function updatePlanet(
  id: string,
  payload: PlanetUpdate,
): Promise<Planet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return normalizePlanet(data);
}

export async function upsertPlanetById(
  id: string | null,
  payload: PlanetInsert,
): Promise<Planet> {
  if (id) {
    return updatePlanet(id, payload);
  }
  return createPlanet(payload);
}

export async function countStaged(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("planets")
    .select("*", { count: "exact", head: true })
    .eq("is_staged", true);

  if (error) throw error;
  return count ?? 0;
}

export async function setPlanetStaged(
  id: string,
  is_staged: boolean,
): Promise<Planet> {
  return updatePlanet(id, { is_staged });
}

/** Clear all staged planets, then stage exactly `ids` (max MAX_STAGED). */
export async function replaceStagedPlanets(ids: string[]): Promise<Planet[]> {
  if (ids.length > MAX_STAGED) {
    throw new Error(`At most ${MAX_STAGED} planets can be staged.`);
  }

  const supabase = createClient();

  const { error: clearError } = await supabase
    .from("planets")
    .update({ is_staged: false })
    .eq("is_staged", true);

  if (clearError) throw clearError;

  if (ids.length > 0) {
    const { error: stageError } = await supabase
      .from("planets")
      .update({ is_staged: true })
      .in("id", ids);

    if (stageError) throw stageError;
  }

  return listPlanets();
}
