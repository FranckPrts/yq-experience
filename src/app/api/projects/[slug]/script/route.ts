import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectRole } from "@/lib/auth/dal";
import { projectReadme, zipFiles } from "@/lib/visuals/bundle";

/**
 * Downloads a project's stored script.
 *
 * Default is a zip of the sketch, its declaration and a short README.
 * `?file=sketch|parameters` fetches one piece, and `?version=N` reaches back
 * into the history.
 *
 * This is the half that makes editing a round trip: take what is live, change
 * it, upload it back as the next version. Without it the only copy of a running
 * script is whatever the tenant happened to keep on their laptop.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // A viewer may read a project, and reading includes taking a copy.
  const { projectId } = await requireProjectRole(slug, "VIEWER");

  const which = request.nextUrl.searchParams.get("file");
  if (which && which !== "sketch" && which !== "parameters") {
    return NextResponse.json(
      { error: "file must be 'sketch' or 'parameters'" },
      { status: 400 },
    );
  }

  const requested = request.nextUrl.searchParams.get("version");
  const version = requested ? Number(requested) : null;
  if (requested && !Number.isInteger(version)) {
    return NextResponse.json({ error: "bad version" }, { status: 400 });
  }

  const [script, project] = await Promise.all([
    db.avatarScript.findFirst({
      where: version ? { projectId, version } : { projectId },
      orderBy: version ? undefined : { version: "desc" },
    }),
    db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true, lexicon: true },
    }),
  ]);
  if (!script) {
    return NextResponse.json({ error: "no such script" }, { status: 404 });
  }

  // Re-serialised from the database rather than kept verbatim, so what comes
  // back is the declaration that actually drives the controls. The project's
  // lexicon rides along, making this a faithful round trip.
  const declaration = JSON.stringify(
    { lexicon: project.lexicon ?? undefined, parameters: script.parameters },
    null,
    2,
  );

  const base = `${slug}-v${script.version}`;

  if (which) {
    const body = which === "sketch" ? script.code : declaration;
    const name = which === "sketch" ? `${base}.js` : `${base}.parameters.json`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const zip = zipFiles([
    { name: "sketch.js", content: script.code },
    { name: "parameters.json", content: declaration },
    {
      name: "README.md",
      content: projectReadme({
        projectName: project.name,
        slug,
        version: script.version,
      }),
    },
  ]);

  return new NextResponse(zip as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${base}.zip"`,
      "Content-Length": String(zip.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
