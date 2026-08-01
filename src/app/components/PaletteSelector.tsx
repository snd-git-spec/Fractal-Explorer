import { memo } from 'react';
import { PALETTES, type PaletteIdx } from '@/fractals/types';
import { useExplorerStore } from '@/state/ExplorerStore';
import { useHudIntent } from './hud/HudIntentContext';

/** Dedicated colour-profile control — mutually exclusive with the fractal list. */
export const PaletteSelector = memo(function PaletteSelector() {
  const paletteIdx = useExplorerStore((s) => s.paletteIdx);
  const setPaletteIdx = useExplorerStore((s) => s.setPaletteIdx);
  const { leftOpacity, isDesktop, leftMenu, toggleLeftMenu, closeLeftMenu } = useHudIntent();

  const open = leftMenu === 'palette';
  const current = PALETTES[paletteIdx] ?? PALETTES[0];

  const pick = (id: PaletteIdx) => {
    setPaletteIdx(id);
    closeLeftMenu();
  };

  return (
    <div
      className="hud-rail absolute pointer-events-auto"
      style={{
        bottom: 'calc(12px + var(--hud-safe-bottom))',
        left: 'max(10px, var(--hud-safe-left))',
        width: isDesktop ? 178 : 160,
        opacity: leftOpacity,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {open && (
        <div
          className="mb-[4px] flex flex-col gap-[2px] overflow-y-auto [&::-webkit-scrollbar]:hidden"
          style={{
            scrollbarWidth: 'none',
            maxHeight: 'min(45vh, calc(100vh - 160px))',
          }}
        >
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id as PaletteIdx)}
              className={`hud-fractal-name flex items-center gap-[8px] w-full text-left px-[6px] py-[6px] min-h-[32px] cursor-pointer ${
                p.id === paletteIdx ? 'is-active' : ''
              }`}
            >
              <span
                className="shrink-0 w-[28px] h-[12px] rounded-[2px]"
                style={{
                  background: `linear-gradient(90deg, ${p.swatch[0]}, ${p.swatch[1]} 55%, ${p.swatch[2]})`,
                }}
                aria-hidden
              />
              <span className="truncate min-w-0 text-[11px] md:text-[12px]">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => toggleLeftMenu('palette')}
        className="hud-fractal-name hud-interactive flex items-center gap-[8px] w-full min-h-[32px] px-[6px] py-[5px] cursor-pointer text-left"
        aria-expanded={open}
        aria-label="Colour profile"
        title="Colour profile"
      >
        <span
          className="shrink-0 w-[28px] h-[12px] rounded-[2px]"
          style={{
            background: `linear-gradient(90deg, ${current.swatch[0]}, ${current.swatch[1]} 55%, ${current.swatch[2]})`,
          }}
          aria-hidden
        />
        <span className="truncate flex-1 text-[11px] md:text-[12px]">{current.name}</span>
        <span className="text-[9px] opacity-50">{open ? '▴' : '▾'}</span>
      </button>
    </div>
  );
});
