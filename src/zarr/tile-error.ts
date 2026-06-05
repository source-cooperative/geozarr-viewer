/** Whether a thrown value is an `AbortError` DOMException (or any error
 * named "AbortError") — these are produced by `AbortController.abort()`
 * cascading into `fetch` / `zarr.get` and are expected during normal
 * deck.gl tile pruning (pan, zoom, layer re-creation). */
export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError";
}

/** Substrings of `console.warn` messages we suppress because they are
 * known, harmless noise emitted by deck.gl / luma.gl on a hot path. */
const SUPPRESSED_WARN_SUBSTRINGS: readonly string[] = [
  // Emitted by luma.gl every draw call when `RasterLayer` is rendered via
  // `renderPipeline` (no `image` prop). The underlying SimpleMeshLayer's
  // shader layout has a sampler slot that the pipeline path doesn't
  // supply, but the layer still renders correctly. Supplying
  // `image: undefined` explicitly triggers a separate deck.gl bug
  // (see the comment in raster-tile-layer.js line ~167), so there's no
  // clean fix from the consumer side.
  "luma.gl: Binding sampler not set",
];

function isSuppressedWarn(args: readonly unknown[]): boolean {
  if (args.length !== 1) return false;
  const msg = args[0];
  if (typeof msg !== "string") return false;
  return SUPPRESSED_WARN_SUBSTRINGS.some((p) => msg.includes(p));
}

let installed = false;

/** Reset the install flag. Test-only; not for production use. */
export function _resetInstalledForTesting(): void {
  installed = false;
}

/** Install one-shot wrappers around `console.error` and `console.warn`
 * to drop known-harmless deck.gl / luma.gl noise.
 *
 * **`console.error`** — drops `AbortError`s.
 * `@developmentseed/deck.gl-raster@0.6.1` constructs its inner `TileLayer`
 * with a hardcoded prop list that does NOT include `onTileError`
 * (see `RasterTileLayer._renderTileLayer`), so the inner TileLayer uses
 * its default `onTileError: err => console.error(err)`. Every pan/zoom
 * fires `_pruneRequests` → `tile.abort()` → the in-flight `zarr.get`
 * rejects with `AbortError` → the default handler logs it.
 *
 * **`console.warn`** — drops the messages listed in
 * {@link SUPPRESSED_WARN_SUBSTRINGS}.
 *
 * Everything else passes through untouched. Idempotent. */
export function installConsoleAbortFilter(): void {
  if (installed) return;
  installed = true;
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    if (args.length === 1 && isAbortError(args[0])) return;
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (isSuppressedWarn(args)) return;
    originalWarn(...args);
  };
}
