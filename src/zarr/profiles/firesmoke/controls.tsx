import { DebouncedSlider } from "../../../components/DebouncedSlider";
import type { ProfileControlsProps } from "../../profile";
import type { FireSmokeContext, FireSmokeState } from "./types";

function formatValidTime(secs: number): string {
  if (!Number.isFinite(secs)) return "—";
  // `YYYY-MM-DD HH:MM UTC` — slightly more legible than the full ISO form.
  return (
    new Date(secs * 1000)
      .toISOString()
      .slice(0, 16)
      .replace("T", " ") + " UTC"
  );
}

export function FireSmokeControls({
  ctx,
  state,
  update,
}: ProfileControlsProps<FireSmokeContext, FireSmokeState>) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <DebouncedSlider
        label="Valid time"
        value={state.time}
        min={0}
        max={Math.max(0, ctx.timeCount - 1)}
        onCommit={(v) => update({ time: v })}
        formatValue={(v) =>
          formatValidTime(ctx.validTimes[v] ?? Number.NaN)
        }
      />
    </div>
  );
}
