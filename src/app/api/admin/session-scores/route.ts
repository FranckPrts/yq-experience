import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import type { SessionScore } from "@/lib/types/session-score";
import { createAdminClient } from "@/utils/supabase/admin";

type CreateBody = {
  yq_session_id?: unknown;
  planet_a_id?: unknown;
  planet_b_id?: unknown;
  score?: unknown;
  recorded_at?: unknown;
  strategy?: unknown;
  duration?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
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

  let strategy: string | null | undefined;
  if (body.strategy !== undefined) {
    if (body.strategy === null) {
      strategy = null;
    } else if (typeof body.strategy === "string") {
      const trimmed = body.strategy.trim();
      strategy = trimmed.length > 0 ? trimmed : null;
    } else {
      return NextResponse.json(
        { error: "strategy must be a string or null" },
        { status: 400 },
      );
    }
  }

  let duration: number | null | undefined;
  if (body.duration !== undefined) {
    if (body.duration === null) {
      duration = null;
    } else if (isFiniteNumber(body.duration)) {
      duration = body.duration;
    } else {
      return NextResponse.json(
        { error: "duration must be a finite number or null" },
        { status: 400 },
      );
    }
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
      ...(strategy !== undefined ? { strategy } : {}),
      ...(duration !== undefined ? { duration } : {}),
    };

    const { data, error } = await supabase
      .from("session_scores")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A session score with this yq_session_id already exists" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session_score: data as SessionScore });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create session score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
