import { memo } from 'react';
import { MacroDial } from './MacroDial';
import { ParamSlider } from './ParamSlider';
import type { MacroState, RemixMode } from '@/fractals/types';
import { useThrottledCamera } from '@/hooks/useThrottledCamera';
import { useExplorerStore } from '@/state/ExplorerStore';
import { useHudIntent } from './hud/HudIntentContext';

function EvolveCapsule({ speed }: { speed: number }) {
  const period = `${Math.max(0.7, 2.2 - speed * 1.1)}s`;
  return (
    <div
      className="hud-evolve-pulse mb-[10px] py-[4px]"
      style={{ ['--evolve-period' as string]: period }}
    >
      <div className="hud-label text-[11px]">∫ Evolving</div>
      <div className="hud-value text-[11px] mt-[2px] tabular-nums">{speed.toFixed(2)}</div>
    </div>
  );
}

function ActionCluster() {
  const autoEvolve = useExplorerStore((s) => s.autoEvolve);
  const setAutoEvolve = useExplorerStore((s) => s.setAutoEvolve);
  const remix = useExplorerStore((s) => s.remix);
  const lockViewOnRemix = useExplorerStore((s) => s.lockViewOnRemix);
  const toggleLockView = useExplorerStore((s) => s.toggleLockView);
  const copySeed = useExplorerStore((s) => s.copySeed);
  const getSeed = useExplorerStore((s) => s.getSeed);

  const row = 'hud-action w-full min-h-[28px] md:min-h-[26px] px-[4px] py-[4px] text-[11px]';

  return (
    <div className="mt-[8px] pt-[6px] flex flex-col gap-[1px]">
      <button
        type="button"
        onClick={() => setAutoEvolve(!autoEvolve)}
        className={`${row} ${autoEvolve ? 'is-on' : ''}`}
      >
        ∫ Evolve {autoEvolve ? 'On' : 'Off'}
      </button>
      <button type="button" onClick={() => remix('gentle' as RemixMode)} className={row}>
        ⊛ Remix
      </button>
      <button type="button" onClick={() => remix('wild' as RemixMode)} className={row}>
        ⊛ Wild
      </button>
      <button
        type="button"
        onClick={toggleLockView}
        className={`${row} ${lockViewOnRemix ? 'is-on' : ''}`}
      >
        ⊡ View {lockViewOnRemix ? 'Locked' : 'Free'}
      </button>
      <button type="button" onClick={copySeed} className={`${row} truncate`} title={getSeed()}>
        ⧉ Copy Seed
      </button>
    </div>
  );
}

function InstrumentBody() {
  const macros = useExplorerStore((s) => s.macros);
  const autoEvolve = useExplorerStore((s) => s.autoEvolve);
  const evolveSpeed = useExplorerStore((s) => s.evolveSpeed);
  const iters = useExplorerStore((s) => s.iters);
  const setMacro = useExplorerStore((s) => s.setMacro);
  const setEvolveSpeed = useExplorerStore((s) => s.setEvolveSpeed);
  const setIters = useExplorerStore((s) => s.setIters);
  const setTargetParam = useExplorerStore((s) => s.setTargetParam);
  const live = useThrottledCamera(autoEvolve ? 80 : 250);

  const setMacroKey = (key: keyof MacroState) => (v: number) => setMacro(key, v);

  return (
    <>
      {autoEvolve ? (
        <>
          <EvolveCapsule speed={evolveSpeed} />
          <ParamSlider
            label="Zoom"
            value={live.zoom}
            onChange={(v) => setTargetParam('zoom', v)}
            min={1}
            max={12}
            step={0.05}
            format={(v) => v.toFixed(1)}
          />
        </>
      ) : (
        <div className="grid grid-cols-2 gap-x-[12px] gap-y-[14px] justify-items-center py-[4px]">
          <MacroDial label="Pulse" value={macros.pulse} onChange={setMacroKey('pulse')} size={48} />
          <MacroDial label="Depth" value={macros.depth} onChange={setMacroKey('depth')} size={48} />
          <MacroDial label="Drift" value={macros.drift} onChange={setMacroKey('drift')} size={48} />
          <MacroDial label="Void" value={macros.void} onChange={setMacroKey('void')} size={48} />
        </div>
      )}

      <div className="mt-[10px]">
        <ParamSlider label="Detail" value={iters} onChange={setIters} min={2} max={64} step={2} format={(v) => v.toString()} />
        <ParamSlider
          label="Evolve Speed"
          value={evolveSpeed}
          onChange={setEvolveSpeed}
          min={0.05}
          max={1.5}
          step={0.05}
          format={(v) => v.toFixed(2)}
        />
      </div>

      <ActionCluster />
    </>
  );
}

export const ExpressPanel = memo(function ExpressPanel() {
  const { rightActive, rightOpacity } = useHudIntent();
  const uiMode = useExplorerStore((s) => s.uiMode);

  if (uiMode !== 'express') return null;

  return (
    <div
      className="hud-rail absolute right-[10px] top-1/2 -translate-y-1/2 w-[160px] md:w-[178px] max-h-[min(78vh,580px)] overflow-y-auto pointer-events-auto px-[6px] py-[8px] [&::-webkit-scrollbar]:hidden"
      style={{
        right: 'max(10px, var(--hud-safe-right))',
        opacity: rightActive ? 1 : rightOpacity,
        scrollbarWidth: 'none',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <InstrumentBody />
    </div>
  );
});
