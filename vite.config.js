import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  server: {
    port: 5173,
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:8080', ws: true } },
  },
  build: {
    outDir: mode === 'artifact' ? 'dist-artifact' : 'dist',
    chunkSizeWarningLimit: 2000,
    target: 'es2020',
    // アーティファクト版は 1 ファイルにまとめて HTML へインライン化する
    rollupOptions: mode === 'artifact' ? { output: { inlineDynamicImports: true } } : {},
  },
}));
