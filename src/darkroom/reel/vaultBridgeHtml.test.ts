import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const shellDir = join(process.cwd(), 'public/reel-shell')

describe('reel-shell vault-bridge wiring', () => {
  it('loads vault-bridge before content.js on every scene html', () => {
    const htmlFiles = readdirSync(shellDir).filter((f) => f.endsWith('.html'))
    const withContent = htmlFiles.filter((f) => readFileSync(join(shellDir, f), 'utf8').includes('content.js'))
    expect(withContent.length).toBeGreaterThan(5)
    for (const file of withContent) {
      const html = readFileSync(join(shellDir, file), 'utf8')
      const bridge = html.indexOf('<script src="vault-bridge.js"')
      const content = html.indexOf('<script src="content.js')
      expect(bridge, file).toBeGreaterThanOrEqual(0)
      expect(content, file).toBeGreaterThanOrEqual(0)
      expect(bridge, file).toBeLessThan(content)
    }
  })

  it('keeps site entry on / and only embeds reel-shell', () => {
    const index = readFileSync(join(shellDir, 'index.html'), 'utf8')
    expect(index).toContain("location.replace('/')")
    expect(index).toContain('vault-content')
    expect(index).toContain('__vault')
  })
})
