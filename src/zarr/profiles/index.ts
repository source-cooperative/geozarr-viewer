import type { AnyZarrProfile } from "../profile";
import { aefProfile } from "./aef/profile";
import { ecmwfProfile } from "./ecmwf/profile";
import { fireSmokeProfile } from "./firesmoke/profile";
import { ftwProfile } from "./ftw/profile";

/** Ordered list of registered profiles. `detectProfile` returns the first
 * one whose `matches(url)` returns true (or the explicit `?p=` override). */
export const PROFILES: readonly AnyZarrProfile[] = [
  ecmwfProfile,
  aefProfile,
  fireSmokeProfile,
  ftwProfile,
];

export function getProfile(id: string | null): AnyZarrProfile | null {
  if (!id) return null;
  return PROFILES.find((p) => p.id === id) ?? null;
}
