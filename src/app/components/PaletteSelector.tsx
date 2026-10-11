import { memo } from 'react';
import { PALETTES, type PaletteIdx } from '@/fractals/types';
import { useExplorerStore } from '@/state/ExplorerStore';
import { useHudIntent } from './hud/HudIntentContext';

/** Dedicated colour-profile control — mutually exclusive with the fractal list. */
export const PaletteSelector = memo(function PaletteSelector() {
  const paletteIdx = useExplorerStore((s) => s.paletteIdx);
  const setPaletteIdx = useExplorerStore((s) => s.setPaletteIdx);
  const setControlsOpen = useExplorerStore((s) => s.setControlsOpen);
  const { isDesktop, leftMenu, toggleLeftMenu, closeLeftMenu } = useHudIntent();

  const open = leftMenu === 'palette';
  const current = PALETTES[paletteIdx] ?? PALETTES[0];

  const pick = (id: PaletteIdx) => {
    setPaletteIdx(id);
    closeLeftMenu();
  };

  const toggle = () => {
    if (!isDesktop && !open) setControlsOpen(false);
    toggleLeftMenu('palette');
  };

  const swatch = (p: (typeof PALETTES)[number]) => (
    <span
      className="shrink-0 w-[28px] h-[12px] rounded-[2px]"
      style={{
        background: `linear-gradient(90deg, ${p.swatch[0]}, ${p.swatch[1]} 55%, ${p.swatch[2]})`,
      }}
      aria-hidden
    />
  );

  const list = (
    <div
      className="flex flex-col gap-[2px] overflow-y-auto [&::-webkit-scrollbar]:hidden px-[2px]"
      style={{
        scrollbarWidth: 'none',
        maxHeight: isDesktop
          ? 'min(45vh, calc(100vh - 160px))'
          : 'calc(100dvh - 190px - var(--hud-safe-top) - var(--hud-safe-bottom))',
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
          {swatch(p)}
          <span className="truncate min-w-0 text-[11px] md:text-[12px]">{p.name}</span>
        </button>
      ))}
    </div>
  );

  if (!isDesktop) {
    // Compact swatch trigger so it never collides with the centred Record button;
    // the list floats above it in its own panel.
    return (
      <div
        className="absolute pointer-events-auto"
        style={{
          bottom: 'calc(12px + var(--hud-safe-bottom))',
          left: 'max(10px, var(--hud-safe-left))',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {open && (
          <div className="hud-glass absolute bottom-[calc(100%+6px)] left-0 w-[180px] px-[8px] py-[8px]">
            {list}
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          className="hud-fractal-name hud-glass hud-interactive flex items-center gap-[6px] h-[40px] px-[10px] cursor-pointer"
          aria-expanded={open}
          aria-label="Colour profile"
          title={current.name}
        >
          {swatch(current)}
          <span className="text-[9px] opacity-50">{open ? '▴' : '▾'}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        bottom: 'calc(12px + var(--hud-safe-bottom))',
        left: 'max(10px, var(--hud-safe-left))',
        width: 178,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="hud-glass px-[14px] py-[8px]">
        {open && <div className="mb-[6px]">{list}</div>}

        <button
          type="button"
          onClick={toggle}
          className="hud-fractal-name hud-interactive flex items-center gap-[8px] w-full min-h-[28px] px-[4px] py-[2px] cursor-pointer text-left"
          aria-expanded={open}
          aria-label="Colour profile"
          title="Colour profile"
        >
          {swatch(current)}
          <span className="truncate flex-1 text-[11px] md:text-[12px]">{current.name}</span>
          <span className="text-[9px] opacity-50">{open ? '▴' : '▾'}</span>
        </button>
      </div>
    </div>
  );
});
