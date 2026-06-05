import type * as zarr from "zarrita";
import type { ProfileBaseContext } from "../../profile";

export type AefContext = ProfileBaseContext & {
  /** Pre-opened `embeddings` array (int8). */
  embeddings: zarr.Array<"int8", zarr.Readable>;
  /** Pre-opened root group's attrs (GeoZarr-compliant), used as
   * `ZarrLayer.metadata` so the layer reads spatial info from them. */
  rootAttrs: unknown;
  /** 64 band labels read from the `band` coord. */
  bandLabels: readonly string[];
  /** Length of the `time` dim. */
  yearCount: number;
};

export type AefState = {
  year: number;
  rBand: number;
  gBand: number;
  bBand: number;
  rescaleMin: number;
  rescaleMax: number;
};
