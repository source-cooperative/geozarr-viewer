type Props = {
  message: string | null;
  onDismiss: () => void;
};

export function Toast({ message, onDismiss }: Props) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="panel"
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#7a1a1a",
        color: "#ffffff",
        padding: "10px 14px",
        borderRadius: "var(--radius)",
        zIndex: 20,
        display: "flex",
        gap: 12,
        alignItems: "center",
        maxWidth: "min(640px, calc(100vw - 32px))",
      }}
    >
      <span style={{ fontSize: 13 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: "transparent",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.6)",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

/** Map a thrown error / rejected fetch to a one-line user-facing message. */
export function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("404") || lower.includes("not found")) {
    return "The Zarr store URL returned 404. Make sure the URL points to the store root (no trailing /zarr.json) — for source.coop datasets the byte-serving host is data.source.coop.";
  }
  if (
    lower.includes("cors") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror")
  ) {
    return "Could not fetch the Zarr store. Check the URL — for source.coop datasets the byte-serving host is data.source.coop; if that's already what you used, the host may be blocking cross-origin requests.";
  }
  if (lower.includes("zarr") || lower.includes("metadata")) {
    return `Could not open the Zarr store: ${msg}`;
  }
  return `Could not load the Zarr store: ${msg}`;
}
