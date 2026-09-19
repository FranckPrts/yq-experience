-- Ensure one row per external YQ session (required for upsert onConflict)
create unique index if not exists session_scores_yq_session_id_key
  on public.session_scores (yq_session_id);
