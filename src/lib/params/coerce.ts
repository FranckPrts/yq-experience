/**
 * Declaration-driven coercion — the generic descendant of `clampStar` and
 * `toStarParams` in `src/lib/types/star.ts`.
 *
 * `normalizePlanet`'s normalize-on-read discipline is kept: nothing trusts what
 * came back from the database, and a missing or junk value falls back to its
 * declared default rather than propagating `NaN` into a shader uniform.
 */

import {
  effectiveRange,
  isNumeric,
  isRenderParam,
  type Parameter,
  type ParameterValue,
  type ToggleParameter,
} from "./types";

export type ParamValues = Record<string, ParameterValue>;

/**
 * Snap to the declared step, then clamp to the range actually on offer.
 *
 * Clamping to `truncatedScale` rather than the domain is what makes the
 * truncation real: a value posted from outside it — an old saved avatar, a
 * hand-edited payload — is pulled back inside rather than honoured.
 */
function clampNumeric(
  param: Extract<Parameter, { type: "continuous" | "discrete" }>,
  value: unknown,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return param.default;

  const { min, max } = effectiveRange(param);
  const step = param.step ?? (param.type === "discrete" ? 1 : 0);
  // Steps are measured from the domain's floor, so truncating a range cannot
  // shift which values are on-step.
  const snapped =
    step > 0 ? param.min + Math.round((n - param.min) / step) * step : n;

  const bounded = Math.min(max, Math.max(min, snapped));
  // Steps like 0.1 leave float dust (1.7000000000000002); round it off at a
  // precision the step itself implies so the value displays and stores clean.
  return step > 0 && !Number.isInteger(step)
    ? Number(bounded.toFixed(decimalsOf(step)))
    : bounded;
}

function decimalsOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * On/off from whatever turned up: a real boolean, 0/1, or the strings a host
 * or a hand-written payload might carry. Deliberately the same dialect as the
 * `flag()` helper inside the sketches, so a value means the same thing on
 * either side of the frame — and anything unrecognisable falls to the
 * declared default rather than to a surprising `false`.
 */
function clampToggle(param: ToggleParameter, value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "" || v === "false" || v === "0" || v === "off") return false;
    if (v === "true" || v === "1" || v === "on") return true;
  }
  return param.default;
}

/** One value, coerced against its own declaration. */
export function coerce(param: Parameter, value: unknown): ParameterValue {
  if (isNumeric(param)) return clampNumeric(param, value);

  if (param.type === "toggle") return clampToggle(param, value);

  if (param.type === "select") {
    return param.options.some((option) => option.value === value)
      ? (value as string)
      : param.default;
  }

  if (param.type === "multiselect") {
    const wanted = new Set(Array.isArray(value) ? value.map(String) : []);
    // Walk the declaration, not the input: unknown values are dropped and the
    // result is ordered and de-duplicated by construction.
    let chosen = param.options
      .map((option) => option.value)
      .filter((option) => wanted.has(option));

    if (param.maxSelected != null) chosen = chosen.slice(0, param.maxSelected);
    // Too few to be valid, and we have no way to guess which to add — the
    // declared default is the only honest answer.
    if (param.minSelected != null && chosen.length < param.minSelected) {
      return [...param.default];
    }
    return chosen;
  }

  // text
  const text = typeof value === "string" ? value : "";
  return param.maxLength ? text.slice(0, param.maxLength) : text;
}

/** Every declared value, defaulted and coerced. Undeclared keys are dropped. */
export function coerceAll(
  parameters: Parameter[],
  values: ParamValues | null | undefined,
): ParamValues {
  const raw = values ?? {};
  const out: ParamValues = {};
  for (const param of parameters) out[param.name] = coerce(param, raw[param.name]);
  return out;
}

export function defaults(parameters: Parameter[]): ParamValues {
  const out: ParamValues = {};
  for (const param of parameters) {
    // Copy array defaults — a shared reference would let one avatar's edits
    // mutate the declaration every other avatar defaults from.
    out[param.name] = Array.isArray(param.default)
      ? [...param.default]
      : param.default;
  }
  return out;
}

/**
 * The subset the sketch receives. `text` entries are answers about the avatar,
 * not inputs to drawing it, so they stay out of the render payload.
 */
export function renderValues(
  parameters: Parameter[],
  values: ParamValues,
): ParamValues {
  const out: ParamValues = {};
  for (const param of parameters) {
    if (isRenderParam(param)) out[param.name] = values[param.name];
  }
  return out;
}
