# Fractal Explorer

Interactive 3D fractal raymarcher with modular renderer architecture.

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173

## Architecture

- `src/renderer/` — WebGL engine (no React imports)
- `src/fractals/` — fractal metadata and camera presets
- `src/state/` — Zustand store for UI state
- `src/app/components/` — thin React HUD shell

Each fractal has its own GLSL shader file, lazy-loaded and cached on selection.
