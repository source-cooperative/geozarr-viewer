import * as zarr from "zarrita";
import {
  autoStatsFromGlobal,
  buildBandStats,
  type AutoStats,
} from "../../../render/stats";

/** Width of the spatial sample patch. Matches the dataset's sub-shard
 * size so the sampler reads exactly one sub-shard (~16 MB raw float32,
 * a few MB compressed) and gets 4 M values to histogram. */
const SAMPLE_PIXELS = 2048;

/** Sample one centered 2048×2048 sub-shard at the current `(time, band)`
 * pin to estimate a starting rescale window. Cheap relative to the
 * `1.5M × 4M` full slice (~6 TB raw). */
export async function computeFtwSliceStats(
  arr: zarr.Array<zarr.DataType, zarr.Readable>,
  pins: { time: number; band: number },
  signal: AbortSignal,
): Promise<AutoStats | null> {
  if (arr.shape.length !== 4) return null;
  const yShape = arr.shape[2]!;
  const xShape = arr.shape[3]!;
  const yStart = Math.floor(yShape / 2 / SAMPLE_PIXELS) * SAMPLE_PIXELS;
  const xStart = Math.floor(xShape / 2 / SAMPLE_PIXELS) * SAMPLE_PIXELS;
  const sliceSpec: (number | zarr.Slice | null)[] = [
    pins.time,
    pins.band,
    zarr.slice(yStart, yStart + SAMPLE_PIXELS),
    zarr.slice(xStart, xStart + SAMPLE_PIXELS),
  ];
  const chunk = await zarr.get(
    arr as zarr.Array<zarr.NumberDataType, zarr.Readable>,
    sliceSpec,
    { signal },
  );
  if (signal.aborted) return null;
  // No fill value to skip — NaN samples are filtered inside buildBandStats
  // (via the `Number.isFinite` check).
  const stats = buildBandStats(chunk.data as ArrayLike<number>, null);
  if (!stats) return null;
  return autoStatsFromGlobal(stats);
}
