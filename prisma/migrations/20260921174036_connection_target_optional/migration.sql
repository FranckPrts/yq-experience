-- AlterTable
ALTER TABLE "supabase_connections" ALTER COLUMN "projectRef" DROP NOT NULL,
ALTER COLUMN "projectUrl" DROP NOT NULL;
