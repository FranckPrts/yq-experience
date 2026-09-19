-- 004_session_scores_anon_insert.sql
-- The exhibit visual writes scores directly with the anon key (no API route).
-- One-day install tradeoff, same as the planets policies.

drop policy if exists "session_scores_insert_all" on public.session_scores;
create policy "session_scores_insert_all"
  on public.session_scores for insert
  to anon, authenticated
  with check (true);