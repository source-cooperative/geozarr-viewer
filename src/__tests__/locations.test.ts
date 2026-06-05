import { describe, expect, it } from "vitest";
import { findMatchingLocation, LOCATIONS } from "../locations";

describe("findMatchingLocation", () => {
  it("returns null for a null view", () => {
    expect(findMatchingLocation(null)).toBeNull();
  });

  it("matches a view that exactly equals a preset", () => {
    const sf = LOCATIONS.find((l) => l.id === "sf-bay")!;
    expect(
      findMatchingLocation([sf.longitude, sf.latitude, sf.zoom])?.id,
    ).toBe("sf-bay");
  });

  it("matches within the tolerance", () => {
    const sf = LOCATIONS.find((l) => l.id === "sf-bay")!;
    expect(
      findMatchingLocation([
        sf.longitude + 0.0005,
        sf.latitude - 0.0005,
        sf.zoom + 0.2,
      ])?.id,
    ).toBe("sf-bay");
  });

  it("returns null when no preset matches", () => {
    expect(findMatchingLocation([0, 0, 2])).toBeNull();
  });
});
