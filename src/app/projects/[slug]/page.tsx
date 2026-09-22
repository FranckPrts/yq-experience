import Link from "next/link";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { coerceLexicon, coerceTheme } from "@/lib/theme/project-theme";
import { setOpenForParticipation } from "./actions";
import { AppearanceForm, RenameForm } from "./settings-form";
import ConnectionSection, { type ConnectionView } from "./connection-section";
import ScriptSection from "./script-section";
import {
  accessTokenFor,
  listSupabaseProjects,
  SCOPE_PURPOSE,
  SupabaseApiError,
} from "@/lib/supabase/management";

export const dynamic = "force-dynamic";

/**
 * Reads the account's project list, if the connection can still do so. A failure
 * here is information, not a crash: an expired or revoked authorisation should
 * show as a message on the page, with the reconnect button still reachable.
 */
async function connectionView(connection: {
  id: string;
  projectRef: string | null;
  provisionedAt: Date | null;
  secretKeyEnc: string | null;
  accessTokenEnc: string | null;
} | null): Promise<ConnectionView> {
  if (!connection || !connection.accessTokenEnc) {
    return {
      connected: false,
      projectRef: null,
      provisioned: false,
      hasSecretKey: false,
      available: null,
      listError: null,
    };
  }

  const base = {
    connected: true,
    projectRef: connection.projectRef,
    provisioned: !!connection.provisionedAt,
    hasSecretKey: !!connection.secretKeyEnc,
  };

  try {
    const token = await accessTokenFor(connection.id);
    const projects = await listSupabaseProjects(token);
    return {
      ...base,
      available: projects.map((p) => ({
        ref: p.ref,
        name: p.name,
        region: p.region,
      })),
      listError: null,
    };
  } catch (error) {
    // Expected and explainable, so `warn` — `console.error` would raise Next's
    // dev error overlay over something the page already handles.
    console.warn("[supabase] listing projects failed:", error);

    if (error instanceof SupabaseApiError) {
      const missing = error.missingScopes;
      if (missing) {
        const named = missing
          .map((s) => `${s}${SCOPE_PURPOSE[s] ? ` (to ${SCOPE_PURPOSE[s]})` : ""}`)
          .join(", ");
        return {
          ...base,
          available: null,
          listError: `Your Supabase OAuth app is missing the scope ${named}. Add it in the Supabase dashboard under organization → OAuth Apps, then disconnect and connect again — a token only carries the scopes it was granted at authorisation.`,
        };
      }
      if (error.status === 401) {
        return {
          ...base,
          available: null,
          listError:
            "Supabase rejected this authorisation. Disconnect and connect again.",
        };
      }
    }

    return {
      ...base,
      available: null,
      listError:
        "Could not reach Supabase to list this account's projects. Try again shortly.",
    };
  }
}

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Viewers may look; the forms below decide for themselves what may be edited.
  const access = await requireProjectRole(slug, "VIEWER");

  const project = await db.project.findUniqueOrThrow({
    where: { id: access.projectId },
    include: {
      connection: {
        select: {
          id: true,
          projectRef: true,
          provisionedAt: true,
          secretKeyEnc: true,
          accessTokenEnc: true,
        },
      },
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
      members: {
        include: { user: { select: { email: true, displayName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const theme = coerceTheme(project.theme);
  const lexicon = coerceLexicon(project.lexicon);
  const isOwner = access.role === "OWNER";
  const canEdit = access.role === "OWNER" || access.role === "COLLABORATOR";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 bg-void p-8 text-paper">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-sm">{project.name}</h1>
          <p className="text-xs text-dim">
            {project.slug} · you are {access.role.toLowerCase()}
            {access.viaPlatformAdmin && " (as administrator)"}
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href={`/dev/sketch?project=${project.slug}`}
            className="text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
          >
            preview
          </Link>
          <Link
            href="/projects"
            className="text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
          >
            all projects
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs text-dim">participation</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm">
            {project.openForParticipation
              ? "Open — participants can reach it."
              : "Closed — nothing is reachable by participants."}
          </span>
          {isOwner && (
            <form action={setOpenForParticipation}>
              <input type="hidden" name="slug" value={project.slug} />
              <input
                type="hidden"
                name="open"
                value={project.openForParticipation ? "false" : "true"}
              />
              <button
                type="submit"
                className="text-sm text-paper underline underline-offset-4"
              >
                {project.openForParticipation ? "close" : "open"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs text-dim">name</h2>
        <RenameForm
          slug={project.slug}
          name={project.name}
          canRename={isOwner}
        />
      </section>

      {canEdit && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xs text-dim">appearance &amp; language</h2>
          <AppearanceForm
            slug={project.slug}
            theme={theme}
            lexicon={lexicon}
          />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xs text-dim">supabase</h2>
        <ConnectionSection
          slug={project.slug}
          view={await connectionView(project.connection)}
          canEdit={isOwner}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs text-dim">script</h2>
        <ScriptSection
          slug={project.slug}
          canEdit={canEdit}
          versions={project.scripts.map((s) => ({
            version: s.version,
            label: s.label,
            parameterCount: (s.parameters as unknown[]).length,
            createdAt: s.createdAt.toISOString().slice(0, 10),
            uploadedBy: s.uploadedById,
          }))}
        />
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
