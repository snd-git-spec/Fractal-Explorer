import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { wgslVitePlugin } from '@vgpu/wgsl/loader-vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), wgslVitePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        vgpuHyperbolic: path.resolve(__dirname, 'vgpu-hyperbolic.html'),
      },
      output: {
        manualChunks: {
          renderer: [
            './src/renderer/FractalRenderer.ts',
            './src/renderer/ShaderCache.ts',
          ],
        },
      },
    },
  },
});
