import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { playableBuild } from './scripts/build-validation.js'
import { localMraidFallback, localCreativePreview } from './scripts/local-preview.js'
import { base64Packaging } from './src/hooks/base64Packaging.js'
import { offlinePhaser } from './scripts/offline-phaser.js'

export default defineConfig({
  plugins: [offlinePhaser(), localMraidFallback(), localCreativePreview(), viteSingleFile(), playableBuild(), base64Packaging()],
  optimizeDeps: { exclude: ['phaser'] },
  build: {
    assetsInlineLimit: () => true,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife' } },
  },
  esbuild: { pure: ['console.error'] },
})
