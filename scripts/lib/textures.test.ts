// @vitest-environment node
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { MAX_TEXTURE_BYTES, runTextures, TextureError, type TextureJob } from './textures.ts'

async function sandbox() {
  const root = await mkdtemp(path.join(tmpdir(), 'textures-'))
  const sourceDir = path.join(root, 'src')
  const outDir = path.join(root, 'out')
  await Promise.all([mkdir(sourceDir), mkdir(outDir)])
  return { sourceDir, outDir }
}

async function noise(file: string, size: number) {
  const raw = Buffer.alloc(size * size * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24
  await sharp(raw, { raw: { width: size, height: size, channels: 3 } }).jpeg().toFile(file)
}

const job = (name: string, source: string): TextureJob => ({ name, source, size: 64, quality: 80 })

describe('runTextures', () => {
  it('writes square webp files at the asked size', async () => {
    const { sourceDir, outDir } = await sandbox()
    await noise(path.join(sourceDir, 'a.jpg'), 128)
    const results = await runTextures({ sourceDir, outDir, jobs: [job('floor_diff', 'a.jpg')], log: () => {} })
    expect(results.map((r) => r.name)).toEqual(['floor_diff'])
    const meta = await sharp(path.join(outDir, 'floor_diff.webp')).metadata()
    expect(meta).toMatchObject({ format: 'webp', width: 64, height: 64 })
  })

  it('names the missing source file', async () => {
    const { sourceDir, outDir } = await sandbox()
    await expect(runTextures({ sourceDir, outDir, jobs: [job('x', 'nope.jpg')], log: () => {} })).rejects.toThrow(TextureError)
    await expect(runTextures({ sourceDir, outDir, jobs: [job('x', 'nope.jpg')], log: () => {} })).rejects.toThrow(/nope\.jpg/)
  })

  it('rejects a texture over the size limit and writes nothing', async () => {
    const { sourceDir, outDir } = await sandbox()
    await noise(path.join(sourceDir, 'a.jpg'), 64)
    await noise(path.join(sourceDir, 'big.jpg'), 1024)
    const jobs = [job('ok', 'a.jpg'), { name: 'big', source: 'big.jpg', size: 1024, quality: 100 }]
    await expect(runTextures({ sourceDir, outDir, jobs, log: () => {} })).rejects.toThrow(new RegExp(`${MAX_TEXTURE_BYTES / 1024} KB`))
    expect(await readdir(outDir)).toEqual([])
  })

  it('rejects duplicate names', async () => {
    const { sourceDir, outDir } = await sandbox()
    await noise(path.join(sourceDir, 'a.jpg'), 64)
    await expect(runTextures({ sourceDir, outDir, jobs: [job('a', 'a.jpg'), job('a', 'a.jpg')], log: () => {} })).rejects.toThrow(TextureError)
  })

  it('removes textures that are no longer configured', async () => {
    const { sourceDir, outDir } = await sandbox()
    await noise(path.join(sourceDir, 'a.jpg'), 64)
    await writeFile(path.join(outDir, 'old.webp'), 'x')
    await runTextures({ sourceDir, outDir, jobs: [job('a', 'a.jpg')], log: () => {} })
    expect(await readdir(outDir)).toEqual(['a.webp'])
  })
})
