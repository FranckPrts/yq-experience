"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { coerceAll, type ParamValues } from "@/lib/params/coerce";
import type { Parameter } from "@/lib/params/types";
import { isRenderParam } from "@/lib/params/types";

/**
 * Reading and writing avatars in the tenant's database — the generic descendant
 * of `src/lib/planets.ts`.
 *
 * Still browser-side, as before, but now under real RLS rather than
 * `using (true)`. `normalizePlanet`'s discipline carries over: nothing trusts
 * what comes back, and every value is coerced against the declaration before it
 * reaches a slider or a shader.
 */

export const AVATARS_TABLE = "avatars";

export type Avatar = {
  id: string;
  owner: string;
  name: string;
  answers: Record<string, string>;
  params: ParamValues;
  is_staged: boolean;
  created_at: string;
  updated_at: string;
};

function asStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = typeof v === "string" ? v : String(v ?? "");
  }
  return out;
}

/** Normalize-on-read: a row is only ever as trustworthy as the declaration. */
export function normalizeAvatar(row: unknown, parameters: Parameter[]): Avatar {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    owner: String(r.owner ?? ""),
    name: typeof r.name === "string" ? r.name : "",
    answers: asStringMap(r.answers),
    params: coerceAll(parameters, (r.params ?? {}) as ParamValues),
    is_staged: r.is_staged === true,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

/** Splits a value set the way the schema does: questions vs render input. */
export function splitValues(parameters: Parameter[], values: ParamValues) {
  const answers: Record<string, string> = {};
  const params: ParamValues = {};
  for (const param of parameters) {
    const value = values[param.name];
    if (isRenderParam(param)) params[param.name] = value;
    else answers[param.name] = typeof value === "string" ? value : "";
  }
  return { answers, params };
}

export async function listAvatars(
  client: SupabaseClient,
  parameters: Parameter[],
): Promise<Avatar[]> {
  const { data, error } = await client
    .from(AVATARS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizeAvatar(row, parameters));
}

/**
 * The caller's own avatar, if they have made one.
 *
 * Filtered by `owner` rather than relying on RLS to narrow it: reads are
 * deliberately wide — participants see each other — so the policy will happily
 * return everyone's.
 */
export async function myAvatar(
  client: SupabaseClient,
  userId: string,
  parameters: Parameter[],
): Promise<Avatar | null> {
  const { data, error } = await client
    .from(AVATARS_TABLE)
    .select("*")
    .eq("owner", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ? normalizeAvatar(data[0], parameters) : null;
}

export async function createAvatar(
  client: SupabaseClient,
  input: { name: string; answers: Record<string, string>; params: ParamValues },
  parameters: Parameter[],
): Promise<Avatar> {
  // `owner` is deliberately not sent — the column defaults to auth.uid(), so a
  // participant cannot create a row owned by anyone else even by trying.
  const { data, error } = await client
    .from(AVATARS_TABLE)
    .insert({
      name: input.name,
      answers: input.answers,
      params: input.params,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalizeAvatar(data, parameters);
}

export async function updateAvatar(
  client: SupabaseClient,
  id: string,
  input: { name: string; answers: Record<string, string>; params: ParamValues },
  parameters: Parameter[],
): Promise<Avatar> {
  // `is_staged` is deliberately absent: editing an avatar must not un-stage it
  // mid-session, and the column grant would refuse the write anyway.
  const { data, error } = await client
    .from(AVATARS_TABLE)
    .update({
      name: input.name,
      answers: input.answers,
      params: input.params,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalizeAvatar(data, parameters);
}

export async function saveAvatar(
  client: SupabaseClient,
  existingId: string | null,
  input: { name: string; answers: Record<string, string>; params: ParamValues },
  parameters: Parameter[],
): Promise<Avatar> {
  return existingId
    ? updateAvatar(client, existingId, input, parameters)
    : createAvatar(client, input, parameters);
}
