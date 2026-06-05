import { ZarrLayer } from "@developmentseed/deck.gl-zarr";
import * as zarr from "zarrita";
import { buildSingleBandRenderTile } from "../../../render/single-band-pipeline";
import { spatialTileSize } from "../../chunk-size";
import { openV3Group } from "../../load-zarr";
import type { ZarrProfile } from "../../profile";
import { FireSmokeControls } from "./controls";
import { getFireSmokeTileData } from "./tile-loader";
import type { FireSmokeContext, FireSmokeState } from "./types";

/** Path within the root group to the variable we render. The store also
 * carries `PM25_runs` (full per-init archive), but `PM25_latest` is the
 * latest-wins view designed for animation. */
const VARIABLE = "PM25_latest";

export const fireSmokeProfile: ZarrProfile<FireSmokeState, FireSmokeContext> = {
  id: "firesmoke",
  label: "BlueSky FireSmoke PM2.5",
  matches: (url) => url.includes("firesmoke"),
  needsColormap: true,

  getStructure: (ctx) => ({
    zarrVersion: "v3",
    variables: [{ path: VARIABLE }],
    // Store has no GeoZarr attrs; we synthesize them at prepare() time
    // from the 1D `lat` / `lon` coord arrays (see ctx.spatialAttrs).
    metadataSource: "synthesized",
    metadata: ctx.spatialAttrs,
  }),

  // `PM25_latest` is opened in prepare(); expose it so App.tsx's `node`
  // state holds the Array (not the parent Group). Lets the Structure
  // panel show shape/dtype/chunks/fillValue.
  resolveNode: async (ctx) => ctx.array,

  async prepare(url, signal) {
    const opened = await openV3Group(url);
    const array = await zarr.open.v3(opened.group.resolve(VARIABLE), {
      kind: "array",
    });
    if (!array.is("int16")) {
      throw new Error(
        `Expected FireSmoke "${VARIABLE}" to be int16, got ${array.dtype}`,
      );
    }
    // Read the three small coord arrays once at prepare time. `lat` /
    // `lon` synthesize the GeoZarr `spatial:transform`; `valid_time`
    // gives us human-readable timestamps for the slider label.
    const [latArr, lonArr, vtArr] = await Promise.all([
      zarr.open.v3(opened.group.resolve("lat"), { kind: "array" }),
      zarr.open.v3(opened.group.resolve("lon"), { kind: "array" }),
      zarr.open.v3(opened.group.resolve("valid_time"), { kind: "array" }),
    ]);
    if (signal.aborted) throw new Error("aborted");
    const [latChunk, lonChunk, vtChunk] = await Promise.all([
      zarr.get(latArr as zarr.Array<zarr.NumberDataType, zarr.Readable>),
      zarr.get(lonArr as zarr.Array<zarr.NumberDataType, zarr.Readable>),
      zarr.get(vtArr as zarr.Array<zarr.DataType, zarr.Readable>),
    ]);
    const lat = latChunk.data as Float64Array;
    const lon = lonChunk.data as Float64Array;
    // `valid_time` is int64 — comes through as BigInt64Array. Coerce
    // to Number; unix seconds fit in a double until year 285,616 AD.
    const vtRaw = vtChunk.data as ArrayLike<number | bigint>;
    const validTimes: number[] = new Array(vtRaw.length);
    for (let i = 0; i < vtRaw.length; i++) {
      const v = vtRaw[i];
      validTimes[i] = typeof v === "bigint" ? Number(v) : (v as number);
    }
    const stepLon = lon.length > 1 ? lon[1]! - lon[0]! : 0;
    const stepLat = lat.length > 1 ? lat[1]! - lat[0]! : 0;
    const spatialAttrs = {
      "spatial:dimensions": ["lat", "lon"],
      "spatial:transform": [stepLon, 0, lon[0]!, 0, stepLat, lat[0]!],
      "spatial:shape": [lat.length, lon.length],
      "proj:code": "EPSG:4326",
    } as const;
    return {
      url,
      group: opened.group,
      array,
      timeCount: array.shape[0] ?? 0,
      validTimes,
      spatialAttrs,
    };
  },

  initialState(ctx) {
    // Default to the latest available valid_time. The user can scrub
    // backwards or forwards from there.
    return { time: Math.max(0, ctx.timeCount - 1) };
  },

  parseUrlParams(p) {
    const out: Partial<FireSmokeState> = {};
    const t = p.get("t");
    if (t !== null && Number.isFinite(Number(t))) out.time = Number(t);
    return out;
  },

  serializeUrlParams(s) {
    return { t: String(s.time) };
  },

  Controls: FireSmokeControls,

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
        colormap: chassisState.colormap ?? "turbo",
        rescale: chassisState.rescale,
        gamma: chassisState.gamma,
        stretch: chassisState.stretch,
        // Tile loader CF-decodes the int16 fill sentinel to NaN; the
        // float texture's automatic FilterNaN takes care of masking.
        nodata: null,
      },
      colormapTexture,
      autoStats,
    );
    return new ZarrLayer<zarr.Readable, zarr.DataType, import("../../../render/shared-textures").MultiBandTileData>({
      id: `firesmoke-${state.time}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node: ctx.array as any,
      metadata: ctx.spatialAttrs,
      selection: { valid_time: state.time },
      getTileData: getFireSmokeTileData,
      renderTile,
      // Chunk shape is `(1, 381, 1081)` — tileSize aligns to the
      // smaller spatial dim so one tile = one chunk file.
      tileSize: spatialTileSize(ctx.array),
      maxRequests: 20,
      maxCacheSize: 10,
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
};
