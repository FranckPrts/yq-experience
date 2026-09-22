/**
 * The schema we install in a tenant's Supabase project.
 *
 * The RLS-honest, generic descendant of the CCN migrations. Where those ended
 * up at `using (true)` with a comment admitting it was a one-day tradeoff, this
 * has to satisfy three different callers with genuinely different rights.
 *
 * ── Who talks to this database ──────────────────────────────────────────────
 *
 * **Participant** — signs in through Supabase *anonymous auth*, so they hold a
 * real JWT and Postgres sees them as `authenticated` with an `auth.uid()`. That
 * is the hinge the whole design turns on: anonymous does not mean the `anon`
 * role. They may insert their own avatar and update only that row.
 *
 * **The scene** — a p5 visual running in YouQuantified with the publishable key
 * pasted into it and no user session, so Postgres sees `anon`. It reads the
 * staged pair, inserts a score, and clears `is_staged` when a run ends. That
 * last one is why `anon` needs UPDATE on avatars at all.
 *
 * **Ops** — this app's server, holding the secret key. `service_role` bypasses
 * RLS, so nothing below constrains it.
 *
 * ── The column grant ────────────────────────────────────────────────────────
 *
 * A policy cannot say "this role may write only this column" — RLS filters
 * rows, not columns. So the scene's ability to clear `is_staged` without also
 * being able to rewrite anyone's `params` comes from a column-level GRANT, with
 * a permissive policy alongside it. Both are needed: the grant without a policy
 * is refused by RLS, and the policy without the grant is refused by privileges.
 */

/**
 * Bumped whenever the shape below changes in a way a scene script would notice.
 * Stored on the connection, and quoted in the snippet a tenant pastes into
 * their scene, so a project and its scene can be told apart when they drift.
 */
export const SCHEMA_VERSION = 1;

export const TABLES = {
  avatars: "avatars",
  scores: "session_scores",
} as const;

/**
 * Idempotent by construction — every statement is `if not exists` or preceded
 * by a drop, so re-running after a partial failure is safe and re-provisioning
 * an already-live project changes nothing.
 */
export function provisioningSql(): string {
  return `-- yq-experiences schema v${SCHEMA_VERSION}
-- Safe to run more than once.

create extension if not exists "pgcrypto";

-- ─── avatars ────────────────────────────────────────────────────────────────

create table if not exists public.${TABLES.avatars} (
  id uuid primary key default gen_random_uuid(),
  -- Defaulting to auth.uid() means a participant cannot create a row owned by
  -- someone else even by trying: they never supply this column.
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  answers jsonb not null default '{}'::jsonb,
  -- No CHECK on shape: params are whatever the project's script declares, and
  -- a constraint here would have to be rewritten on every declaration change.
  -- Validation lives in the app, against the declaration.
  params jsonb not null default '{}'::jsonb,
  is_staged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists avatars_owner_idx on public.${TABLES.avatars} (owner);
create index if not exists avatars_is_staged_idx on public.${TABLES.avatars} (is_staged);
create index if not exists avatars_created_at_idx on public.${TABLES.avatars} (created_at desc);

create or replace function public.set_avatars_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists avatars_set_updated_at on public.${TABLES.avatars};
create trigger avatars_set_updated_at
  before update on public.${TABLES.avatars}
  for each row
  execute function public.set_avatars_updated_at();

-- ─── session_scores ─────────────────────────────────────────────────────────
-- Written by the tenant's scene script, read-only to this app.

create table if not exists public.${TABLES.scores} (
  id uuid primary key default gen_random_uuid(),
  yq_session_id text not null,
  avatar_a_id uuid not null references public.${TABLES.avatars} (id) on delete cascade,
  avatar_b_id uuid not null references public.${TABLES.avatars} (id) on delete cascade,
  score double precision not null,
  duration double precision,
  strategy text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (avatar_a_id <> avatar_b_id)
);

create index if not exists session_scores_a_idx on public.${TABLES.scores} (avatar_a_id);
create index if not exists session_scores_b_idx on public.${TABLES.scores} (avatar_b_id);
create index if not exists session_scores_recorded_at_idx on public.${TABLES.scores} (recorded_at desc);

-- ─── privileges ─────────────────────────────────────────────────────────────
-- Explicit, because Supabase's defaults are generous and this is the only way
-- to stop the scene's key from rewriting avatars it should only be un-staging.

revoke all on public.${TABLES.avatars} from anon, authenticated;
revoke all on public.${TABLES.scores} from anon, authenticated;

grant select on public.${TABLES.avatars} to anon, authenticated;
grant insert on public.${TABLES.avatars} to authenticated;
grant update (name, answers, params) on public.${TABLES.avatars} to authenticated;
-- The scene, holding only the publishable key, may clear the staging flag and
-- nothing else.
grant update (is_staged) on public.${TABLES.avatars} to anon;

grant select on public.${TABLES.scores} to anon, authenticated;
grant insert on public.${TABLES.scores} to anon;

-- ─── row level security ─────────────────────────────────────────────────────

alter table public.${TABLES.avatars} enable row level security;
alter table public.${TABLES.scores} enable row level security;

-- Everyone may read the avatars: the experience shows them to each other, and
-- the scene needs the staged pair.
drop policy if exists "avatars_select" on public.${TABLES.avatars};
create policy "avatars_select"
  on public.${TABLES.avatars} for select
  to anon, authenticated
  using (true);

-- This is the test today's policies would fail: a participant may write their
-- own row and no one else's.
drop policy if exists "avatars_insert_own" on public.${TABLES.avatars};
create policy "avatars_insert_own"
  on public.${TABLES.avatars} for insert
  to authenticated
  with check (auth.uid() = owner);

drop policy if exists "avatars_update_own" on public.${TABLES.avatars};
create policy "avatars_update_own"
  on public.${TABLES.avatars} for update
  to authenticated
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

-- Paired with the column grant above: rows are unrestricted, columns are not.
drop policy if exists "avatars_unstage_by_scene" on public.${TABLES.avatars};
create policy "avatars_unstage_by_scene"
  on public.${TABLES.avatars} for update
  to anon
  using (true)
  with check (true);

drop policy if exists "session_scores_select" on public.${TABLES.scores};
create policy "session_scores_select"
  on public.${TABLES.scores} for select
  to anon, authenticated
  using (true);

-- Anything embedded in browser-side p5 is public, so this insert is forgeable
-- and knowingly so. The blast radius is held to inserts: no update, no delete,
-- and the publishable key can be rotated.
drop policy if exists "session_scores_insert_by_scene" on public.${TABLES.scores};
create policy "session_scores_insert_by_scene"
  on public.${TABLES.scores} for insert
  to anon
  with check (true);

-- ─── realtime ───────────────────────────────────────────────────────────────
-- For the ops console's live list. The scene polls instead.

alter table public.${TABLES.avatars} replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = '${TABLES.avatars}'
    ) then
      alter publication supabase_realtime add table public.${TABLES.avatars};
    end if;
  end if;
end $$;

-- Let PostgREST see the new shape immediately.
notify pgrst, 'reload schema';
`;
}

/**
 * The CONFIG block a tenant pastes into their scene script. The scene talks to
 * their database directly — nothing is handed to YouQuantified as an
 * application — so this snippet is the whole of the integration.
 */
export function sceneSnippet(opts: {
  projectUrl: string;
  publishableKey: string;
}): string {
  return `// yq-experiences · schema v${SCHEMA_VERSION}
// Paste into your scene script in YouQuantified.
const DB = {
  url:     "${opts.projectUrl}",
  anonKey: "${opts.publishableKey}",
  avatars: "${TABLES.avatars}",
  scores:  "${TABLES.scores}",
  pollMs:  2000,
};

// The score row this schema expects:
//   { yq_session_id, avatar_a_id, avatar_b_id, score, duration }
// Un-stage a pair when a run ends by PATCHing is_staged = false.
`;
}
