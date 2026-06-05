import type { AnyZarrProfile } from "./zarr/profile";
import { getProfile, PROFILES } from "./zarr/profiles";

/** Pick the active profile for a (url, explicit-override) pair. Explicit
 * `?p=` wins; otherwise the first profile whose `matches(url)` returns
 * true; null if neither resolves. */
export function detectProfile(
  url: string | null,
  explicit: string | null,
): AnyZarrProfile | null {
  if (explicit) {
    const found = getProfile(explicit);
    if (found) return found;
  }
  if (!url) return null;
  return PROFILES.find((p) => p.matches(url)) ?? null;
}

/** Normalize a pasted store URL.
 *
 * Two common pitfalls people hit on source.coop datasets:
 *   1. They paste the catalog host (`source.coop/<path>`) — that returns the
 *      Next.js HTML, not the zarr bytes. The byte-serving host is
 *      `data.source.coop`.
 *   2. They include the explicit metadata key (`…/zarr.json` or
 *      `…/.zmetadata`). zarrita's `FetchStore` appends that itself, so
 *      passing it through doubles the suffix and 404s.
 */
export function normalizeStoreUrl(raw: string): string {
  let url = raw.trim();
  url = url.replace(/\/(zarr\.json|\.zmetadata)\/?$/, "");
  url = url.replace(/^(https?:\/\/)source\.coop\//, "$1data.source.coop/");
  return url;
}
