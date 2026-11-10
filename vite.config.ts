/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The lazy Stage chunk carries three.js (~1.15 MB raw); the index-*.js gzip budget is checked separately.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    // Node resolves these packages to their CJS entries, and three.cjs warns THREE_CJS_DEPRECATED; force the ESM builds.
    alias: [
      { find: /^@react-three\/fiber$/, replacement: fileURLToPath(new URL('./node_modules/@react-three/fiber/dist/react-three-fiber.esm.js', import.meta.url)) },
    ],
    server: { deps: { inline: [/@react-three\/fiber/, /@react-three\/drei/, /^three$/] } },
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
