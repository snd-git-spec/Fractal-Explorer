import { useEffect, useState } from 'react';
import type { CameraState } from '@/fractals/types';
import { useExplorerStore } from '@/state/ExplorerStore';

export function useThrottledCamera(intervalMs = 100): CameraState {
  const runtime = useExplorerStore((s) => s.runtime);
  const [camera, setCamera] = useState(() => ({ ...runtime.cur }));

  useEffect(() => {
    const id = window.setInterval(() => {
      // Prefer smoothed cur — matches what is on screen during auto-evolve
      setCamera({ ...runtime.cur });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [runtime, intervalMs]);

  return camera;
}
