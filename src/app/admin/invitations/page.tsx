import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { revokeInviteAction } from "./actions";
import InviteForm from "./form";

export const dynamic = "force-dynamic";

function status(i: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): string {
  if (i.acceptedAt) return "used";
  if (i.revokedAt) return "revoked";
  if (i.expiresAt.getTime() <= Date.now()) return "expired";
  return "open";
}

export default async function InvitationsPage() {
  await requirePlatformAdmin();

  const [projects, invitations] = await Promise.all([
    db.project.findMany({
      select: { slug: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    db.invitation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        project: { select: { slug: true } },
        acceptedBy: { select: { email: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-void p-8 text-paper">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-sm">Invitations</h1>
          <p className="text-xs text-dim">
            Accounts are created only from these links.
          </p>
        </div>
        <Link
          href="/projects"
          className="text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
        >
          projects
        </Link>
      </header>

      <InviteForm projects={projects} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-dim">recent</h2>
        {invitations.length === 0 ? (
          <p className="text-xs text-dim">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invitations.map((i) => {
              const state = status(i);
              return (
                <li
                  key={i.id}
                  className="flex items-baseline justify-between gap-4 border-b border-paper/10 pb-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate text-paper/80">
                      {i.email ?? "any address"}
                      {i.project && ` → ${i.project.slug}`}
                      {i.grantsPlatformAdmin && " · admin"}
                    </p>
                    <p className="text-dim">
                      {i.role.toLowerCase()} · {state}
                      {i.acceptedBy && ` by ${i.acceptedBy.email}`} · expires{" "}
                      {i.expiresAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  {state === "open" && (
                    <form action={revokeInviteAction} className="shrink-0">
                      <input type="hidden" name="id" value={i.id} />
                      <button
                        type="submit"
                        className="text-dim underline-offset-4 hover:text-red-400 hover:underline"
                      >
                        revoke
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
