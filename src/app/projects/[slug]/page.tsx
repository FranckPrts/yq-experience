import Link from "next/link";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { coerceLexicon, coerceTheme, FONTS } from "@/lib/theme/project-theme";
import { RenameForm } from "./settings-form";
import ProjectNav from "./nav";
import ParticipationToggle from "./participation-toggle";
import { projectReadiness } from "@/lib/projects/readiness";

export const dynamic = "force-dynamic";

/** One line per bucket: what it is, and whether it is ready. */
function Bucket({
  href,
  title,
  state,
  ready,
  blurb,
}: {
  href: string;
  title: string;
  state: string;
  ready: boolean;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 border-b border-paper/10 pb-3 hover:border-paper/30"
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-paper">{title}</span>
        <span className={`shrink-0 text-xs ${ready ? "text-dim" : "text-amber-400/80"}`}>
          {state}
        </span>
      </div>
      <span className="text-[11px] leading-relaxed text-dim">{blurb}</span>
    </Link>
  );
}

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await requireProjectRole(slug, "VIEWER");

  const project = await db.project.findUniqueOrThrow({
    where: { id: access.projectId },
    include: {
      connection: {
        select: { projectRef: true, provisionedAt: true, accessTokenEnc: true },
      },
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true, parameters: true },
      },
      members: {
        include: { user: { select: { email: true, displayName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const theme = coerceTheme(project.theme);
  const lexicon = coerceLexicon(project.lexicon);
  const script = project.scripts[0];
  const connection = project.connection;
  const isOwner = access.role === "OWNER";
  const readiness = await projectReadiness(access.projectId);
  const base = process.env.APP_BASE_URL ?? "http://localhost:3100";

  const connectionState = !connection?.accessTokenEnc
    ? "not connected"
    : !connection.projectRef
      ? "no target chosen"
      : connection.provisionedAt
        ? `${connection.projectRef} · provisioned`
        : `${connection.projectRef} · not provisioned`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-void p-8 text-paper">
      <ProjectNav
        slug={slug}
        projectName={project.name}
        here="overview"
        subtitle={`${project.slug} · you are ${access.role.toLowerCase()}${
          access.viaPlatformAdmin ? " (as administrator)" : ""
        }`}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-xs text-dim">participation</h2>
        <ParticipationToggle
          slug={project.slug}
          open={project.openForParticipation}
          canEdit={isOwner}
          missing={readiness.missing}
          publicUrl={`${base}/e/${project.slug}`}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-dim">the three parts</h2>
        <Bucket
          href={`/projects/${slug}/participant-frontend`}
          title="style &amp; language"
          state={`${lexicon.noun} · ${FONTS[theme.font].label.toLowerCase()}`}
          ready
          blurb="The palette, typeface and the word for what participants make."
        />
        <Bucket
          href={`/projects/${slug}/visual`}
          title="script &amp; parameters"
          state={
            script
              ? `v${script.version} · ${(script.parameters as unknown[]).length} parameters`
              : "no script"
          }
          ready={!!script}
          blurb="The p5 sketch, and which of its knobs a participant may turn."
        />
        <Bucket
          href={`/projects/${slug}/database`}
          title="database"
          state={connectionState}
          ready={!!connection?.provisionedAt}
          blurb="Your Supabase project, where participants and their avatars live."
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs text-dim">name</h2>
        <RenameForm slug={project.slug} name={project.name} canRename={isOwner} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-dim">members</h2>
        <ul className="flex flex-col gap-2 text-xs">
          {project.members.map((m) => (
            <li
              key={m.id}
              className="flex justify-between gap-4 border-b border-paper/10 pb-2"
            >
              <span>{m.user.displayName ?? m.user.email}</span>
              <span className="text-dim">{m.role.toLowerCase()}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
