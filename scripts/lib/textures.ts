import { access, readdir, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export interface TextureJob {
  name: string
  source: string
  size: number
  quality: number
}

export const MAX_TEXTURE_BYTES = 150 * 1024
export const MAX_TEXTURES_TOTAL = 500 * 1024

export class TextureError extends Error {
  name = 'TextureError'
}

export interface RunTexturesOptions {
  sourceDir: string
  outDir: string
  jobs: readonly TextureJob[]
  log: (line: string) => void
}

export async function runTextures({ sourceDir, outDir, jobs, log }: RunTexturesOptions): Promise<{ name: string; bytes: number }[]> {
  const names = new Set<string>()
  for (const job of jobs) {
    if (names.has(job.name)) throw new TextureError(`贴图名重复：${job.name}`)
    names.add(job.name)
    const input = path.join(sourceDir, job.source)
    try {
      await access(input)
    } catch {
      throw new TextureError(`找不到 ${input}：请把贴图源文件放到 ${sourceDir} 下，文件名见 scripts/textures.config.ts`)
    }
  }
  const work = jobs.map((job) => {
    const out = path.join(outDir, `${job.name}.webp`)
    return { job, out, tmp: `${out}.tmp`, bytes: 0 }
  })
  try {
    for (const item of work) {
      await sharp(path.join(sourceDir, item.job.source))
        .resize(item.job.size, item.job.size)
        .webp({ quality: item.job.quality })
        .toFile(item.tmp)
      item.bytes = (await stat(item.tmp)).size
      if (item.bytes > MAX_TEXTURE_BYTES) {
        throw new TextureError(`${item.job.name}：${(item.bytes / 1024).toFixed(0)} KB，超过 ${MAX_TEXTURE_BYTES / 1024} KB`)
      }
      log(`已处理 ${item.job.name}（${(item.bytes / 1024).toFixed(1)} KB）`)
    }
    const total = work.reduce((sum, item) => sum + item.bytes, 0)
    if (total > MAX_TEXTURES_TOTAL) throw new TextureError(`贴图合计 ${(total / 1024).toFixed(0)} KB，超过 ${MAX_TEXTURES_TOTAL / 1024} KB`)
    for (const item of work) await rename(item.tmp, item.out)
  } catch (error) {
    await Promise.all(work.map((item) => unlink(item.tmp).catch(() => undefined)))
    throw error
  }
  const configured = new Set(work.map((item) => path.basename(item.out)))
  for (const name of await readdir(outDir)) {
    if (!name.endsWith('.webp') || configured.has(name)) continue
    await unlink(path.join(outDir, name))
    log(`已删除不再使用的 ${name}`)
  }
  return work.map((item) => ({ name: item.job.name, bytes: item.bytes }))
}
