import { VOID_COLOR } from "@/lib/theme";
import { hueToCss, type StarParams } from "@/lib/types/star";

/** Matches SIZE_RANGE.max in star.ts — used only to normalize the disc scale. */
const SIZE_MAX = 500;
const FREQ_MIN = 1;
const FREQ_MAX = 12;

/**
 * A cheap, static stand-in for the star. Admin lists dozens of rows and every
 * live StarCanvas costs a WebGL context (browsers cap out around 16), so the
 * table uses this and saves the real sketch for single-star views.
 *
 * Maps every StarParams knob into CSS (no animation, no canvas):
 * size/core → disc radius, noise → halo + light blur, hue/hue2 → colors,
 * freq → faint concentric rings, orbit_mode → soft corona vs dotted beads.
 */
export default function StarSwatch({
  params,
  size = 72,
  className = "",
}: {
  params: StarParams;
  size?: number;
  className?: string;
}) {
  // Mirror canvas: uRad ∝ size * (radBase + core/100 * radCore)
  const sizeT = Math.min(1, Math.max(0.06, params.size / SIZE_MAX));
  const radFactor = 0.5 + (params.core / 100) * 0.6;
  const discExtent = 36 + sizeT * radFactor * 52;

  const coreStop = Math.min(
    discExtent * 0.4,
    4 + (params.core / 100) * discExtent * 0.32,
  );
  const haloStop = Math.min(
    90,
    coreStop + 8 + (params.noise / 100) * discExtent * 0.5,
  );
  const voidStop = Math.min(98, Math.max(haloStop + 6, discExtent));

  const corona = hueToCss(params.hue, 90, 62);
  const outer = hueToCss(params.hue2, 85, 42);

  const freqT = Math.min(
    1,
    Math.max(0, (params.freq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)),
  );
  // Higher freq → tighter rings; keep them faint on small thumbs
  const ringPeriod = 16 - freqT * 10;
  const ringStroke = `color-mix(in srgb, ${hueToCss(params.hue, 75, 58)} ${Math.round(22 + freqT * 18)}%, transparent)`;

  const blurPx = (params.noise / 100) * 1.1;
  const beads = params.orbit_mode === "beads";
  const beadR = Math.min(48, (coreStop + haloStop) * 0.55);
  const beadDot = Math.max(1.6, 2.2 + sizeT * 1.2);

  const beadLayer = [
    [50, 50 - beadR],
    [50 + beadR * 0.71, 50 - beadR * 0.71],
    [50 + beadR, 50],
    [50 + beadR * 0.71, 50 + beadR * 0.71],
    [50, 50 + beadR],
    [50 - beadR * 0.71, 50 + beadR * 0.71],
    [50 - beadR, 50],
    [50 - beadR * 0.71, 50 - beadR * 0.71],
  ]
    .map(
      ([x, y]) =>
        `radial-gradient(circle at ${x}% ${y}%, ${corona} 0 ${beadDot}%, transparent ${beadDot + 0.8}%)`,
    )
    .join(", ");

  return (
    <div
      className={`relative overflow-hidden rounded ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: VOID_COLOR,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, white 0%, ${corona} ${coreStop}%, ${outer} ${haloStop}%, ${VOID_COLOR} ${voidStop}%)`,
          filter: blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent ${ringPeriod - 1.4}%, ${ringStroke} ${ringPeriod - 0.7}%, transparent ${ringPeriod}%)`,
          // Soften rings toward the void so they read as corona texture, not a full bullseye
          maskImage: `radial-gradient(circle at 50% 50%, black 0%, black ${haloStop}%, transparent ${voidStop}%)`,
          WebkitMaskImage: `radial-gradient(circle at 50% 50%, black 0%, black ${haloStop}%, transparent ${voidStop}%)`,
        }}
      />
      {beads && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: beadLayer }}
        />
      )}
    </div>
  );
}
