type Props = {
  /** Live map zoom. */
  current: number;
  /** Lowest zoom at which the active layer renders tiles. */
  threshold: number;
};

/** Centered overlay shown when the map is zoomed out past the active
 * profile's render floor (e.g. AEF's MIN_ZOOM). The dataset has no
 * overviews, so nothing draws below the threshold — this tells the user to
 * zoom in and shows how far they have to go. `pointerEvents: none` lets
 * scroll/drag-zoom gestures pass straight through to the map. */
export function ZoomHint({ current, threshold }: Props) {
  return (
    <div
      role="status"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 15,
        pointerEvents: "none",
      }}
    >
      <div
        className="panel"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          maxWidth: "min(360px, calc(100vw - 32px))",
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, color: "var(--text-muted)" }}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
        <div style={{ display: "grid", gap: 2 }}>
          <span style={{ fontWeight: 600 }}>Zoom in to load tiles</span>
          <span className="mono" style={{ color: "var(--text-muted)" }}>
            zoom {current.toFixed(1)} · tiles at {threshold}+
          </span>
        </div>
      </div>
    </div>
  );
}
