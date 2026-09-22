"use client";

import { useActionState, useMemo, useState } from "react";
import AvatarControls from "@/components/AvatarControls";
import { coerceAll, defaults } from "@/lib/params/coerce";
import type { ParamValues } from "@/lib/params/coerce";
import { validateParameters } from "@/lib/params/validate";
import { blankParameter, uniqueName } from "@/lib/params/blank";
import type {
  Parameter,
  ParameterType,
  ParameterValue,
} from "@/lib/params/types";
import { saveParameters, type SaveState } from "./actions";

/**
 * The parameter builder — YouQuantified's repeating `{name, suggested}` row,
 * grown into something that can express the six types this platform renders.
 *
 * Two things make it worth the code. `validateParameters` is pure, so the same
 * function that guards the save runs on every keystroke here — there is no
 * second, laxer idea of validity in the browser. And the preview is the real
 * `AvatarControls`, not a mock of it, so what you are arranging is literally
 * what the participant will be handed.
 */

const TYPES: { value: ParameterType; label: string }[] = [
  { value: "continuous", label: "slider (decimal)" },
  { value: "discrete", label: "slider (whole)" },
  { value: "select", label: "pick one" },
  { value: "multiselect", label: "pick any" },
  { value: "toggle", label: "on / off" },
  { value: "text", label: "question" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-dim">
        {label}
        {hint && <span className="text-paper/25"> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}

const input =
  "term-input border-b border-paper/20 text-sm";
const select =
  "term-input border-b border-paper/20 bg-void text-sm";

export default function ParameterBuilder({
  slug,
  initial,
  scriptVersion,
}: {
  slug: string;
  initial: Parameter[];
  scriptVersion: number;
}) {
  const [draft, setDraft] = useState<Parameter[]>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [json, setJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<SaveState, FormData>(
    saveParameters,
    {},
  );

  const problems = useMemo(() => validateParameters(draft), [draft]);
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial],
  );

  // Preview values, re-derived whenever the shape changes. Coercing through the
  // real pipeline means a bad range shows up here as a pinned slider, exactly
  // as it would for a participant.
  const [previewValues, setPreviewValues] = useState<ParamValues>(() =>
    coerceAll(initial, defaults(initial)),
  );
  const previewKey = useMemo(
    () => draft.map((p) => `${p.name}:${p.type}`).join("|"),
    [draft],
  );
  const [lastKey, setLastKey] = useState(previewKey);
  if (previewKey !== lastKey) {
    setLastKey(previewKey);
    setPreviewValues(coerceAll(draft, previewValues));
  }

  const names = draft.map((p) => p.name);
  const ungatedToggles = draft.filter((p) => p.type === "toggle" && !p.enabledBy);

  function update(index: number, patch: Partial<Parameter>) {
    setDraft((prev) =>
      prev.map((p, i) => (i === index ? ({ ...p, ...patch } as Parameter) : p)),
    );
  }

  function retype(index: number, type: ParameterType) {
    setDraft((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        // Type-specific fields do not survive a type change — carrying `min`
        // onto a select would leave junk in the stored declaration.
        const fresh = blankParameter(type, p.name);
        return {
          ...fresh,
          label: p.label,
          description: p.description,
          advanced: p.advanced,
          enabledBy: p.enabledBy,
        } as Parameter;
      }),
    );
  }

  function add(type: ParameterType) {
    const name = uniqueName(type === "text" ? "question" : type, names);
    setDraft((prev) => [...prev, blankParameter(type, name)]);
    setOpen(name);
  }

  function remove(index: number) {
    const gone = draft[index].name;
    setDraft((prev) =>
      prev
        .filter((_, i) => i !== index)
        // A gate pointing at a deleted toggle would fail validation, and the
        // person who deleted it cannot see why. Clear the reference instead.
        .map((p) => (p.enabledBy === gone ? { ...p, enabledBy: undefined } : p)),
    );
  }

  function move(index: number, by: number) {
    const to = index + by;
    if (to < 0 || to >= draft.length) return;
    setDraft((prev) => {
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(json);
      const list = Array.isArray(parsed) ? parsed : parsed?.parameters;
      if (!Array.isArray(list)) {
        setJsonError("Expected an array, or an object with a `parameters` array.");
        return;
      }
      setDraft(list as Parameter[]);
      setJsonError(null);
      setJson("");
    } catch {
      setJsonError("That is not valid JSON.");
    }
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {draft.map((param, index) => {
          const expanded = open === param.name;
          const numeric =
            param.type === "continuous" || param.type === "discrete";
          const hasOptions =
            param.type === "select" || param.type === "multiselect";

          return (
            <div
              key={`${param.name}-${index}`}
              className="flex flex-col gap-3 border-b border-paper/10 pb-4"
            >
              <div className="flex items-baseline gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : param.name)}
                  className="min-w-0 flex-1 text-left text-sm text-paper underline-offset-4 hover:underline"
                >
                  {param.label || param.name}{" "}
                  <span className="text-dim">
                    · {param.name} · {param.type}
                    {param.advanced && " · advanced"}
                    {param.enabledBy && ` · needs ${param.enabledBy}`}
                  </span>
                </button>
                <span className="flex shrink-0 gap-2 text-xs text-dim">
                  <button type="button" onClick={() => move(index, -1)} aria-label="move up">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(index, 1)} aria-label="move down">
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="hover:text-red-400"
                    aria-label="remove"
                  >
                    ✕
                  </button>
                </span>
              </div>

              {expanded && (
                <div className="flex flex-col gap-4 pl-1">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="name" hint="the key the sketch reads">
                      <input
                        className={input}
                        value={param.name}
                        onChange={(e) => update(index, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="type">
                      <select
                        className={select}
                        value={param.type}
                        onChange={(e) =>
                          retype(index, e.target.value as ParameterType)
                        }
                      >
                        {TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="label" hint="what the participant sees">
                      <input
                        className={input}
                        value={param.label}
                        onChange={(e) => update(index, { label: e.target.value })}
                      />
                    </Field>
                    <Field label="description" hint="optional">
                      <input
                        className={input}
                        value={param.description ?? ""}
                        onChange={(e) =>
                          update(index, { description: e.target.value })
                        }
                      />
                    </Field>
                  </div>

                  {numeric && (
                    <div className="grid gap-4 sm:grid-cols-4">
                      <Field label="min" hint="domain">
                        <input
                          type="number"
                          className={input}
                          value={param.min}
                          onChange={(e) =>
                            update(index, { min: Number(e.target.value) } as Partial<Parameter>)
                          }
                        />
                      </Field>
                      <Field label="max" hint="domain">
                        <input
                          type="number"
                          className={input}
                          value={param.max}
                          onChange={(e) =>
                            update(index, { max: Number(e.target.value) } as Partial<Parameter>)
                          }
                        />
                      </Field>
                      <Field label="step">
                        <input
                          type="number"
                          step="any"
                          className={input}
                          value={param.step ?? 1}
                          onChange={(e) =>
                            update(index, { step: Number(e.target.value) } as Partial<Parameter>)
                          }
                        />
                      </Field>
                      <Field label="default">
                        <input
                          type="number"
                          step="any"
                          className={input}
                          value={param.default as number}
                          onChange={(e) =>
                            update(index, { default: Number(e.target.value) } as Partial<Parameter>)
                          }
                        />
                      </Field>
                    </div>
                  )}

                  {numeric && (
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-2 text-[11px] text-dim">
                        <input
                          type="checkbox"
                          checked={param.display === "hue"}
                          onChange={(e) =>
                            update(index, {
                              display: e.target.checked ? "hue" : undefined,
                            } as Partial<Parameter>)
                          }
                        />
                        colour slider — the track shows the hues this maps to
                      </label>

                      <label className="flex items-center gap-2 text-[11px] text-dim">
                        <input
                          type="checkbox"
                          checked={!!param.truncatedScale}
                          onChange={(e) =>
                            update(index, {
                              truncatedScale: e.target.checked
                                ? { min: param.min, max: param.max }
                                : undefined,
                            } as Partial<Parameter>)
                          }
                        />
                        offer only part of the range
                      </label>

                      {param.truncatedScale && (
                        <div className="grid gap-4 pl-6 sm:grid-cols-2">
                          <Field label="offered from">
                            <input
                              type="number"
                              className={input}
                              value={param.truncatedScale.min}
                              onChange={(e) =>
                                update(index, {
                                  truncatedScale: {
                                    min: Number(e.target.value),
                                    max: param.truncatedScale!.max,
                                  },
                                } as Partial<Parameter>)
                              }
                            />
                          </Field>
                          <Field label="offered to">
                            <input
                              type="number"
                              className={input}
                              value={param.truncatedScale.max}
                              onChange={(e) =>
                                update(index, {
                                  truncatedScale: {
                                    min: param.truncatedScale!.min,
                                    max: Number(e.target.value),
                                  },
                                } as Partial<Parameter>)
                              }
                            />
                          </Field>
                          <p className="text-[11px] leading-relaxed text-dim sm:col-span-2">
                            Values keep their meaning — narrowing what is offered
                            does not rescale it. A hue of 90 is the same colour
                            whether or not the slider reaches the rest of the
                            wheel.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {hasOptions && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] text-dim">options</span>
                      {param.options.map((option, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            className={`${input} flex-1`}
                            value={option.value}
                            placeholder="value"
                            onChange={(e) =>
                              update(index, {
                                options: param.options.map((o, j) =>
                                  j === oi ? { ...o, value: e.target.value } : o,
                                ),
                              } as Partial<Parameter>)
                            }
                          />
                          <input
                            className={`${input} flex-1`}
                            value={option.label}
                            placeholder="label"
                            onChange={(e) =>
                              update(index, {
                                options: param.options.map((o, j) =>
                                  j === oi ? { ...o, label: e.target.value } : o,
                                ),
                              } as Partial<Parameter>)
                            }
                          />
                          <button
                            type="button"
                            className="text-xs text-dim hover:text-red-400"
                            onClick={() =>
                              update(index, {
                                options: param.options.filter((_, j) => j !== oi),
                              } as Partial<Parameter>)
                            }
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="self-start text-xs text-dim underline underline-offset-4 hover:text-paper"
                        onClick={() =>
                          update(index, {
                            options: [
                              ...param.options,
                              { value: "", label: "" },
                            ],
                          } as Partial<Parameter>)
                        }
                      >
                        add option
                      </button>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {param.type === "select" && (
                          <Field label="default">
                            <select
                              className={select}
                              value={param.default}
                              onChange={(e) =>
                                update(index, {
                                  default: e.target.value,
                                } as Partial<Parameter>)
                              }
                            >
                              {param.options.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label || o.value}
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}
                        {param.type === "multiselect" && (
                          <>
                            <Field label="min selected" hint="optional">
                              <input
                                type="number"
                                className={input}
                                value={param.minSelected ?? ""}
                                onChange={(e) =>
                                  update(index, {
                                    minSelected: e.target.value
                                      ? Number(e.target.value)
                                      : undefined,
                                  } as Partial<Parameter>)
                                }
                              />
                            </Field>
                            <Field label="max selected" hint="optional">
                              <input
                                type="number"
                                className={input}
                                value={param.maxSelected ?? ""}
                                onChange={(e) =>
                                  update(index, {
                                    maxSelected: e.target.value
                                      ? Number(e.target.value)
                                      : undefined,
                                  } as Partial<Parameter>)
                                }
                              />
                            </Field>
                            <Field label="selected by default" hint="comma separated">
                              <input
                                className={input}
                                value={(param.default as string[]).join(", ")}
                                onChange={(e) =>
                                  update(index, {
                                    default: e.target.value
                                      .split(",")
                                      .map((v) => v.trim())
                                      .filter(Boolean),
                                  } as Partial<Parameter>)
                                }
                              />
                            </Field>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {param.type === "toggle" && (
                    <Field label="default">
                      <select
                        className={select}
                        value={param.default ? "on" : "off"}
                        onChange={(e) =>
                          update(index, {
                            default: e.target.value === "on",
                          } as Partial<Parameter>)
                        }
                      >
                        <option value="on">on</option>
                        <option value="off">off</option>
                      </select>
                    </Field>
                  )}

                  {param.type === "text" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="placeholder" hint="optional">
                        <input
                          className={input}
                          value={param.placeholder ?? ""}
                          onChange={(e) =>
                            update(index, {
                              placeholder: e.target.value,
                            } as Partial<Parameter>)
                          }
                        />
                      </Field>
                      <Field label="max length" hint="optional">
                        <input
                          type="number"
                          className={input}
                          value={param.maxLength ?? ""}
                          onChange={(e) =>
                            update(index, {
                              maxLength: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            } as Partial<Parameter>)
                          }
                        />
                      </Field>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-[11px] text-dim">
                      <input
                        type="checkbox"
                        checked={!!param.advanced}
                        onChange={(e) =>
                          update(index, { advanced: e.target.checked || undefined })
                        }
                      />
                      under “additional parameters”
                    </label>

                    <Field label="only active when" hint="a toggle above">
                      <select
                        className={select}
                        value={param.enabledBy ?? ""}
                        onChange={(e) =>
                          update(index, {
                            enabledBy: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">— always active —</option>
                        {ungatedToggles
                          .filter((t) => t.name !== param.name)
                          .map((t) => (
                            <option key={t.name} value={t.name}>
                              {t.label || t.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-dim">add:</span>
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => add(t.value)}
              className="text-xs text-dim underline underline-offset-4 hover:text-paper"
            >
              {t.label}
            </button>
          ))}
        </div>

        {problems.length > 0 && (
          <div className="flex flex-col gap-1 rounded border border-red-500/40 p-3">
            <p className="text-xs text-red-400">
              {problems.length} problem{problems.length > 1 ? "s" : ""} — saving
              is blocked until these are fixed:
            </p>
            <ul className="text-[11px] leading-relaxed text-red-300/80">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {state.problems && (
          <div className="flex flex-col gap-1 rounded border border-red-500/40 p-3">
            <p className="text-xs text-red-400">The server rejected this:</p>
            <ul className="text-[11px] leading-relaxed text-red-300/80">
              {state.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {state.error && (
          <p role="alert" className="text-xs text-red-400">
            {state.error}
          </p>
        )}
        {state.warnings && (
          <div className="flex flex-col gap-1 rounded border border-amber-500/40 p-3">
            <p className="text-xs text-amber-400">Saved, but worth a look:</p>
            <ul className="text-[11px] leading-relaxed text-amber-200/70">
              {state.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <form action={action} className="flex items-center gap-4">
          <input type="hidden" name="slug" value={slug} />
          <input
            type="hidden"
            name="parameters"
            value={JSON.stringify(draft)}
          />
          <button
            type="submit"
            disabled={pending || problems.length > 0 || !dirty}
            className="text-sm text-paper underline underline-offset-4 disabled:text-dim disabled:no-underline"
          >
            {pending
              ? "saving…"
              : `save as v${scriptVersion + 1}`}
          </button>
          {state.saved && (
            <span className="text-xs text-dim">saved as v{state.saved.version}</span>
          )}
          {!dirty && !state.saved && (
            <span className="text-xs text-dim">no changes</span>
          )}
        </form>
      </div>

      <aside className="flex w-full flex-col gap-6 lg:w-[26rem] lg:shrink-0">
        <section className="flex flex-col gap-2">
          <h2 className="text-xs text-dim">
            preview · what the participant gets
          </h2>
          <div className="rounded border border-paper/10 p-4">
            {problems.length > 0 ? (
              <p className="text-[11px] text-dim">
                Fix the problems to see the preview.
              </p>
            ) : (
              <AvatarControls
                parameters={draft}
                values={previewValues}
                onChange={(name: string, value: ParameterValue) =>
                  setPreviewValues((prev) => ({ ...prev, [name]: value }))
                }
                includeText
                advancedOpen
              />
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-dim">
            The real controls component, not a mock — the ordering, gating and
            colour ramps here are exactly what participants will see.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs text-dim">json</h2>
          <pre className="max-h-64 overflow-auto rounded bg-paper/5 p-3 text-[10px] leading-relaxed text-dim">
            {JSON.stringify(draft, null, 2)}
          </pre>
          <details className="text-xs text-dim">
            <summary className="cursor-pointer">paste a declaration</summary>
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                rows={6}
                placeholder='{"parameters": [ … ]}  or  [ … ]'
                className="w-full rounded border border-paper/20 bg-transparent p-2 font-mono text-[11px] text-paper"
              />
              {jsonError && <p className="text-red-400">{jsonError}</p>}
              <button
                type="button"
                onClick={applyJson}
                disabled={!json.trim()}
                className="self-start underline underline-offset-4 hover:text-paper disabled:no-underline disabled:opacity-40"
              >
                replace with this
              </button>
            </div>
          </details>
        </section>
      </aside>
    </div>
  );
}
