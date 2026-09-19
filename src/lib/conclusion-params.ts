/**
 * Query-string helpers for personalizing /conclusion from /results.
 *
 * Repeated params keep the entry shareable without client-only state:
 *   /conclusion?run=<session_score.id>&planet=<planet.id>&…
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ConclusionPersonalization = {
  runIds: string[];
  planetIds: string[];
};

function asParamList(
  value: string | string[] | undefined,
): string[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value])
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && UUID_RE.test(v));
}

/** Deduplicate while preserving first-seen order. */
function unique(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function parseConclusionSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): ConclusionPersonalization {
  return {
    runIds: unique(asParamList(searchParams.run)),
    planetIds: unique(asParamList(searchParams.planet)),
  };
}

/** Build a /conclusion href carrying the participant's run and planet ids. */
export function buildConclusionHref(
  runIds: string[],
  planetIds: string[],
): string {
  const params = new URLSearchParams();
  for (const id of unique(runIds.filter((id) => UUID_RE.test(id)))) {
    params.append("run", id);
  }
  for (const id of unique(planetIds.filter((id) => UUID_RE.test(id)))) {
    params.append("planet", id);
  }
  const qs = params.toString();
  return qs.length > 0 ? `/conclusion?${qs}` : "/conclusion";
}
