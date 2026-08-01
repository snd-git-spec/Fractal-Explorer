import { memo } from 'react';

interface ParamSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  readOnly?: boolean;
}

export const ParamSlider = memo(function ParamSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  readOnly = false,
}: ParamSliderProps) {
  return (
    <div className="hud-param">
      <div className="flex justify-between items-baseline gap-[8px]">
        <span className="hud-label text-[10px] md:text-[11px] truncate">{label}</span>
        <span className="hud-value text-[10px] md:text-[11px] shrink-0 tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => !readOnly && onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={readOnly}
        className={readOnly ? 'cursor-default' : 'cursor-pointer'}
      />
    </div>
  );
});
