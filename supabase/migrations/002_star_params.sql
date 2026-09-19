-- Replace the four scalar planet params with a single JSON blob for the star.
-- Existing rows keep their identity/answers; their params are reset to the
-- star defaults (the old 0–1 scalars have no meaningful mapping onto the new
-- sketch's size/freq/noise/core/hue/hue2).

alter table public.planets
  add column if not exists star_params jsonb not null default
    '{"size": 120, "freq": 5, "noise": 20, "core": 50, "hue": 69, "hue2": 0}'::jsonb;

alter table public.planets
  drop column if exists params1,
  drop column if exists params2,
  drop column if exists params3,
  drop column if exists params4;

-- Fixed StarParams shape (answers stay unconstrained elsewhere).
alter table public.planets
  drop constraint if exists planets_star_params_shape;

alter table public.planets
  add constraint planets_star_params_shape check (
    jsonb_typeof(star_params -> 'size')  = 'number' and
    jsonb_typeof(star_params -> 'freq')  = 'number' and
    jsonb_typeof(star_params -> 'noise') = 'number' and
    jsonb_typeof(star_params -> 'core')  = 'number' and
    jsonb_typeof(star_params -> 'hue')   = 'number' and
    jsonb_typeof(star_params -> 'hue2')  = 'number'
  );
