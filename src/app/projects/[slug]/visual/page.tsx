import Link from "next/link";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import ProjectNav from "../nav";
import ScriptSection from "./section";

export const dynamic = "force-dynamic";

export default async function VisualPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await requireProjectRole(slug, "VIEWER");

  const project = await db.project.findUniqueOrThrow({
    where: { id: access.projectId },
    select: {
      name: true,
      scripts: {
        orderBy: { version: "desc" },
        take: 20,
        select: {
          label: true,
          version: true,
          parameters: true,
          createdAt: true,
          uploadedById: true,
        },
      },
    },
  });

  const canEdit = access.role === "OWNER" || access.role === "COLLABORATOR";
  const active = project.scripts[0];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-void p-8 text-paper">
      <ProjectNav slug={slug} projectName={project.name} here="visual" />

      <p className="max-w-prose text-[11px] leading-relaxed text-dim">
        The p5 sketch, and the declaration that says which of its knobs a
        participant may turn. Scripts are authored in YouQuantified&rsquo;s
        editor and uploaded here — nothing is edited in place.
      </p>

      <ScriptSection slug={slug} canEdit={canEdit} versions={project.scripts.map((s) => ({
        version: s.version,
        label: s.label,
        parameterCount: (s.parameters as unknown[]).length,
        createdAt: s.createdAt.toISOString().slice(0, 10),
        uploadedBy: s.uploadedById,
      }))} />

      {active && canEdit && (
        <section className="flex flex-col gap-2 border-t border-paper/10 pt-6">
          <h2 className="text-xs text-dim">parameters</h2>
          <p className="text-sm">
            {(active.parameters as unknown[]).length} declared on v
            {active.version}.{" "}
            <Link
              href={`/projects/${slug}/parameters`}
              className="text-paper underline underline-offset-4"
            >
              edit them
            </Link>
          </p>
          <p className="text-[11px] leading-relaxed text-dim">
            Editing the declaration saves a new version carrying the same code,
            so a parameter change can be rolled back exactly like a code change.
          </p>
        </section>
      )}
    </main>
  );
}
