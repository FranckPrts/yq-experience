"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { aadFor, encryptSecret } from "@/lib/crypto/envelope";
import {
  accessTokenFor,
  fetchProjectKeys,
  projectUrlFor,
} from "@/lib/supabase/management";

export type ConnectionState = { error?: string; saved?: boolean };

/**
 * Points this experiment at one of the account's Supabase projects, and
 * resolves that project's keys.
 *
 * One experiment per Supabase project, strictly — so this is a choice of
 * target, not an addition to a list. Re-running it repoints the experiment,
 * which is a real thing to want when a tenant rehearses on a scratch project
 * before an event.
 */
export async function chooseSupabaseProject(
  _prev: ConnectionState,
  formData: FormData,
): Promise<ConnectionState> {
  const slug = String(formData.get("slug") ?? "");
  const ref = String(formData.get("ref") ?? "").trim();
  const { projectId } = await requireProjectRole(slug, "OWNER");

  if (!ref) return { error: "Choose a Supabase project." };

  const connection = await db.supabaseConnection.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!connection) return { error: "Connect a Supabase account first." };

  try {
    const accessToken = await accessTokenFor(connection.id);
    const keys = await fetchProjectKeys(ref, accessToken);

    if (!keys.publishableKey) {
      // Without it no participant can reach the database at all, so stopping
      // here is kinder than storing a half-connection that fails later.
      return {
        error:
          "Could not read that project's publishable key. Check the OAuth app has project access.",
      };
    }

    await db.supabaseConnection.update({
      where: { id: connection.id },
      data: {
        projectRef: ref,
        projectUrl: projectUrlFor(ref),
        // Public by design — it ships to every participant's browser.
        publishableKey: keys.publishableKey,
        secretKeyEnc: keys.secretKey
          ? encryptSecret(keys.secretKey, aadFor(connection.id, "secretKey"))
          : null,
      },
    });

    revalidatePath(`/projects/${slug}`);
    return { saved: true };
  } catch (error) {
    console.error("[supabase] choose project failed:", error);
    return {
      error:
        error instanceof Error ? error.message : "Could not reach Supabase.",
    };
  }
}

/**
 * Forgets the authorisation and everything derived from it. The tenant's
 * Supabase project is untouched — this only removes our access to it.
 */
export async function disconnectSupabase(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const { projectId } = await requireProjectRole(slug, "OWNER");
  await db.supabaseConnection.deleteMany({ where: { projectId } });
  revalidatePath(`/projects/${slug}`);
}
