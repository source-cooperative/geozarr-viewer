import { describe, expect, it } from "vitest";
import {
  buildBandStats,
  HISTOGRAM_BINS,
  percentileFromHistogram,
} from "../render/stats";

describe("buildBandStats", () => {
  it("returns min/max + histogram for finite values", () => {
    const values = new Float32Array(1000);
    for (let i = 0; i < values.length; i++) {
      values[i] = i / 100; // 0..9.99
    }
    const stats = buildBandStats(values, null);
    expect(stats).not.toBeNull();
    expect(stats!.min).toBeCloseTo(0);
    expect(stats!.max).toBeCloseTo(9.99);
    expect(stats!.histogram.length).toBe(HISTOGRAM_BINS);
    const total = stats!.histogram.reduce((a, b) => a + b, 0);
    expect(total).toBe(1000);
  });

  it("skips nodata values", () => {
    const values = new Float32Array([1, 2, 3, -9999, -9999, 4]);
    const stats = buildBandStats(values, -9999);
    expect(stats?.min).toBe(1);
    expect(stats?.max).toBe(4);
    const total = stats!.histogram.reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });

  it("returns null for all-NaN", () => {
    const values = new Float32Array([NaN, NaN, NaN]);
    expect(buildBandStats(values, null)).toBeNull();
  });

  it("percentileFromHistogram brackets the 50th percentile", () => {
    const values = new Float32Array(1000);
    for (let i = 0; i < values.length; i++) values[i] = i;
    const stats = buildBandStats(values, null)!;
    const p50 = percentileFromHistogram(stats, 0.5);
    expect(p50).toBeGreaterThan(450);
    expect(p50).toBeLessThan(550);
  });
});
