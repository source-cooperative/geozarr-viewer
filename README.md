# zarr-viewer

Live: <https://source-cooperative.github.io/zarr-viewer/>

Browser-only viewer for GeoZarr / Zarr raster datasets, built on MapLibre +
deck.gl + [`@developmentseed/deck.gl-zarr`](https://www.npmjs.com/package/@developmentseed/deck.gl-zarr).
Sibling of [`raster-viewer`](../raster-viewer) (which targets COGs) — both
build on [`@developmentseed/deck.gl-raster`](https://www.npmjs.com/package/@developmentseed/deck.gl-raster).

The viewer dispatches by **profile** — a capability (render path, selector UI,
default rescale, metadata handling), not a per-dataset config. Each profile
lives in `src/zarr/profiles/<id>/`. Pick one explicitly with `?p=<id>`;
otherwise the chassis defaults to `scalar-grid`, upgrading to `multiscale-grid`
when an async probe detects a multiscale pyramid. Four profiles ship on `main`:

- **`scalar-grid`** — _Scalar grid (colormap)_. Default. Single-band geographic
  grids with CF lat/lon coordinates → colormap (e.g. ECMWF/GFS forecast cubes,
  FireSmoke PM2.5, FTW field boundaries).
- **`band-composite`** — _RGB band composite_. Multi-band int8 arrays rendered
  as a runtime-selectable RGB composite (e.g. AlphaEarth Foundations 64-band
  embeddings).
- **`multiscale-grid`** — _Multiscale grid (colormap)_. GeoZarr multiscale
  pyramids, single-band → colormap (e.g. Meta CHM v2 canopy height);
  auto-detected from the pyramid structure.
- **`image-orthographic`** — _Image (OME-Zarr)_. Non-geographic OME-Zarr
  bioimaging stores (no CRS/lat-lon), rendered in a standalone deck.gl
  `OrthographicView` instead of the MapLibre map (e.g. IDR microscopy).

Stores are read with zarrita over both plain HTTP Zarr (v2 and v3) and
[Icechunk](https://icechunk.io/) (via
[`icechunk-js`](https://www.npmjs.com/package/icechunk-js)); many of the bundled
examples are `.icechunk` datasets. See `src/data/examples.ts` for the full list.

## Development

```sh
pnpm install
pnpm dev
```

`pnpm test` runs the vitest suite; `pnpm build` runs `tsc` + Vite build.
