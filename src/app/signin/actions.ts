"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

export type SignInState = { error?: string };

/**
 * A Server Action is a POST endpoint against the page that declares it, and
 * anyone who can send that POST reaches it. So this validates everything
 * itself; the page around it guarantees nothing.
 */
export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Same message and roughly the same work whether the account exists or the
  // password is wrong, so this route cannot be used to enumerate addresses.
  const ok = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword(
        "$argon2id$v=19$m=19456,t=2,p=1$YWFhYWFhYWFhYWFhYWFhYQ$Q0kAIRyR9VZKZPVDrLxkhVcBLAjzCfHcbCoMBUw6rTI",
        password,
      );

  if (!user || !ok) {
    return { error: "That email and password do not match." };
  }

  const userAgent = (await headers()).get("user-agent");
  await createSession(user.id, userAgent);

  // Only ever redirect within this app — an open redirect here would turn the
  // sign-in page into a credible phishing hop.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/projects");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/signin");
}
