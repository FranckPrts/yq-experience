export type SessionScore = {
  id: string;
  yq_session_id: string;
  planet_a_id: string;
  planet_b_id: string;
  score: number;
  strategy: string | null;
  duration: number | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type SessionScoreInsert = {
  yq_session_id: string;
  planet_a_id: string;
  planet_b_id: string;
  score: number;
  strategy?: string | null;
  duration?: number | null;
  recorded_at?: string;
};

export type SessionScoreUpdate = Partial<
  Omit<SessionScore, "id" | "yq_session_id" | "created_at" | "updated_at">
>;
