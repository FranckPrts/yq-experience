"use client";

import { useActionState, useState } from "react";
import {
  renameProject,
  saveAppearance,
  type SettingsState,
} from "./actions";
import { FONTS, type ProjectLexicon, type ProjectTheme } from "@/lib/theme/project-theme";

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

export function AppearanceForm({
  slug,
  theme,
  lexicon,
}: {
  slug: string;
  theme: ProjectTheme;
  lexicon: ProjectLexicon;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveAppearance,
    {},
  );
  // Local mirror purely so the swatches preview live before saving.
  const [preview, setPreview] = useState(theme);

  const swatch = (key: "void" | "paper" | "dim", label: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-dim">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          name={key}
          value={preview[key]}
          onChange={(e) =>
            setPreview((p) => ({ ...p, [key]: e.target.value.toLowerCase() }))
          }
          className="h-7 w-10 cursor-pointer border border-paper/20 bg-transparent"
        />
        <code className="text-[11px] text-dim">{preview[key]}</code>
      </div>
    </label>
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-4 sm:grid-cols-3">
        {swatch("void", "background")}
        {swatch("paper", "text")}
        {swatch("dim", "secondary")}
      </div>

      <div
        className="rounded border border-paper/10 p-4"
        style={{
          backgroundColor: preview.void,
          fontFamily: FONTS[preview.font].stack,
        }}
      >
        <p className="text-sm" style={{ color: preview.paper }}>
          Name your {lexicon.noun}
        </p>
        <p className="text-xs" style={{ color: preview.dim }}>
          core_size : |————————|
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-dim">typeface</span>
        <select
          name="font"
          value={preview.font}
          onChange={(e) =>
            setPreview((p) => ({
              ...p,
              font: e.target.value as ProjectTheme["font"],
            }))
          }
          className="term-input border-b border-paper/20 bg-void"
        >
          {Object.entries(FONTS).map(([key, font]) => (
            <option key={key} value={key}>
              {font.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-dim">what participants make</span>
          <input
            name="noun"
            defaultValue={lexicon.noun}
            className="term-input border-b border-paper/20"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-dim">plural</span>
          <input
            name="nounPlural"
            defaultValue={lexicon.nounPlural}
            className="term-input border-b border-paper/20"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="self-start text-sm text-paper underline underline-offset-4 disabled:text-dim"
        >
          {pending ? "saving…" : "save appearance"}
        </button>
        <Saved state={state} />
      </div>
    </form>
  );
}
