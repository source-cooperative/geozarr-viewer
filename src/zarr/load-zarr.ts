import * as zarr from "zarrita";

export type ConsolidatedStore = zarr.Readable & {
  contents: () => { path: string; kind: "array" | "group" }[];
};

export type OpenedStore = {
  group: zarr.Group<zarr.Readable>;
  /** The underlying store. When `consolidated: true` was requested, this
   * is the consolidated-metadata wrapper exposing `.contents()`. */
  store: zarr.Readable;
};

/** Open a Zarr v3 store at `url`.
 *
 * Stacking:
 * 1. `FetchStore` — base HTTP backend. `useSuffixRequest: true` is
 *    REQUIRED for sharded stores (ECMWF, AEF). The sharding codec reads
 *    its index from the end of each shard via a suffix read; zarrita's
 *    default path does a HEAD first to turn that into an absolute range,
 *    but cross-origin HEAD responses on `data.source.coop` don't expose a
 *    readable `Content-Length`, so zarrita computes `length = 0` and emits
 *    the malformed header `bytes=-N--1`. The server then answers with the
 *    whole object — a ~500 MB shard pulled per tile. A direct
 *    `bytes=-N` suffix request (which the host honors with a 206) avoids
 *    the HEAD entirely and reads only the index.
 * 2. `withRangeCoalescing` — merges concurrent `getRange` calls within a
 *    microtask if they're separated by < 32 KB. For sharded stores
 *    (ECMWF, AEF) this is a big win: a single tile typically reads
 *    several nearby sub-shards inside the same outer-chunk file, and
 *    coalescing collapses those into one HTTP request.
 * 3. `withConsolidatedMetadata` (optional) — exposes `.contents()` for
 *    cheap hierarchy listing without per-array `zarr.json` fetches. */
export async function openV3Group(
  url: string,
  options: { consolidated?: boolean } = {},
): Promise<OpenedStore> {
  const raw = new zarr.FetchStore(url, { useSuffixRequest: true });
  const coalesced = zarr.withRangeCoalescing(raw);
  const store: zarr.Readable = options.consolidated
    ? await zarr.withConsolidatedMetadata(coalesced, { format: "v3" })
    : coalesced;
  const group = await zarr.open.v3(store, { kind: "group" });
  return { group, store };
}

/** Narrow a store to the consolidated `Listable` shape. Returns null when
 * the store wasn't wrapped with `withConsolidatedMetadata`. */
export function asConsolidated(store: zarr.Readable): ConsolidatedStore | null {
  if (typeof (store as ConsolidatedStore).contents === "function") {
    return store as ConsolidatedStore;
  }
  return null;
}
