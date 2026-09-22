import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { coerceLexicon, coerceTheme } from "@/lib/theme/project-theme";
import ProjectNav from "../nav";
import AppearanceForm from "./form";

export const dynamic = "force-dynamic";

export default async function ParticipantFrontendPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await requireProjectRole(slug, "VIEWER");

  const project = await db.project.findUniqueOrThrow({
    where: { id: access.projectId },
    select: { name: true, theme: true, lexicon: true },
  });

  const canEdit = access.role === "OWNER" || access.role === "COLLABORATOR";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-void p-8 text-paper">
      <ProjectNav
        slug={slug}
        projectName={project.name}
        here="participant-frontend"
      />

      <p className="max-w-prose text-[11px] leading-relaxed text-dim">
        What a participant sees around the sketch: the colours the page is drawn
        in, the typeface, and the word for the thing they are making. The
        controls themselves come from the script&rsquo;s parameters.
      </p>

      {canEdit ? (
        <AppearanceForm
          slug={slug}
          theme={coerceTheme(project.theme)}
          lexicon={coerceLexicon(project.lexicon)}
        />
      ) : (
        <p className="text-xs text-dim">
          You have read-only access to this project.
        </p>
      )}
    </main>
  );
}
