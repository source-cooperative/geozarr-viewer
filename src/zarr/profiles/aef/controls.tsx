import type { ProfileControlsProps } from "../../profile";
import { NUM_BANDS, YEAR_ORIGIN } from "./constants";
import type { AefContext, AefState } from "./types";

export function AefControls({
  ctx,
  state,
  update,
}: ProfileControlsProps<AefContext, AefState>) {
  const labels = ctx.bandLabels;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 4 }}>
        <span className="field-label">Year</span>
        <select
          value={state.year}
          onChange={(e) => update({ year: Number(e.target.value) })}
        >
          {Array.from({ length: ctx.yearCount }, (_, i) => (
            <option key={i} value={i}>
              {YEAR_ORIGIN + i}
            </option>
          ))}
        </select>
      </label>

      <BandSlider
        label="Red band"
        value={state.rBand}
        labels={labels}
        onChange={(v) => update({ rBand: v })}
      />
      <BandSlider
        label="Green band"
        value={state.gBand}
        labels={labels}
        onChange={(v) => update({ gBand: v })}
      />
      <BandSlider
        label="Blue band"
        value={state.bBand}
        labels={labels}
        onChange={(v) => update({ bBand: v })}
      />

      <div style={{ display: "grid", gap: 4 }}>
        <span className="field-label">Rescale (dequantized)</span>
        <div style={{ display: "grid", gap: 4, gridTemplateColumns: "1fr 1fr" }}>
          <input
            type="number"
            aria-label="rescaleMin"
            step={0.01}
            value={state.rescaleMin}
            onChange={(e) => update({ rescaleMin: Number(e.target.value) })}
          />
          <input
            type="number"
            aria-label="rescaleMax"
            step={0.01}
            value={state.rescaleMax}
            onChange={(e) => update({ rescaleMax: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}

function BandSlider({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: number;
  labels: readonly string[];
  onChange: (next: number) => void;
}) {
  const labelText = labels[value] ?? `band ${value}`;
  return (
    <label style={{ display: "grid", gap: 2 }}>
      <span
        className="field-label"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        <span>{label}</span>
        <span className="mono" style={{ textTransform: "none" }}>
          {value} · {labelText}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={NUM_BANDS - 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
