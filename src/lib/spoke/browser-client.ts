"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The participant's connection — straight from their browser to the tenant's
 * Supabase, with no server of ours in between.
 *
 * This is decision 2 in practice: the publishable key is public by design, RLS
 * is the boundary, and cutting out the relay is what lets Realtime work
 * natively. Nothing here is a secret; the interesting security lives in the
 * policies we provisioned.
 */

const clients = new Map<string, SupabaseClient>();

export function spokeClient(
  projectUrl: string,
  publishableKey: string,
): SupabaseClient {
  const existing = clients.get(projectUrl);
  if (existing) return existing;

  const client = createClient(projectUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Namespaced per project. Two experiences open in the same browser are
      // two different Supabase projects and two different anonymous identities;
      // a shared key would have one silently evict the other.
      storageKey: `yq-spoke-${new URL(projectUrl).hostname.split(".")[0]}`,
    },
  });

  clients.set(projectUrl, client);
  return client;
}

/**
 * Returns the participant's user id, signing them in anonymously if they do not
 * already have a session.
 *
 * An anonymous Supabase user is still an *authenticated* one: they carry a JWT
 * and a real `auth.uid()`, which is exactly what the RLS policies key off. The
 * session persists in browser storage, so returning to the experience finds the
 * same identity — and losing that storage means losing the avatar, the same
 * tradeoff the old localStorage UUID had.
 */
export async function ensureParticipant(
  client: SupabaseClient,
): Promise<{ userId: string } | { error: string }> {
  const { data: existing } = await client.auth.getSession();
  if (existing.session?.user?.id) {
    return { userId: existing.session.user.id };
  }

  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) {
    // Keep the real thing for whoever is debugging…
    if (error) console.warn("[spoke] anonymous sign-in failed:", error);
    // …and give the participant a sentence. Supabase's own messages are for
    // developers — "Failed to fetch" tells someone at an event nothing, and
    // the two causes that actually happen have very different answers.
    return { error: participantMessage(error) };
  }
  return { userId: data.user.id };
}

function participantMessage(error: { message?: string; status?: number } | null): string {
  const message = error?.message?.toLowerCase() ?? "";

  if (message.includes("fetch") || message.includes("network")) {
    return "Can’t reach this experience’s database. Check your connection and try again.";
  }
  // The one that bites at events: anonymous sign-ins are rate-limited per IP,
  // and a room full of people shares one.
  if (error?.status === 429 || message.includes("rate limit")) {
    return "Too many people have joined from this network in the last hour. Wait a few minutes and try again.";
  }
  if (message.includes("anonymous") || message.includes("disabled")) {
    return "This experience isn’t accepting new participants yet.";
  }
  return "Couldn’t start. Try reloading the page.";
}
