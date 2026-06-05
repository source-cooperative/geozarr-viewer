import { ZarrLayer } from "@developmentseed/deck.gl-zarr";
import * as zarr from "zarrita";
import { buildSingleBandRenderTile } from "../../../render/single-band-pipeline";
import type { MultiBandTileData } from "../../../render/shared-textures";
import { spatialTileSize } from "../../chunk-size";
import { openV3Group } from "../../load-zarr";
import type { ZarrProfile } from "../../profile";
import { BAND_LABELS_FALLBACK, fetchBandLabels } from "./band-labels";
import { FtwControls } from "./controls";
import { computeFtwSliceStats } from "./stats";
import { getFtwTileData } from "./tile-loader";
import type { FtwContext, FtwState } from "./types";

/** Path within the root group to the renderable data array. */
const VARIABLE = "variables";

/** Lowest zoom at which the layer renders. FTW is a single-level ~10 m/px
 * global zarr with NO overviews (native ≈ z14); each level below native
 * ~quadruples the chunks read to fill the screen, and a tile spanning one
 * 8192² outer shard already pulls ~224 MB. Floor at z12 (measured
 * ~85–170 MB/screen) to bound the zoomed-out cost — same reasoning as
 * AEF's MIN_ZOOM. Surfaced to the chassis via `minRenderZoom` so a
 * zoom-in hint shows below it instead of a blank map. */
const MIN_ZOOM = 12;

export const ftwProfile: ZarrProfile<FtwState, FtwContext> = {
  id: "ftw",
  label: "Fields of The World (FTW) predictions",
  matches: (url) => url.includes("/ftw/") || url.includes("ftw/global-data"),
  needsColormap: true,
  // Single-level ~10 m/px source with no overviews: renders only at/above
  // MIN_ZOOM. Show the chassis zoom-in hint below it instead of a blank map.
  minRenderZoom: MIN_ZOOM,

  getStructure: (ctx) => ({
    zarrVersion: "v3",
    variables: [{ path: VARIABLE }],
    // FTW's root attrs are GeoZarr-compliant (spatial:* + proj:code);
    // we pass them straight through to ZarrLayer.metadata.
    metadataSource: "store-native",
    metadata: ctx.rootAttrs,
  }),

  async prepare(url, signal) {
    const opened = await openV3Group(url, { consolidated: true });
    const variablesArr = await zarr.open.v3(opened.group.resolve(VARIABLE), {
      kind: "array",
    });
    if (!variablesArr.is("float32")) {
      throw new Error(
        `Expected FTW "${VARIABLE}" to be float32, got ${variablesArr.dtype}`,
      );
    }
    if (signal.aborted) throw new Error("aborted");
    // Shape is [time, band, y, x].
    const timeCount = variablesArr.shape[0] ?? 0;
    const bandCount = variablesArr.shape[1] ?? 0;
    // Try to read the band labels from the store; fall back to a
    // hardcoded list if zarrita can't decode the `fixed_length_utf32`
    // coord (current 0.7.3 limitation).
    let bandLabels: readonly string[] = BAND_LABELS_FALLBACK;
    try {
      bandLabels = await fetchBandLabels(url, signal);
    } catch (err) {
      if (signal.aborted) throw err;
      console.warn("FTW: band label fetch failed, using fallback", err);
    }
    return {
      url,
      group: opened.group,
      variablesArr,
      timeCount,
      bandCount,
      bandLabels,
      rootAttrs: opened.group.attrs,
    };
  },

  initialState(ctx) {
    return {
      // Default to the latest time slice and the first band.
      time: Math.max(0, ctx.timeCount - 1),
      band: 0,
    };
  },

  parseUrlParams(p) {
    const out: Partial<FtwState> = {};
    const t = p.get("t");
    if (t !== null && Number.isFinite(Number(t))) out.time = Number(t);
    const b = p.get("b");
    if (b !== null && Number.isFinite(Number(b))) out.band = Number(b);
    return out;
  },

  serializeUrlParams(s) {
    return { t: String(s.time), b: String(s.band) };
  },

  resolveNode: async (ctx) => ctx.variablesArr,

  statsDeps: (state) => [state.time, state.band],

  Controls: FtwControls,

  buildLayer({
    ctx,
    state,
    chassisState,
    colormapTexture,
    autoStats,
    basemapBeforeId,
  }) {
    if (!colormapTexture) return null;
    const renderTile = buildSingleBandRenderTile(
      {
        colormap: chassisState.colormap ?? "viridis",
        rescale: chassisState.rescale,
        gamma: chassisState.gamma,
        stretch: chassisState.stretch,
        // Float texture; FilterNaN catches NaN fills automatically.
        nodata: null,
      },
      colormapTexture,
      autoStats,
    );
    return new ZarrLayer<zarr.Readable, zarr.DataType, MultiBandTileData>({
      id: `ftw-${state.time}-${state.band}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node: ctx.variablesArr as any,
      metadata: ctx.rootAttrs,
      selection: { time: state.time, band: state.band },
      getTileData: getFtwTileData,
      renderTile,
      // One tile = one inner shard: zarrita reports the 2048² sub-shard as
      // the chunk, and sharding byte-range-fetches only the sub-shards the
      // viewport touches.
      tileSize: spatialTileSize(ctx.variablesArr),
      minZoom: MIN_ZOOM,
      maxRequests: 20,
      // Each native tile is one ~14 MB inner shard; a roomy cache avoids
      // re-fetching shared shard data as the viewport pans.
      maxCacheSize: 64,
      opacity: chassisState.opacity,
      updateTriggers: {
        renderTile: [
          chassisState.colormap,
          chassisState.rescale?.[0],
          chassisState.rescale?.[1],
          chassisState.gamma,
          chassisState.stretch,
          autoStats,
        ],
      },
      // beforeId is injected by @deck.gl/mapbox; ZarrLayerProps doesn't
      // expose it, so attach via a wider cast.
      ...({ beforeId: basemapBeforeId } as Record<string, unknown>),
    });
  },

  async computeAutoStats({ ctx, state, signal }) {
    return computeFtwSliceStats(
      ctx.variablesArr,
      { time: state.time, band: state.band },
      signal,
    );
  },
};
