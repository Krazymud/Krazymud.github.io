import { access, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'

export interface AudioClip {
  name: string
  source: string
  start: number
  end: number
  fadeIn: number
  fadeOut: number
  loudness: number
}

export const MAX_CLIP_BYTES = 150 * 1024
export const MAX_TOTAL_BYTES = 250 * 1024

export class AudioError extends Error {
  name = 'AudioError'
}

const round = (value: number) => Math.round(value * 1000) / 1000

export function validateClips(clips: readonly AudioClip[]): void {
  const names = new Set<string>()
  for (const clip of clips) {
    if (names.has(clip.name)) throw new AudioError(`音效名重复：${clip.name}`)
    names.add(clip.name)
    const length = clip.end - clip.start
    if (clip.start < 0 || length <= 0) throw new AudioError(`${clip.name}：截取范围不对（${clip.start}–${clip.end} 秒）`)
    if (clip.fadeIn < 0 || clip.fadeOut < 0 || clip.fadeIn + clip.fadeOut > length) {
      throw new AudioError(`${clip.name}：淡入淡出比片段还长`)
    }
  }
}

export function ffmpegArgs(clip: AudioClip, input: string, output: string): string[] {
  const length = round(clip.end - clip.start)
  const filters = [
    ...(clip.fadeIn > 0 ? [`afade=t=in:st=0:d=${clip.fadeIn}`] : []),
    ...(clip.fadeOut > 0 ? [`afade=t=out:st=${round(length - clip.fadeOut)}:d=${clip.fadeOut}`] : []),
    `loudnorm=I=${clip.loudness}:TP=-1.5:LRA=11`,
  ]
  return [
    '-v', 'error', '-y',
    '-ss', String(clip.start), '-t', String(length),
    '-i', input,
    '-af', filters.join(','),
    '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', '-f', 'mp3',
    output,
  ]
}

export interface RunAudioOptions {
  sourceDir: string
  outDir: string
  clips: readonly AudioClip[]
  encode: (args: string[]) => Promise<void>
  log: (line: string) => void
}

export async function runAudio({ sourceDir, outDir, clips, encode, log }: RunAudioOptions): Promise<{ name: string; bytes: number }[]> {
  validateClips(clips)
  for (const clip of clips) {
    const input = path.join(sourceDir, clip.source)
    try {
      await access(input)
    } catch {
      throw new AudioError(`找不到 ${input}：请把音效源文件放到 ${sourceDir} 下，文件名见 scripts/audio.config.ts`)
    }
  }
  const jobs = clips.map((clip) => {
    const out = path.join(outDir, `${clip.name}.mp3`)
    return { clip, out, tmp: `${out}.tmp`, bytes: 0 }
  })
  try {
    for (const job of jobs) {
      await encode(ffmpegArgs(job.clip, path.join(sourceDir, job.clip.source), job.tmp))
      job.bytes = (await stat(job.tmp)).size
      if (job.bytes > MAX_CLIP_BYTES) {
        throw new AudioError(`${job.clip.name}：${(job.bytes / 1024).toFixed(0)} KB，超过 ${MAX_CLIP_BYTES / 1024} KB`)
      }
      log(`已处理 ${job.clip.name}（${(job.bytes / 1024).toFixed(1)} KB）`)
    }
    const total = jobs.reduce((sum, job) => sum + job.bytes, 0)
    if (total > MAX_TOTAL_BYTES) throw new AudioError(`音效合计 ${(total / 1024).toFixed(0)} KB，超过 ${MAX_TOTAL_BYTES / 1024} KB`)
  } catch (error) {
    await Promise.all(jobs.map((job) => unlink(job.tmp).catch(() => undefined)))
    throw error
  }
  for (const job of jobs) await rename(job.tmp, job.out)
  return jobs.map((job) => ({ name: job.clip.name, bytes: job.bytes }))
}
