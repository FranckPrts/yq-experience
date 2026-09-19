import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type { SessionScore } from "@/lib/types/session-score";

type SessionScoreBody = {
  yq_session_id?: unknown;
  planet_a_id?: unknown;
  planet_b_id?: unknown;
  score?: unknown;
  recorded_at?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function authorize(request: NextRequest): boolean {
  const expected = process.env.YQ_API_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  return header.slice("Bearer ".length) === expected;
}

export async function POST(request: NextRequest) {
  if (!process.env.YQ_API_SECRET) {
    return NextResponse.json(
      { error: "YQ_API_SECRET is not configured" },
      { status: 500 },
    );
  }

  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SessionScoreBody;
  try {
    body = (await request.json()) as SessionScoreBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { yq_session_id, planet_a_id, planet_b_id, score, recorded_at } = body;

  if (!isNonEmptyString(yq_session_id)) {
    return NextResponse.json(
      { error: "yq_session_id is required" },
      { status: 400 },
    );
  }
  if (!isNonEmptyString(planet_a_id) || !isNonEmptyString(planet_b_id)) {
    return NextResponse.json(
      { error: "planet_a_id and planet_b_id are required" },
      { status: 400 },
    );
  }
  if (planet_a_id === planet_b_id) {
    return NextResponse.json(
      { error: "planet_a_id and planet_b_id must be distinct" },
      { status: 400 },
    );
  }
  if (!isFiniteNumber(score)) {
    return NextResponse.json(
      { error: "score must be a finite number" },
      { status: 400 },
    );
  }
  if (
    recorded_at !== undefined &&
    recorded_at !== null &&
    (typeof recorded_at !== "string" ||
      Number.isNaN(Date.parse(recorded_at)))
  ) {
    return NextResponse.json(
      { error: "recorded_at must be a valid ISO timestamp" },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();

    const { data: planets, error: planetsError } = await supabase
      .from("planets")
      .select("id")
      .in("id", [planet_a_id, planet_b_id]);

    if (planetsError) {
      return NextResponse.json(
        { error: planetsError.message },
        { status: 500 },
      );
    }

    const found = new Set((planets ?? []).map((p) => p.id as string));
    if (!found.has(planet_a_id) || !found.has(planet_b_id)) {
      return NextResponse.json(
        { error: "One or both planets were not found" },
        { status: 400 },
      );
    }

    const row = {
      yq_session_id: yq_session_id.trim(),
      planet_a_id,
      planet_b_id,
      score,
      ...(typeof recorded_at === "string" ? { recorded_at } : {}),
    };

    const { data, error } = await supabase
      .from("session_scores")
      .upsert(row, { onConflict: "yq_session_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session_score: data as SessionScore });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to write session score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
