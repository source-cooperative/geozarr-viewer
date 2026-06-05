import { ZarrLayer } from "@developmentseed/deck.gl-zarr";
import * as zarr from "zarrita";
import { spatialTileSize } from "../../chunk-size";
import { asConsolidated, openV3Group } from "../../load-zarr";
import type { ZarrProfile } from "../../profile";
import { ECMWF_GEOZARR_ATTRS } from "./attrs";
import { EcmwfControls } from "./controls";
import { makeEcmwfRenderTile } from "./render-tile";
import { computeEcmwfSliceStats } from "./stats";
import { makeEcmwfTileLoader, type EcmwfTileData } from "./tile-loader";
import type { EcmwfContext, EcmwfState, EcmwfVariable } from "./types";

const SPATIAL_DIM_TAIL = ["latitude", "longitude"];

/** Enumerate renderable data variables by listing the consolidated
 * contents and opening each array node to inspect its dim names / dtype.
 * `withConsolidatedMetadata` makes the opens cheap (no network). */
async function enumerateVariables(
  group: zarr.Group<zarr.Readable>,
  signal: AbortSignal,
): Promise<EcmwfVariable[]> {
  const store = asConsolidated(group.store);
  if (!store) {
    throw new Error(
      "ECMWF: store must be opened with consolidated metadata to enumerate variables",
    );
  }
  const out: EcmwfVariable[] = [];
  for (const entry of store.contents()) {
    if (signal.aborted) return out;
    if (entry.kind !== "array") continue;
    // top-level arrays only (path "/name", no nested groups)
    const rest = entry.path.replace(/^\/+/, "");
    if (!rest || rest.includes("/")) continue;
    const arr = await zarr.open.v3(group.resolve(rest), { kind: "array" });
    const dims = arr.dimensionNames;
    if (!Array.isArray(dims) || dims.length < 2) continue;
    if (
      dims[dims.length - 2] !== SPATIAL_DIM_TAIL[0] ||
      dims[dims.length - 1] !== SPATIAL_DIM_TAIL[1]
    ) {
      continue;
    }
    if (arr.dtype !== "float32") continue;
    const attrs = arr.attrs;
    out.push({
      name: rest,
      longName: typeof attrs.long_name === "string" ? attrs.long_name : null,
      units: typeof attrs.units === "string" ? attrs.units : null,
      fillValue:
        typeof attrs._FillValue === "number"
          ? attrs._FillValue
          : typeof arr.fillValue === "number"
            ? arr.fillValue
            : null,
    });
  }
  out.sort((a, b) => {
    if (a.name === "temperature_2m") return -1;
    if (b.name === "temperature_2m") return 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

async function readDimSize(
  group: zarr.Group<zarr.Readable>,
  dim: string,
): Promise<number> {
  const arr = await zarr.open.v3(group.resolve(dim), { kind: "array" });
  return arr.shape[0] ?? 0;
}

export const ecmwfProfile: ZarrProfile<EcmwfState, EcmwfContext> = {
  id: "ecmwf",
  label: "ECMWF IFS ENS forecast",
  matches: (url) => url.includes("ecmwf-ifs-ens-forecast"),
  needsColormap: true,

  getStructure: (_ctx, state) => ({
    zarrVersion: "v3",
    variables: [{ path: state.variable }],
    // ECMWF store has no GeoZarr attrs of its own — we inject our
    // hand-built constant so ZarrLayer can interpret the spatial extent.
    metadataSource: "injected",
    metadata: ECMWF_GEOZARR_ATTRS,
  }),

  async prepare(url, signal) {
    const opened = await openV3Group(url, { consolidated: true });
    const variables = await enumerateVariables(opened.group, signal);
    if (variables.length === 0) {
      throw new Error("ECMWF store: no renderable variables found");
    }
    const [initTime, leadTime, member] = await Promise.all([
      readDimSize(opened.group, "init_time"),
      readDimSize(opened.group, "lead_time"),
      readDimSize(opened.group, "ensemble_member"),
    ]);
    return {
      url,
      group: opened.group,
      store: opened.store,
      variables,
      dimSizes: { initTime, leadTime, member },
    };
  },

  initialState(ctx) {
    const variable =
      ctx.variables.find((v) => v.name === "temperature_2m")?.name ??
      ctx.variables[0]!.name;
    return {
      variable,
      initTime: Math.max(0, ctx.dimSizes.initTime - 1),
      leadTime: 0,
      member: 0,
    };
  },

  parseUrlParams(p) {
    const out: Partial<EcmwfState> = {};
    const v = p.get("var");
    if (v) out.variable = v;
    const t = p.get("t");
    if (t !== null && Number.isFinite(Number(t))) out.initTime = Number(t);
    const lead = p.get("lead");
    if (lead !== null && Number.isFinite(Number(lead))) out.leadTime = Number(lead);
    const m = p.get("member");
    if (m !== null && Number.isFinite(Number(m))) out.member = Number(m);
    return out;
  },

  serializeUrlParams(s) {
    return {
      var: s.variable,
      t: String(s.initTime),
      lead: String(s.leadTime),
      member: String(s.member),
    };
  },

  initialBounds: () => [-180, -90, 180, 90],

  Controls: EcmwfControls,

  async resolveNode(ctx, state, _signal) {
    const opened = await zarr.open.v3(ctx.group.resolve(state.variable), {
      kind: "array",
    });
    return opened;
  },
  // Re-resolve the variable array only on variable change. init_time /
  // lead_time / member are handled via `selection` and shader uniforms.
  resolveNodeDeps: (state) => [state.variable],

  // Auto-stats are roughly stable across init_time/lead_time/member for
  // these forecast variables, so recompute only on variable change. The
  // sampler uses canonical pins, not the current slider values.
  statsDeps: (state) => [state.variable],

  buildLayer({
    ctx,
    state,
    chassisState,
    colormapTexture,
    autoStats,
    basemapBeforeId,
    node,
  }) {
    if (!node || !colormapTexture) return null;
    const variableMeta = ctx.variables.find((v) => v.name === state.variable);
    const nodata = variableMeta?.fillValue ?? null;
    const renderTile = makeEcmwfRenderTile(
      {
        leadTimeIdx: state.leadTime,
        colormap: chassisState.colormap ?? "turbo",
        rescale: chassisState.rescale,
        gamma: chassisState.gamma,
        stretch: chassisState.stretch,
      },
      colormapTexture,
      autoStats,
    );
    const getTileData = makeEcmwfTileLoader({ nodata });
    // Align deck.gl's tile grid with the variable's native spatial chunk
    // shape so each tile lands on one chunk's worth of sub-shards instead
    // of straddling 2–4 chunks. `node` is the opened variable array here.
    const variableArr = node as zarr.Array<zarr.DataType, zarr.Readable>;
    const tileSize = spatialTileSize(variableArr);
    return new ZarrLayer<zarr.Readable, zarr.DataType, EcmwfTileData>({
      // Drop leadTime from the id — it's a free shader uniform, not a
      // fetched dimension.
      id: `ecmwf-${state.variable}-${state.initTime}-${state.member}`,
      // node is the opened variable array (see resolveNode above).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node: variableArr as any,
      metadata: ECMWF_GEOZARR_ATTRS,
      selection: {
        init_time: state.initTime,
        // Keep all 85 lead_time frames — the sub-shard unit is
        // `[1, 85, 51, 32, 32]`, so they come for free with the bytes we
        // already had to download. Lead-time scrubbing then becomes a
        // shader uniform (no refetch).
        lead_time: null,
        ensemble_member: state.member,
      },
      getTileData,
      renderTile,
      tileSize,
      maxRequests: 20,
      maxCacheSize: 10,
      opacity: chassisState.opacity,
      updateTriggers: {
        renderTile: [
          state.leadTime,
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
    const arr = await zarr.open.v3(ctx.group.resolve(state.variable), {
      kind: "array",
    });
    if (signal.aborted) return null;
    // The sampler keeps all lead_times + ensemble_members, so we only
    // need to pin init_time. Latest is a sensible canonical choice;
    // stats become a pure function of `variable`.
    return computeEcmwfSliceStats(
      arr,
      { initTime: Math.max(0, ctx.dimSizes.initTime - 1) },
      signal,
    );
  },
};
