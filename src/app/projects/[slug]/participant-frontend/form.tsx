"use client";

import { useActionState, useState } from "react";
import { saveAppearance, type AppearanceState } from "./actions";
import {
  FONTS,
  type ProjectLexicon,
  type ProjectTheme,
} from "@/lib/theme/project-theme";

export default function AppearanceForm({
  slug,
  theme,
  lexicon,
}: {
  slug: string;
  theme: ProjectTheme;
  lexicon: ProjectLexicon;
}) {
  const [state, action, pending] = useActionState<AppearanceState, FormData>(
    saveAppearance,
    {},
  );
  // Local mirror purely so the sample previews live before saving.
  const [preview, setPreview] = useState(theme);
  const [noun, setNoun] = useState(lexicon.noun);

  const swatch = (key: "void" | "paper" | "dim", label: string, hint: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-dim">
        {label} <span className="text-paper/25">· {hint}</span>
      </span>
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
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="slug" value={slug} />

      <section className="flex flex-col gap-4">
        <h2 className="text-xs text-dim">palette</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {swatch("void", "background", "the void behind everything")}
          {swatch("paper", "text", "names, values, prompts")}
          {swatch("dim", "secondary", "labels and help")}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs text-dim">typeface</h2>
        <select
          name="font"
          value={preview.font}
          onChange={(e) =>
            setPreview((p) => ({
              ...p,
              font: e.target.value as ProjectTheme["font"],
            }))
          }
          className="term-input max-w-xs border-b border-paper/20 bg-void"
        >
          {Object.entries(FONTS).map(([key, font]) => (
            <option key={key} value={key}>
              {font.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] leading-relaxed text-dim">
          Typefaces come from a list we host, so licensing and loading stay our
          problem rather than yours.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs text-dim">language</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">what participants make</span>
            <input
              name="noun"
              value={noun}
              onChange={(e) => setNoun(e.target.value)}
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
        <p className="text-[11px] leading-relaxed text-dim">
          This word replaces “avatar” everywhere a participant reads it. It
          belongs to the project rather than the script, so changing it never
          means editing delivered code.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-dim">preview</h2>
        <div
          className="rounded border border-paper/10 p-5"
          style={{
            backgroundColor: preview.void,
            fontFamily: FONTS[preview.font].stack,
          }}
        >
          <p className="text-sm" style={{ color: preview.paper }}>
            Name your {noun || "avatar"}
          </p>
          <p className="mt-1 text-xs" style={{ color: preview.dim }}>
            core_size : |————————|
          </p>
          <p className="mt-3 text-xs" style={{ color: preview.dim }}>
            Tune it, then save. Your {noun || "avatar"} joins the others.
          </p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="self-start text-sm text-paper underline underline-offset-4 disabled:text-dim"
        >
          {pending ? "saving…" : "save"}
        </button>
        {state.error ? (
          <p role="alert" className="text-xs text-red-400">
            {state.error}
          </p>
        ) : (
          state.saved && <p className="text-xs text-dim">saved</p>
        )}
      </div>
    </form>
  );
}
