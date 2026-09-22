import Link from "next/link";
import { requireUser, visibleProjects } from "@/lib/auth/dal";
import { signOut } from "@/app/signin/actions";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser("/projects");
  const projects = await visibleProjects(user);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-void p-8 text-paper">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-sm">Projects</h1>
          <p className="text-xs text-dim">
            {user.displayName ?? user.email}
            {user.isPlatformAdmin && " · administrator"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {user.isPlatformAdmin && (
            <Link
              href="/admin/invitations"
              className="text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
            >
              invitations
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
            >
              sign out
            </button>
          </form>
        </div>
      </header>

      {projects.length === 0 ? (
        <p className="text-xs text-dim">
          You are not a member of any project yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li
              key={project.slug}
              className="flex items-baseline justify-between gap-4 border-b border-paper/10 pb-3"
            >
              <div>
                <p className="text-sm">{project.name}</p>
                <p className="text-xs text-dim">
                  {project.slug} ·{" "}
                  {project.members[0]?.role.toLowerCase() ??
                    "visible as administrator"}{" "}
                  · {project.openForParticipation ? "open" : "closed"}
                </p>
              </div>
              <div className="flex shrink-0 gap-4">
                <Link
                  href={`/projects/${project.slug}`}
                  className="text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
                >
                  settings
                </Link>
                <Link
                  href={`/dev/sketch?project=${project.slug}`}
                  className="text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
                >
                  preview
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
