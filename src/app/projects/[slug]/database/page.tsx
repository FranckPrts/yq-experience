import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import {
  accessTokenFor,
  listSupabaseProjects,
  SCOPE_PURPOSE,
  SupabaseApiError,
} from "@/lib/supabase/management";
import ProjectNav from "../nav";
import ConnectionSection, { type ConnectionView } from "./section";
import ProvisionSection from "./provision-section";
import { SCHEMA_VERSION, sceneSnippet } from "@/lib/spoke/schema";

export const dynamic = "force-dynamic";

/**
 * Reads the account's project list, if the connection can still do so. A failure
 * here is information, not a crash: the page should say what went wrong with
 * the reconnect button still reachable.
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

export default async function DatabasePage({
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
      connection: {
        select: {
          id: true,
          projectRef: true,
          projectUrl: true,
          publishableKey: true,
          provisionedAt: true,
          schemaVersion: true,
          anonSignInsEnabled: true,
          secretKeyEnc: true,
          accessTokenEnc: true,
        },
      },
    },
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-void p-8 text-paper">
      <ProjectNav slug={slug} projectName={project.name} here="database" />

      <p className="max-w-prose text-[11px] leading-relaxed text-dim">
        Participants and their avatars live in your own Supabase project, never
        here. This app needs enough access to create the tables and read them
        back; the secret key is encrypted at rest and never reaches a browser.
      </p>

      <ConnectionSection
        slug={slug}
        view={await connectionView(project.connection)}
        canEdit={access.role === "OWNER"}
      />

      <section className="flex flex-col gap-4 border-t border-paper/10 pt-6">
        <h2 className="text-xs text-dim">tables &amp; policies</h2>
        <ProvisionSection
          slug={slug}
          canEdit={access.role === "OWNER"}
          view={{
            ready: !!project.connection?.projectRef,
            provisioned: !!project.connection?.provisionedAt,
            schemaVersion: project.connection?.schemaVersion ?? null,
            currentVersion: SCHEMA_VERSION,
            anonEnabled: !!project.connection?.anonSignInsEnabled,
            sceneSnippet:
              project.connection?.projectUrl &&
              project.connection?.publishableKey
                ? sceneSnippet({
                    projectUrl: project.connection.projectUrl,
                    publishableKey: project.connection.publishableKey,
                  })
                : null,
          }}
        />
      </section>
    </main>
  );
}
