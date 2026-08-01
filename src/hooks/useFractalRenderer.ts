import { useEffect } from 'react';
import { FractalRenderer } from '@/renderer/FractalRenderer';
import { useExplorerStore } from '@/state/ExplorerStore';

export function useFractalRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const store = useExplorerStore;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new FractalRenderer(canvas, store);
    let cancelled = false;

    renderer.init().then(() => {
      if (cancelled) {
        renderer.dispose();
        return;
      }
      renderer.start();
    }).catch((err) => {
      console.error('Renderer init failed:', err);
      alert('WebGL not supported');
    });

    const onHot = () => {
      void renderer.reloadShaders();
    };
    window.addEventListener('fractal-shader-hmr', onHot);

    return () => {
      cancelled = true;
      window.removeEventListener('fractal-shader-hmr', onHot);
      renderer.dispose();
    };
  }, [canvasRef, store]);
}
