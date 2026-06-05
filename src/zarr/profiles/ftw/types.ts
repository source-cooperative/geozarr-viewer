import type * as zarr from "zarrita";
import type { ProfileBaseContext } from "../../profile";

export type FtwContext = ProfileBaseContext & {
  /** Pre-opened `variables` data array (float32, shape
   * `[time, band, y, x]`). */
  variablesArr: zarr.Array<"float32", zarr.Readable>;
  timeCount: number;
  bandCount: number;
  /** Band labels, decoded from the store's `band` coord array. Falls
   * back to a hardcoded list if the decode fails (zarrita 0.7.3 doesn't
   * support `fixed_length_utf32` natively). */
  bandLabels: readonly string[];
  /** Store's root attrs — GeoZarr-compliant, passed straight to
   * `ZarrLayer.metadata`. */
  rootAttrs: unknown;
};

export type FtwState = {
  /** Index into the `time` dim (0 or 1 in the current store). */
  time: number;
  /** Index into the `band` dim (0..2). */
  band: number;
};
