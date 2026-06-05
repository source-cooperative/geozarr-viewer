import * as zarr from "zarrita";

/** Hardcoded fallback used when {@link fetchBandLabels} fails (e.g.
 * the `fixed_length_utf32` dtype isn't supported by the installed
 * zarrita version, or a future store layout breaks the chunk-shape
 * assumption). Verified against the alpha global FTW predictions on
 * 2026-06-02 by decompressing `band/c/0` directly. */
export const BAND_LABELS_FALLBACK: readonly string[] = [
  "non_field_background",
  "field",
  "field_boundaries",
];

const STRING_BYTES = 80; // `fixed_length_utf32 { length_bytes: 80 }` from band/zarr.json
const NUM_BANDS = 3;

/** Fetch + decode the FTW `band` coordinate array.
 *
 * Why manual? The band coord uses Zarr v3's `fixed_length_utf32` dtype,
 * which zarrita 0.7.3 doesn't yet handle (open throws
 * `dataType.match is not a function`). We bypass that by fetching
 * `band/c/0` directly, running the bytes through zarrita's bundled
 * zstd codec, and reading 3 × 80-byte slots as utf-32-le.
 *
 * Caller catches and falls back to {@link BAND_LABELS_FALLBACK} on any
 * failure. */
export async function fetchBandLabels(
  storeUrl: string,
  signal: AbortSignal,
): Promise<readonly string[]> {
  const base = storeUrl.replace(/\/+$/, "");
  const resp = await fetch(`${base}/band/c/0`, { signal });
  if (!resp.ok) throw new Error(`band/c/0: HTTP ${resp.status}`);
  const compressed = new Uint8Array(await resp.arrayBuffer());

  // zarrita's registry value is a lazy loader `() => Promise<Class>`.
  const zstdFactory = zarr.registry.get("zstd");
  if (!zstdFactory) throw new Error("zstd codec not in zarrita registry");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ZstdClass = (await (zstdFactory as () => Promise<any>)()) as {
    fromConfig: (cfg: unknown) => Promise<{
      decode: (b: Uint8Array) => Promise<Uint8Array>;
    }>;
  };
  // Config matches what the band/zarr.json declares — `level` and
  // `checksum`. The codec ignores `level` for decode anyway.
  const codec = await ZstdClass.fromConfig({ level: 0, checksum: false });
  const raw = await codec.decode(compressed);

  if (raw.byteLength < STRING_BYTES * NUM_BANDS) {
    throw new Error(
      `band chunk too small: expected ${STRING_BYTES * NUM_BANDS} bytes, got ${raw.byteLength}`,
    );
  }
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const labels: string[] = [];
  for (let i = 0; i < NUM_BANDS; i++) {
    labels.push(decodeUtf32LE(view, i * STRING_BYTES, STRING_BYTES));
  }
  return labels;
}

/** Decode a fixed-length utf-32-le buffer slice into a string,
 * stopping at the first U+0000 null. */
function decodeUtf32LE(view: DataView, offset: number, byteLen: number): string {
  let s = "";
  for (let i = 0; i + 4 <= byteLen; i += 4) {
    const cp = view.getUint32(offset + i, true);
    if (cp === 0) break;
    s += String.fromCodePoint(cp);
  }
  return s;
}
