/**
 * Generates an invitation link from the command line.
 *
 * The same thing /admin/invitations does in the browser, for when a link is
 * needed from a terminal — bootstrapping, or scripting a batch for an event.
 *
 *   npm run invite -- --by you@example.com --email them@example.com
 *   npm run invite -- --by you@example.com --project fish-school-pw-2026 --role OWNER
 *
 * `--by` must be a platform admin: this CLI does not let someone hand out
 * standing they do not have.
 */

import "dotenv/config";
import { db } from "../src/lib/db.ts";
import { createInvitation, invitationUrl } from "../src/lib/auth/invitations.ts";
import type { Role } from "../src/generated/prisma/enums.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const by = arg("by")?.trim().toLowerCase();
  if (!by) {
    console.error(
      "Required: --by <admin email>  [--email <address>] [--project <slug>] [--role OWNER|COLLABORATOR|VIEWER] [--days 14]",
    );
    process.exit(1);
  }

  const admin = await db.user.findUnique({
    where: { email: by },
    select: { id: true, isPlatformAdmin: true },
  });
  if (!admin) {
    console.error(`No user ${by}. Create one with: npm run admin -- --email ${by}`);
    process.exit(1);
  }
  if (!admin.isPlatformAdmin) {
    console.error(`${by} is not a platform admin, so cannot invite.`);
    process.exit(1);
  }

  const projectSlug = arg("project");
  let projectId: string | null = null;
  if (projectSlug) {
    const project = await db.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });
    if (!project) {
      console.error(`No project with slug "${projectSlug}".`);
      process.exit(1);
    }
    projectId = project.id;
  }

  const role = (arg("role") ?? "COLLABORATOR").toUpperCase() as Role;
  if (!["OWNER", "COLLABORATOR", "VIEWER"].includes(role)) {
    console.error(`Unknown role "${role}".`);
    process.exit(1);
  }

  const days = Number(arg("days") ?? 14);
  const { invitation, token } = await createInvitation({
    createdById: admin.id,
    email: arg("email") ?? null,
    projectId,
    role,
    ttlDays: Number.isFinite(days) && days > 0 ? days : 14,
  });

  console.log(`\n  Invitation created`);
  console.log(`    for        ${invitation.email ?? "any address"}`);
  console.log(
    `    project    ${invitation.project ? `${invitation.project.slug} (${role.toLowerCase()})` : "none"}`,
  );
  console.log(`    expires    ${invitation.expiresAt.toISOString().slice(0, 10)}`);
  // Only the hash is stored, so this is the one time the link exists.
  console.log(`\n    ${invitationUrl(token)}\n`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
