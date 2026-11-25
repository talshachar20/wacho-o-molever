import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone static client-side app — no backend, no API proxying needed.
// base: './' keeps asset paths relative so the build can be dropped on any
// static host (file://, a subfolder on nginx, GitHub Pages, etc.) without
// extra config.
export default defineConfig({
  base: './',
  plugins: [react()],
});
