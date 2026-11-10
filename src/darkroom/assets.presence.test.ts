import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('darkroom public assets', () => {
  it('ships wood texture', () => {
    expect(existsSync(path.join(process.cwd(), 'public/darkroom/wood.jpg'))).toBe(true)
  })

  it('ships at least one self-hosted darkroom font', () => {
    const fontsDir = path.join(process.cwd(), 'public/darkroom/fonts')
    expect(existsSync(path.join(fontsDir, 'fraunces-normal.woff2'))).toBe(true)
  })
})
