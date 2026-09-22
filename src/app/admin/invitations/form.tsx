"use client";

import { useActionState } from "react";
import { createInviteAction, type InviteState } from "./actions";

export default function InviteForm({
  projects,
}: {
  projects: { slug: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    createInviteAction,
    {},
  );

  return (
    <section className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">
              email <span className="text-paper/30">(optional — pins the link)</span>
            </span>
            <input
              name="email"
              type="email"
              placeholder="anyone, if left blank"
              className="term-input border-b border-paper/20"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">project (optional)</span>
            <select
              name="projectSlug"
              defaultValue=""
              className="term-input border-b border-paper/20 bg-void"
            >
              <option value="">— no project —</option>
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">role in that project</span>
            <select
              name="role"
              defaultValue="COLLABORATOR"
              className="term-input border-b border-paper/20 bg-void"
            >
              <option value="OWNER">owner</option>
              <option value="COLLABORATOR">collaborator</option>
              <option value="VIEWER">viewer</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">expires in (days)</span>
            <input
              name="ttlDays"
              type="number"
              min={1}
              max={90}
              defaultValue={14}
              className="term-input border-b border-paper/20"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs text-dim">
          <input type="checkbox" name="grantsPlatformAdmin" />
          make this account a platform administrator
        </label>

        {state.error && (
          <p role="alert" className="text-xs text-red-400">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="self-start text-sm text-paper underline underline-offset-4 disabled:text-dim"
        >
          {pending ? "generating…" : "generate link"}
        </button>
      </form>

      {state.url && (
        <div className="flex flex-col gap-2 rounded border border-paper/20 p-3">
          <p className="text-xs text-dim">
            Copy this now — only its hash is stored, so it cannot be shown again.
          </p>
          <code className="break-all text-[11px] text-paper/90">{state.url}</code>
        </div>
      )}
    </section>
  );
}
