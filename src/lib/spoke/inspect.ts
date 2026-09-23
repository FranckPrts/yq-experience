import "server-only";
import { runQuery } from "@/lib/supabase/management";
import { TABLES } from "./schema";

/**
 * Looking at the tenant's database without changing it.
 *
 * Every destructive action on this platform shows what it is about to destroy
 * first — a row count is the difference between "wipe the data" as a shrug and
 * as a decision. This is also the only honest way to answer "is it actually
 * provisioned?", since our `provisionedAt` records what we *did*, not what is
 * true now: a tenant can drop a table in the Supabase dashboard and we would
 * never hear about it.
 */

export type TableState = {
  name: string;
  exists: boolean;
  rlsEnabled: boolean;
  policies: number;
  rows: number | null;
};

export type SpokeState = {
  avatars: TableState;
  scores: TableState;
  /** True only if both tables are present. */
  installed: boolean;
  stagedCount: number | null;
};

const EMPTY = (name: string): TableState => ({
  name,
  exists: false,
  rlsEnabled: false,
  policies: 0,
  rows: null,
});

type CatalogRow = { relname: string; rls: boolean; policies: number | string };

export async function inspectSpoke(
  ref: string,
  accessToken: string,
): Promise<SpokeState> {
  // Catalogue first, and only from catalogues — selecting from a table that may
  // not exist would turn "not provisioned" into an error.
  const catalog = await runQuery<CatalogRow[]>(
    ref,
    accessToken,
    `select c.relname,
            c.relrowsecurity as rls,
            (select count(*) from pg_policies p
              where p.schemaname = 'public' and p.tablename = c.relname) as policies
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('${TABLES.avatars}', '${TABLES.scores}');`,
  );

  const rows = Array.isArray(catalog) ? catalog : [];
  const find = (name: string): TableState => {
    const row = rows.find((r) => r.relname === name);
    if (!row) return EMPTY(name);
    return {
      name,
      exists: true,
      rlsEnabled: row.rls === true,
      policies: Number(row.policies ?? 0),
      rows: null,
    };
  };

  const avatars = find(TABLES.avatars);
  const scores = find(TABLES.scores);
  const installed = avatars.exists && scores.exists;

  if (!installed) {
    return { avatars, scores, installed, stagedCount: null };
  }

  const counts = await runQuery<
    { avatars: number | string; scores: number | string; staged: number | string }[]
  >(
    ref,
    accessToken,
    `select (select count(*) from public.${TABLES.avatars}) as avatars,
            (select count(*) from public.${TABLES.scores}) as scores,
            (select count(*) from public.${TABLES.avatars} where is_staged) as staged;`,
  );

  const c = Array.isArray(counts) ? counts[0] : undefined;
  return {
    avatars: { ...avatars, rows: Number(c?.avatars ?? 0) },
    scores: { ...scores, rows: Number(c?.scores ?? 0) },
    installed,
    stagedCount: Number(c?.staged ?? 0),
  };
}

/**
 * Empties the tables, leaving the schema, policies and grants in place.
 *
 * Scores go first: they reference avatars, and although the foreign keys
 * cascade, deleting in dependency order keeps the statement honest about what
 * it is doing rather than relying on a side effect.
 */
export function wipeDataSql(): string {
  return `delete from public.${TABLES.scores};
delete from public.${TABLES.avatars};`;
}

/**
 * Removes everything this platform installed. The tenant's project, its auth
 * users and anything else they keep in it are untouched — we only drop what
 * provisioning created.
 */
export function wipeSchemaSql(): string {
  return `drop table if exists public.${TABLES.scores} cascade;
drop table if exists public.${TABLES.avatars} cascade;
drop function if exists public.set_avatars_updated_at() cascade;`;
}
