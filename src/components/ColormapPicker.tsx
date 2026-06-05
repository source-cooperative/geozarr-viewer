export type ColormapOption = {
  name: string;
  label: string;
  rowIndex: number;
  reversed?: boolean;
};

export type ColormapPickerProps = {
  colormapsPngUrl: string;
  rowCount: number;
  value: string;
  options: ColormapOption[];
  onChange: (next: string) => void;
};

export function ColormapPicker({
  colormapsPngUrl,
  rowCount,
  value,
  options,
  onChange,
}: ColormapPickerProps) {
  const active = options.find((o) => o.name === value);
  const previewHeight = 14;
  const stripHeight = previewHeight * rowCount;

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <select
        aria-label="colormap"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.name} value={o.name}>
            {o.label}
          </option>
        ))}
      </select>
      {active && (
        <div
          aria-hidden
          data-testid="colormap-preview"
          className="colormap-preview"
          style={{
            height: previewHeight,
            borderRadius: 2,
            backgroundImage: `url(${colormapsPngUrl})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `100% ${stripHeight}px`,
            backgroundPosition: `0 ${-active.rowIndex * previewHeight}px`,
            transform: active.reversed ? "scaleX(-1)" : undefined,
            imageRendering: "auto",
          }}
        />
      )}
    </div>
  );
}
