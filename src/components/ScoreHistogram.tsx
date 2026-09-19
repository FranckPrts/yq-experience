"use client";

import { useMemo, useState } from "react";
import { buildBins, YOUR_SCORE_RED } from "@/lib/score-chart-style";
import { DIM_COLOR, PAPER_COLOR } from "@/lib/theme";

type ScoreHistogramProps = {
  scores: number[];
  /** Scores from sessions that include one of the viewer's planets. */
  highlightScores?: number[];
  min?: number;
  max?: number;
  binWidth?: number;
};

/**
 * Interactive score histogram on the void — transparent plate, paper ink,
 * terminal type. Hover a bin for its range and count; red dotted lines mark
 * your runs.
 */
export default function ScoreHistogram({
  scores,
  highlightScores = [],
  min = 0,
  max = 100,
  binWidth = 4,
}: ScoreHistogramProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);

  const bins = useMemo(
    () => buildBins(scores, min, max, binWidth),
    [scores, min, max, binWidth],
  );
  const peak = Math.max(1, ...bins.map((b) => b.count));

  const width = 420;
  const height = 240;
  const padLeft = 48;
  const padRight = 14;
  const padTop = 22;
  const padBottom = 44;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const gap = 1;
  const barW = plotW / bins.length;

  const xFor = (score: number) =>
    padLeft + ((score - min) / (max - min)) * plotW;

  const tickScores = [0, 20, 40, 60, 80, 100].filter(
    (t) => t >= min && t <= max,
  );

  return (
    <div className="relative w-full select-none font-terminal">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Interactive score histogram"
        onMouseLeave={() => {
          setHoverIdx(null);
          setTooltip(null);
        }}
      >
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={padLeft}
            y1={padTop + plotH * (1 - frac)}
            x2={padLeft + plotW}
            y2={padTop + plotH * (1 - frac)}
            stroke={DIM_COLOR}
            strokeWidth={0.6}
            opacity={0.45}
          />
        ))}

        {bins.map((bin, i) => {
          const barH = (bin.count / peak) * plotH;
          const x =
            padLeft + ((bin.start - min) / (max - min)) * plotW + gap / 2;
          const y = padTop + plotH - barH;
          const w = Math.max(0, barW - gap);
          const active = hoverIdx === i;

          return (
            <g key={`${bin.start}-${bin.end}`}>
              <rect
                x={x}
                y={padTop}
                width={w}
                height={plotH}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={(e) => {
                  setHoverIdx(i);
                  const rect = (
                    e.currentTarget.ownerSVGElement as SVGSVGElement
                  ).getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    label: `${bin.start}–${bin.end}: ${bin.count}`,
                  });
                }}
                onMouseMove={(e) => {
                  const rect = (
                    e.currentTarget.ownerSVGElement as SVGSVGElement
                  ).getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    label: `${bin.start}–${bin.end}: ${bin.count}`,
                  });
                }}
              />
              <rect
                x={x}
                y={y}
                width={w}
                height={barH}
                fill={PAPER_COLOR}
                opacity={active ? 1 : 0.85}
                style={{
                  transition: "opacity 80ms linear",
                  pointerEvents: "none",
                }}
              />
            </g>
          );
        })}

        {highlightScores.map((score, i) => {
          const x = xFor(score);
          return (
            <line
              key={`you-${score}-${i}`}
              x1={x}
              y1={padTop}
              x2={x}
              y2={padTop + plotH}
              stroke={YOUR_SCORE_RED}
              strokeWidth={1.25}
              strokeDasharray="2.5 2.5"
              style={{ pointerEvents: "none" }}
            />
          );
        })}

        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + plotH}
          stroke={PAPER_COLOR}
          strokeWidth={1}
        />
        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={padLeft + plotW}
          y2={padTop + plotH}
          stroke={PAPER_COLOR}
          strokeWidth={1}
        />

        {tickScores.map((t) => (
          <g key={t}>
            <line
              x1={xFor(t)}
              y1={padTop + plotH}
              x2={xFor(t)}
              y2={padTop + plotH + 4}
              stroke={PAPER_COLOR}
              strokeWidth={0.8}
            />
            <text
              x={xFor(t)}
              y={padTop + plotH + 18}
              textAnchor="middle"
              fill={PAPER_COLOR}
              className="tabular-nums"
              style={{
                fontFamily: "var(--font-terminal), monospace",
                fontSize: "calc(0.875rem - 4pt)",
              }}
            >
              {t}
            </text>
          </g>
        ))}

        <text
          x={14}
          y={padTop + plotH / 2}
          textAnchor="middle"
          fill={PAPER_COLOR}
          transform={`rotate(-90 14 ${padTop + plotH / 2})`}
          style={{
            fontFamily: "var(--font-terminal), monospace",
            fontSize: "calc(0.875rem - 4pt)",
          }}
        >
          Frequency
        </text>
        <text
          x={padLeft + plotW / 2}
          y={height - 6}
          textAnchor="middle"
          fill={PAPER_COLOR}
          style={{
            fontFamily: "var(--font-terminal), monospace",
            fontSize: "calc(0.875rem - 4pt)",
          }}
        >
          Score
        </text>

        <text
          x={padLeft - 8}
          y={padTop + 6}
          textAnchor="end"
          fill={PAPER_COLOR}
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-terminal), monospace",
            fontSize: "calc(0.875rem - 4pt)",
          }}
        >
          {peak}
        </text>
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap border border-paper/40 bg-void px-2 py-1 font-terminal tabular-nums text-paper"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(10px, -120%)",
            fontSize: "calc(0.875rem - 4pt)",
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
