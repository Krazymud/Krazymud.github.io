import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const MAX_MP4_BYTES = 4.5 * 1024 * 1024

describe('fc-drive-loop.mp4', () => {
  it('places moov before mdat so iPhone can progressive-play past frame 0', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'public/sketch/fc-drive-loop.mp4'))
    const moov = bytes.indexOf(Buffer.from('moov'))
    const mdat = bytes.indexOf(Buffer.from('mdat'))
    expect(moov).toBeGreaterThanOrEqual(0)
    expect(mdat).toBeGreaterThanOrEqual(0)
    expect(moov).toBeLessThan(mdat)
  })

  it('stays under the mobile start-up size budget', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'public/sketch/fc-drive-loop.mp4'))
    expect(bytes.byteLength).toBeLessThanOrEqual(MAX_MP4_BYTES)
  })
})
