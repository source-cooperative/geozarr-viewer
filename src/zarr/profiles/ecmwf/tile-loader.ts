import type { MinimalTileData } from "@developmentseed/deck.gl-raster";
import type { GetTileDataOptions } from "@developmentseed/deck.gl-zarr";
import type { Texture } from "@luma.gl/core";
import * as zarr from "zarrita";
import { ECMWF_LEAD_TIME_HOURS } from "./dim-labels";

const LEAD_TIME_COUNT = ECMWF_LEAD_TIME_HOURS.length;

export type EcmwfTileData = MinimalTileData & {
  /** r32float Texture2DArray; depth = LEAD_TIME_COUNT. Layer `i` = frame `i`. */
  texture: Texture;
  /** Sentinel value to treat as nodata (currently informational — the
   * sampler also discards NaN intrinsically). */
  nodata: number | null;
};

/**
 * Slice one spatial chunk × all 85 lead-time frames for the pinned
 * init_time + ensemble_member, then upload the data as a `r32float`
 * Texture2DArray. The dataset's sub-shard unit is `[1, 85, 51, 32, 32]`,
 * so keeping all 85 lead-times means we use 85/4335 of the downloaded
 * bytes instead of 1/4335 — a 85× efficiency gain compared to pinning
 * lead_time. The user's lead_time slider then becomes a shader uniform
 * (no refetch).
 */
export function makeEcmwfTileLoader(opts: { nodata: number | null }) {
  return async function getTileData(
    arr: zarr.Array<zarr.DataType, zarr.Readable>,
    options: GetTileDataOptions,
  ): Promise<EcmwfTileData> {
    const { device, sliceSpec, signal, width, height } = options;
    const chunk = await zarr.get(
      arr as zarr.Array<zarr.NumberDataType, zarr.Readable>,
      sliceSpec,
      { signal },
    );

    if (chunk.shape.length !== 3) {
      throw new Error(
        `ECMWF tile expected 3D [lead_time, H, W]; got [${chunk.shape.join(",")}]`,
      );
    }
    if (chunk.shape[0] !== LEAD_TIME_COUNT) {
      throw new Error(
        `ECMWF tile expected depth=${LEAD_TIME_COUNT}, got ${chunk.shape[0]}`,
      );
    }
    if (chunk.shape[1] !== height || chunk.shape[2] !== width) {
      throw new Error(
        `ECMWF tile shape mismatch: expected [${LEAD_TIME_COUNT},${height},${width}], got [${chunk.shape.join(",")}]`,
      );
    }

    const data =
      chunk.data instanceof Float32Array
        ? chunk.data
        : Float32Array.from(chunk.data as ArrayLike<number>);

    const texture = device.createTexture({
      dimension: "2d-array",
      format: "r32float",
      width,
      height,
      depth: LEAD_TIME_COUNT,
      mipLevels: 1,
      data,
      sampler: {
        minFilter: "nearest",
        magFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      },
    });

    return {
      texture,
      width,
      height,
      byteLength: data.byteLength,
      nodata: opts.nodata,
    };
  };
}
