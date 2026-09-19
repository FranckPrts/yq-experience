import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import type {
  SessionScore,
  SessionScoreUpdate,
} from "@/lib/types/session-score";
import { createAdminClient } from "@/utils/supabase/admin";

type PatchBody = {
  score?: unknown;
  planet_a_id?: unknown;
  planet_b_id?: unknown;
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

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  if (!isNonEmptyString(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: SessionScoreUpdate = {};

  if (body.score !== undefined) {
    if (!isFiniteNumber(body.score)) {
      return NextResponse.json(
        { error: "score must be a finite number" },
        { status: 400 },
      );
    }
    patch.score = body.score;
  }

  if (body.planet_a_id !== undefined) {
    if (!isNonEmptyString(body.planet_a_id)) {
      return NextResponse.json(
        { error: "planet_a_id must be a non-empty string" },
        { status: 400 },
      );
    }
    patch.planet_a_id = body.planet_a_id;
  }

  if (body.planet_b_id !== undefined) {
    if (!isNonEmptyString(body.planet_b_id)) {
      return NextResponse.json(
        { error: "planet_b_id must be a non-empty string" },
        { status: 400 },
      );
    }
    patch.planet_b_id = body.planet_b_id;
  }

  if (body.recorded_at !== undefined) {
    if (
      typeof body.recorded_at !== "string" ||
      Number.isNaN(Date.parse(body.recorded_at))
    ) {
      return NextResponse.json(
        { error: "recorded_at must be a valid ISO timestamp" },
        { status: 400 },
      );
    }
    patch.recorded_at = body.recorded_at;
  }

  if (body.strategy !== undefined) {
    if (body.strategy === null) {
      patch.strategy = null;
    } else if (typeof body.strategy === "string") {
      const trimmed = body.strategy.trim();
      patch.strategy = trimmed.length > 0 ? trimmed : null;
    } else {
      return NextResponse.json(
        { error: "strategy must be a string or null" },
        { status: 400 },
      );
    }
  }

  if (body.duration !== undefined) {
    if (body.duration === null) {
      patch.duration = null;
    } else if (isFiniteNumber(body.duration)) {
      patch.duration = body.duration;
    } else {
      return NextResponse.json(
        { error: "duration must be a finite number or null" },
        { status: 400 },
      );
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from("session_scores")
      .select("planet_a_id, planet_b_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 },
      );
    }
    if (!existing) {
      return NextResponse.json(
        { error: "Session score not found" },
        { status: 404 },
      );
    }

    const nextA = patch.planet_a_id ?? (existing.planet_a_id as string);
    const nextB = patch.planet_b_id ?? (existing.planet_b_id as string);

    if (nextA === nextB) {
      return NextResponse.json(
        { error: "planet_a_id and planet_b_id must be distinct" },
        { status: 400 },
      );
    }

    if (patch.planet_a_id !== undefined || patch.planet_b_id !== undefined) {
      const { data: planets, error: planetsError } = await supabase
        .from("planets")
        .select("id")
        .in("id", [nextA, nextB]);

      if (planetsError) {
        return NextResponse.json(
          { error: planetsError.message },
          { status: 500 },
        );
      }

      const found = new Set((planets ?? []).map((p) => p.id as string));
      if (!found.has(nextA) || !found.has(nextB)) {
        return NextResponse.json(
          { error: "One or both planets were not found" },
          { status: 400 },
        );
      }
    }

    const { data, error } = await supabase
      .from("session_scores")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session_score: data as SessionScore });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update session score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  if (!isNonEmptyString(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("session_scores")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Session score not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete session score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
