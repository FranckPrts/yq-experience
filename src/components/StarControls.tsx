"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  STAR_CONTROLS,
  hueToCss,
  starInkColor,
  type OrbitMode,
  type StarKey,
  type StarParams,
} from "@/lib/types/star";

/** The full 0–255 hue ramp, so a hue slider's track shows what it selects. */
const HUE_TRACK = `linear-gradient(to right, ${Array.from(
  { length: 13 },
  (_, i) => hueToCss((i / 12) * 255),
).join(", ")})`;

const ORBIT_MODES: readonly OrbitMode[] = ["clouds", "beads"];

type StarControlsProps = {
  params: StarParams;
  onChange: (key: StarKey, value: number) => void;
  onOrbitModeChange: (mode: OrbitMode) => void;
};

/** `label : <control>`, with the label tinted by the star it belongs to. */
function Row({
  label,
  ink,
  children,
}: {
  label: string;
  ink: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
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

/**
 * Participant-facing star controls. Same values as the admin `StarSliders`,
 * dressed as terminal rows — admin keeps its own component untouched.
 */
export default function StarControls({
  params,
  onChange,
  onOrbitModeChange,
}: StarControlsProps) {
  const ink = starInkColor(params.hue);

  const slider = (control: (typeof STAR_CONTROLS)[number]) => (
    <Row key={control.key} label={control.termLabel} ink={ink}>
      <span className="text-paper/60">|</span>
      <input
        type="range"
        aria-label={control.termLabel}
        className="term-range min-w-0 flex-1"
        min={control.min}
        max={control.max}
        step={control.step}
        value={params[control.key]}
        onChange={(e) => onChange(control.key, Number(e.target.value))}
        style={
          control.hue
            ? ({ "--term-track": HUE_TRACK } as CSSProperties)
            : undefined
        }
      />
      <span className="text-paper/60">|</span>
    </Row>
  );

  return (
    <div className="flex flex-col gap-1">
      {/* `behavior` sits after the first slider, as in the mockup. */}
      {slider(STAR_CONTROLS[0])}

      <Row label="behavior" ink={ink}>
        <div role="radiogroup" aria-label="behavior" className="flex gap-6">
          {ORBIT_MODES.map((mode) => {
            const active = params.orbit_mode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onOrbitModeChange(mode)}
                className={`text-sm underline-offset-4 ${
                  active
                    ? "text-paper underline"
                    : "text-dim hover:text-paper/80"
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </Row>

      {STAR_CONTROLS.slice(1).map(slider)}
    </div>
  );
}
