import { describe, expect, it } from "vitest";
import { buildSelection, pickLevelForZoom } from "./lod";
import type { OmeAxis } from "./types";

describe("pickLevelForZoom", () => {
  const ds = [1, 2, 4, 8, 16, 32]; // 6 levels, finest-first

  it("picks the finest level when zoomed in past native (zoom > 0)", () => {
    expect(pickLevelForZoom(1, ds)).toBe(0);
    expect(pickLevelForZoom(0, ds)).toBe(0); // 2^0 = 1 → only d=1 qualifies
  });

  it("picks coarser levels as the view zooms out (zoom < 0)", () => {
    expect(pickLevelForZoom(-1, ds)).toBe(1); // 2^1 = 2 → coarsest d≤2 is d=2
    expect(pickLevelForZoom(-2, ds)).toBe(2); // 2^2 = 4 → d=4
    expect(pickLevelForZoom(-3, ds)).toBe(3); // d=8
  });

  it("clamps to the coarsest level when zoomed far out", () => {
    expect(pickLevelForZoom(-10, ds)).toBe(5); // all qualify → coarsest
  });

  it("returns 0 for an empty pyramid", () => {
    expect(pickLevelForZoom(-5, [])).toBe(0);
  });
});

describe("buildSelection", () => {
  const cyx: OmeAxis[] = [
    { name: "c", type: "channel" },
    { name: "y", type: "space" },
    { name: "x", type: "space" },
  ];

  it("pins the channel and leaves the spatial pair full", () => {
    expect(buildSelection(cyx, 0, { yIndex: 1, xIndex: 2 }, 3, {})).toEqual([
      3,
      null,
      null,
    ]);
  });

  it("pins z/t axes from indices, defaulting missing ones to 0", () => {
    const tczyx: OmeAxis[] = [
      { name: "t", type: "time" },
      { name: "c", type: "channel" },
      { name: "z", type: "space" }, // (depth treated as non-spatial here)
      { name: "y", type: "space" },
      { name: "x", type: "space" },
    ];
    // spatial pair = last two (y, x); t and z are "other" axes.
    const sel = buildSelection(tczyx, 1, { yIndex: 3, xIndex: 4 }, 2, {
      t: 5,
    });
    expect(sel).toEqual([5, 2, 0, null, null]); // t=5, c=2, z default 0
  });
});
