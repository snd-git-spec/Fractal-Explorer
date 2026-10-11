import { memo } from 'react';
import { getSnapshots } from '@/fractals/instruments';
import { useExplorerStore } from '@/state/ExplorerStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useHudIntent } from './hud/HudIntentContext';

export const ModePill = memo(function ModePill() {
  const fractalId = useExplorerStore((s) => s.fractalId);
  const activeMode = useExplorerStore((s) => s.activeMode);
  const applySnapshot = useExplorerStore((s) => s.applySnapshot);
  const controlsOpen = useExplorerStore((s) => s.controlsOpen);
  const { leftMenu } = useHudIntent();
  // Below this width the right-hand panel reaches into the left column
  const narrow = useMediaQuery('(max-width: 347px)');

  const modes = getSnapshots(fractalId);
  if (modes.length === 0 || leftMenu === 'fractal') return null;
  if (narrow && controlsOpen) return null;

  const idx = modes.findIndex((m) => m.name === activeMode);

  const step = (dir: 1 | -1) => {
    const next = idx < 0
      ? (dir === 1 ? 0 : modes.length - 1)
      : (idx + dir + modes.length) % modes.length;
    applySnapshot(modes[next].name);
  };

  const arrow = 'hud-fractal-name hud-interactive shrink-0 w-[28px] h-full flex items-center justify-center text-[11px] cursor-pointer';

  return (
    <div className="mt-[6px]" onPointerDown={(e) => e.stopPropagation()}>
      <div className="hud-glass flex items-stretch h-[32px] w-full">
        <button type="button" onClick={() => step(-1)} className={arrow} aria-label="Previous mode">◂</button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Fractal mode"
          className={`hud-fractal-name hud-interactive flex-1 min-w-0 px-[4px] text-[10px] md:text-[11px] tracking-[0.5px] cursor-pointer truncate ${idx >= 0 ? 'is-active' : 'opacity-70'}`}
        >
          {idx >= 0 ? modes[idx].name : `${modes.length} modes`}
        </button>
        <button type="button" onClick={() => step(1)} className={arrow} aria-label="Next mode">▸</button>
      </div>
    </div>
  );
});
