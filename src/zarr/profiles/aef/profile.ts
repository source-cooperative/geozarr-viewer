import { ZarrLayer } from "@developmentseed/deck.gl-zarr";
import * as zarr from "zarrita";
import { LOCATIONS } from "../../../locations";
import { spatialTileSize } from "../../chunk-size";
import { openV3Group } from "../../load-zarr";
import type { ZarrProfile } from "../../profile";
import { fetchBandLabels } from "./band-labels";
import { AEF_URL_PATTERN, AEF_VARIABLE, MIN_ZOOM, NUM_BANDS } from "./constants";
import { AefControls } from "./controls";
import { makeAefRenderTile } from "./render-tile";
import { getAefTileData } from "./tile-loader";
import type { AefContext, AefState } from "./types";

export const aefProfile: ZarrProfile<AefState, AefContext> = {
  id: "aef",
  label: "AlphaEarth Foundations Mosaic",
  matches: (url) => url.includes(AEF_URL_PATTERN),
  needsColormap: false,
  // No overviews: the layer only renders at/above MIN_ZOOM (see
  // constants.ts). Below it the chassis shows a zoom-in hint instead of a
  // blank map.
  minRenderZoom: MIN_ZOOM,

  getStructure: (ctx) => ({
    zarrVersion: "v3",
    variables: [{ path: AEF_VARIABLE }],
    // AEF ships GeoZarr-compliant root attrs; we pass them through
    // unchanged as the layer's `metadata` prop.
    metadataSource: "store-native",
    metadata: ctx.rootAttrs,
  }),

  // The `embeddings` array is already opened in prepare(); expose it
  // here so App.tsx's `node` state holds the Array (not the parent
  // Group). Lets the Structure panel show shape/dtype/chunks/fillValue.
  resolveNode: async (ctx) => ctx.embeddings,

  async prepare(url, _signal) {
    const opened = await openV3Group(url);
    const embeddings = await zarr.open.v3(opened.group.resolve(AEF_VARIABLE), {
      kind: "array",
    });
    if (!embeddings.is("int8")) {
      throw new Error(
        `Expected AEF "${AEF_VARIABLE}" to be int8, got ${embeddings.dtype}`,
      );
    }
    const bandLabels = await fetchBandLabels(opened.group);
    // The `time` dim is the first axis of the embeddings array.
    const yearCount = embeddings.shape[0] ?? 0;
    return {
      url,
      group: opened.group,
      embeddings,
      rootAttrs: opened.group.attrs,
      bandLabels,
      yearCount,
    };
  },

  initialState(ctx) {
    return {
      // Default to the latest available year (2025 = index 8 in upstream).
      year: Math.max(0, ctx.yearCount - 1),
      rBand: 0,
      gBand: 16,
      bBand: 32,
      rescaleMin: -0.3,
      rescaleMax: 0.3,
    };
  },

  parseUrlParams(p) {
    const out: Partial<AefState> = {};
    const y = p.get("y");
    if (y !== null && Number.isFinite(Number(y))) out.year = Number(y);
    const r = p.get("r");
    if (r !== null && Number.isFinite(Number(r)))
      out.rBand = clampBand(Number(r));
    const g = p.get("g");
    if (g !== null && Number.isFinite(Number(g)))
      out.gBand = clampBand(Number(g));
    const b = p.get("b");
    if (b !== null && Number.isFinite(Number(b)))
      out.bBand = clampBand(Number(b));
    const rmin = p.get("rmin");
    if (rmin !== null && Number.isFinite(Number(rmin)))
      out.rescaleMin = Number(rmin);
    const rmax = p.get("rmax");
    if (rmax !== null && Number.isFinite(Number(rmax)))
      out.rescaleMax = Number(rmax);
    return out;
  },

  serializeUrlParams(s) {
    return {
      y: String(s.year),
      r: String(s.rBand),
      g: String(s.gBand),
      b: String(s.bBand),
      rmin: String(s.rescaleMin),
      rmax: String(s.rescaleMax),
    };
  },

  // No `initialBounds`; AEF is global but has no overviews. Land at the
  // first preset location at ~native zoom (MIN_ZOOM + 2 ≈ z14) so first
  // paint is crisp and light (~55 MB) rather than the heavy wide z12 view.
  // MIN_ZOOM still lets users zoom out two levels for context. The chassis
  // Location dropdown handles further navigation.
  initialView() {
    const loc = LOCATIONS[0]!;
    return {
      longitude: loc.longitude,
      latitude: loc.latitude,
      zoom: MIN_ZOOM + 2,
    };
  },

  Controls: AefControls,

  buildLayer({ ctx, state, chassisState, basemapBeforeId }) {
    const renderTile = makeAefRenderTile({
      rBandIdx: state.rBand,
      gBandIdx: state.gBand,
      bBandIdx: state.bBand,
      rescaleMin: state.rescaleMin,
      rescaleMax: state.rescaleMax,
    });
    return new ZarrLayer<zarr.Readable, "int8", import("./tile-loader").AefTileData>({
      id: `aef-${state.year}`,
      node: ctx.embeddings,
      metadata: ctx.rootAttrs,
      selection: { time: state.year, band: null },
      getTileData: getAefTileData,
      renderTile,
      // Align tile grid with the embeddings array's spatial chunk shape.
      tileSize: spatialTileSize(ctx.embeddings),
      minZoom: MIN_ZOOM,
      maxRequests: 20,
      // Each tile near native zoom is ~3 MB (one inner 256² chunk). A
      // roomy cache stops overlapping/adjacent tiles from re-fetching the
      // same shard data as the viewport pans.
      maxCacheSize: 64,
      opacity: chassisState.opacity,
      updateTriggers: {
        renderTile: [
          state.rBand,
          state.gBand,
          state.bBand,
          state.rescaleMin,
          state.rescaleMax,
        ],
      },
      // beforeId is injected by @deck.gl/mapbox; ZarrLayerProps doesn't
      // expose it, so attach via a wider cast.
      ...({ beforeId: basemapBeforeId } as Record<string, unknown>),
    });
  },
};

function clampBand(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(NUM_BANDS - 1, Math.floor(n)));
}
