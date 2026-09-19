"use client";

import type { CSSProperties } from "react";
import {
  STAR_CONTROLS,
  hueToCss,
  type OrbitMode,
  type StarKey,
  type StarParams,
} from "@/lib/types/star";

/** The full 0–255 hue ramp, so a hue slider's track shows what it selects. */
const HUE_TRACK = `linear-gradient(to right, ${Array.from(
  { length: 13 },
  (_, i) => hueToCss((i / 12) * 255),
).join(", ")})`;

type StarSlidersProps = {
  params: StarParams;
  onChange: (key: StarKey, value: number) => void;
  onOrbitModeChange: (mode: OrbitMode) => void;
  className?: string;
};

export default function StarSliders({
  params,
  onChange,
  onOrbitModeChange,
  className = "",
}: StarSlidersProps) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {STAR_CONTROLS.map((control) => {
        const value = params[control.key];
        return (
          <label key={control.key} className="form-control w-full">
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="opacity-80">{control.label}</span>
              <span className="font-mono text-xs opacity-50 tabular-nums">
                {control.step < 1 ? value.toFixed(1) : Math.round(value)}
              </span>
            </div>
            <input
              type="range"
              className={`range range-sm w-full ${
                control.hue ? "range-hue" : "range-primary"
              }`}
              min={control.min}
              max={control.max}
              step={control.step}
              value={value}
              onChange={(e) => onChange(control.key, Number(e.target.value))}
              style={
                control.hue
                  ? ({
                      "--hue-track": HUE_TRACK,
                      "--hue-thumb": hueToCss(value),
                    } as CSSProperties)
                  : undefined
              }
            />
          </label>
        );
      })}

      <label className="label cursor-pointer justify-start gap-3 px-0">
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={params.orbit_mode === "beads"}
          onChange={(e) =>
            onOrbitModeChange(e.target.checked ? "beads" : "clouds")
          }
        />
        <span className="label-text flex flex-col gap-0.5">
          <span>Orbit mode</span>
          <span className="font-mono text-xs opacity-50">
            {params.orbit_mode}
          </span>
        </span>
      </label>
    </div>
  );
}
