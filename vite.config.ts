/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { PREFS_KEY } from './src/prefs/key.ts'
import { earlyFetchScript, STAGE_ASSET_PATHS } from './src/scene/stageAssets.ts'

function earlyStageFetch(): Plugin {
  let base = '/'
  return {
    name: 'early-stage-fetch',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        const chunks = Object.values(bundle ?? {}).filter((output) => output.type === 'chunk')
        const stage = chunks.find((chunk) => chunk.facadeModuleId?.endsWith('/src/scene/three/Stage.tsx'))
        const main = chunks.find((chunk) => chunk.isEntry)
        const script = earlyFetchScript({
          prefsKey: PREFS_KEY,
          urls: STAGE_ASSET_PATHS.map((path) => base + path),
          stageScript: stage && base + stage.fileName,
          mainScript: main && base + main.fileName,
        })
        return [{ tag: 'script', children: script, injectTo: 'head' }]
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), earlyStageFetch()],
  build: {
    // The lazy Stage chunk carries three.js (~1.15 MB raw); the index-*.js gzip budget is checked separately.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Stylesheets are stubbed out in tests unless included; `?raw` imports let tests read the source.
    css: { include: [/\.css\?raw$/] },
    experimental: {
      // The per-file jsdom hints suggest fixes that don't fit: pool 'vmThreads' has no crypto.subtle (vault tests fail),
      // and isolate: false would let module-level state (prefs cache, sound context, warn-once flags) leak between files.
      diagnostics: { environment: false, isolate: false },
    },
  },
})
