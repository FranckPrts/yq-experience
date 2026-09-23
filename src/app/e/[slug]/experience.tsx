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

type Step = "questions" | "tune" | "done";

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
}: {
  projectName: string;
  theme: ProjectTheme;
  lexicon: ProjectLexicon;
  supabaseUrl: string;
  publishableKey: string;
  code: string;
  scriptVersion: number;
  parameters: Parameter[];
}) {
  const questions = useMemo(
    () => parameters.filter((p) => p.type === "text"),
    [parameters],
  );

  const [values, setValues] = useState<ParamValues>(() =>
    coerceAll(parameters, defaults(parameters)),
  );
  const [step, setStep] = useState<Step>(
    questions.length > 0 ? "questions" : "tune",
  );
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">(
    "starting",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const clientRef = useRef<SupabaseClient | null>(null);

  // Sign in anonymously, then adopt any avatar this identity already made — so
  // returning to the experience continues rather than starts again.
  useEffect(() => {
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
  }, [supabaseUrl, publishableKey, parameters]);

  const sketchParams = useMemo(
    () => renderValues(parameters, values),
    [parameters, values],
  );

  function set(name: string, value: ParameterValue) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function save() {
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

  const style = {
    ...themeCssVars(theme),
    backgroundColor: theme.void,
    color: theme.paper,
    fontFamily: FONTS[theme.font].stack,
  } as React.CSSProperties;

  const noun = lexicon.noun;

  return (
    <main style={style} className="flex min-h-screen flex-col">
      {/* Mounted once for the life of the page. Re-mounting between steps would
          restart the sketch, and the avatar would blink rather than persist. */}
      <div className="relative h-[45vh] w-full shrink-0 md:h-[55vh]">
        <AvatarCanvas
          key={scriptVersion}
          code={code}
          params={sketchParams}
          className="h-full w-full"
        />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
        {status === "starting" && (
          <p className="text-xs" style={{ color: theme.dim }}>
            starting…
          </p>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">This experience can’t start right now.</p>
            <p className="text-xs" style={{ color: theme.dim }}>
              {error}
            </p>
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
              next
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
                {saving ? "saving…" : avatarId ? "save changes" : `save my ${noun}`}
              </button>
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStep("questions")}
                  className="text-xs underline-offset-4 hover:underline"
                  style={{ color: theme.dim }}
                >
                  back
                </button>
              )}
            </div>
          </>
        )}

        {status === "ready" && step === "done" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Your {noun} is saved
              {questions[0] && values[questions[0].name]
                ? `, ${String(values[questions[0].name])}.`
                : "."}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: theme.dim }}>
              It has joined the others. You can keep changing it — it stays
              yours on this device.
            </p>
            <button
              type="button"
              onClick={() => setStep("tune")}
              className="self-start text-sm underline underline-offset-4"
            >
              keep tuning
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
