import { defineConfig } from 'vite';

// ビルドごとの ID。公開版（GitHub Pages など）は version.json と比べて、古いページのままなら読み直す
const BUILD_ID = Date.now().toString(36);

export default defineConfig(({ mode }) => ({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [{
    name: 'build-version',
    apply: 'build',
    generateBundle() {
      if (mode !== 'artifact') this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
    },
  }],
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
