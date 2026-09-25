import Link from "next/link";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { coerceLexicon } from "@/lib/theme/project-theme";
import type { Parameter } from "@/lib/params/types";
import ProjectNav from "../nav";
import OpsConsole from "./console";

export const dynamic = "force-dynamic";

/**
 * The room, while an event is running: who has made an avatar, which two are
 * on stage, and the scores coming back from the scene.
 *
 * Viewers may watch. Staging needs a collaborator or owner.
 */
export default async function ConsolePage({
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
      openForParticipation: true,
      lexicon: true,
      connection: {
        select: { projectUrl: true, publishableKey: true, provisionedAt: true },
      },
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        select: { code: true, parameters: true, version: true },
      },
    },
  });

  const connection = project.connection;
  const script = project.scripts[0];
  const ready =
    !!connection?.projectUrl &&
    !!connection.publishableKey &&
    !!connection.provisionedAt;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 bg-void p-8 text-paper">
      <ProjectNav
        slug={slug}
        projectName={project.name}
        here="console"
        subtitle={
          project.openForParticipation
            ? "Open to participants."
            : "Closed — nothing new will arrive until it is opened."
        }
      />

      {ready ? (
        <OpsConsole
          slug={slug}
          projectUrl={connection!.projectUrl!}
          publishableKey={connection!.publishableKey!}
          parameters={(script?.parameters ?? []) as unknown as Parameter[]}
          code={script?.code ?? null}
          scriptVersion={script?.version ?? null}
          lexicon={coerceLexicon(project.lexicon)}
          canStage={access.role === "OWNER" || access.role === "COLLABORATOR"}
        />
      ) : (
        <p className="text-xs text-dim">
          The console reads the project&rsquo;s own database, which isn&rsquo;t
          set up yet.{" "}
          <Link
            href={`/projects/${slug}/database`}
            className="underline underline-offset-4 hover:text-paper"
          >
            Connect and provision it
          </Link>{" "}
          first.
        </p>
      )}
    </main>
  );
}
