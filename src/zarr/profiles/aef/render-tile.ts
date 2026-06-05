import type { RenderTileResult } from "@developmentseed/deck.gl-raster";
import { SampleAefRgb } from "./sample-aef-rgb";
import type { AefTileData } from "./tile-loader";

export type AefRenderTileArgs = {
  rBandIdx: number;
  gBandIdx: number;
  bBandIdx: number;
  rescaleMin: number;
  rescaleMax: number;
};

/** Build a `renderTile` closure for AEF. The shader module owns
 * dequantization + RGB band picks + linear rescale + nodata discard. */
export function makeAefRenderTile(args: AefRenderTileArgs) {
  const { rBandIdx, gBandIdx, bBandIdx, rescaleMin, rescaleMax } = args;
  return function renderTile(data: AefTileData): RenderTileResult {
    return {
      renderPipeline: [
        {
          module: SampleAefRgb,
          props: {
            dataTex: data.texture,
            rBandIdx,
            gBandIdx,
            bBandIdx,
            rescaleMin,
            rescaleMax,
          },
        },
      ],
    };
  };
}
