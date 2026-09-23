import { db } from "@/lib/db";

/**
 * Whether a project has everything a participant needs.
 *
 * All three buckets have to be filled before the doors open, because the
 * failure mode otherwise lands on a participant rather than on the tenant: an
 * open project with no script is a blank screen, and one with no provisioned
 * database is a save button that throws. Both are discovered at an event.
 */

export type Readiness = {
  ready: boolean;
  missing: string[];
  hasScript: boolean;
  hasConnection: boolean;
  provisioned: boolean;
};

export async function projectReadiness(projectId: string): Promise<Readiness> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      connection: {
        select: { projectRef: true, publishableKey: true, provisionedAt: true },
      },
      scripts: { take: 1, select: { id: true } },
    },
  });

  const hasScript = !!project?.scripts.length;
  const connection = project?.connection;
  const hasConnection = !!connection?.projectRef && !!connection.publishableKey;
  const provisioned = !!connection?.provisionedAt;

  const missing: string[] = [];
  if (!hasConnection) missing.push("a Supabase project to write to");
  else if (!provisioned) missing.push("its tables — run provisioning");
  if (!hasScript) missing.push("a script to render");

  return {
    ready: missing.length === 0,
    missing,
    hasScript,
    hasConnection,
    provisioned,
  };
}
