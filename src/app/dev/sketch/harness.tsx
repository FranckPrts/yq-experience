"use client";

import { useMemo, useState } from "react";
import AvatarCanvas, { type SketchLog } from "@/components/AvatarCanvas";
import AvatarControls from "@/components/AvatarControls";
import { coerceAll, defaults, renderValues } from "@/lib/params/coerce";
import type { ParamValues } from "@/lib/params/coerce";
import type { ParameterValue } from "@/lib/params/types";
import type { LoadedProject } from "@/lib/projects/get-project";

type HarnessProps = {
  project: LoadedProject;
  projects: { slug: string; name: string; openForParticipation: boolean }[];
};

export default function SketchHarness({ project, projects }: HarnessProps) {
  const script = project.script!;
  const { parameters } = script;

  const [values, setValues] = useState<ParamValues>(() =>
    coerceAll(parameters, defaults(parameters)),
  );
  const [logs, setLogs] = useState<SketchLog[]>([]);

  /**
   * Only the render subset reaches the sketch, and only a change in it makes a
   * new object — otherwise typing an answer would re-post params on every
   * keystroke.
   */
  const sketchParams = useMemo(
    () => renderValues(parameters, values),
    [parameters, values],
  );

  function set(name: string, value: ParameterValue) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <main className="flex min-h-screen flex-col bg-void text-paper md:flex-row">
      <div className="relative h-[50vh] w-full md:h-screen md:flex-1">
        <AvatarCanvas
          key={`${project.slug}-${script.version}`}
          code={script.code}
          params={sketchParams}
          extensions={script.extensions}
          className="h-full w-full"
          onLog={(log) => setLogs((prev) => [...prev.slice(-24), log])}
        />
      </div>

      <aside className="flex w-full flex-col gap-6 p-6 md:h-screen md:w-[28rem] md:overflow-y-auto">
        <header className="flex flex-col gap-2">
          <h1 className="text-sm text-paper">{project.name}</h1>
          <p className="text-xs text-dim">
            {project.slug} · {script.label ?? "script"} v{script.version} ·{" "}
            {project.lexicon.noun} · from the database
          </p>

          {projects.length > 1 && (
            <nav className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {projects.map((p) => {
                const active = p.slug === project.slug;
                return (
                  <a
                    key={p.slug}
                    href={`/dev/sketch?project=${p.slug}`}
                    className={`text-xs underline-offset-4 ${
                      active
                        ? "text-paper underline"
                        : "text-dim hover:text-paper/80"
                    }`}
                  >
                    {p.slug}
                  </a>
                );
              })}
            </nav>
          )}
        </header>

        {project.declarationErrors.length > 0 && (
          <section className="flex flex-col gap-1 rounded border border-red-500/40 p-3">
            <h2 className="text-xs text-red-400">stored declaration is invalid</h2>
            <ul className="text-[11px] leading-relaxed text-red-300/80">
              {project.declarationErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </section>
        )}

        <AvatarControls
          parameters={parameters}
          values={values}
          onChange={set}
          includeText
          advancedOpen
        />

        <section className="flex flex-col gap-2">
          <h2 className="text-xs text-dim">params posted to the sketch</h2>
          <pre className="overflow-x-auto rounded bg-paper/5 p-3 text-[11px] leading-relaxed text-dim">
            {JSON.stringify(sketchParams, null, 2)}
          </pre>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs text-dim">
            sketch → parent channel{" "}
            <span className="text-paper/40">
              ({logs.length === 0 ? "silent" : `${logs.length} message(s)`})
            </span>
          </h2>
          <p className="text-[11px] leading-relaxed text-dim">
            This stays silent while the sketch is healthy. It is here because the
            outbound half of the transport fails <em>quietly</em> when the
            targetOrigin is wrong — a sketch can render perfectly while its error
            channel is dead. Break something in <code>draw</code> to check it.
          </p>
          {logs.length > 0 && (
            <pre className="max-h-48 overflow-auto rounded bg-paper/5 p-3 text-[11px] leading-relaxed text-paper/70">
              {logs.map((log) => `${log.type}: ${log.message}`).join("\n")}
            </pre>
          )}
        </section>
      </aside>
    </main>
  );
}
