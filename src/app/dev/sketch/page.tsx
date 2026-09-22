import SketchHarness from "./harness";
import { getProject, listProjects } from "@/lib/projects/get-project";

/**
 * Phase 0.5 harness, now reading from the database rather than from disk.
 *
 * That swap is the point: it exercises the same path the participant runtime
 * will take — load the project, take its active script, drive the controls from
 * the stored declaration — and so proves that what `create-project` wrote round
 * trips back out intact.
 *
 * Which project is active: `?project=<slug>`, else `DEV_PROJECT_SLUG`, else the
 * most recently created one.
 */

export const dynamic = "force-dynamic";

export default async function DevSketchPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: requested } = await searchParams;
  const slug = requested ?? process.env.DEV_PROJECT_SLUG;

  const [project, projects] = await Promise.all([
    getProject(slug),
    listProjects(),
  ]);

  if (!project) {
    return (
      <main className="flex min-h-screen flex-col gap-3 bg-void p-8 text-paper">
        <h1 className="text-sm">No project to show</h1>
        <p className="max-w-prose text-xs text-dim">
          {slug
            ? `Nothing matches the slug "${slug}".`
            : "The database has no projects yet."}{" "}
          Create one with{" "}
          <code className="text-paper/70">
            npx tsx scripts/create-project.mts
          </code>
          .
        </p>
        {projects.length > 0 && (
          <p className="text-xs text-dim">
            Available: {projects.map((p) => p.slug).join(", ")}
          </p>
        )}
      </main>
    );
  }

  if (!project.script) {
    return (
      <main className="flex min-h-screen flex-col gap-3 bg-void p-8 text-paper">
        <h1 className="text-sm">{project.name}</h1>
        <p className="text-xs text-dim">
          This project has no script uploaded yet.
        </p>
      </main>
    );
  }

  return <SketchHarness project={project} projects={projects} />;
}
