import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built bundle also works from file:// inside a
  // Capacitor WebView, not just from a web server root.
  base: './',
  build: { outDir: 'dist', sourcemap: true },
});
