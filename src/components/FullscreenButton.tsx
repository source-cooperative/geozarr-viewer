import { useEffect, useState } from "react";

export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== "undefined" && Boolean(document.fullscreenElement),
  );

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  };

  return (
    <button
      type="button"
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      onClick={toggle}
      className="map-icon-button"
      style={{ position: "absolute", bottom: 16, right: 16, zIndex: 4 }}
    >
      {isFullscreen ? <ExitIcon /> : <EnterIcon />}
    </button>
  );
}

function EnterIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6V3h3" />
      <path d="M13 6V3h-3" />
      <path d="M3 10v3h3" />
      <path d="M13 10v3h-3" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3v3H3" />
      <path d="M10 3v3h3" />
      <path d="M6 13v-3H3" />
      <path d="M10 13v-3h3" />
    </svg>
  );
}
