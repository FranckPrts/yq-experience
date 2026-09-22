"use client";

import type { CSSProperties, ReactNode } from "react";
import { coerce } from "@/lib/params/coerce";
import type { ParamValues } from "@/lib/params/coerce";
import {
  effectiveRange,
  hueDegrees,
  isEnabled,
  isNumeric,
  type NumericParameter,
  type Parameter,
  type ParameterValue,
} from "@/lib/params/types";

/**
 * Generic descendant of `StarControls` + `StarSliders`. Rows are rendered from
 * the declaration rather than from `STAR_CONTROLS`, so the number and nature of
 * the controls is whatever the delivered script declared.
 *
 * The terminal styling (`term-range`, the `label : |—————| ` row) and the hue
 * ramp carry over unchanged; the ramp is now keyed off `display: "hue"` and
 * spans the parameter's own declared range instead of a hardcoded 0–255.
 */

/**
 * A hue value → CSS colour, measured against the parameter's full domain so a
 * given value is always the same colour whether or not the parameter is
 * truncated.
 */
function hueToCss(
  param: NumericParameter,
  value: number,
  saturation = 85,
  lightness = 55,
): string {
  return `hsl(${hueDegrees(param, value).toFixed(1)} ${saturation}% ${lightness}%)`;
}

/**
 * The track spans exactly what the participant can reach — the truncation if
 * there is one — while each stop's colour still comes from the domain. So a
 * truncated hue shows a short ramp of the real colours, not the whole wheel
 * squeezed into a narrow slider.
 */
function hueTrack(param: NumericParameter): string {
  const { min, max } = effectiveRange(param);
  const stops = Array.from({ length: 13 }, (_, i) =>
    hueToCss(param, min + (i / 12) * (max - min)),
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/**
 * The avatar's own colour, lightened enough to read as text on the void, so the
 * chrome belongs to the thing it controls. Taken from the first hue parameter
 * the script declares; scripts with no hue keep the default ink.
 */
function inkColor(parameters: Parameter[], values: ParamValues): string {
  const hue = parameters.find((p) => isNumeric(p) && p.display === "hue");
  if (!hue || !isNumeric(hue)) return "var(--color-paper)";
  return hueToCss(hue, Number(values[hue.name] ?? hue.default), 58, 78);
}

/** `label : <control>`, with the label tinted by the avatar it belongs to. */
function Row({
  label,
  ink,
  muted = false,
  children,
}: {
  label: string;
  ink: string;
  /** Gated by a toggle that is currently off — shown, but out of reach. */
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex items-center gap-2 py-1.5 ${muted ? "opacity-40" : ""}`}>
      <span className="w-[11ch] shrink-0 text-sm" style={{ color: ink }}>
        {label}
      </span>
      <span className="shrink-0 text-sm" style={{ color: ink }}>
        :
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
        {children}
      </div>
    </div>
  );
}

type AvatarControlsProps = {
  parameters: Parameter[];
  values: ParamValues;
  onChange: (name: string, value: ParameterValue) => void;
  /** Answers are asked elsewhere in the flow; controls skip them by default. */
  includeText?: boolean;
  /**
   * Whether the "additional parameters" section starts open. A participant
   * meets the everyday controls first, so it stays shut for them; the harness
   * opens it, because a bench that hides half the knobs is a worse bench.
   */
  advancedOpen?: boolean;
};

export default function AvatarControls({
  parameters,
  values,
  onChange,
  includeText = false,
  advancedOpen = false,
}: AvatarControlsProps) {
  const ink = inkColor(parameters, values);
  const rows = parameters.filter((p) => includeText || p.type !== "text");
  // Two tiers, each keeping declaration order within itself.
  const plain = rows.filter((p) => !p.advanced);
  const advanced = rows.filter((p) => p.advanced);

  function renderRow(param: Parameter) {
    const value = values[param.name] ?? param.default;
    // A gated control is disabled rather than hidden, and its value is left
    // alone, so turning the switch back on restores what was set.
    const enabled = isEnabled(param, values);

    if (isNumeric(param)) {
      // The slider offers the truncated range where one is declared, so
      // the control cannot even reach a value coercion would reject.
      const range = effectiveRange(param);
      return (
        <Row key={param.name} label={param.label} ink={ink} muted={!enabled}>
          <span className="text-paper/60">|</span>
          <input
            type="range"
            aria-label={param.label}
            className="term-range min-w-0 flex-1"
            min={range.min}
            max={range.max}
            step={param.step ?? (param.type === "discrete" ? 1 : "any")}
            value={Number(value)}
            disabled={!enabled}
            onChange={(e) => onChange(param.name, coerce(param, e.target.value))}
            style={
              param.display === "hue"
                ? ({ "--term-track": hueTrack(param) } as CSSProperties)
                : undefined
            }
          />
          <span className="text-paper/60">|</span>
        </Row>
      );
    }

    if (param.type === "toggle") {
      const on = value !== false;
      return (
        <Row key={param.name} label={param.label} ink={ink} muted={!enabled}>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={param.label}
            disabled={!enabled}
            onClick={() => onChange(param.name, !on)}
            className={`text-sm underline-offset-4 ${
              on
                ? "text-paper underline"
                : "text-dim hover:text-paper/80"
            } ${enabled ? "" : "cursor-not-allowed"}`}
          >
            {on ? "on" : "off"}
          </button>
        </Row>
      );
    }

    if (param.type === "multiselect") {
      const chosen = Array.isArray(value) ? value : [];
      const atMax =
        param.maxSelected != null && chosen.length >= param.maxSelected;
      return (
        <Row key={param.name} label={param.label} ink={ink} muted={!enabled}>
          <div
            role="group"
            aria-label={param.label}
            className="flex flex-wrap gap-x-6 gap-y-1"
          >
            {param.options.map((option) => {
              const active = chosen.includes(option.value);
              // A full selection locks the unchosen, but never the chosen —
              // otherwise there is no way back out of a maxed-out group.
              const locked = !enabled || (atMax && !active);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="checkbox"
                  aria-checked={active}
                  disabled={locked}
                  onClick={() =>
                    onChange(
                      param.name,
                      coerce(
                        param,
                        active
                          ? chosen.filter((v) => v !== option.value)
                          : [...chosen, option.value],
                      ),
                    )
                  }
                  className={`text-sm underline-offset-4 ${
                    active
                      ? "text-paper underline"
                      : locked
                        ? "cursor-not-allowed text-dim/40"
                        : "text-dim hover:text-paper/80"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Row>
      );
    }

    if (param.type === "select") {
      return (
        <Row key={param.name} label={param.label} ink={ink} muted={!enabled}>
          <div role="radiogroup" aria-label={param.label} className="flex gap-6">
            {param.options.map((option) => {
              const active = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!enabled}
                  onClick={() => onChange(param.name, option.value)}
                  className={`text-sm underline-offset-4 ${
                    active
                      ? "text-paper underline"
                      : "text-dim hover:text-paper/80"
                  } ${enabled ? "" : "cursor-not-allowed"}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Row>
      );
    }

    return (
      <Row key={param.name} label={param.label} ink={ink} muted={!enabled}>
        <input
          type="text"
          aria-label={param.label}
          className="term-input min-w-0 flex-1"
          placeholder={param.placeholder}
          maxLength={param.maxLength}
          value={String(value)}
          disabled={!enabled}
          onChange={(e) => onChange(param.name, e.target.value)}
        />
      </Row>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {plain.map(renderRow)}

      {advanced.length > 0 && (
        <details
          open={advancedOpen}
          className="mt-2 border-t border-paper/10 pt-2"
        >
          <summary
            className="cursor-pointer text-xs opacity-60 hover:opacity-100"
            style={{ color: ink }}
          >
            additional parameters
          </summary>
          <div className="flex flex-col gap-1 pt-1">
            {advanced.map(renderRow)}
          </div>
        </details>
      )}
    </div>
  );
}
