export type Location = {
  /** Stable identifier used as the `<option>` value. */
  id: string;
  /** Human-readable label shown in the dropdown. */
  label: string;
  longitude: number;
  latitude: number;
  zoom: number;
};

/** Preset map views available from the chassis "Location" dropdown.
 * Shared across all profiles — picks `flyTo` the map and updates the
 * URL's `lng` / `lat` / `zoom` params. */
export const LOCATIONS: readonly Location[] = [
  {
    id: "sf-bay",
    label: "San Francisco Bay (urban + water)",
    longitude: -122.4500106165,
    latitude: 37.7691860287,
    zoom: 13,
  },
  {
    id: "iowa-corn",
    label: "Iowa corn belt (seasonal agriculture)",
    longitude: -93.5,
    latitude: 42.0,
    zoom: 13,
  },
  {
    id: "amazon-frontier",
    label: "Amazon deforestation frontier (Rondônia)",
    longitude: -62.2,
    latitude: -9.5,
    zoom: 12,
  },
  {
    id: "nile-delta",
    label: "Nile delta (irrigation mosaic)",
    longitude: 31.2,
    latitude: 30.8,
    zoom: 12,
  },
  {
    id: "alaska-north-slope",
    label: "Alaska North Slope (tundra)",
    longitude: -150.0,
    latitude: 69.5,
    zoom: 12,
  },
];

const LNG_EPSILON = 0.001;
const LAT_EPSILON = 0.001;
const ZOOM_EPSILON = 0.5;

/** Find the preset location matching a `[lng, lat, zoom]` view, within a
 * small tolerance. Returns `null` when no preset matches. */
export function findMatchingLocation(
  view: readonly [number, number, number] | null,
): Location | null {
  if (!view) return null;
  const [lng, lat, zoom] = view;
  for (const loc of LOCATIONS) {
    if (
      Math.abs(lng - loc.longitude) < LNG_EPSILON &&
      Math.abs(lat - loc.latitude) < LAT_EPSILON &&
      Math.abs(zoom - loc.zoom) < ZOOM_EPSILON
    ) {
      return loc;
    }
  }
  return null;
}
