import { cookies } from "next/headers";
import { createClient as createServerSupabase } from "@/utils/supabase/server";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerSupabase(cookieStore);
}
