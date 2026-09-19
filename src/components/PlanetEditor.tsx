"use client";

import { useMemo, useState, type FormEvent } from "react";
import StarCanvasClient from "@/components/StarCanvasClient";
import StarControls from "@/components/StarControls";
import {
  TermButton,
  TermField,
  TermGhostButton,
  TermRule,
} from "@/components/terminal";
import { upsertPlanetById } from "@/lib/planets";
import { PAPER_COLOR, VOID_COLOR } from "@/lib/theme";
import type { Planet } from "@/lib/types/planet";
import {
  DEFAULT_STAR_PARAMS,
  clampStar,
  hueToCss,
  starInkColor,
  type StarKey,
  type StarParams,
} from "@/lib/types/star";

/**
 * Naming and tuning one star — the same screens whether it's someone's
 * first, their third, or one they came back to change. Identity is settled
 * before this component: it takes a name and email and never asks for them.
 *
 * Participants read "star"; the row it saves is still a `planets` row.
 *
 * Star's vertical center sits above the middle so the controls at the bottom
 * land on empty void rather than on the corona.
 */
const STAR_CENTER_Y = 0.4;

/** Which visit this is — copy and the way out differ, the screens don't. */
export type PlanetEditorMode = "first" | "new" | "edit";

type Step = "name" | "tune" | "done";

const INTRO: Record<PlanetEditorMode, string> = {
  first: "create your own star to participate in the experience",
  new: "another star, same you — give this one a name",
  edit: "rename this star",
};

const DONE_MESSAGE: Record<PlanetEditorMode, string> = {
  first: "you are ready to participate",
  new: "your new star is ready",
  edit: "changes saved",
};

function answerText(answers: Planet["answers"], key: string): string {
  const value = answers[key];
  return typeof value === "string" ? value : "";
}

export default function PlanetEditor({
  mode,
  planet = null,
  creatorName,
  creatorEmail,
  anonymousId,
  onCancel,
  onDone,
  onSaved,
}: {
  mode: PlanetEditorMode;
  /** The planet being edited, or null when this one is being created. */
  planet?: Planet | null;
  creatorName: string;
  creatorEmail: string;
  anonymousId: string;
  /** Backing out of the first screen — usually back to the planet list. */
  onCancel: () => void;
  /** Leaving the confirmation screen. */
  onDone: () => void;
  /** Fires on every successful save, before the reader leaves. */
  onSaved?: (planet: Planet) => void;
}) {
  const editing = planet !== null;

  const [step, setStep] = useState<Step>(editing ? "tune" : "name");
  const [planetId, setPlanetId] = useState<string | null>(planet?.id ?? null);
  const [answer1, setAnswer1] = useState(() =>
    planet ? answerText(planet.answers, "answer1") || planet.name : "",
  );
  const [params, setParams] = useState<StarParams>(() =>
    planet ? { ...planet.params } : { ...DEFAULT_STAR_PARAMS },
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const starName = useMemo(() => {
    const trimmed = answer1.trim();
    if (trimmed) return trimmed;
    if (creatorName.trim()) return `${creatorName.trim()}'s star`;
    return "untitled";
  }, [answer1, creatorName]);

  /** Label ink, and a lighter grade of it for the star's own name. */
  const ink = starInkColor(params.hue);
  const inkBright = hueToCss(params.hue, 45, 90);

  function setParam(key: StarKey, value: number) {
    setParams((prev) => ({ ...prev, [key]: clampStar(key, value) }));
  }

  function onNameSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!answer1.trim()) {
      setError("star_name is required");
      return;
    }
    setStep("tune");
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertPlanetById(planetId, {
        name: starName,
        creator_name: creatorName.trim(),
        creator_email: creatorEmail.trim(),
        anonymous_id: anonymousId,
        // Keep whatever else the questionnaire left in the bag.
        answers: { ...(planet?.answers ?? {}), answer1: answer1.trim() },
        params,
        // `is_staged` deliberately absent — an edit must not unstage a planet
        // the exhibit is mid-session with.
      });
      setPlanetId(saved.id);
      setToast(editing ? "saved" : "star saved");
      setStep("done");
      onSaved?.(saved);
      window.setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to save star");
    } finally {
      setSaving(false);
    }
  }

  /*
   * The star holds still on an existing planet — someone who tapped in from
   * the list to rename it shouldn't watch it blink out. On a new one it stays
   * dark until the sliders appear, so the star arrives with its controls.
   */
  const showStar = step !== "name" || editing;

  return (
    <div
      className="font-terminal relative min-h-dvh"
      style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
    >
      {/*
       * Full-bleed noisy void. It never unmounts between steps — the naming
       * screen just runs it at zero intensity, so the grain is there and the
       * star fades in when the controls open.
       */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient
          params={params}
          intensity={showStar ? 1 : 0}
          centerY={STAR_CENTER_Y}
        />
      </div>

      {/*
       * Sinks the star back into the void behind the controls. Kept partly
       * transparent so the grain still reads through it.
       */}
      {showStar && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-[52vh] bg-gradient-to-t from-void via-void/90 to-transparent" />
      )}

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8 pt-6">
        {step === "name" ? (
          <form onSubmit={onNameSubmit} className="flex flex-1 flex-col">
            <p className="max-w-[34ch] pt-[16vh] text-sm leading-relaxed text-dim">
              {INTRO[mode]}
            </p>

            <div className="mt-16">
              <TermField
                label="star_name:"
                value={answer1}
                onChange={setAnswer1}
                inkColor={ink}
                autoFocus
                required
              />
            </div>

            {error && <p className="mt-6 text-sm text-red-300">{error}</p>}

            <div className="mt-auto mb-[22vh] flex items-center justify-between">
              <TermGhostButton
                onClick={() => (editing ? setStep("tune") : onCancel())}
              >
                back
              </TermGhostButton>
              <TermButton type="submit">next</TermButton>
            </div>
          </form>
        ) : (
          <div className="flex flex-1 flex-col">
            <header className="flex items-baseline gap-3">
              <span className="shrink-0 text-sm" style={{ color: ink }}>
                star_name :
              </span>
              <span
                className="min-w-0 flex-1 truncate text-lg"
                style={{ color: inkBright }}
                title={starName}
              >
                {starName}
              </span>
              {step === "tune" && (
                <button
                  type="button"
                  onClick={() => setStep("name")}
                  className="shrink-0 text-xs text-dim underline underline-offset-4 hover:text-paper/80"
                >
                  rename
                </button>
              )}
            </header>

            {/* Status line, held open so a toast doesn't shift the layout. */}
            <p className="mt-2 h-5 text-sm text-dim">{toast}</p>

            {/* Empty space the star lives behind. */}
            <div className="min-h-[38vh] flex-1" />

            {step === "tune" ? (
              <>
                <StarControls
                  params={params}
                  onChange={setParam}
                  onOrbitModeChange={(orbit_mode) =>
                    setParams((prev) => ({ ...prev, orbit_mode }))
                  }
                />

                {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

                <div className="mt-8 flex items-center justify-between">
                  <TermGhostButton
                    onClick={() => (editing ? onCancel() : setStep("name"))}
                  >
                    back
                  </TermGhostButton>
                  <TermButton disabled={saving} onClick={() => void onSave()}>
                    {saving ? "saving..." : "save"}
                  </TermButton>
                </div>
              </>
            ) : (
              /*
               * Saved. The sliders go away so the planet they landed on is the
               * only thing on screen — `edit` brings them back.
               */
              <>
                <TermRule />
                <p className="mt-6 text-base">{DONE_MESSAGE[mode]}</p>

                {/* Wraps rather than collides on a ~320px screen. */}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <TermGhostButton onClick={() => setStep("tune")}>
                    edit
                  </TermGhostButton>
                  <TermButton onClick={onDone}>your stars</TermButton>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
