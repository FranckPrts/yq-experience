import { inspectInvitation } from "@/lib/auth/invitations";
import AcceptForm from "./form";

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  unknown: "This invitation link is not valid.",
  expired: "This invitation has expired.",
  used: "This invitation has already been used.",
  revoked: "This invitation was withdrawn.",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const state = await inspectInvitation(token);

  if (!state.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void p-6 text-paper">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 text-sm">Invitation</h1>
          <p className="text-xs text-dim">{REASONS[state.reason]}</p>
          <p className="mt-4 text-[11px] text-dim">
            Ask an administrator for a new link.
          </p>
        </div>
      </main>
    );
  }

  const invitation = state.invitation!;

  return (
    <main className="flex min-h-screen items-center justify-center bg-void p-6 text-paper">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-sm">Create your account</h1>
        <p className="mb-6 text-xs text-dim">
          {invitation.project
            ? `You have been invited to ${invitation.project.name} as ${invitation.role.toLowerCase()}.`
            : "You have been invited to Constellation."}
          {invitation.grantsPlatformAdmin && " This account will be an administrator."}
        </p>

        <AcceptForm
          token={token}
          /* A pinned address is shown but not editable — editing it could only
             make the redemption fail, since the server checks it again. */
          lockedEmail={invitation.email}
        />
      </div>
    </main>
  );
}
