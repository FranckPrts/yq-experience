import type { StarParams } from "@/lib/types/star";

/**
 * Opaque answers bag. Key names and cardinality are defined by YQ / the
 * questionnaire — not fixed by this schema.
 */
export type PlanetAnswers = Record<string, unknown>;

/**
 * Rows live in the `planets` table. Answers are open-ended jsonb; star
 * tunables ride in `params` with a fixed StarParams shape.
 */
export type Planet = {
  id: string;
  name: string;
  creator_name: string;
  creator_email: string;
  anonymous_id: string;
  answers: PlanetAnswers;
  params: StarParams;
  is_staged: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanetInsert = {
  name: string;
  creator_name: string;
  creator_email: string;
  anonymous_id: string;
  answers?: PlanetAnswers;
  params: StarParams;
  is_staged?: boolean;
};

export type PlanetUpdate = Partial<
  Omit<Planet, "id" | "created_at" | "updated_at" | "anonymous_id">
> & {
  anonymous_id?: string;
};
