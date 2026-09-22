import Link from "next/link";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import ParameterBuilder from "./builder";
import type { Parameter } from "@/lib/params/types";

export const dynamic = "force-dynamic";

export default async function ParametersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { projectId } = await requireProjectRole(slug, "COLLABORATOR");

  const [project, script] = await Promise.all([
    db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true, slug: true },
    }),
    db.avatarScript.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      select: { version: true, label: true, parameters: true },
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 bg-void p-8 text-paper">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-sm">{project.name} · parameters</h1>
          <p className="text-xs text-dim">
            {script
              ? `editing the declaration from ${script.label ?? "script"} v${script.version} — saving creates v${script.version + 1} with the same code`
              : "no script yet"}
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href={`/dev/sketch?project=${slug}`}
            className="text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
          >
            preview
          </Link>
          <Link
            href={`/projects/${slug}`}
            className="text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
          >
            settings
          </Link>
        </div>
      </header>

      {script ? (
        <ParameterBuilder
          slug={slug}
          scriptVersion={script.version}
          initial={script.parameters as unknown as Parameter[]}
        />
      ) : (
        <p className="text-xs text-dim">
          Upload a script first — the declaration describes the controls for a
          sketch, so there has to be a sketch.{" "}
          <Link
            href={`/projects/${slug}`}
            className="underline underline-offset-4 hover:text-paper"
          >
            Go to settings
          </Link>
          .
        </p>
      )}
    </main>
  );
}
