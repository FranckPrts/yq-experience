-- Catch-up: collapse answer1–3 → answers, rename star_params → params,
-- and require orbit_mode (clouds | beads). Safe to re-run.

-- 1) answers jsonb
alter table public.planets
  add column if not exists answers jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planets' and column_name = 'answer1'
  ) then
    update public.planets
    set answers = jsonb_build_object(
      'answer1', answer1,
      'answer2', answer2,
      'answer3', answer3
    )
    where answers = '{}'::jsonb
       or answers = jsonb_build_object(
            'answer1', null, 'answer2', null, 'answer3', null
          );
  end if;
end $$;

alter table public.planets
  drop column if exists answer1,
  drop column if exists answer2,
  drop column if exists answer3;

-- 2) star_params → params
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planets' and column_name = 'star_params'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planets' and column_name = 'params'
  ) then
    alter table public.planets rename column star_params to params;
  end if;
end $$;

alter table public.planets
  add column if not exists params jsonb not null default
    '{"size": 120, "freq": 5, "noise": 20, "core": 50, "hue": 69, "hue2": 0, "orbit_mode": "clouds"}'::jsonb;

-- 3) backfill missing keys on existing rows
update public.planets
set params = jsonb_set(params, '{size}', '120'::jsonb, true)
where jsonb_typeof(params -> 'size') is distinct from 'number';

update public.planets
set params = jsonb_set(params, '{orbit_mode}', '"clouds"'::jsonb, true)
where params ->> 'orbit_mode' is distinct from 'clouds'
  and params ->> 'orbit_mode' is distinct from 'beads';

-- 4) shape constraint
alter table public.planets
  drop constraint if exists planets_star_params_shape;

alter table public.planets
  drop constraint if exists planets_params_shape;

alter table public.planets
  add constraint planets_params_shape check (
    jsonb_typeof(params -> 'size')  = 'number' and
    jsonb_typeof(params -> 'freq')  = 'number' and
    jsonb_typeof(params -> 'noise') = 'number' and
    jsonb_typeof(params -> 'core')  = 'number' and
    jsonb_typeof(params -> 'hue')   = 'number' and
    jsonb_typeof(params -> 'hue2')  = 'number' and
    (params ->> 'orbit_mode') in ('clouds', 'beads')
  );

-- Refresh PostgREST schema cache so inserts see the new columns immediately.
notify pgrst, 'reload schema';
