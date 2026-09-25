"use client";

import { useActionState, useState } from "react";
import { saveCopy, type AppearanceState } from "./actions";
import {
  COPY_FIELDS,
  type CopyKey,
  type ProjectCopy,
} from "@/lib/theme/project-copy";

const GROUPS = Array.from(
  new Set(Object.values(COPY_FIELDS).map((f) => f.group)),
);

/**
 * Every sentence a participant reads, as plain text. The live preview beside
 * the form shows each one in place, so the placeholders are checked by reading,
 * not by guessing.
 */
export default function CopyForm({
  slug,
  copy,
  onDraft,
}: {
  slug: string;
  copy: ProjectCopy;
  /** Every unsaved change, for the live preview next to the form. */
  onDraft?: (copy: ProjectCopy) => void;
}) {
  const [state, action, pending] = useActionState<AppearanceState, FormData>(
    saveCopy,
    {},
  );
  const [draft, setDraftState] = useState<ProjectCopy>(copy);
  function setDraft(update: (d: ProjectCopy) => ProjectCopy) {
    const next = update(draft);
    setDraftState(next);
    onDraft?.(next);
  }

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
