import { memo } from 'react';

export interface HudSelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface HudSelectProps<T extends string | number> {
  label?: string;
  value: T;
  options: HudSelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export const HudSelect = memo(function HudSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className = '',
}: HudSelectProps<T>) {
  return (
    <div className={className}>
      {label && (
        <div
          style={{ fontFamily: "'Orbitron', sans-serif" }}
          className="text-[7px] tracking-[2px] text-[rgba(0,255,65,0.45)] mb-[4px] uppercase"
        >
          {label}
        </div>
      )}
      <div className="relative">
        <select
          value={String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            const next = typeof value === 'number' ? Number(raw) : raw;
            onChange(next as T);
          }}
          className="appearance-none w-full min-w-[140px] bg-[rgba(0,10,20,0.75)] border border-[rgba(0,255,65,0.18)] rounded-[3px] pl-[8px] pr-[22px] py-[6px] text-[9px] tracking-[1px] text-[rgba(0,255,65,0.8)] cursor-pointer transition-all duration-200 hover:border-[rgba(0,255,65,0.4)] focus:outline-none focus:border-[rgba(0,255,65,0.45)]"
          style={{ fontFamily: "'Share Tech Mono', monospace", backdropFilter: 'blur(8px)' }}
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)} className="bg-[#000408]">
              {opt.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute right-[8px] top-1/2 -translate-y-1/2 text-[8px] text-[rgba(0,255,65,0.4)]"
          aria-hidden
        >
          ▾
        </span>
      </div>
    </div>
  );
}) as <T extends string | number>(props: HudSelectProps<T>) => JSX.Element;
