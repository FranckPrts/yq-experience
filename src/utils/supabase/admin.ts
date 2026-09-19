import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Prefer the new secret key (`sb_secret_...`). Fall back to the legacy
 * `service_role` JWT while migrating — both work until legacy keys are
 * deactivated (deprecated end of 2026).
 *
 * @see https://supabase.com/docs/guides/api/api-keys
 * @see https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
 */
function getSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Elevated-privilege client for trusted server routes (e.g. YQ session score writes).
 * Never import this into client components or expose the key publicly.
 */
export function createAdminClient() {
  const secretKey = getSecretKey();

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) and NEXT_PUBLIC_SUPABASE_URL are required",
    );
  }

  return createSupabaseClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
