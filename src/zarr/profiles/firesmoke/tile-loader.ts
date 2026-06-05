import type { GetTileDataOptions } from "@developmentseed/deck.gl-zarr";
import * as zarr from "zarrita";
import {
  buildMultiBandTile,
  type MultiBandTileData,
} from "../../../render/shared-textures";

/** CF int16 sentinel reserved for NaN — the `_FillValue` of `PM25_latest`. */
const FILL_VALUE = -32768;
/** CF `scale_factor` for `PM25_latest` — applied client-side to recover
 * µg/m³ from the int16-quantized storage values. */
const SCALE_FACTOR = 0.1;

/** Tile loader for FireSmoke PM2.5.
 *
 * The store quantizes float32 µg/m³ down to int16 with
 * `scale_factor=0.1`, `_FillValue=-32768`. We decode CF on the JS side:
 * int16 → float32, NaN for the fill sentinel, then ×0.1. The resulting
 * float texture flows through the shared single-band render pipeline,
 * which already filters NaN via `FilterNaN` for `r32float` textures.
 *
 * Chunks are `(1, 381, 1081)` (no sharding) — selecting one valid_time
 * pulls exactly one chunk file = one HTTP request per tile. */
export async function getFireSmokeTileData(
  arr: zarr.Array<zarr.DataType, zarr.Readable>,
  options: GetTileDataOptions,
): Promise<MultiBandTileData> {
  const { device, sliceSpec, signal, width, height } = options;
  const chunk = await zarr.get(
    arr as zarr.Array<zarr.NumberDataType, zarr.Readable>,
    sliceSpec,
    { signal },
  );
  if (chunk.shape.length !== 2) {
    throw new Error(
      `FireSmoke tile expected 2D [H,W] chunk after slicing; got [${chunk.shape.join(",")}]`,
    );
  }
  if (chunk.shape[0] !== height || chunk.shape[1] !== width) {
    throw new Error(
      `FireSmoke tile shape mismatch: expected [${height},${width}], got [${chunk.shape.join(",")}]`,
    );
  }
  const int16 = chunk.data as Int16Array;
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    const v = int16[i]!;
    float32[i] = v === FILL_VALUE ? Number.NaN : v * SCALE_FACTOR;
  }
  // nodata: null — the render pipeline's automatic FilterNaN catches
  // NaN pixels for float textures.
  return buildMultiBandTile(
    device,
    [{ key: "1", data: float32 }],
    width,
    height,
    null,
  );
}
