import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  coerceLexicon,
  coerceTheme,
  FONTS,
  themeCssVars,
} from "@/lib/theme/project-theme";
import { validateParameters } from "@/lib/params/validate";
import type { Parameter } from "@/lib/params/types";
import ParticipantExperience from "./experience";

/**
 * The participant's door. No sign-in, no account — the only identity involved
 * is the anonymous one the browser takes out with the *tenant's* Supabase.
 *
 * This is the one route in the app that serves people who have no relationship
 * with us at all, so it says as little as possible about anything they are not
 * entitled to: a project that exists but is shut looks different from one that
 * never existed, and nothing here reveals who owns it.
 */

export const dynamic = "force-dynamic";

function Shut({
  theme,
  title,
  message,
}: {
  theme: ReturnType<typeof coerceTheme>;
  title: string;
  message: string;
}) {
  return (
    <main
      style={{
        ...themeCssVars(theme),
        backgroundColor: theme.void,
        color: theme.paper,
        fontFamily: FONTS[theme.font].stack,
      }}
      className="flex min-h-screen items-center justify-center p-8"
    >
      <div className="max-w-sm">
        <h1 className="text-sm">{title}</h1>
        <p className="mt-2 text-xs" style={{ color: theme.dim }}>
          {message}
        </p>
      </div>
    </main>
  );
}

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const project = await db.project.findUnique({
    where: { slug },
    select: {
      name: true,
      openForParticipation: true,
      theme: true,
      lexicon: true,
      connection: {
        select: {
          projectUrl: true,
          publishableKey: true,
          provisionedAt: true,
        },
      },
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        select: { code: true, parameters: true, version: true },
      },
    },
  });

  // Only a slug that was never a project 404s. A real project that is shut says
  // so — a 404 there reads as a mistyped link and sends people hunting.
  if (!project) notFound();

  const theme = coerceTheme(project.theme);
  const lexicon = coerceLexicon(project.lexicon);

  if (!project.openForParticipation) {
    return (
      <Shut
        theme={theme}
        title={project.name}
        message="This experience isn’t open yet. Check back when the people running it say so."
      />
    );
  }

  const connection = project.connection;
  const script = project.scripts[0];
  const parameters = (script?.parameters ?? []) as unknown as Parameter[];

  // Belt and braces against the activation gate: a project could have been
  // opened and then had its script removed, and a participant should meet a
  // sentence rather than a stack trace.
  const usable =
    !!connection?.projectUrl &&
    !!connection.publishableKey &&
    !!connection.provisionedAt &&
    !!script &&
    validateParameters(parameters).length === 0;

  if (!usable) {
    return (
      <Shut
        theme={theme}
        title={project.name}
        message="This experience isn’t quite ready. The people running it have been left a note."
      />
    );
  }

  return (
    <ParticipantExperience
      projectName={project.name}
      theme={theme}
      lexicon={lexicon}
      supabaseUrl={connection!.projectUrl!}
      publishableKey={connection!.publishableKey!}
      code={script!.code}
      scriptVersion={script!.version}
      parameters={parameters}
    />
  );
}
