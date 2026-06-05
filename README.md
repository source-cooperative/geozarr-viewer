# zarr-viewer

Browser-only viewer for GeoZarr / Zarr raster datasets, built on MapLibre +
deck.gl + [`@developmentseed/deck.gl-zarr`](https://www.npmjs.com/package/@developmentseed/deck.gl-zarr).
Sibling of [`raster-viewer`](../raster-viewer) (which targets COGs) — both
build on [`@developmentseed/deck.gl-raster`](https://www.npmjs.com/package/@developmentseed/deck.gl-raster).

The viewer dispatches by **profile**: each dataset's specifics (metadata
override, dimension names, render path, selector UI, default rescale) live
in `src/zarr/profiles/<name>/`. Two profiles ship with v1:

- **ECMWF** — `data.source.coop/dynamical/ecmwf-ifs-ens-forecast-15-day-0-25-degree/v0.1.0.zarr` (Zarr v3 + consolidated, float32 single-variable cube; single-band + colormap)
- **AEF** — `data.source.coop/tge-labs/aef-mosaic` (Zarr v3, GeoZarr-compliant, 64-band int8 embeddings; runtime RGB band picks)

## Development

```sh
pnpm install
pnpm dev
```

`pnpm test` runs the vitest suite; `pnpm build` runs `tsc` + Vite build.
