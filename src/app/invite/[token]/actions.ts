"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { passwordProblem } from "@/lib/auth/password";
import { joinWithInvitation, redeemInvitation } from "@/lib/auth/invitations";
import { currentUser } from "@/lib/auth/dal";
import { createSession } from "@/lib/auth/session";

export type AcceptState = { error?: string };

/**
 * Accepts as the person already signed in. Identity comes from the session,
 * never from the form — the only thing the form carries is which invitation.
 */
export async function joinAsSignedIn(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  const user = await currentUser();
  if (!user) return { error: "Your session has ended. Sign in again." };
  if (!token) return { error: "This invitation link is incomplete." };

  const result = await joinWithInvitation(token, user);
  if (!result.ok) {
    const friendly: Record<string, string> = {
      unknown: "This invitation link is not valid.",
      expired: "This invitation has expired. Ask for a new one.",
      used: "This invitation has already been used.",
      revoked: "This invitation was withdrawn.",
    };
    return { error: friendly[result.error] ?? result.error };
  }

  redirect(result.projectSlug ? `/projects/${result.projectSlug}` : "/projects");
}

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

  redirect(result.projectSlug ? `/projects/${result.projectSlug}` : "/projects");
}
