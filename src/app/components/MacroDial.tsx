import { memo, useCallback, useRef } from 'react';

interface MacroDialProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  size?: number;
}

const R = 15;
const C = 2 * Math.PI * R;

export const MacroDial = memo(function MacroDial({
  label,
  value,
  onChange,
  size = 48,
}: MacroDialProps) {
  const dragging = useRef(false);

  const setFromPointer = useCallback(
    (clientX: number, clientY: number, el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angle = Math.atan2(clientY - cy, clientX - cx);
      let t = (angle + Math.PI / 2) / (Math.PI * 2);
      if (t < 0) t += 1;
      onChange(Math.max(0, Math.min(1, t)));
    },
    [onChange],
  );

  const offset = C * (1 - value);

  return (
    <div className="flex flex-col items-center gap-[3px] select-none">
      <div
        className="relative touch-none cursor-pointer"
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromPointer(e.clientX, e.clientY, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          setFromPointer(e.clientX, e.clientY, e.currentTarget);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
      >
        <svg width={size} height={size} viewBox="0 0 48 48" className="block drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          <circle cx="24" cy="24" r={R} fill="none" stroke="rgba(0,255,65,0.2)" strokeWidth="2" />
          <circle
            cx="24"
            cy="24"
            r={R}
            fill="none"
            stroke="rgba(0,255,65,0.95)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            className="hud-dial-arc"
            transform="rotate(-90 24 24)"
          />
          <text
            x="24"
            y="27"
            textAnchor="middle"
            fill="rgba(0,255,65,0.95)"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 9,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))',
            }}
          >
            {Math.round(value * 100)}
          </text>
        </svg>
      </div>
      <span className="hud-label text-[9px] tracking-[0.12em]">{label}</span>
    </div>
  );
});
