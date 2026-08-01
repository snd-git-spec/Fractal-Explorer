import { useEffect } from 'react';
import { FRACTALS } from '@/fractals/registry';
import { useExplorerStore } from '@/state/ExplorerStore';
import { ExpressPanel } from './ExpressPanel';
import { FractalSelector } from './FractalSelector';
import { LabPanel } from './LabPanel';
import { ModeToggle } from './ModeToggle';
import { PaletteSelector } from './PaletteSelector';
import { HudIntentProvider, useHudIntent } from './hud/HudIntentContext';

function HudChrome() {
  const uiVisible = useExplorerStore((s) => s.uiVisible);
  const uiMode = useExplorerStore((s) => s.uiMode);
  const controlsOpen = useExplorerStore((s) => s.controlsOpen);
  const fractalId = useExplorerStore((s) => s.fractalId);
  const fps = useExplorerStore((s) => s.fps);
  const { topOpacity, topActive, hintsVisible, dismissHints, isDesktop } = useHudIntent();

  useEffect(() => {
    if (!hintsVisible) return;
    const dismiss = () => dismissHints();
    window.addEventListener('pointerdown', dismiss, { once: true, passive: true });
    window.addEventListener('wheel', dismiss, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('wheel', dismiss);
    };
  }, [hintsVisible, dismissHints]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-10 transition-opacity duration-500 ${!uiVisible ? 'opacity-0' : ''}`}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-300"
        style={{ top: 'calc(10px + var(--hud-safe-top))', opacity: topOpacity }}
      >
        <h1 className="hud-label text-[9px] tracking-[3px]">
          Fractal Explorer
        </h1>
      </div>

      <div
        className="hud-label hidden md:block absolute text-[9px] tracking-[2px] transition-opacity duration-300"
        style={{
          top: 'calc(10px + var(--hud-safe-top))',
          right: 'max(120px, calc(120px + var(--hud-safe-right)))',
          opacity: topOpacity,
        }}
      >
        {fps}
      </div>

      <ModeToggle />
      <FractalSelector />
      <PaletteSelector />
      {controlsOpen && (uiMode === 'express' ? <ExpressPanel /> : <LabPanel />)}

      {isDesktop && topActive && (
        <div className="absolute bottom-[36px] left-1/2 -translate-x-1/2 text-[8px] tracking-[1px] text-[rgba(0,255,65,0.25)] text-center pointer-events-none whitespace-nowrap max-w-[70vw] truncate transition-opacity duration-300">
          {FRACTALS[fractalId].equation}
        </div>
      )}
      {isDesktop && hintsVisible && (
        <div className="absolute bottom-[14px] left-1/2 -translate-x-1/2 flex gap-[20px] text-[7px] tracking-[2px] text-[rgba(0,255,65,0.22)] uppercase pointer-events-none whitespace-nowrap">
          <span>Drag</span>
          <span>Scroll</span>
          <span>Shift+Drag</span>
        </div>
      )}
    </div>
  );
}

export function HudOverlay() {
  return (
    <HudIntentProvider>
      <HudChrome />
    </HudIntentProvider>
  );
}
