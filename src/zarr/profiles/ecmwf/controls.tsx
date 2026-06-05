import { DebouncedSlider } from "../../../components/DebouncedSlider";
import type { ProfileControlsProps } from "../../profile";
import {
  dateFromInitTimeIdx,
  isoDateString,
  leadHoursLabel,
  memberLabel,
} from "./dim-labels";
import type { EcmwfContext, EcmwfState } from "./types";

export function EcmwfControls({
  ctx,
  state,
  update,
}: ProfileControlsProps<EcmwfContext, EcmwfState>) {
  const activeVar = ctx.variables.find((v) => v.name === state.variable);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 4 }}>
        <span className="field-label">Variable</span>
        <select
          value={state.variable}
          onChange={(e) => update({ variable: e.target.value })}
        >
          {ctx.variables.map((v) => (
            <option key={v.name} value={v.name}>
              {v.longName ? `${v.name} — ${v.longName}` : v.name}
            </option>
          ))}
        </select>
        {activeVar?.units && (
          <span className="mono" style={{ color: "var(--text-muted)" }}>
            units: {activeVar.units}
          </span>
        )}
      </label>

      {/* init_time and member changes refetch tiles → debounce so a slider
       * drag doesn't trigger a refetch on every onChange tick. */}
      <DebouncedSlider
        label="Init time (forecast run)"
        value={state.initTime}
        min={0}
        max={ctx.dimSizes.initTime - 1}
        onCommit={(v) => update({ initTime: v })}
        formatValue={(v) => isoDateString(dateFromInitTimeIdx(v))}
      />
      {/* lead_time is a shader uniform (all 85 frames live in the tile
       * texture) — scrubbing it is free, so leave the slider live. */}
      <LiveSlider
        label="Lead time"
        value={state.leadTime}
        min={0}
        max={ctx.dimSizes.leadTime - 1}
        onChange={(v) => update({ leadTime: v })}
        formatValue={leadHoursLabel}
      />
      <DebouncedSlider
        label="Ensemble member"
        value={state.member}
        min={0}
        max={ctx.dimSizes.member - 1}
        onCommit={(v) => update({ member: v })}
        formatValue={memberLabel}
      />
    </div>
  );
}

/** Controlled slider with no debounce — every change fires `onChange`.
 * Use only for state that updates a shader uniform (no refetch). */
function LiveSlider({
  label,
  value,
  min,
  max,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  formatValue: (v: number) => string;
}) {
  return (
    <label style={{ display: "grid", gap: 2 }}>
      <span
        className="field-label"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        <span>{label}</span>
        <span className="mono" style={{ textTransform: "none" }}>
          {formatValue(value)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
