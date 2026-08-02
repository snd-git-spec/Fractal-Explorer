import { useEffect, useRef } from 'react';
import { useFractalRenderer } from '@/hooks/useFractalRenderer';
import { setRecordCanvas } from '@/recorder/fractalRecorder';

export function FractalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useFractalRenderer(canvasRef);

  useEffect(() => {
    setRecordCanvas(canvasRef.current);
    return () => setRecordCanvas(null);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full touch-none cursor-grab active:cursor-grabbing"
    />
  );
}
