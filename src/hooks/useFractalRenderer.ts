import { useEffect, useState } from 'react';
import { FractalRenderer } from '@/renderer/FractalRenderer';
import { useExplorerStore } from '@/state/ExplorerStore';

export function useFractalRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const store = useExplorerStore;
  const [shaderEpoch, setShaderEpoch] = useState(0);

  useEffect(() => {
    const onHot = () => setShaderEpoch((n) => n + 1);
    window.addEventListener('fractal-shader-hmr', onHot);
    return () => window.removeEventListener('fractal-shader-hmr', onHot);
  }, []);

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
      if (err.message.includes('WebGL not supported')) {
        alert('WebGL not supported');
      } else if (err.message.includes('Shader compile error') || err.message.includes('Program link error')) {
        alert(`Shader Error: ${err.message}`);
      } else {
        alert(`Renderer Error: ${err.message}`);
      }
    });

    return () => {
      cancelled = true;
      renderer.dispose();
    };
  }, [canvasRef, store, shaderEpoch]);
}
