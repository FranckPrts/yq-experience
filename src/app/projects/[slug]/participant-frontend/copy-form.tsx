"use client";

import { useActionState, useState } from "react";
import { saveCopy, type AppearanceState } from "./actions";
import {
  COPY_FIELDS,
  DEFAULT_COPY,
  fillCopy,
  type CopyKey,
  type ProjectCopy,
} from "@/lib/theme/project-copy";
import type { ProjectLexicon, ProjectTheme } from "@/lib/theme/project-theme";
import { FONTS } from "@/lib/theme/project-theme";

const GROUPS = Array.from(
  new Set(Object.values(COPY_FIELDS).map((f) => f.group)),
);

/**
 * Every sentence a participant reads, as plain text. The preview renders each
 * one with the project's own noun and palette, so the placeholders are checked
 * by reading, not by guessing.
 */
export default function CopyForm({
  slug,
  copy,
  lexicon,
  theme,
}: {
  slug: string;
  copy: ProjectCopy;
  lexicon: ProjectLexicon;
  theme: ProjectTheme;
}) {
  const [state, action, pending] = useActionState<AppearanceState, FormData>(
    saveCopy,
    {},
  );
  const [draft, setDraft] = useState<ProjectCopy>(copy);
  const vars = {
    noun: lexicon.noun,
    nounPlural: lexicon.nounPlural,
    name: "Tide Chorus",
  };

  const preview = (key: CopyKey) =>
    fillCopy(draft[key] || DEFAULT_COPY[key], vars);

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="slug" value={slug} />

      <p className="text-[11px] leading-relaxed text-dim">
        Plain text — line breaks are kept, and nothing is interpreted as HTML.
        Use <code className="text-paper/70">{"{noun}"}</code>,{" "}
        <code className="text-paper/70">{"{nounPlural}"}</code> and{" "}
        <code className="text-paper/70">{"{name}"}</code> (what the participant
        called theirs, which may be empty). Leave a field blank to use the
        default. Error messages, like a full network at an event, stay ours:
        they have to say what to do when something breaks.
      </p>

      {GROUPS.map((group) => (
        <section key={group} className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xs text-dim">{group}</h2>
            {group === "welcome" && (
              <label className="flex items-center gap-2 text-[11px] text-dim">
                <input
                  type="checkbox"
                  name="introEnabled"
                  checked={draft.introEnabled}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, introEnabled: e.target.checked }))
                  }
                />
                show a welcome screen to new participants
              </label>
            )}
          </div>

          {(Object.entries(COPY_FIELDS) as [CopyKey, (typeof COPY_FIELDS)[CopyKey]][])
            .filter(([, f]) => f.group === group)
            .map(([key, field]) => {
              const muted = group === "welcome" && !draft.introEnabled;
              return (
                <label
                  key={key}
                  className={`flex flex-col gap-1 ${muted ? "opacity-40" : ""}`}
                >
                  <span className="text-[11px] text-dim">{field.label}</span>
                  {field.multiline ? (
                    <textarea
                      name={key}
                      rows={2}
                      maxLength={400}
                      value={draft[key]}
                      placeholder={field.default}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [key]: e.target.value }))
                      }
                      className="term-input resize-y border-b border-paper/20 text-sm"
                    />
                  ) : (
                    <input
                      name={key}
                      maxLength={400}
                      value={draft[key]}
                      placeholder={field.default}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [key]: e.target.value }))
                      }
                      className="term-input border-b border-paper/20 text-sm"
                    />
                  )}
                </label>
              );
            })}
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-dim">
          preview · named “{vars.name}” where {"{name}"} is used
        </h2>
        <div
          className="flex flex-col gap-6 rounded border border-paper/10 p-5"
          style={{
            backgroundColor: theme.void,
            color: theme.paper,
            fontFamily: FONTS[theme.font].stack,
          }}
        >
          {draft.introEnabled && (
            <div className="flex flex-col gap-2">
              <p className="text-sm">{preview("introTitle")}</p>
              <p
                className="whitespace-pre-line text-xs leading-relaxed"
                style={{ color: theme.dim }}
              >
                {preview("introBody")}
              </p>
              <span className="text-sm underline underline-offset-4">
                {preview("introButton")}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-xs" style={{ color: theme.dim }}>
              {preview("loading")}
            </span>
            <span className="underline underline-offset-4">{preview("nextButton")}</span>
            <span className="underline underline-offset-4">{preview("saveButton")}</span>
            <span className="underline underline-offset-4">
              {preview("saveChangesButton")}
            </span>
            <span className="text-xs" style={{ color: theme.dim }}>
              {preview("backButton")}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm">{preview("savedTitle")}</p>
            <p
              className="whitespace-pre-line text-xs leading-relaxed"
              style={{ color: theme.dim }}
            >
              {preview("savedBody")}
            </p>
            <span className="text-sm underline underline-offset-4">
              {preview("keepTuningButton")}
            </span>
          </div>
          <p
            className="whitespace-pre-line text-xs"
            style={{ color: theme.dim }}
          >
            {preview("closedMessage")}
          </p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="text-sm text-paper underline underline-offset-4 disabled:text-dim"
        >
          {pending ? "saving…" : "save wording"}
        </button>
        {state.saved && <p className="text-xs text-dim">saved</p>}
        {state.error && (
          <p role="alert" className="text-xs text-red-400">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
