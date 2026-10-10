/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The lazy Stage chunk carries three.js (~1.15 MB raw); the index-*.js gzip budget is checked separately.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    experimental: {
      // The per-file jsdom hints suggest fixes that don't fit: pool 'vmThreads' has no crypto.subtle (vault tests fail),
      // and isolate: false would let module-level state (prefs cache, sound context, warn-once flags) leak between files.
      diagnostics: { environment: false, isolate: false },
    },
  },
})
