import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { aadFor, decryptSecret } from "@/lib/crypto/envelope";
import { TABLES } from "./schema";

/**
 * Operating a live experience, from our server, with the tenant's secret key.
 *
 * Only *writes* come through here. Reads do not need to: provisioning made
 * `avatars` and `session_scores` readable with the publishable key — the scene
 * and the participants rely on that — so the console reads and subscribes to
 * Realtime straight from the browser. Relaying those reads through our server
 * would add a long-lived connection per viewer and protect nothing.
 *
 * Staging is different. It changes what the scene puts on stage, so it is
 * authorised against project membership first, and made with the secret key,
 * which never leaves this module.
 */

/** The scene renders a pair, and takes the first two staged by `updated_at`. */
export const MAX_STAGED = 2;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function opsClient(projectId: string): Promise<SupabaseClient> {
  const connection = await db.supabaseConnection.findUnique({
    where: { projectId },
    select: {
      id: true,
      projectUrl: true,
      secretKeyEnc: true,
      keyVersion: true,
    },
  });
  if (!connection?.projectUrl || !connection.secretKeyEnc) {
    throw new Error("This project has no database connection with a secret key.");
  }

  const secret = decryptSecret(
    connection.secretKeyEnc,
    aadFor(connection.id, "secretKey"),
    connection.keyVersion,
  );

  // Built per call and never cached: holding a decrypted service key in module
  // state would outlive the request that needed it.
  return createClient(connection.projectUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type StageResult = { ok: true } | { ok: false; error: string };

/**
 * Stages or un-stages one avatar.
 *
 * The pair limit is a check-then-write, not a lock: two operators staging in the
 * same second could briefly put three on stage. Accepted, because the scene is
 * already robust to it — it takes the first two by `updated_at` — and an ops
 * console run by one or two people at an event does not justify a stored
 * procedure in the tenant's database.
 */
export async function setStaged(
  projectId: string,
  avatarId: string,
  staged: boolean,
): Promise<StageResult> {
  if (!UUID.test(avatarId)) return { ok: false, error: "Unknown avatar." };
  const client = await opsClient(projectId);

  if (staged) {
    const { count, error } = await client
      .from(TABLES.avatars)
      .select("id", { count: "exact", head: true })
      .eq("is_staged", true)
      .neq("id", avatarId);
    if (error) return { ok: false, error: error.message };
    if ((count ?? 0) >= MAX_STAGED) {
      return {
        ok: false,
        error: `Two are already on stage. Take one off first.`,
      };
    }
  }

  const { error } = await client
    .from(TABLES.avatars)
    .update({ is_staged: staged })
    .eq("id", avatarId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function unstageAll(projectId: string): Promise<StageResult> {
  const client = await opsClient(projectId);
  const { error } = await client
    .from(TABLES.avatars)
    .update({ is_staged: false })
    .eq("is_staged", true);
  return error ? { ok: false, error: error.message } : { ok: true };
}
