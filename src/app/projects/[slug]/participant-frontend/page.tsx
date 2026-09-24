import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { coerceLexicon, coerceTheme } from "@/lib/theme/project-theme";
import ProjectNav from "../nav";
import AppearanceForm from "./form";
import CopyForm from "./copy-form";
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
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-void p-8 text-paper">
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

      {canEdit ? (
        <>
          <AppearanceForm
            slug={slug}
            theme={coerceTheme(project.theme)}
            lexicon={coerceLexicon(project.lexicon)}
          />
          <section className="flex flex-col gap-4 border-t border-paper/10 pt-8">
            <h2 className="text-sm">wording</h2>
            <CopyForm
              slug={slug}
              copy={coerceCopy(project.copy)}
              lexicon={coerceLexicon(project.lexicon)}
              theme={coerceTheme(project.theme)}
            />
          </section>
        </>
      ) : (
        <p className="text-xs text-dim">
          You have read-only access to this project.
        </p>
      )}
    </main>
  );
}
