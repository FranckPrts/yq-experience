"use client";

import { useEffect, useState } from "react";
import ParticipantExperience, { type Step } from "@/app/e/[slug]/experience";
import Shut from "@/app/e/[slug]/shut";
import type { Parameter } from "@/lib/params/types";
import {
  coerceLexicon,
  coerceTheme,
  type ProjectLexicon,
  type ProjectTheme,
} from "@/lib/theme/project-theme";
import { coerceCopy, fillCopy, type ProjectCopy } from "@/lib/theme/project-copy";
import type { FromPreview, PreviewScreen, ToPreview } from "./protocol";

const EXPERIENCE_STEPS: readonly PreviewScreen[] = [
  "intro",
  "questions",
  "tune",
  "done",
];

function toParent(message: FromPreview) {
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin);
  }
}

/**
 * Hosts the real participant page in preview mode and keeps it in step with the
 * editor's drafts. Drafts go through the same coercion as a save, so the preview
 * shows what saving would produce — defaults for blank fields included.
 */
export default function LivePreview({
  projectName,
  theme: savedTheme,
  lexicon: savedLexicon,
  copy: savedCopy,
  script,
}: {
  projectName: string;
  theme: ProjectTheme;
  lexicon: ProjectLexicon;
  copy: ProjectCopy;
  script: { code: string; version: number; parameters: Parameter[] } | null;
}) {
  const [theme, setTheme] = useState(savedTheme);
  const [lexicon, setLexicon] = useState(savedLexicon);
  const [copy, setCopy] = useState(savedCopy);

  const hasQuestions = !!script?.parameters.some((p) => p.type === "text");
  const firstStep: Step = hasQuestions ? "questions" : "tune";
  const [screen, setScreen] = useState<PreviewScreen>(
    savedCopy.introEnabled ? "intro" : firstStep,
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== window.parent) return;
      const data = event.data as ToPreview;
      if (data?.type === "yq-preview:draft") {
        setTheme(coerceTheme(data.theme));
        setLexicon(coerceLexicon(data.lexicon));
        setCopy(coerceCopy(data.copy));
      } else if (data?.type === "yq-preview:show") {
        setScreen(data.screen);
      }
    }
    window.addEventListener("message", onMessage);
    // Announced after the listener is up, so the editor's first draft lands.
    toParent({ type: "yq-preview:ready", hasScript: !!script, hasQuestions });
    return () => window.removeEventListener("message", onMessage);
  }, [script, hasQuestions]);

  // A screen the current draft cannot reach falls through to the next one,
  // just as the participant's flow would skip it.
  let shown = screen;
  if (shown === "intro" && !copy.introEnabled) shown = firstStep;
  if (shown === "questions" && !hasQuestions) shown = "tune";

  const vars = {
    noun: lexicon.noun,
    nounPlural: lexicon.nounPlural,
    project: projectName,
  };

  const overlay =
    shown === "closed"
      ? fillCopy(copy.closedMessage, vars)
      : shown === "notReady"
        ? fillCopy(copy.notReadyMessage, vars)
        : !script
          ? // Ours, not the tenant's: it only ever appears in this preview.
            `No valid script yet. Add one under parameters to see the ${lexicon.noun} here.`
          : null;

  return (
    <>
      {script && (
        <ParticipantExperience
          preview
          projectName={projectName}
          theme={theme}
          lexicon={lexicon}
          supabaseUrl=""
          publishableKey=""
          code={script.code}
          scriptVersion={script.version}
          parameters={script.parameters}
          copy={copy}
          step={
            EXPERIENCE_STEPS.includes(shown) ? (shown as Step) : undefined
          }
          onStepChange={(next) => {
            setScreen(next);
            toParent({ type: "yq-preview:screen", screen: next });
          }}
        />
      )}
      {/* Laid over the experience rather than replacing it, so flicking to the
          closed screen and back keeps the avatar and whatever was typed. */}
      {overlay !== null && (
        <div className="fixed inset-0 z-10 overflow-auto">
          <Shut theme={theme} title={projectName} message={overlay} />
        </div>
      )}
    </>
  );
}
