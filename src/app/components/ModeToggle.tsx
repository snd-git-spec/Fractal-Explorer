import { useEffect, useMemo } from 'react';
import type { UiMode } from '@/fractals/types';
import { useExplorerStore } from '@/state/ExplorerStore';
import { useHudIntent } from './hud/HudIntentContext';

export function ModeToggle() {
  const uiMode = useExplorerStore((s) => s.uiMode);
  const controlsOpen = useExplorerStore((s) => s.controlsOpen);
  const toggleControlsMode = useExplorerStore((s) => s.toggleControlsMode);
  const setControlsOpen = useExplorerStore((s) => s.setControlsOpen);
  const { rightOpacity, rightActive, topActive } = useHudIntent();
  const opacity = Math.max(rightOpacity, topActive ? 0.95 : 0.7, rightActive ? 1 : 0);

  const modes = useMemo(
    () =>
      [
        { value: 'express' as UiMode, label: 'Express', short: 'EX' },
        { value: 'lab' as UiMode, label: 'Lab', short: 'LAB' },
      ] as const,
    [],
  );

  // Click outside closes the controls rail (same pattern as fractal list).
  useEffect(() => {
    if (!controlsOpen) return;
    const onDown = () => setControlsOpen(false);
    const id = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [controlsOpen, setControlsOpen]);

  return (
    <div
      className="hud-rail absolute pointer-events-auto"
      style={{
        top: 'calc(28px + var(--hud-safe-top))',
        right: 'max(10px, var(--hud-safe-right))',
        opacity,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex gap-[2px]">
        {modes.map((m) => {
          const isActive = controlsOpen && uiMode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => toggleControlsMode(m.value)}
              className={`hud-mode-btn min-h-[32px] md:min-h-[28px] min-w-[40px] px-[8px] py-[4px] text-[11px] md:text-[10px] cursor-pointer ${
                isActive ? 'is-active' : ''
              }`}
              aria-pressed={isActive}
              aria-label={isActive ? `Hide ${m.label} controls` : `Show ${m.label} controls`}
            >
              <span className="md:hidden">{m.short}</span>
              <span className="hidden md:inline">{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
