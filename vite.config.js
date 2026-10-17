import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:8080', ws: true } },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    target: 'es2020',
  },
});
