import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { coerceLexicon, coerceTheme } from "@/lib/theme/project-theme";
import { validateParameters } from "@/lib/params/validate";
import type { Parameter } from "@/lib/params/types";
import ParticipantExperience from "./experience";
import Shut from "./shut";
import { coerceCopy, fillCopy } from "@/lib/theme/project-copy";

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
      copy: true,
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
  const copy = coerceCopy(project.copy);
  const vars = {
    noun: lexicon.noun,
    nounPlural: lexicon.nounPlural,
    project: project.name,
  };

  if (!project.openForParticipation) {
    return (
      <Shut
        theme={theme}
        title={project.name}
        message={fillCopy(copy.closedMessage, vars)}
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
        message={fillCopy(copy.notReadyMessage, vars)}
      />
    );
  }

  return (
    <>
      {/*
        The 1MB p5 bundle is fetched by the iframe, which does not exist until
        React has hydrated and built its srcDoc — so without this the download
        does not even begin until the client bundle has parsed. Preloading from
        the server-rendered HTML starts it immediately, in parallel. `crossorigin`
        has to match the iframe's script tag or the cache entry will not be
        reused. Supabase gets a preconnect for the same reason: the participant
        will authenticate against it moments from now.
      */}
      <link
        rel="preload"
        as="script"
        href="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"
        crossOrigin="anonymous"
      />
      <link rel="preconnect" href={connection!.projectUrl!} crossOrigin="" />
      <ParticipantExperience
        projectName={project.name}
        theme={theme}
        lexicon={lexicon}
        supabaseUrl={connection!.projectUrl!}
        publishableKey={connection!.publishableKey!}
        code={script!.code}
        scriptVersion={script!.version}
        parameters={parameters}
        copy={copy}
      />
    </>
  );
}
