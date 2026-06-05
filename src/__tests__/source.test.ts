import { describe, expect, it } from "vitest";
import { detectProfile, normalizeStoreUrl } from "../source";

describe("detectProfile", () => {
  it("matches AEF by URL pattern", () => {
    const p = detectProfile("https://data.source.coop/tge-labs/aef-mosaic", null);
    expect(p?.id).toBe("aef");
  });

  it("returns null for unmatched URLs", () => {
    const p = detectProfile("https://example.com/random.zarr", null);
    expect(p).toBeNull();
  });

  it("returns null for null url", () => {
    expect(detectProfile(null, null)).toBeNull();
  });

  it("honors explicit ?p= override", () => {
    const p = detectProfile("https://example.com/random.zarr", "aef");
    expect(p?.id).toBe("aef");
  });

  it("ignores invalid explicit override", () => {
    const p = detectProfile(
      "https://data.source.coop/tge-labs/aef-mosaic",
      "bogus",
    );
    expect(p?.id).toBe("aef");
  });
});

describe("normalizeStoreUrl", () => {
  it("strips a trailing /zarr.json", () => {
    expect(
      normalizeStoreUrl("https://data.source.coop/tge-labs/aef-mosaic/zarr.json"),
    ).toBe("https://data.source.coop/tge-labs/aef-mosaic");
  });

  it("strips a trailing /.zmetadata", () => {
    expect(
      normalizeStoreUrl("https://example.com/x/.zmetadata"),
    ).toBe("https://example.com/x");
  });

  it("rewrites source.coop to data.source.coop", () => {
    expect(
      normalizeStoreUrl("https://source.coop/tge-labs/aef-mosaic"),
    ).toBe("https://data.source.coop/tge-labs/aef-mosaic");
  });

  it("does both at once for the user's pasted URL", () => {
    expect(
      normalizeStoreUrl("https://source.coop/tge-labs/aef-mosaic/zarr.json"),
    ).toBe("https://data.source.coop/tge-labs/aef-mosaic");
  });

  it("leaves an already-normalized data.source.coop URL unchanged", () => {
    const url = "https://data.source.coop/some-account/some-dataset/v1.zarr";
    expect(normalizeStoreUrl(url)).toBe(url);
  });

  it("trims whitespace", () => {
    expect(normalizeStoreUrl("  https://example.com/x  ")).toBe(
      "https://example.com/x",
    );
  });
});
