"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { passwordProblem } from "@/lib/auth/password";
import { redeemInvitation } from "@/lib/auth/invitations";
import { createSession } from "@/lib/auth/session";

export type AcceptState = { error?: string };

/**
 * The token is the authorisation. It arrives in the form body rather than being
 * read from the URL, because a Server Action is a bare POST — there is no page
 * context to inherit, and nothing here may assume the acceptance page ran.
 */
export async function acceptInvitation(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const displayName = String(formData.get("displayName") ?? "");

  if (!token) return { error: "This invitation link is incomplete." };
  if (!email) return { error: "Enter your email address." };
  if (password !== confirm) return { error: "The passwords do not match." };

  const weak = passwordProblem(password);
  if (weak) return { error: weak };

  const result = await redeemInvitation(token, { email, password, displayName });
  if (!result.ok) {
    const friendly: Record<string, string> = {
      unknown: "This invitation link is not valid.",
      expired: "This invitation has expired. Ask for a new one.",
      used: "This invitation has already been used.",
      revoked: "This invitation was withdrawn.",
    };
    return { error: friendly[result.error] ?? result.error };
  }

  const userAgent = (await headers()).get("user-agent");
  await createSession(result.userId, userAgent);

  redirect(result.projectSlug ? `/projects` : "/projects");
}
