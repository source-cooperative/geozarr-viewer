/**
 * Hardcoded GeoZarr-compliant attrs for the dynamical.org ECMWF IFS ENS
 * 15-day 0.25° store. The source store is not GeoZarr-compliant, so we
 * inject a synthetic attrs object that ZarrLayer's parser accepts.
 *
 * Grid: 721 lat (90 → -90 step -0.25) × 1440 lon (-180 → 179.75 step 0.25).
 * Ported from the upstream `dynamical-zarr-ecmwf` example.
 */
export const ECMWF_GEOZARR_ATTRS = {
  "spatial:dimensions": ["latitude", "longitude"],
  // Affine [a, b, c, d, e, f] in this repo's convention:
  //   x_out = a*col + b*row + c
  //   y_out = d*col + e*row + f
  "spatial:transform": [0.25, 0, -180, 0, -0.25, 90],
  "spatial:shape": [721, 1440],
  "proj:code": "EPSG:4326",
} as const;

/** Order of named non-spatial dims in ECMWF variable arrays. */
export const ECMWF_NON_SPATIAL_DIMS = [
  "init_time",
  "lead_time",
  "ensemble_member",
] as const;
