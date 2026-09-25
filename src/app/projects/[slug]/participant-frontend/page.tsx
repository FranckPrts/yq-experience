import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { coerceLexicon, coerceTheme } from "@/lib/theme/project-theme";
import ProjectNav from "../nav";
import ParticipantFrontendEditor from "./editor";
import { coerceCopy } from "@/lib/theme/project-copy";

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
    select: { name: true, theme: true, lexicon: true, copy: true },
  });

  const canEdit = access.role === "OWNER" || access.role === "COLLABORATOR";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 bg-void p-8 text-paper">
      <ProjectNav
        slug={slug}
        projectName={project.name}
        here="participant-frontend"
      />

      <p className="max-w-prose text-[11px] leading-relaxed text-dim">
        What a participant sees around the sketch: the colours the page is drawn
        in, the typeface, the word for the thing they are making, and every
        sentence they read. The controls themselves come from the script&rsquo;s
        parameters.
      </p>

      <ParticipantFrontendEditor
        slug={slug}
        theme={coerceTheme(project.theme)}
        lexicon={coerceLexicon(project.lexicon)}
        copy={coerceCopy(project.copy)}
        canEdit={canEdit}
      />
    </main>
  );
}
