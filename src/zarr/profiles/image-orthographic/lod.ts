import type { OmeAxis } from "./types";

/** Pick the pyramid level to display at a given OrthographicView zoom.
 *
 * In the viewer's world space one unit = one finest-level pixel, so screen
 * pixels per finest-pixel = 2^zoom. A level with downsample `d` stretches each
 * of its pixels over `d` finest-pixels, i.e. `d · 2^zoom` screen px per
 * level-pixel; it looks crisp (no upscaling) while `d ≤ 2^-zoom`.
 *
 * `downsamples` is finest-first and ascending (e.g. [1, 2, 4, 8, …]). We return
 * the index of the COARSEST level still crisp (least data to fetch); when the
 * view is zoomed in past native resolution (`2^-zoom < 1`), nothing qualifies
 * and we fall back to the finest level (index 0). */
export function pickLevelForZoom(zoom: number, downsamples: number[]): number {
  if (downsamples.length === 0) return 0;
  const target = Math.pow(2, -zoom);
  let pick = 0;
  for (let i = 0; i < downsamples.length; i++) {
    if (downsamples[i]! <= target) pick = i;
  }
  return pick;
}

/** Build a zarrita selection (one entry per array axis): the spatial pair is
 * full (`null`); the channel axis is pinned to `channel`; every other axis
 * (z / time) is pinned to its index from `indices` (default 0). */
export function buildSelection(
  axes: OmeAxis[],
  channelAxisIndex: number | null,
  spatialAxes: { yIndex: number; xIndex: number },
  channel: number,
  indices: Record<string, number>,
): (number | null)[] {
  return axes.map((axis, i) => {
    if (i === spatialAxes.yIndex || i === spatialAxes.xIndex) return null;
    if (i === channelAxisIndex) return channel;
    return indices[axis.name] ?? 0;
  });
}
