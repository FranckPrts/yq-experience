-- Planets table for participant-created planet systems
create extension if not exists "pgcrypto";

create table if not exists public.planets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  creator_name text not null,
  creator_email text not null,
  anonymous_id text not null,
  answer1 text,
  answer2 text,
  answer3 text,
  params1 double precision not null default 0.5 check (params1 >= 0 and params1 <= 1),
  params2 double precision not null default 0.5 check (params2 >= 0 and params2 <= 1),
  params3 double precision not null default 0.5 check (params3 >= 0 and params3 <= 1),
  params4 double precision not null default 0.5 check (params4 >= 0 and params4 <= 1),
  is_staged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planets_anonymous_id_idx on public.planets (anonymous_id);
create index if not exists planets_is_staged_idx on public.planets (is_staged);
create index if not exists planets_created_at_idx on public.planets (created_at desc);

-- Keep updated_at fresh on every update
create or replace function public.set_planets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planets_set_updated_at on public.planets;
create trigger planets_set_updated_at
  before update on public.planets
  for each row
  execute function public.set_planets_updated_at();

-- Enable Realtime for admin live list
alter table public.planets replica identity full;

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
        and tablename = 'planets'
    ) then
      alter publication supabase_realtime add table public.planets;
    end if;
  end if;
end $$;

-- RLS: open read; insert/update allowed for anon (v1 password-gated admin UI)
-- Security tradeoff: admin edits use the anon key behind a shared UI password.
alter table public.planets enable row level security;

drop policy if exists "planets_select_all" on public.planets;
create policy "planets_select_all"
  on public.planets for select
  to anon, authenticated
  using (true);

drop policy if exists "planets_insert_all" on public.planets;
create policy "planets_insert_all"
  on public.planets for insert
  to anon, authenticated
  with check (true);

drop policy if exists "planets_update_all" on public.planets;
create policy "planets_update_all"
  on public.planets for update
  to anon, authenticated
  using (true)
  with check (true);
