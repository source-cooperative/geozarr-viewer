export const HISTOGRAM_BINS = 128;

export type BandStats = {
  min: number;
  max: number;
  /** Bin counts evenly distributed over [min, max]. Length = HISTOGRAM_BINS. */
  histogram: number[];
};

export type AutoStats = {
  perBand: Map<number, BandStats> | null;
  global: BandStats | null;
};

/** Linear-interpolated percentile from a histogram. `p` is in [0, 1]. */
export function percentileFromHistogram(stats: BandStats, p: number): number {
  const total = stats.histogram.reduce((a, b) => a + b, 0);
  if (total === 0) return p < 0.5 ? stats.min : stats.max;
  const target = total * p;
  let acc = 0;
  const range = stats.max - stats.min;
  if (range <= 0) return stats.min;
  const binWidth = range / stats.histogram.length;
  for (let i = 0; i < stats.histogram.length; i++) {
    const count = stats.histogram[i] ?? 0;
    if (acc + count >= target) {
      const fraction = count > 0 ? (target - acc) / count : 0;
      return stats.min + (i + fraction) * binWidth;
    }
    acc += count;
  }
  return stats.max;
}

/** Single-pass min/max + histogram over an iterable of sample values.
 * Two-pass: first to find min/max (skipping nodata + non-finite), then to
 * bin. Returns null when the iterable produces no valid samples. */
export function buildBandStats(
  values: ArrayLike<number>,
  nodata: number | null,
): BandStats | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let any = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (nodata !== null && v === nodata) continue;
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    any = true;
  }
  if (!any || !(min < max)) return null;
  const histogram = new Array<number>(HISTOGRAM_BINS).fill(0);
  const scale = HISTOGRAM_BINS / (max - min);
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (nodata !== null && v === nodata) continue;
    if (!Number.isFinite(v)) continue;
    let idx = Math.floor((v - min) * scale);
    if (idx < 0) idx = 0;
    if (idx >= HISTOGRAM_BINS) idx = HISTOGRAM_BINS - 1;
    histogram[idx]++;
  }
  return { min, max, histogram };
}

/** Wrap a `BandStats` as a single-band `AutoStats`. */
export function autoStatsFromGlobal(stats: BandStats): AutoStats {
  return {
    perBand: new Map([[1, stats]]),
    global: stats,
  };
}
