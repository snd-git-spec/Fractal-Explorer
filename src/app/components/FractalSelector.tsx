import { memo, useMemo } from 'react';
import { FRACTALS, getFractalsForMenu } from '@/fractals/registry';
import type { FractalId } from '@/fractals/types';
import { useExplorerStore } from '@/state/ExplorerStore';
import { SnapshotStrip } from './SnapshotStrip';
import { useHudIntent } from './hud/HudIntentContext';

export const FractalSelector = memo(function FractalSelector() {
  const fractalId = useExplorerStore((s) => s.fractalId);
  const setFractalId = useExplorerStore((s) => s.setFractalId);
  const { isDesktop, leftMenu, toggleLeftMenu, closeLeftMenu } = useHudIntent();

  const current = useMemo(() => FRACTALS[fractalId], [fractalId]);
  const menuFractals = useMemo(() => getFractalsForMenu(), []);
  // Click-only — do not auto-open on left-edge hover (that fought toggle + overlapped palette).
  const open = leftMenu === 'fractal';

  const pick = (id: FractalId) => {
    setFractalId(id);
    closeLeftMenu();
  };

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        top: 'calc(28px + var(--hud-safe-top))',
        left: 'max(10px, var(--hud-safe-left))',
        width: isDesktop ? 178 : 160,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="hud-glass px-[14px] py-[8px]">
        <button
          type="button"
          onClick={() => toggleLeftMenu('fractal')}
          className="hud-fractal-name hud-interactive flex items-center gap-[6px] w-full min-h-[28px] px-[4px] py-[2px] cursor-pointer text-left text-[12px]"
          aria-expanded={open}
          aria-label="Fractal selection"
        >
          <span className="opacity-80">∞</span>
          <span className="truncate flex-1">{current.name}</span>
          <span className="text-[9px] opacity-50">{open ? '▴' : '▾'}</span>
        </button>

        {open && (
          <div className="mt-[6px] px-[2px] pb-[4px]">
            <div className="hud-fractal-list flex flex-col gap-[1px]">
              {menuFractals.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => pick(f.id as FractalId)}
                  className={`hud-fractal-name text-left w-full px-[6px] py-[4px] text-[11px] md:text-[12px] min-h-[26px] cursor-pointer ${
                    f.id === fractalId ? 'is-active' : ''
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <div className="mt-[6px] pt-[4px]">
              <SnapshotStrip />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
