import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { coerceLexicon, coerceTheme } from "@/lib/theme/project-theme";
import { coerceCopy } from "@/lib/theme/project-copy";
import { validateParameters } from "@/lib/params/validate";
import type { Parameter } from "@/lib/params/types";
import LivePreview from "./live-preview";

export const dynamic = "force-dynamic";

/**
 * The participant page as a participant gets it, for the editor's iframe.
 * Starts from what is saved; the editor then streams its unsaved drafts in.
 *
 * Behind project access like the rest of `/projects`: it serves the latest
 * script, which is not public until the project opens.
 */
export default async function ParticipantPreviewPage({
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
      theme: true,
      lexicon: true,
      copy: true,
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        select: { code: true, parameters: true, version: true },
      },
    },
  });

  const script = project.scripts[0];
  const parameters = (script?.parameters ?? []) as unknown as Parameter[];
  const usable = !!script && validateParameters(parameters).length === 0;

  return (
    <>
      <link
        rel="preload"
        as="script"
        href="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"
        crossOrigin="anonymous"
      />
      <LivePreview
        projectName={project.name}
        theme={coerceTheme(project.theme)}
        lexicon={coerceLexicon(project.lexicon)}
        copy={coerceCopy(project.copy)}
        script={
          usable
            ? { code: script.code, version: script.version, parameters }
            : null
        }
      />
    </>
  );
}
