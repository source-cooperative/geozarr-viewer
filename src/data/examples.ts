export type Example = {
  profile: "ecmwf" | "aef" | "firesmoke" | "ftw";
  title: string;
  url: string;
  /** Default URL params applied when the example is picked. Any param
   * already present in the current URL takes precedence over these
   * defaults (so a shared link with an explicit `?colormap=plasma`
   * isn't overwritten by the example's choice). */
  params?: Record<string, string>;
};

export const EXAMPLES: Example[] = [
  {
    profile: "ecmwf",
    title: "ECMWF IFS ENS — 2 m Temperature (forecast cube)",
    url: "https://data.source.coop/dynamical/ecmwf-ifs-ens-forecast-15-day-0-25-degree/v0.1.0.zarr",
    // Europe-centered at zoom 4.5 — matches the upstream
    // `dynamical-zarr-ecmwf` example's default view, ECMWF's primary
    // forecast domain.
    params: { lng: "10", lat: "45", zoom: "4.5" },
  },
  {
    profile: "aef",
    title: "AlphaEarth Foundations Mosaic (10 m, 64-band embeddings)",
    url: "https://data.source.coop/tge-labs/aef-mosaic",
  },
  {
    profile: "firesmoke",
    title: "BlueSky FireSmoke PM2.5 forecast (Canada / North America)",
    url: "https://data.source.coop/alukach/firesmoke/forecasts.zarr",
    // BlueSky Canada covers most of North America. Centered on western
    // Canada at zoom 3, with a turbo colormap and a 0–100 µg/m³ range
    // that brackets typical wildfire-smoke severity.
    params: {
      lng: "-100",
      lat: "55",
      zoom: "3",
      colormap: "turbo",
      rescale: "0,100",
    },
  },
  {
    profile: "ftw",
    title: "Fields of The World — Global field-boundary predictions (alpha)",
    url: "https://data.source.coop/ftw/global-data/predictions/zarr/alpha/global.zarr",
    // ~10 m/px global; MIN_ZOOM is 12 so the example lands one level above
    // that. Iowa corn belt at zoom 13 puts you over visibly-distinct
    // agricultural fields. Defaults assume probability-style outputs.
    params: {
      lng: "-93.5",
      lat: "42.0",
      zoom: "13",
      colormap: "viridis",
      rescale: "0,1",
    },
  },
];
