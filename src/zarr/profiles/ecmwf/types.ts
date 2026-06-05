import type * as zarr from "zarrita";
import type { ProfileBaseContext } from "../../profile";

export type EcmwfVariable = {
  name: string;
  longName: string | null;
  units: string | null;
  /** Numeric fill value if present (used as nodata). */
  fillValue: number | null;
};

export type EcmwfContext = ProfileBaseContext & {
  store: zarr.Readable;
  variables: EcmwfVariable[];
  /** Sizes of `init_time`, `lead_time`, `ensemble_member` respectively. */
  dimSizes: { initTime: number; leadTime: number; member: number };
};

export type EcmwfState = {
  variable: string;
  initTime: number;
  leadTime: number;
  member: number;
};
