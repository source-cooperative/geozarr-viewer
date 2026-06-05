import type { Texture } from "@luma.gl/core";

export type SampleTexture2DArrayProps = {
  /** Texture2DArray of r32float data, depth = lead-time frames. */
  dataTex: Texture;
  /** Animation frame index (as a float — nearest sampling). */
  layerIndex: number;
};

const MODULE_NAME = "sampleTexture2DArray";

/**
 * Samples a `sampler2DArray` at `(uv, layerIndex)` and writes the scalar
 * into `color.rgb` (broadcast). Discards NaN samples so missing-data
 * regions are transparent. Compose downstream with `LinearRescale` +
 * `Colormap` (and optionally `Gamma`/`Stretch`). Ported verbatim from the
 * upstream `dynamical-zarr-ecmwf` example.
 */
export const SampleTexture2DArray = {
  name: MODULE_NAME,
  fs: `\
uniform ${MODULE_NAME}Uniforms {
  float layerIndex;
} ${MODULE_NAME};
`,
  inject: {
    "fs:#decl": `
precision highp sampler2DArray;
uniform sampler2DArray dataTex;
`,
    "fs:DECKGL_FILTER_COLOR": /* glsl */ `
      float v = texture(dataTex, vec3(geometry.uv, ${MODULE_NAME}.layerIndex)).r;
      if (isnan(v)) discard;
      color = vec4(v, v, v, 1.0);
    `,
  },
  uniformTypes: {
    layerIndex: "f32",
  },
  getUniforms: (props: Partial<SampleTexture2DArrayProps>) => ({
    layerIndex: props.layerIndex ?? 0,
    dataTex: props.dataTex,
  }),
} as const;
