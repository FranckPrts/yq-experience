import { VOID_COLOR } from "@/lib/theme";

/**
 * Fixed star tunables stored in `params` jsonb. Key set is owned by this app
 * (not YQ). Answers remain a separate, open-ended jsonb bag.
 */
export type OrbitMode = "clouds" | "beads";

export type StarParams = {
  size: number;
  freq: number;
  noise: number;
  core: number;
  hue: number;
  hue2: number;
  orbit_mode: OrbitMode;
};

/** Numeric tunables only — `orbit_mode` is edited via a toggle. */
export type StarKey = Exclude<keyof StarParams, "orbit_mode">;

export type StarControl = {
  key: StarKey;
  label: string;
  /** snake_case name shown in the participant-facing terminal UI. */
  termLabel: string;
  min: number;
  max: number;
  step: number;
  /** Renders the slider track as the HSB hue ramp the value maps to. */
  hue?: boolean;
};

/** Participant-facing sliders — `size` is stored but not exposed here. */
export const STAR_CONTROLS: readonly StarControl[] = [
  { key: "core", label: "Core", termLabel: "core_size", min: 0, max: 100, step: 1 },
  { key: "freq", label: "Frequency", termLabel: "frequency", min: 1, max: 6, step: 0.1 },
  { key: "noise", label: "Noise", termLabel: "scatter", min: 1, max: 100, step: 1 },
  {
    key: "hue",
    label: "Corona hue",
    termLabel: "inner_color",
    min: 0,
    max: 255,
    step: 1,
    hue: true,
  },
  {
    key: "hue2",
    label: "Outer hue",
    termLabel: "outer_color",
    min: 0,
    max: 255,
    step: 1,
    hue: true,
  },
] as const;

export const STAR_KEYS = [
  "size",
  "freq",
  "noise",
  "core",
  "hue",
  "hue2",
  "orbit_mode",
] as const;

export const DEFAULT_STAR_PARAMS: StarParams = {
  size: 120,
  freq: 5,
  noise: 20,
  core: 50,
  hue: 69,
  hue2: 0,
  orbit_mode: "clouds",
};

const SIZE_RANGE = { min: 1, max: 500 } as const;

const CONTROL_BY_KEY = Object.fromEntries(
  STAR_CONTROLS.map((c) => [c.key, c]),
) as Partial<Record<StarKey, StarControl>>;

/** Clamps one value to its control's range; falls back to the default. */
export function clampStar(key: StarKey, value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_STAR_PARAMS[key];
  if (key === "size") {
    return Math.min(SIZE_RANGE.max, Math.max(SIZE_RANGE.min, n));
  }
  const c = CONTROL_BY_KEY[key];
  if (!c) return DEFAULT_STAR_PARAMS[key];
  return Math.min(c.max, Math.max(c.min, n));
}

export function toOrbitMode(value: unknown): OrbitMode {
  return value === "beads" ? "beads" : "clouds";
}

/**
 * Coerces whatever came back from the `params` jsonb column into a
 * complete, in-range StarParams. Missing or junk keys fall back to defaults.
 */
export function toStarParams(value: unknown): StarParams {
  if (!value || typeof value !== "object") return { ...DEFAULT_STAR_PARAMS };
  const raw = value as Record<string, unknown>;
  return {
    size: clampStar("size", raw.size),
    freq: clampStar("freq", raw.freq),
    noise: clampStar("noise", raw.noise),
    core: clampStar("core", raw.core),
    hue: clampStar("hue", raw.hue),
    hue2: clampStar("hue2", raw.hue2),
    orbit_mode: toOrbitMode(raw.orbit_mode),
  };
}

/**
 * Everything the sketch reads that participants don't touch. Merged with
 * StarParams at draw time — tweak the look here rather than in the component.
 * Star radius comes from `params.size`, not from here.
 */
export const SKETCH_DEFAULTS = {
  star: {
    x: 0.5,
    y: 0.5,
    /**
     * Display-only multiplier on `params.size`. Size isn't tunable, so the
     * star's on-screen presence lives here instead of in the stored value —
     * which keeps already-saved planets rendering at the same scale as new
     * ones. Scales the glow radius, the orbit amplitudes and the corona ring
     * together, so the composition holds.
     */
    scale: 2.8,
    /**
     * Caps the viewport dimension the star is sized against, in px. The
     * participant UI is a phone-width column, so past this the star would
     * outgrow the layout it's composed with — on a wide desktop it would
     * spill straight over the controls. Below the cap nothing changes.
     */
    maxUnit: 560,
  },
  glow: {
    tone: 1.5,
    thresh: 2,
    fuse: 3,
    blend: 3,
    halo: 0.95,
    grad: 0.3,
    soft: 3,
    sat: 0.8,
    bri: 0.3,
    radBase: 0.5,
    radCore: 0.6,
    base: VOID_COLOR,
  },
  particles: {
    num: 100,
    size: 12,
    detail: 10,
    sat: 180,
    coronaR: 140,
    coronaW: 0.45,
    hueSpread: 1.7,
    noiseGain: 2.2,
    noiseSpeed: 0.3,
    noiseOctaves: 4,
    follow: 0.35,
  },
  post: {
    ca: 0.01,
    grain: 0.5,
    grainDisplace: 5,
    grainAnimate: true,
  },
} as const;

/**
 * HSB hue (0–255, the sketch's scale) → CSS color. Used for slider track
 * gradients and the cheap non-WebGL previews in admin.
 */
export function hueToCss(hue: number, saturation = 85, lightness = 55): string {
  const h = (((hue / 255) * 360) % 360).toFixed(1);
  return `hsl(${h} ${saturation}% ${lightness}%)`;
}

/**
 * The star's own color, lightened enough to read as text on the void. Labels
 * and the planet name are tinted with this so the chrome belongs to the star.
 */
export function starInkColor(hue: number): string {
  return hueToCss(hue, 58, 78);
}
