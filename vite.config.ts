import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: lo stesso build funziona su GitHub Pages, Vercel o file://
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist', sourcemap: false },
});
