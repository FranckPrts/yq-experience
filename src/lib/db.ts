import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * One client per process.
 *
 * Next's dev server re-evaluates modules on every hot reload, so a plain
 * `new PrismaClient()` would open a fresh pool each time and exhaust Postgres'
 * connection limit within a few edits. Stashing it on `globalThis` survives the
 * reload; in production the module is evaluated once and the global is unused.
 *
 * Prisma 7 requires an explicit driver adapter — there is no built-in engine to
 * fall back on — so the connection string is handed to `PrismaPg` rather than
 * read from the schema. `DATABASE_URL` lives in `.env`, which Next loads for us
 * alongside `.env.local`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
