/** Shared binning + highlight color for conclusion charts. */

export type Bin = {
  start: number;
  end: number;
  mid: number;
  count: number;
};

export function buildBins(
  scores: number[],
  min: number,
  max: number,
  binWidth: number,
): Bin[] {
  const binCount = Math.max(1, Math.round((max - min) / binWidth));
  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => {
    const start = min + i * binWidth;
    const end = min + (i + 1) * binWidth;
    return { start, end, mid: (start + end) / 2, count: 0 };
  });

  for (const score of scores) {
    if (score < min || score > max) continue;
    const idx =
      score === max
        ? binCount - 1
        : Math.min(binCount - 1, Math.floor((score - min) / binWidth));
    bins[idx].count += 1;
  }

  return bins;
}

/** Red dotted markers for the viewer's own runs. */
export const YOUR_SCORE_RED = "#c41e1e";
