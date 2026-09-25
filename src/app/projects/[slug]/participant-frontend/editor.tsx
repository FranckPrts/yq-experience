"use client";

import { useState } from "react";
import type { ProjectLexicon, ProjectTheme } from "@/lib/theme/project-theme";
import type { ProjectCopy } from "@/lib/theme/project-copy";
import AppearanceForm from "./form";
import CopyForm from "./copy-form";
import PreviewPane from "./preview-pane";

/**
 * The two forms and the live preview, sharing one set of drafts: whatever is
 * typed shows in the preview before it is saved.
 */
export default function ParticipantFrontendEditor({
  slug,
  theme: savedTheme,
  lexicon: savedLexicon,
  copy: savedCopy,
  canEdit,
}: {
  slug: string;
  theme: ProjectTheme;
  lexicon: ProjectLexicon;
  copy: ProjectCopy;
  canEdit: boolean;
}) {
  const [theme, setTheme] = useState(savedTheme);
  const [lexicon, setLexicon] = useState(savedLexicon);
  const [copy, setCopy] = useState(savedCopy);

  return (
    <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start">
      <div className="flex flex-col gap-8">
        {canEdit ? (
          <>
            <AppearanceForm
              slug={slug}
              theme={savedTheme}
              lexicon={savedLexicon}
              onDraft={(t, l) => {
                setTheme(t);
                setLexicon(l);
              }}
            />
            <section className="flex flex-col gap-4 border-t border-paper/10 pt-8">
              <h2 className="text-sm">wording</h2>
              <CopyForm slug={slug} copy={savedCopy} onDraft={setCopy} />
            </section>
          </>
        ) : (
          <p className="text-xs text-dim">
            You have read-only access to this project.
          </p>
        )}
      </div>

      <div className="lg:sticky lg:top-8">
        <PreviewPane slug={slug} theme={theme} lexicon={lexicon} copy={copy} />
      </div>
    </div>
  );
}
