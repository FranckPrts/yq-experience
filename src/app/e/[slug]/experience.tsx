"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import AvatarCanvas from "@/components/AvatarCanvas";
import AvatarControls from "@/components/AvatarControls";
import { coerceAll, defaults, renderValues } from "@/lib/params/coerce";
import type { ParamValues } from "@/lib/params/coerce";
import type { Parameter, ParameterValue } from "@/lib/params/types";
import {
  ensureParticipant,
  spokeClient,
} from "@/lib/spoke/browser-client";
import { myAvatar, saveAvatar, splitValues } from "@/lib/spoke/avatars";
import {
  FONTS,
  themeCssVars,
  type ProjectLexicon,
  type ProjectTheme,
} from "@/lib/theme/project-theme";
import { fillCopy, type ProjectCopy } from "@/lib/theme/project-copy";

export type Step = "intro" | "questions" | "tune" | "done";

/**
 * The participant runtime — `PlanetEditor` generalized.
 *
 * The flow it inherits: answer, then tune, then done, with the canvas mounted
 * once and never unmounted between steps, so the avatar comes into being rather
 * than appearing. What changes is that every question and every control now
 * comes from the project's declaration instead of from six hardcoded sliders.
 */
export default function ParticipantExperience({
  projectName,
  theme,
  lexicon,
  supabaseUrl,
  publishableKey,
  code,
  scriptVersion,
  parameters,
  copy,
  preview = false,
  step: stepProp,
  onStepChange,
}: {
  projectName: string;
  theme: ProjectTheme;
  lexicon: ProjectLexicon;
  supabaseUrl: string;
  publishableKey: string;
  code: string;
  scriptVersion: number;
  parameters: Parameter[];
  copy: ProjectCopy;
  /**
   * The participant-frontend preview: the same page, with no anonymous sign-in
   * and a save that writes nothing, so a tenant can walk through it without
   * leaving participants — or rows — behind in their Supabase.
   */
  preview?: boolean;
  /** Controlled step, for the preview's screen tabs. */
  step?: Step;
  onStepChange?: (step: Step) => void;
}) {
  const questions = useMemo(
    () => parameters.filter((p) => p.type === "text"),
    [parameters],
  );

  const [values, setValues] = useState<ParamValues>(() =>
    coerceAll(parameters, defaults(parameters)),
  );
  const firstStep: Step = questions.length > 0 ? "questions" : "tune";
  // Returning participants skip the welcome: the effect below moves them
  // straight to tuning once their avatar is found.
  const [ownStep, setOwnStep] = useState<Step>(
    copy.introEnabled ? "intro" : firstStep,
  );
  const step = stepProp ?? ownStep;
  function setStep(next: Step) {
    setOwnStep(next);
    onStepChange?.(next);
  }
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">(
    preview ? "ready" : "starting",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const clientRef = useRef<SupabaseClient | null>(null);

  // Sign in anonymously, then adopt any avatar this identity already made — so
  // returning to the experience continues rather than starts again.
  useEffect(() => {
    if (preview) return;
    let cancelled = false;

    async function start() {
      const client = spokeClient(supabaseUrl, publishableKey);
      clientRef.current = client;

      const session = await ensureParticipant(client);
      if (cancelled) return;
      if ("error" in session) {
        setError(session.error);
        setStatus("error");
        return;
      }

      try {
        const mine = await myAvatar(client, session.userId, parameters);
        if (cancelled) return;
        if (mine) {
          setAvatarId(mine.id);
          setValues(
            coerceAll(parameters, { ...mine.params, ...mine.answers }),
          );
          setStep("tune");
        }
      } catch {
        // A read failure is not fatal — they can still make a new one.
      }
      if (!cancelled) setStatus("ready");
    }

    void start();
    return () => {
      cancelled = true;
    };
    // `setStep` is recreated each render but only ever sets state and reports.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, supabaseUrl, publishableKey, parameters]);

  const sketchParams = useMemo(
    () => renderValues(parameters, values),
    [parameters, values],
  );

  function set(name: string, value: ParameterValue) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function save() {
    if (preview) {
      // Walk on as if it saved; the id only switches the button to "save
      // changes", exactly as a real first save would.
      setAvatarId("preview");
      setStep("done");
      return;
    }
    const client = clientRef.current;
    if (!client) return;
    setSaving(true);
    setError(null);
    try {
      const { answers, params } = splitValues(parameters, values);
      const name = questions[0]
        ? String(values[questions[0].name] ?? "")
        : projectName;
      const saved = await saveAvatar(
        client,
        avatarId,
        { name, answers, params },
        parameters,
      );
      setAvatarId(saved.id);
      setStep("done");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Try once more.",
      );
    } finally {
      setSaving(false);
    }
  }

  const nameValue = questions[0] ? String(values[questions[0].name] ?? "") : "";
  // Plain text in, plain text out: React escapes it, so tenant wording can
  // never become markup on this page.
  const t = (key: Exclude<keyof ProjectCopy, "introEnabled">) =>
    fillCopy(copy[key], {
      noun: lexicon.noun,
      nounPlural: lexicon.nounPlural,
      name: nameValue.trim(),
      project: projectName,
    });

  const style = {
    ...themeCssVars(theme),
    backgroundColor: theme.void,
    color: theme.paper,
    fontFamily: FONTS[theme.font].stack,
  } as React.CSSProperties;

  return (
    // Side by side from tablet width up: the avatar fills the left, the
    // controls sit in a column on the right, so tuning never scrolls the
    // avatar out of view. Stacked on a phone, where there is no room for both.
    <main
      style={style}
      className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden"
    >
      {/* Mounted once for the life of the page. Re-mounting between steps would
          restart the sketch, and the avatar would blink rather than persist. */}
      <div className="relative h-[45vh] w-full shrink-0 md:h-full md:w-auto md:flex-1">
        <AvatarCanvas
          key={scriptVersion}
          code={code}
          params={sketchParams}
          /* Held at 0 until the participant's own values have arrived, so the
             avatar fades in as *theirs*. Rendering the declaration's defaults
             at full strength would show a stranger's avatar and then swap it. */
          host={{ intensity: status === "ready" ? 1 : 0 }}
          className="h-full w-full"
        />
        {status === "starting" && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6">
            <p className="text-xs" style={{ color: theme.dim }}>
              {t("loading")}
            </p>
          </div>
        )}
      </div>

      <div className="flex w-full flex-1 flex-col md:h-full md:w-[28rem] md:flex-none md:overflow-y-auto md:border-l md:border-dim/20">
        {/* `my-auto` centres short steps (welcome, questions) and falls back to
            the top when the controls overflow, so nothing is ever clipped. */}
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-6 md:my-auto">
        {status === "error" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">This experience can’t start right now.</p>
            <p className="text-xs" style={{ color: theme.dim }}>
              {error}
            </p>
          </div>
        )}

        {status === "ready" && step === "intro" && (
          <div className="flex flex-col gap-4">
            <h1 className="text-sm">{t("introTitle")}</h1>
            <p
              className="whitespace-pre-line text-xs leading-relaxed"
              style={{ color: theme.dim }}
            >
              {t("introBody")}
            </p>
            <button
              type="button"
              onClick={() => setStep(firstStep)}
              className="self-start text-sm underline underline-offset-4"
              autoFocus
            >
              {t("introButton")}
            </button>
          </div>
        )}

        {status === "ready" && step === "questions" && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              setStep("tune");
            }}
          >
            {questions.map((q) => (
              <label key={q.name} className="flex flex-col gap-2">
                <span className="text-sm">{q.label}</span>
                <input
                  className="term-input border-b"
                  style={{ borderColor: `${theme.dim}55` }}
                  value={String(values[q.name] ?? "")}
                  placeholder={
                    q.type === "text" ? (q.placeholder ?? "") : undefined
                  }
                  maxLength={q.type === "text" ? q.maxLength : undefined}
                  onChange={(e) => set(q.name, e.target.value)}
                  autoFocus={q === questions[0]}
                />
              </label>
            ))}
            <button
              type="submit"
              className="self-start text-sm underline underline-offset-4"
            >
              {t("nextButton")}
            </button>
          </form>
        )}

        {status === "ready" && step === "tune" && (
          <>
            <AvatarControls
              parameters={parameters}
              values={values}
              onChange={set}
            />
            {error && (
              <p role="alert" className="text-xs text-red-400">
                {error}
              </p>
            )}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="text-sm underline underline-offset-4 disabled:no-underline"
                style={saving ? { color: theme.dim } : undefined}
              >
                {saving ? "saving…" : avatarId ? t("saveChangesButton") : t("saveButton")}
              </button>
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStep("questions")}
                  className="text-xs underline-offset-4 hover:underline"
                  style={{ color: theme.dim }}
                >
                  {t("backButton")}
                </button>
              )}
            </div>
          </>
        )}

        {status === "ready" && step === "done" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">{t("savedTitle")}</p>
            <p
              className="whitespace-pre-line text-xs leading-relaxed"
              style={{ color: theme.dim }}
            >
              {t("savedBody")}
            </p>
            <button
              type="button"
              onClick={() => setStep("tune")}
              className="self-start text-sm underline underline-offset-4"
            >
              {t("keepTuningButton")}
            </button>
          </div>
        )}
        </div>
      </div>
    </main>
  );
}
