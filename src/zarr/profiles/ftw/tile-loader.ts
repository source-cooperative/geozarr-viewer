import type { GetTileDataOptions } from "@developmentseed/deck.gl-zarr";
import * as zarr from "zarrita";
import {
  buildMultiBandTile,
  type MultiBandTileData,
} from "../../../render/shared-textures";

/** Tile loader for FTW predictions.
 *
 * Data is float32 with NaN fill values (the v3 metadata encodes the
 * sentinel as a float64 NaN bit pattern but the chunks come back as
 * IEEE-754 NaN inside the `Float32Array`). The shared single-band
 * render pipeline's automatic `FilterNaN` module masks them for free,
 * so the loader is a near-passthrough.
 *
 * Outer chunks are `(1, 3, 8192, 8192)` and sharded with sub-chunks of
 * `(1, 1, 2048, 2048)`. Pinning `time` + `band` and slicing a small
 * spatial region fetches just the sub-shards covering that region. */
export async function getFtwTileData(
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
      `FTW tile expected 2D [H,W] chunk after slicing; got [${chunk.shape.join(",")}]`,
    );
  }
  if (chunk.shape[0] !== height || chunk.shape[1] !== width) {
    throw new Error(
      `FTW tile shape mismatch: expected [${height},${width}], got [${chunk.shape.join(",")}]`,
    );
  }
  const data =
    chunk.data instanceof Float32Array
      ? chunk.data
      : Float32Array.from(chunk.data as ArrayLike<number>);
  return buildMultiBandTile(
    device,
    [{ key: "1", data }],
    width,
    height,
    null,
  );
}
