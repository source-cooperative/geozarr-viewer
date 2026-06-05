import { DebouncedSlider } from "../../../components/DebouncedSlider";
import type { ProfileControlsProps } from "../../profile";
import type { FtwContext, FtwState } from "./types";

export function FtwControls({
  ctx,
  state,
  update,
}: ProfileControlsProps<FtwContext, FtwState>) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <DebouncedSlider
        label="Time"
        value={state.time}
        min={0}
        max={Math.max(0, ctx.timeCount - 1)}
        onCommit={(v) => update({ time: v })}
        formatValue={(v) => `t=${v}`}
      />
      <DebouncedSlider
        label="Band"
        value={state.band}
        min={0}
        max={Math.max(0, ctx.bandCount - 1)}
        onCommit={(v) => update({ band: v })}
        formatValue={(v) => ctx.bandLabels[v] ?? `band ${v}`}
      />
    </div>
  );
}
