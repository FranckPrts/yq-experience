-- Session scores: one shared score per IRL planet pair (written by YouQuantified)
create table if not exists public.session_scores (
  id uuid primary key default gen_random_uuid(),
  yq_session_id text not null,
  planet_a_id uuid not null references public.planets (id),
  planet_b_id uuid not null references public.planets (id),
  score double precision not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planet_a_id <> planet_b_id)
);

create index if not exists session_scores_planet_a_id_idx
  on public.session_scores (planet_a_id);
create index if not exists session_scores_planet_b_id_idx
  on public.session_scores (planet_b_id);
create index if not exists session_scores_recorded_at_idx
  on public.session_scores (recorded_at desc);

-- Keep updated_at fresh on every update
create or replace function public.set_session_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists session_scores_set_updated_at on public.session_scores;
create trigger session_scores_set_updated_at
  before update on public.session_scores
  for each row
  execute function public.set_session_scores_updated_at();

-- Enable Realtime for live admin / exhibit updates
alter table public.session_scores replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'session_scores'
    ) then
      alter publication supabase_realtime add table public.session_scores;
    end if;
  end if;
end $$;

-- RLS: open read for this app; writes only via service role (YQ API route)
alter table public.session_scores enable row level security;

drop policy if exists "session_scores_select_all" on public.session_scores;
create policy "session_scores_select_all"
  on public.session_scores for select
  to anon, authenticated
  using (true);
