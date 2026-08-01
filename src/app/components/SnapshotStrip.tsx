import { memo } from 'react';
import { getSnapshots } from '@/fractals/instruments';
import { useExplorerStore } from '@/state/ExplorerStore';

export const SnapshotStrip = memo(function SnapshotStrip() {
  const fractalId = useExplorerStore((s) => s.fractalId);
  const applySnapshot = useExplorerStore((s) => s.applySnapshot);
  const snapshots = getSnapshots(fractalId);

  if (snapshots.length === 0) return null;

  return (
    <div className="mt-[4px]">
      <div
        className="flex flex-nowrap gap-[2px] overflow-x-auto pb-[1px] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', touchAction: 'pan-x' }}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {snapshots.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => applySnapshot(s.name)}
            className="hud-fractal-name shrink-0 min-h-[24px] text-[9px] tracking-[0.5px] px-[6px] py-[3px] cursor-pointer"
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
});
