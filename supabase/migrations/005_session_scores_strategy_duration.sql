-- 005_session_scores_strategy_duration.sql
-- Admin-managed annotations on session scores
alter table public.session_scores
  add column if not exists strategy text,
  add column if not exists duration double precision;
