# vgpu Hyperbolic Kaleidoscope sketch

Standalone WebGPU port of Fractal Explorer's Hyperbolic Kaleidoscope DE,
built on the official vgpu `raymarched-fractal` pipeline (HDR bloom + drag orbit).

## Run

From the project root (with the main Vite server):

```bash
npm run dev
```

Open: [http://localhost:5173/vgpu-hyperbolic.html](http://localhost:5173/vgpu-hyperbolic.html)

Requires a browser with WebGPU (Chrome/Edge recommended).

## What's different from the main app

| Main explorer | This sketch |
|---|---|
| WebGL + GLSL | WebGPU + WGSL via vgpu |
| Shared footer lighting | Dedicated neon + AO + bloom |
| Auto-evolve morph stack | Light time morph of `sphR` / offset / twist |
| Full HUD | Drag orbit + slow auto spin |

The distance estimator is the same Knighty-style IFS:
`icosa folds → sphere inversion → scale`, surface = `length(p)/DEf`.
