import type * as zarr from "zarrita";

/** Derive a square `tileSize` for `RasterTileLayer` from a zarr array's
 * native chunk shape. Each store chunks differently; aligning the tile
 * grid with the data's spatial chunk boundaries makes one tile = one
 * chunk fetch (or one set of sub-shards for sharded stores), eliminating
 * the "tile straddles N chunks" multiplier.
 *
 * We take the last two dims as spatial (the GeoZarr convention). When
 * they differ, fall back to the smaller — that ensures any one tile
 * touches at most one chunk along the larger axis (some tiles will
 * straddle the smaller axis instead, which is the lesser overfetch). */
export function spatialTileSize(
  arr: zarr.Array<zarr.DataType, zarr.Readable>,
): number {
  const chunks = arr.chunks;
  if (chunks.length < 2) return 256;
  const cy = chunks[chunks.length - 2];
  const cx = chunks[chunks.length - 1];
  if (typeof cy !== "number" || typeof cx !== "number") return 256;
  return Math.min(cy, cx);
}
