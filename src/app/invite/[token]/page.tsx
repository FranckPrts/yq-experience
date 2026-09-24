import Link from "next/link";
import { inspectInvitation } from "@/lib/auth/invitations";
import { currentUser } from "@/lib/auth/dal";
import { signOut } from "@/app/signin/actions";
import AcceptForm from "./form";
import JoinForm from "./join-form";

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  unknown: "This invitation link is not valid.",
  expired: "This invitation has expired.",
  used: "This invitation has already been used.",
  revoked: "This invitation was withdrawn.",
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-void p-6 text-paper">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

/**
 * Three people arrive here, and each gets a different page:
 *
 * - **Signed in** — they already have an account, so accepting is one click.
 *   Co-tenancy is mostly between people who are already here, so this is the
 *   common case rather than the edge.
 * - **Signed out, new** — create an account.
 * - **Signed out, existing** — sign in, and come back.
 *
 * The last two are deliberately *not* told apart. Checking whether the pinned
 * address already has an account would reveal, to whoever holds the link, which
 * emails are registered. Both options are offered and the server sorts it out.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const state = await inspectInvitation(token);

  if (!state.ok) {
    return (
      <Frame>
        <h1 className="mb-2 text-sm">Invitation</h1>
        <p className="text-xs text-dim">{REASONS[state.reason]}</p>
        <p className="mt-4 text-[11px] text-dim">
          Ask whoever sent it for a new link.
        </p>
      </Frame>
    );
  }

  const invitation = state.invitation!;
  const user = await currentUser();

  const what = invitation.project
    ? `You have been invited to ${invitation.project.name} as ${invitation.role.toLowerCase()}.`
    : "You have been invited to yq-experiences.";

  if (user) {
    const mismatch =
      !!invitation.email && invitation.email !== user.email.toLowerCase();

    return (
      <Frame>
        <h1 className="mb-1 text-sm">
          {invitation.project ? `Join ${invitation.project.name}` : "Invitation"}
        </h1>
        <p className="mb-6 text-xs text-dim">
          {what}
        </p>

        {mismatch ? (
          // Said up front rather than discovered by clicking: the server would
          // refuse anyway, and the fix is to switch accounts, not to retry.
          <div className="flex flex-col gap-3">
            <p className="text-xs text-amber-400/90">
              This invitation is for <strong>{invitation.email}</strong>, but
              you are signed in as <strong>{user.email}</strong>.
            </p>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-paper underline underline-offset-4"
              >
                sign out and use the right account
              </button>
            </form>
          </div>
        ) : invitation.project ? (
          <JoinForm
            token={token}
            label={`join as ${invitation.role.toLowerCase()}`}
          />
        ) : (
          <p className="text-xs text-dim">
            You already have an account, so there is nothing to accept here.{" "}
            <Link href="/projects" className="underline underline-offset-4">
              Go to your projects
            </Link>
            .
          </p>
        )}

        <p className="mt-6 text-[11px] text-dim">
          Signed in as {user.email}.
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      <h1 className="mb-1 text-sm">Accept your invitation</h1>
      <p className="mb-6 text-xs text-dim">
        {what}
      </p>

      <p className="mb-4 text-xs">
        Already have an account?{" "}
        <Link
          href={`/signin?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="underline underline-offset-4"
        >
          Sign in to accept
        </Link>
        .
      </p>

      <p className="mb-3 text-[11px] text-dim">Otherwise, create one:</p>
      <AcceptForm
        token={token}
        /* A pinned address is shown but not editable — editing it could only
           make the redemption fail, since the server checks it again. */
        lockedEmail={invitation.email}
      />
    </Frame>
  );
}
