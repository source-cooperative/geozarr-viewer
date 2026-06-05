import * as zarr from "zarrita";
import { autoStatsFromGlobal, buildBandStats, type AutoStats } from "../../../render/stats";
import { ECMWF_NON_SPATIAL_DIMS } from "./attrs";

/** Width of the centered spatial patch we sample for stats. Matches the
 * dataset's sub-shard spatial size so the slice fetches exactly one
 * sub-shard. */
const SAMPLE_PIXELS = 32;

/** Sample a small spatial patch (32×32 near the array center) across
 * **all** lead-times and ensemble members, then compute a histogram +
 * min/max from it.
 *
 * Why this shape? The dataset is sharded with sub-chunk shape
 * `[1, 85, 51, 32, 32]`. zarrita's smallest byte-range fetch is one
 * sub-shard (~2 MB compressed, ~17.7 MB decompressed) — and the
 * sub-shard contains every `lead_time × ensemble_member` combination
 * regardless of which we ask for. Slicing the full `[721, 1440]`
 * spatial grid would force every sub-shard to be downloaded (~1500
 * of them, ~3 GB) for what's essentially a rescale-defaults heuristic.
 *
 * Pinning only `init_time` and slicing `null` for `lead_time` /
 * `ensemble_member` keeps the network cost identical (one sub-shard)
 * but lets us *use* all 4.4 M samples it carries. Critical for variables
 * like `precipitation_surface` whose value at `lead_time=0` is
 * identically zero across the globe — a single-frame sample would give
 * min == max and a null stats result. */
export async function computeEcmwfSliceStats(
  arr: zarr.Array<zarr.DataType, zarr.Readable>,
  pins: { initTime: number },
  signal: AbortSignal,
): Promise<AutoStats | null> {
  if (arr.shape.length !== 5) return null;

  const latShape = arr.shape[3]!;
  const lonShape = arr.shape[4]!;
  // Align the patch to sub-shard boundaries (multiples of SAMPLE_PIXELS)
  // so zarrita reads exactly one sub-shard, not two.
  const latStart =
    Math.floor(latShape / 2 / SAMPLE_PIXELS) * SAMPLE_PIXELS;
  const lonStart =
    Math.floor(lonShape / 2 / SAMPLE_PIXELS) * SAMPLE_PIXELS;
  const sliceSpec: (number | zarr.Slice | null)[] = [
    pins.initTime,
    null, // keep all 85 lead_times
    null, // keep all 51 ensemble_members
    zarr.slice(latStart, latStart + SAMPLE_PIXELS),
    zarr.slice(lonStart, lonStart + SAMPLE_PIXELS),
  ];
  const chunk = await zarr.get(
    arr as zarr.Array<zarr.NumberDataType, zarr.Readable>,
    sliceSpec,
    { signal },
  );
  if (signal.aborted) return null;
  const fillValue =
    typeof arr.attrs._FillValue === "number" ? arr.attrs._FillValue : null;
  const stats = buildBandStats(chunk.data as ArrayLike<number>, fillValue);
  if (!stats) return null;
  return autoStatsFromGlobal(stats);
}

/** Marker re-export so the rest of the profile can reference the canonical
 * non-spatial dim list. */
export { ECMWF_NON_SPATIAL_DIMS };
