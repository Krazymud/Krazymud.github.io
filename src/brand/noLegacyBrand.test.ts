import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

const BANNED: { label: string; pattern: RegExp }[] = [
  { label: 'Midnight Garage', pattern: /Midnight Garage/i },
  { label: 'PRIVATE VAULT', pattern: /PRIVATE VAULT/ },
  { label: 'WELCOME BACK', pattern: /WELCOME BACK/ },
  { label: 'MIDNIGHT GARAGE', pattern: /MIDNIGHT GARAGE/ },
]

const SKIP_FILES = new Set(['config/copy.ts'])

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      listSourceFiles(path, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (/\.test\.(ts|tsx)$/.test(name)) continue
    const rel = relative(SRC, path).replace(/\\/g, '/')
    if (SKIP_FILES.has(rel)) continue
    out.push(path)
  }
  return out
}

/** Drop comment-only lines and midnight-garage storage key literals (legacy keys, not user copy). */
function scannableLines(source: string): string[] {
  return source.split('\n').filter((line) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//')) return false
    if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.endsWith('*/')) return false
    if (/midnight-garage/.test(line) && !BANNED.some(({ pattern }) => pattern.test(line))) return false
    return true
  })
}

describe('no legacy brand strings in src', () => {
  it('does not expose Midnight Garage / vault-era English in application source', () => {
    const hits: string[] = []
    for (const file of listSourceFiles(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, '/')
      const body = scannableLines(readFileSync(file, 'utf8')).join('\n')
      for (const { label, pattern } of BANNED) {
        if (pattern.test(body)) hits.push(`${rel} (${label})`)
      }
    }
    expect(hits, hits.join('\n')).toEqual([])
  })
})
