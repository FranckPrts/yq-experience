"use client";

import { useActionState } from "react";
import { renameProject, type SettingsState } from "./actions";

function Saved({ state }: { state: SettingsState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-xs text-red-400">
        {state.error}
      </p>
    );
  }
  if (state.saved) return <p className="text-xs text-dim">saved</p>;
  return null;
}

export function RenameForm({
  slug,
  name,
  canRename,
}: {
  slug: string;
  name: string;
  canRename: boolean;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    renameProject,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <label className="flex flex-col gap-1">
        <span className="text-xs text-dim">name</span>
        <input
          name="name"
          defaultValue={name}
          disabled={!canRename}
          className="term-input border-b border-paper/20 disabled:text-dim"
        />
      </label>
      <p className="text-[11px] text-dim">
        The URL keeps using <code className="text-paper/60">{slug}</code>.
        Renaming never changes it, so a link handed out at an event goes on
        working.
      </p>
      {canRename && (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="self-start text-sm text-paper underline underline-offset-4 disabled:text-dim"
          >
            {pending ? "saving…" : "save name"}
          </button>
          <Saved state={state} />
        </div>
      )}
    </form>
  );
}
