/// <reference types="vitest/config" />
import fs from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Dev-only: browser agent logs POST here → /opt/cursor/logs/debug.log (NDJSON). */
function agentDebugIngest(): Plugin {
  const logPath = '/opt/cursor/logs/debug.log'
  return {
    name: 'agent-debug-ingest',
    configureServer(server) {
      server.middlewares.use('/__debug_ingest', (req, res, next) => {
        if (req.method !== 'POST') return next()
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          try {
            const line = Buffer.concat(chunks).toString('utf8').trim()
            if (line) fs.appendFileSync(logPath, `${line}\n`)
          } catch {
            // Ignore log write failures during instrumentation.
          }
          res.statusCode = 204
          res.end()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), agentDebugIngest()],
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
