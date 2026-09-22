/**
 * Creates or re-creates a platform administrator.
 *
 * Invite-only registration has a bootstrapping problem: the first account
 * cannot be invited, because there is nobody to invite it. This CLI is that
 * first account, and the way back in if every admin locks themselves out. It
 * requires shell access to the server, which is the point.
 *
 *   npx tsx scripts/create-admin.mts --email you@example.com --password '...'
 *
 * On an existing account it resets the password, grants admin, and signs that
 * user out everywhere — a password reset that leaves old sessions alive is not
 * a reset.
 */

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { db } from "../src/lib/db.ts";
import { hashPassword, passwordProblem } from "../src/lib/auth/password.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email) {
    console.error("Required: --email <address> [--password <password>] [--name <name>]");
    process.exit(1);
  }

  const generated = !arg("password");
  const password = arg("password") ?? randomBytes(12).toString("base64url");
  const displayName = arg("name");

  const weak = passwordProblem(password);
  if (weak) {
    console.error(`Password rejected: ${weak}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const existing = await db.user.findUnique({ where: { email } });

  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      displayName: displayName ?? null,
      isPlatformAdmin: true,
    },
    update: {
      passwordHash,
      isPlatformAdmin: true,
      ...(displayName ? { displayName } : {}),
    },
  });

  // Any session issued against the old password must not survive it.
  const { count } = await db.session.deleteMany({ where: { userId: user.id } });

  console.log(`\n  ${existing ? "Updated" : "Created"} platform admin`);
  console.log(`    email     ${user.email}`);
  console.log(`    admin     ${user.isPlatformAdmin}`);
  if (generated) console.log(`    password  ${password}   (shown once)`);
  else console.log(`    password  set from --password`);
  if (count) console.log(`    sessions  ${count} revoked`);
  console.log();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
