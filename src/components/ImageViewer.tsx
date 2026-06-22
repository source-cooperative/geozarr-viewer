import { Deck, OrthographicView } from "@deck.gl/core";
import { BitmapLayer } from "@deck.gl/layers";
import { useEffect, useMemo, useRef, useState } from "react";
import * as zarr from "zarrita";
import { formatNumber } from "./RangeSlider";
import { createLogger } from "../log";
import { buildSelection, pickLevelForZoom } from "../zarr/profiles/image-orthographic/lod";
import type {
  ImageOrthographicContext,
  ImageOrthographicState,
} from "../zarr/profiles/image-orthographic/types";
import { toGrayscaleRgba } from "./image-normalize";

const log = createLogger("image-viewer");

/** What's currently painted, plus the raw samples behind it for hover. */
type LevelTexture = {
  image: ImageData;
  raw: ArrayLike<number>;
  width: number;
  height: number;
  /** Downsample of this level vs the finest (world) coordinate space. */
  downsample: number;
  level: number;
};

type HoverInfo = {
  x: number;
  y: number;
  col: number;
  row: number;
  value: number;
};

/** Standalone deck.gl `OrthographicView` host for non-geographic OME-Zarr
 * images. All pyramid levels describe the same image, so they share one
 * pixel-space extent ([0,0,W,H] in finest pixels); we pick the level matching
 * the current zoom (LOD) and paint it with a `BitmapLayer`. The texture
 * sharpens as you zoom in. Hover reads the raw intensity under the cursor.
 *
 * Not yet tile-by-tile: each level loads whole, so this targets images that fit
 * in memory per level (microscopy wells), not gigapixel whole-slides. */
export function ImageViewer({
  ctx,
  state,
  opacity,
}: {
  ctx: ImageOrthographicContext;
  state: ImageOrthographicState;
  opacity: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deckRef = useRef<Deck<OrthographicView> | null>(null);
  // Latest painted texture, read by the (stable) hover handler via a ref.
  const sampleRef = useRef<LevelTexture | null>(null);
  // Per (level, channel, z/t) decoded-texture cache.
  const cacheRef = useRef<Map<string, LevelTexture>>(new Map());

  const [zoom, setZoom] = useState<number | null>(null);
  const [displayed, setDisplayed] = useState<LevelTexture | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const { width, height } = ctx; // finest-level extent = world coords
  const downsamples = useMemo(
    () => ctx.levels.map((l) => l.downsample),
    [ctx.levels],
  );
  const indicesKey = JSON.stringify(state.indices);

  // Create the Deck instance once. The view is uncontrolled (deck's controller
  // owns pan/zoom); we observe zoom for LOD and the cursor for hover.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || width === 0 || height === 0) return;
    const cw = wrap.clientWidth || 800;
    const ch = wrap.clientHeight || 600;
    // OrthographicView: screen px = world units · 2^zoom. Fit both axes.
    const fitZoom = Math.log2(Math.min(cw / width, ch / height) * 0.92);
    setZoom(fitZoom);

    const deck = new Deck<OrthographicView>({
      canvas,
      views: new OrthographicView({ id: "ortho" }),
      controller: true,
      initialViewState: {
        target: [width / 2, height / 2, 0],
        zoom: fitZoom,
        minZoom: fitZoom - 1,
        maxZoom: 8,
      },
      layers: [],
      getCursor: ({ isDragging }) => (isDragging ? "grabbing" : "crosshair"),
      onViewStateChange: ({ viewState }) => {
        const z = (viewState as { zoom: number }).zoom;
        // Round to avoid recomputing the LOD level every animation frame.
        setZoom((prev) =>
          prev != null && Math.round(prev * 10) === Math.round(z * 10) ? prev : z,
        );
      },
      onHover: (info) => {
        const tex = sampleRef.current;
        const coord = info.coordinate;
        if (!tex || !coord) {
          setHover(null);
          return;
        }
        const col = Math.floor(coord[0]!);
        const row = Math.floor(coord[1]!);
        if (col < 0 || col >= width || row < 0 || row >= height) {
          setHover(null);
          return;
        }
        // Map world (finest) pixel → this level's pixel grid.
        const lc = Math.min(tex.width - 1, Math.floor(col / tex.downsample));
        const lr = Math.min(tex.height - 1, Math.floor(row / tex.downsample));
        const value = Number(tex.raw[lr * tex.width + lc]);
        setHover({ x: info.x, y: info.y, col, row, value });
      },
    });
    deckRef.current = deck;
    log.info(`ortho host ${width}×${height}px, fitZoom=${fitZoom.toFixed(2)}`);
    return () => {
      deck.finalize();
      deckRef.current = null;
    };
  }, [width, height]);

  const targetLevel = zoom == null ? ctx.levels.length - 1 : pickLevelForZoom(zoom, downsamples);

  // Load the selected level + channel + z/t slice, normalize, and cache. The
  // previously displayed texture stays painted until the new one is ready.
  useEffect(() => {
    const level = ctx.levels[targetLevel];
    if (!level) return;
    const key = `${targetLevel}|${state.channel}|${indicesKey}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      sampleRef.current = cached;
      setDisplayed(cached);
      setStatus("ready");
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        const sel = buildSelection(
          ctx.axes,
          ctx.channelAxisIndex,
          ctx.spatialAxes,
          state.channel,
          state.indices,
        );
        const chunk = await zarr.get(
          level.array as zarr.Array<zarr.NumberDataType, zarr.Readable>,
          sel,
          { signal: ctrl.signal },
        );
        if (ctrl.signal.aborted) return;
        const win = ctx.channels[state.channel];
        const rgba = toGrayscaleRgba(
          chunk.data as ArrayLike<number>,
          level.width,
          level.height,
          win?.start,
          win?.end,
        );
        const tex: LevelTexture = {
          image: new ImageData(rgba, level.width, level.height),
          raw: chunk.data as ArrayLike<number>,
          width: level.width,
          height: level.height,
          downsample: level.downsample,
          level: targetLevel,
        };
        cacheRef.current.set(key, tex);
        sampleRef.current = tex;
        setDisplayed(tex);
        setStatus("ready");
      } catch (err) {
        if (ctrl.signal.aborted) return;
        log.error("level load failed", err);
        setStatus("error");
      }
    })();
    return () => ctrl.abort();
    // state.indices is read inside but its identity changes every render; the
    // stable `indicesKey` string captures its value for the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, targetLevel, state.channel, indicesKey]);

  // Drop the decoded-texture cache when the store (ctx) changes.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      cache.clear();
      sampleRef.current = null;
    };
  }, [ctx]);

  // Push the current texture to the Deck instance as a single BitmapLayer.
  useEffect(() => {
    if (!displayed) return;
    deckRef.current?.setProps({
      layers: [
        new BitmapLayer({
          id: `ome-L${displayed.level}`,
          image: displayed.image,
          // bounds [left, bottom, right, top]; top=0 puts image row 0 at the
          // top under flipY. (If upside down on first view, swap 2nd/4th.)
          bounds: [0, height, width, 0],
          opacity,
        }),
      ],
    });
  }, [displayed, opacity, width, height]);

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0, background: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />

      {status !== "ready" && (
        <div
          className="panel mono"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            padding: "6px 10px",
            fontSize: 12,
            color: status === "error" ? "var(--danger, #f66)" : undefined,
          }}
        >
          {status === "error" ? "Failed to load image" : "Loading image…"}
        </div>
      )}

      {hover && (
        <div
          style={{
            position: "absolute",
            left: hover.x + 14,
            top: hover.y + 14,
            zIndex: 16,
            pointerEvents: "none",
            maxWidth: 280,
          }}
        >
          <div
            className="panel mono"
            style={{ padding: "4px 8px", fontSize: 11, lineHeight: 1.4, whiteSpace: "nowrap" }}
          >
            <div>{ctx.channels[state.channel]?.label ?? `channel ${state.channel}`}</div>
            <div>{formatNumber(hover.value)}</div>
            <div style={{ color: "var(--text-muted)" }}>
              x {hover.col}, y {hover.row}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
