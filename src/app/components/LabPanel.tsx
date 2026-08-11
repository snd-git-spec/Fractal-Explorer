import { memo } from 'react';
import { ParamSlider } from './ParamSlider';
import { useThrottledCamera } from '@/hooks/useThrottledCamera';
import { getInstrument } from '@/fractals/instruments';
import { useExplorerStore } from '@/state/ExplorerStore';
import { useHudIntent } from './hud/HudIntentContext';

function LabBody() {
  const camera = useThrottledCamera();
  const fractalId = useExplorerStore((s) => s.fractalId);
  const iters = useExplorerStore((s) => s.iters);
  const autoEvolve = useExplorerStore((s) => s.autoEvolve);
  const evolveSpeed = useExplorerStore((s) => s.evolveSpeed);
  const setIters = useExplorerStore((s) => s.setIters);
  const setEvolveSpeed = useExplorerStore((s) => s.setEvolveSpeed);
  const setTargetParam = useExplorerStore((s) => s.setTargetParam);

  const labels = getInstrument(fractalId).labels;

  return (
    <div className="flex flex-col">
      <ParamSlider label="Detail" value={iters} onChange={setIters} min={2} max={64} step={2} format={(v) => v.toString()} />
      <ParamSlider label={labels.power} value={camera.power} onChange={(v) => setTargetParam('power', v)} min={2} max={16} step={0.05} format={(v) => v.toFixed(1)} />
      {!labels.hideBailout && (
        <ParamSlider label={labels.bailout} value={camera.bailout} onChange={(v) => setTargetParam('bailout', v)} min={1} max={6} step={0.05} format={(v) => v.toFixed(2)} />
      )}
      {!labels.hideWarp && (
        <>
          <ParamSlider label={labels.cx} value={camera.cx} onChange={(v) => setTargetParam('cx', v)} min={-1.5} max={1.5} step={0.005} format={(v) => v.toFixed(2)} />
          <ParamSlider label={labels.cy} value={camera.cy} onChange={(v) => setTargetParam('cy', v)} min={-1.5} max={1.5} step={0.005} format={(v) => v.toFixed(2)} />
        </>
      )}
      <ParamSlider label={labels.glow} value={camera.glow} onChange={(v) => setTargetParam('glow', v)} min={0} max={1} step={0.005} format={(v) => v.toFixed(2)} />
      <ParamSlider label={labels.bright} value={camera.bright} onChange={(v) => setTargetParam('bright', v)} min={0.1} max={3} step={0.05} format={(v) => v.toFixed(1)} />
      <ParamSlider label={labels.zoom} value={camera.zoom} onChange={(v) => setTargetParam('zoom', v)} min={0.2} max={12} step={0.05} format={(v) => v.toFixed(1)} />
      {autoEvolve && (
        <ParamSlider label="Evolve Speed" value={evolveSpeed} onChange={setEvolveSpeed} min={0.05} max={1.5} step={0.05} format={(v) => v.toFixed(2)} />
      )}
    </div>
  );
}

export const LabPanel = memo(function LabPanel() {
  const uiMode = useExplorerStore((s) => s.uiMode);
  const { rightActive, rightOpacity } = useHudIntent();

  if (uiMode !== 'lab') return null;

  return (
    <div
      className="hud-rail absolute top-1/2 -translate-y-1/2 w-[160px] md:w-[178px] max-h-[min(78vh,580px)] overflow-y-auto pointer-events-auto px-[6px] py-[8px] [&::-webkit-scrollbar]:hidden"
      style={{
        right: 'max(10px, var(--hud-safe-right))',
        opacity: rightActive ? 1 : rightOpacity,
        scrollbarWidth: 'none',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <LabBody />
    </div>
  );
});
