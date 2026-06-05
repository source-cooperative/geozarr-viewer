import type * as zarr from "zarrita";
import type { ProfileBaseContext } from "../../profile";

export type FireSmokeContext = ProfileBaseContext & {
  /** Pre-opened `PM25_latest` array (int16 with CF scale_factor=0.1). */
  array: zarr.Array<"int16", zarr.Readable>;
  /** Number of valid_time frames (~171). */
  timeCount: number;
  /** Decoded valid_time values (unix seconds, in arrival order — not sorted). */
  validTimes: readonly number[];
  /** Synthesized GeoZarr attrs handed to `ZarrLayer.metadata`. Built
   * from the dataset's 1D `lat` / `lon` coord arrays at prepare time. */
  spatialAttrs: {
    "spatial:dimensions": readonly string[];
    "spatial:transform": readonly number[];
    "spatial:shape": readonly number[];
    "proj:code": string;
  };
};

export type FireSmokeState = {
  /** Index into the `valid_time` dim. */
  time: number;
};
