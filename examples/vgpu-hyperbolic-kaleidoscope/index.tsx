"use client";

import { useEffect, useRef } from "react";
import { createRenderer } from "./renderer";

export function Example() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createRenderer({ canvas });
    void renderer.ready.catch((err) => {
      console.error("[vgpu-hyperbolic]", err);
      const msg = document.createElement("pre");
      msg.textContent = String(err instanceof Error ? err.stack ?? err.message : err);
      msg.style.cssText =
        "position:fixed;inset:12px;color:#f88;font:12px/1.4 monospace;white-space:pre-wrap;z-index:9";
      document.body.appendChild(msg);
    });
    return () => renderer.dispose();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        touchAction: "none",
      }}
    />
  );
}

export default Example;
