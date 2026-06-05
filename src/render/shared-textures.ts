import type { Device, Texture, TextureFormat } from "@luma.gl/core";

/** UV transform vec4 = (offsetX, offsetY, scaleX, scaleY). Identity since
 * we never reproject within a tile. */
type UvTransform = [number, number, number, number];
const IDENTITY_UV: UvTransform = [0, 0, 1, 1];

/** Per-tile data fed to the shared single-band render pipeline. */
export type MultiBandTileData = {
  /** One r-channel texture per band, keyed by 1-based index as a string
   * (so it can flow into `buildCompositeBandsProps`). */
  bands: Map<string, { texture: Texture; uvTransform: UvTransform }>;
  width: number;
  height: number;
  byteLength: number;
  nodata: number | null;
  /** Source-unit → GPU-sample-unit divisor. r8unorm → 255; r32float → 1. */
  sampleScale: number;
};

/** Standard TypedArrays accepted by `buildMultiBandTile`. */
type AcceptableArray =
  | Uint8Array
  | Uint8ClampedArray
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | Float32Array
  | Float64Array;

/** Best-effort GPU-texture cleanup. `RasterTileLayer` doesn't surface
 * `onTileUnload`, so we register the textures with a `FinalizationRegistry`
 * which fires shortly after deck.gl evicts the tile data. Bounds the leak
 * rather than eliminating it. */
const tileFinalizer =
  typeof FinalizationRegistry !== "undefined"
    ? new FinalizationRegistry<Texture[]>((textures) => {
        for (const t of textures) {
          try {
            t.destroy();
          } catch {
            // best-effort
          }
        }
      })
    : null;

function singleBandFormat(data: AcceptableArray): TextureFormat {
  if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
    return "r8unorm";
  }
  return "r32float";
}

function sampleScaleForFormat(format: TextureFormat): number {
  return format === "r8unorm" ? 255 : 1;
}

/** Cast non-Float32 source data to Float32 for upload into `r32float`
 * textures. `r8unorm` passes Uint8Array straight through. */
function coerceForFormat(
  array: AcceptableArray,
  format: TextureFormat,
): AcceptableArray {
  if (format !== "r32float") return array;
  if (array instanceof Float32Array) return array;
  return Float32Array.from(array);
}

export type BandInput = { key: string; data: AcceptableArray };

/** Build a `MultiBandTileData` from one or more single-band typed arrays.
 * Each band becomes an r-channel texture keyed by `band.key`. */
export function buildMultiBandTile(
  device: Device,
  bands: readonly BandInput[],
  width: number,
  height: number,
  nodata: number | null,
): MultiBandTileData {
  const out = new Map<string, { texture: Texture; uvTransform: UvTransform }>();
  let totalBytes = 0;
  let sampleScale = 1;
  for (const { key, data: raw } of bands) {
    const format = singleBandFormat(raw);
    const data = coerceForFormat(raw, format);
    sampleScale = sampleScaleForFormat(format);
    const texture = device.createTexture({ data, format, width, height });
    out.set(key, { texture, uvTransform: IDENTITY_UV });
    totalBytes += width * height * data.BYTES_PER_ELEMENT;
  }
  const result: MultiBandTileData = {
    bands: out,
    width,
    height,
    byteLength: totalBytes,
    nodata,
    sampleScale,
  };
  if (tileFinalizer && out.size > 0) {
    tileFinalizer.register(
      result,
      Array.from(out.values(), (v) => v.texture),
    );
  }
  return result;
}
