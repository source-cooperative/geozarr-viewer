import type {
  RasterModule,
  RenderTileResult,
} from "@developmentseed/deck.gl-raster";
import {
  Colormap,
  COLORMAP_INDEX,
  LinearRescale,
} from "@developmentseed/deck.gl-raster/gpu-modules";
import type { Texture } from "@luma.gl/core";
import {
  Gamma,
  LogStretch,
  SqrtStretch,
} from "../../../render/shader-modules";
import {
  percentileFromHistogram,
  type AutoStats,
  type BandStats,
} from "../../../render/stats";
import type { Stretch } from "../../../state/types";
import { SampleTexture2DArray } from "./sample-texture-2d-array";
import type { EcmwfTileData } from "./tile-loader";

const RESCALE_EPSILON = 1e-9;
const DEFAULT_PERCENTILE_LO = 0.02;
const DEFAULT_PERCENTILE_HI = 0.98;

export type EcmwfRenderState = {
  /** Active lead-time frame (`0..84`). Mapped to the shader's `layerIndex`. */
  leadTimeIdx: number;
  colormap: string;
  rescale: [number, number] | null;
  gamma: number;
  stretch: Stretch;
};

function safeRange([lo, hi]: [number, number]): [number, number] {
  return lo === hi ? [lo, lo + RESCALE_EPSILON] : [lo, hi];
}

function autoRange(stats: BandStats): [number, number] {
  const hasBins = stats.histogram.some((b) => b > 0);
  if (!hasBins) return [stats.min, stats.max];
  return [
    percentileFromHistogram(stats, DEFAULT_PERCENTILE_LO),
    percentileFromHistogram(stats, DEFAULT_PERCENTILE_HI),
  ];
}

/** Build a renderTile closure for ECMWF. Pipeline:
 *
 *     SampleTexture2DArray → LinearRescale → [stretch] → [gamma] → Colormap
 *
 * `leadTimeIdx` is a shader uniform, so scrubbing the lead-time slider
 * does not refetch tiles. */
export function makeEcmwfRenderTile(
  state: EcmwfRenderState,
  colormapTexture: Texture,
  autoStats: AutoStats | null,
) {
  const name = state.colormap.toLowerCase();
  const colormapIndex =
    (COLORMAP_INDEX as Record<string, number>)[name] ?? COLORMAP_INDEX.viridis;

  let rescale: [number, number] | null = null;
  if (state.rescale) rescale = safeRange(state.rescale);
  else if (autoStats?.global) rescale = safeRange(autoRange(autoStats.global));

  return function renderTile(data: EcmwfTileData): RenderTileResult {
    const pipeline: RasterModule[] = [
      {
        module: SampleTexture2DArray,
        props: {
          dataTex: data.texture,
          layerIndex: state.leadTimeIdx,
        },
      },
    ];
    if (rescale) {
      pipeline.push({
        module: LinearRescale,
        props: { rescaleMin: rescale[0], rescaleMax: rescale[1] },
      });
    }
    if (state.stretch === "log") {
      pipeline.push({ module: LogStretch, props: { strength: 99 } });
    } else if (state.stretch === "sqrt") {
      pipeline.push({ module: SqrtStretch });
    }
    if (state.gamma !== 1) {
      pipeline.push({ module: Gamma, props: { gamma: state.gamma } });
    }
    pipeline.push({
      module: Colormap,
      props: { colormapTexture, colormapIndex, reversed: false },
    });
    return { renderPipeline: pipeline };
  };
}
