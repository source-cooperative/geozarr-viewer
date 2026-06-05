import { describe, expect, it } from "vitest";
import { aefProfile } from "../zarr/profiles/aef/profile";

describe("profile URL params round-trip", () => {
  it("AEF serializes + parses", () => {
    const state = {
      year: 8,
      rBand: 0,
      gBand: 16,
      bBand: 32,
      rescaleMin: -0.3,
      rescaleMax: 0.3,
    };
    const params = new URLSearchParams(
      Object.entries(aefProfile.serializeUrlParams(state)).filter(
        (kv): kv is [string, string] => typeof kv[1] === "string",
      ),
    );
    const parsed = aefProfile.parseUrlParams(params);
    expect(parsed).toEqual(state);
  });

  it("AEF clamps band index out of range", () => {
    const parsed = aefProfile.parseUrlParams(new URLSearchParams("r=200"));
    expect(parsed.rBand).toBe(63);
  });
});
