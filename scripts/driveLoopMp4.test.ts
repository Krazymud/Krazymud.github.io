import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const MAX_MOBILE_MP4_BYTES = 4.5 * 1024 * 1024

function atomOffsets(relPath: string) {
  const bytes = readFileSync(resolve(process.cwd(), relPath))
  return {
    bytes,
    moov: bytes.indexOf('moov'),
    mdat: bytes.indexOf('mdat'),
  }
}

describe('fc-drive-loop.mp4 (desktop)', () => {
  it('places moov before mdat so progressive play works', () => {
    const { moov, mdat } = atomOffsets('public/sketch/fc-drive-loop.mp4')
    expect(moov).toBeGreaterThanOrEqual(0)
    expect(mdat).toBeGreaterThanOrEqual(0)
    expect(moov).toBeLessThan(mdat)
  })
})

describe('fc-drive-loop-mobile.mp4', () => {
  it('places moov before mdat so iPhone can progressive-play past frame 0', () => {
    const { moov, mdat } = atomOffsets('public/sketch/fc-drive-loop-mobile.mp4')
    expect(moov).toBeGreaterThanOrEqual(0)
    expect(mdat).toBeGreaterThanOrEqual(0)
    expect(moov).toBeLessThan(mdat)
  })

  it('stays under the mobile start-up size budget', () => {
    const { bytes } = atomOffsets('public/sketch/fc-drive-loop-mobile.mp4')
    expect(bytes.byteLength).toBeLessThanOrEqual(MAX_MOBILE_MP4_BYTES)
  })
})
