import { StepperRange } from "../../../components/StepperRange";
import type { ProfileControlsProps } from "../../profile";
import type { ImageOrthographicContext, ImageOrthographicState } from "./types";

export function ImageOrthographicControls({
  ctx,
  state,
  update,
  group,
}: ProfileControlsProps<ImageOrthographicContext, ImageOrthographicState>) {
  // Channel + z/t pins re-read pixel data → "fetch" bucket. (Rescale uses the
  // omero window; LOD level is chosen automatically from zoom.)
  if (group !== "fetch") return null;

  const scrubAxes = ctx.otherAxes.filter((a) => a.size > 1);
  if (ctx.channelCount <= 1 && scrubAxes.length === 0) return null;

  const channelLabel =
    ctx.channels[state.channel]?.label ?? `channel ${state.channel}`;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {ctx.channelCount > 1 && (
        <AxisSlider
          label="Channel"
          value={state.channel}
          max={ctx.channelCount - 1}
          valueLabel={channelLabel}
          onChange={(v) => update({ channel: v })}
        />
      )}
      {scrubAxes.map((axis) => (
        <AxisSlider
          key={axis.name}
          label={axis.name}
          value={state.indices[axis.name] ?? 0}
          max={axis.size - 1}
          onChange={(v) =>
            update({ indices: { ...state.indices, [axis.name]: v } })
          }
        />
      ))}
    </div>
  );
}

function AxisSlider({
  label,
  value,
  max,
  valueLabel,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  valueLabel?: string;
  onChange: (next: number) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 2 }}>
      <span
        className="field-label"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        <span>{label}</span>
        <span className="mono" style={{ textTransform: "none" }}>
          {value}
          {valueLabel ? ` · ${valueLabel}` : ` / ${max}`}
        </span>
      </span>
      <StepperRange value={value} min={0} max={Math.max(0, max)} onChange={onChange} />
    </label>
  );
}
