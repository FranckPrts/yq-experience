import { createClient } from "@/utils/supabase/client";
import type {
  SessionScore,
  SessionScoreInsert,
  SessionScoreUpdate,
} from "@/lib/types/session-score";

export async function listSessionScores(): Promise<SessionScore[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_scores")
    .select("*")
    .order("recorded_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SessionScore[];
}

export async function getLatestSessionScore(): Promise<SessionScore | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_scores")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as SessionScore | null) ?? null;
}

export async function getSessionScore(id: string): Promise<SessionScore | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_scores")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as SessionScore | null) ?? null;
}

export async function getSessionScoreByYqId(
  yqSessionId: string,
): Promise<SessionScore | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_scores")
    .select("*")
    .eq("yq_session_id", yqSessionId)
    .maybeSingle();

  if (error) throw error;
  return (data as SessionScore | null) ?? null;
}

export async function createSessionScore(
  payload: SessionScoreInsert,
): Promise<SessionScore> {
  const res = await fetch("/api/admin/session-scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    session_score?: SessionScore;
    error?: string;
  };

  if (!res.ok || !data.session_score) {
    throw new Error(data.error ?? "Failed to create session score");
  }

  return data.session_score;
}

export async function updateSessionScore(
  id: string,
  payload: SessionScoreUpdate,
): Promise<SessionScore> {
  const res = await fetch(`/api/admin/session-scores/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    session_score?: SessionScore;
    error?: string;
  };

  if (!res.ok || !data.session_score) {
    throw new Error(data.error ?? "Failed to update session score");
  }

  return data.session_score;
}

export async function deleteSessionScore(id: string): Promise<void> {
  const res = await fetch(`/api/admin/session-scores/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  const data = (await res.json()) as { ok?: boolean; error?: string };

  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "Failed to delete session score");
  }
}
