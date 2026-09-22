"use client";

import { useActionState } from "react";
import {
  promoteScriptVersion,
  uploadScript,
  type UploadState,
} from "./actions";

export type ScriptVersion = {
  version: number;
  label: string | null;
  parameterCount: number;
  createdAt: string;
  uploadedBy: string | null;
};

export default function ScriptSection({
  slug,
  versions,
  canEdit,
}: {
  slug: string;
  versions: ScriptVersion[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<UploadState, FormData>(
    uploadScript,
    {},
  );

  const active = versions[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="text-sm">
          {active ? (
            <>
              Active:{" "}
              <code className="text-paper/90">{active.label ?? "script"}</code>{" "}
              <span className="text-dim">
                v{active.version} · {active.parameterCount} parameters
              </span>
            </>
          ) : (
            <span className="text-dim">No script uploaded yet.</span>
          )}
        </div>

        <div className="flex shrink-0 gap-4 text-xs">
          {active && (
            <a
              href={`/projects/${slug}/parameters`}
              className="text-dim underline-offset-4 hover:text-paper hover:underline"
            >
              edit parameters
            </a>
          )}
          {active ? (
            <>
              <a
                href={`/api/projects/${slug}/script`}
                className="text-dim underline-offset-4 hover:text-paper hover:underline"
              >
                download this script (.zip)
              </a>
            </>
          ) : (
            <>
              <a
                href="/api/starter"
                className="text-dim underline-offset-4 hover:text-paper hover:underline"
              >
                download starter (.zip)
              </a>
            </>
          )}
        </div>
      </div>

      {active && (
        <p className="text-[11px] leading-relaxed text-dim">
          Starting fresh? The{" "}
          <a
            href="/api/starter"
            className="underline underline-offset-4 hover:text-paper"
          >
            starter bundle
          </a>{" "}
          is a working sketch, its declaration and a README covering the
          contract — every parameter type used once.
        </p>
      )}

      {canEdit && (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="slug" value={slug} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-dim">sketch.js</span>
              <input
                type="file"
                name="sketch"
                accept=".js,text/javascript"
                required
                className="text-xs text-dim file:mr-3 file:border file:border-paper/20 file:bg-transparent file:px-2 file:py-1 file:text-xs file:text-paper"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-dim">
                parameters.json{" "}
                <span className="text-paper/30">
                  {active ? "(optional — keeps the current one)" : "(required)"}
                </span>
              </span>
              <input
                type="file"
                name="declaration"
                accept=".json,application/json"
                className="text-xs text-dim file:mr-3 file:border file:border-paper/20 file:bg-transparent file:px-2 file:py-1 file:text-xs file:text-paper"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">label (optional)</span>
            <input
              name="label"
              placeholder="defaults to the file name"
              className="term-input border-b border-paper/20"
            />
          </label>

          <p className="text-[11px] leading-relaxed text-dim">
            Uploads add a version rather than replacing one, so a bad upload is
            undone by promoting an earlier version. The declaration is parsed as
            JSON — never executed.
          </p>

          {state.error && (
            <p role="alert" className="text-xs text-red-400">
              {state.error}
            </p>
          )}

          {state.problems && (
            <div className="flex flex-col gap-1 rounded border border-red-500/40 p-3">
              <p className="text-xs text-red-400">
                The declaration is not valid, so nothing was uploaded:
              </p>
              <ul className="text-[11px] leading-relaxed text-red-300/80">
                {state.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {state.uploaded && (
            <p className="text-xs text-dim">
              uploaded v{state.uploaded.version} · {state.uploaded.parameters}{" "}
              parameters
            </p>
          )}

          {state.warnings && (
            <div className="flex flex-col gap-1 rounded border border-amber-500/40 p-3">
              <p className="text-xs text-amber-400">
                Uploaded, but worth a look:
              </p>
              <ul className="text-[11px] leading-relaxed text-amber-200/70">
                {state.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="self-start text-sm text-paper underline underline-offset-4 disabled:text-dim"
          >
            {pending ? "uploading…" : "upload version"}
          </button>
        </form>
      )}

      {versions.length > 1 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs text-dim">history</h3>
          <ul className="flex flex-col gap-2 text-xs">
            {versions.map((v, i) => (
              <li
                key={v.version}
                className="flex items-baseline justify-between gap-4 border-b border-paper/10 pb-2"
              >
                <span className={i === 0 ? "" : "text-dim"}>
                  v{v.version} · {v.label ?? "script"} · {v.parameterCount}{" "}
                  parameters
                  {i === 0 && <span className="text-paper/60"> · active</span>}
                </span>
                <span className="flex shrink-0 items-baseline gap-3 text-dim">
                  <span>{v.createdAt}</span>
                  <a
                    href={`/api/projects/${slug}/script?version=${v.version}`}
                    className="underline-offset-4 hover:text-paper hover:underline"
                  >
                    .zip
                  </a>
                  {canEdit && i !== 0 && (
                    <form action={promoteScriptVersion}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="version" value={v.version} />
                      <button
                        type="submit"
                        className="underline-offset-4 hover:text-paper hover:underline"
                      >
                        promote
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
