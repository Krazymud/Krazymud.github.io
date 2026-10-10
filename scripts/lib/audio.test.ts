// @vitest-environment node
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AudioError, ffmpegArgs, MAX_CLIP_BYTES, MAX_TOTAL_BYTES, runAudio, validateClips, type AudioClip } from './audio.ts'

const clip = (overrides: Partial<AudioClip> = {}): AudioClip => ({
  name: 'rev',
  source: 'rev.mp3',
  start: 6,
  end: 8.9,
  fadeIn: 0.03,
  fadeOut: 0.4,
  loudness: -16,
  ...overrides,
})

async function sandbox(sources: string[]) {
  const root = await mkdtemp(path.join(tmpdir(), 'audio-'))
  const sourceDir = path.join(root, 'src')
  const outDir = path.join(root, 'out')
  await Promise.all([mkdir(sourceDir), mkdir(outDir)])
  for (const name of sources) await writeFile(path.join(sourceDir, name), 'x')
  return { sourceDir, outDir }
}

const fakeEncode = (bytes: number) => async (args: string[]) => {
  await writeFile(args[args.length - 1], Buffer.alloc(bytes))
}

describe('audio clips', () => {
  it('rejects bad ranges, long fades and duplicate names', () => {
    expect(() => validateClips([clip({ end: 6 })])).toThrow(AudioError)
    expect(() => validateClips([clip({ start: -1 })])).toThrow(AudioError)
    expect(() => validateClips([clip({ fadeIn: 2, fadeOut: 2 })])).toThrow(AudioError)
    expect(() => validateClips([clip({ fadeIn: 2, fadeOut: 2 })])).toThrow(/淡入淡出/)
    expect(() => validateClips([clip(), clip()])).toThrow(AudioError)
    expect(() => validateClips([clip(), clip()])).toThrow(/重复/)
    expect(() => validateClips([clip(), clip({ name: 'blip' })])).not.toThrow()
  })

  it('rejects numbers that are not finite', () => {
    for (const bad of [{ start: Number.NaN }, { end: Number.POSITIVE_INFINITY }, { fadeOut: Number.NaN }, { loudness: Number.NaN }]) {
      expect(() => validateClips([clip(bad)])).toThrow(AudioError)
    }
  })

  it('cuts, fades, levels and encodes mono MP3', () => {
    const args = ffmpegArgs(clip(), 'in.mp3', 'out.tmp')
    expect(args.slice(args.indexOf('-ss'), args.indexOf('-ss') + 4)).toEqual(['-ss', '6', '-t', '2.9'])
    const filters = args[args.indexOf('-af') + 1]
    expect(filters).toBe('afade=t=in:st=0:d=0.03,afade=t=out:st=2.5:d=0.4,loudnorm=I=-16:TP=-1.5:LRA=11')
    expect(args).toEqual(expect.arrayContaining(['-ac', '1', '-b:a', '96k', '-f', 'mp3']))
    expect(args[args.length - 1]).toBe('out.tmp')
  })

  it('leaves out a zero-length fade', () => {
    const filters = ffmpegArgs(clip({ fadeIn: 0 }), 'in.mp3', 'out.tmp')
    expect(filters[filters.indexOf('-af') + 1]).not.toContain('t=in')
  })
})

describe('runAudio', () => {
  it('says where to put a missing source file', async () => {
    const { sourceDir, outDir } = await sandbox([])
    const run = () => runAudio({ sourceDir, outDir, clips: [clip()], encode: fakeEncode(10), log: () => {} })
    await expect(run()).rejects.toThrow(AudioError)
    await expect(run()).rejects.toThrow(/rev\.mp3/)
  })

  it('writes every clip and reports its size', async () => {
    const { sourceDir, outDir } = await sandbox(['rev.mp3'])
    const result = await runAudio({ sourceDir, outDir, clips: [clip(), clip({ name: 'blip', start: 10, end: 11.2 })], encode: fakeEncode(1000), log: () => {} })
    expect(result).toEqual([
      { name: 'rev', bytes: 1000 },
      { name: 'blip', bytes: 1000 },
    ])
    expect((await readdir(outDir)).sort()).toEqual(['blip.mp3', 'rev.mp3'])
  })

  it('writes nothing when a clip is too big', async () => {
    const { sourceDir, outDir } = await sandbox(['rev.mp3'])
    const run = () => runAudio({ sourceDir, outDir, clips: [clip()], encode: fakeEncode(MAX_CLIP_BYTES + 1), log: () => {} })
    await expect(run()).rejects.toThrow(AudioError)
    await expect(run()).rejects.toThrow(/rev/)
    expect(await readdir(outDir)).toEqual([])
  })

  it('writes nothing when the clips together are too big', async () => {
    const { sourceDir, outDir } = await sandbox(['rev.mp3'])
    const clips = [clip(), clip({ name: 'blip', start: 10, end: 11.2 })]
    const run = () => runAudio({ sourceDir, outDir, clips, encode: fakeEncode(MAX_TOTAL_BYTES / 2 + 1), log: () => {} })
    await expect(run()).rejects.toThrow(AudioError)
    await expect(run()).rejects.toThrow(/合计/)
    expect(await readdir(outDir)).toEqual([])
  })

  it('cleans up the first clip when the second one fails to encode', async () => {
    const { sourceDir, outDir } = await sandbox(['rev.mp3'])
    let calls = 0
    const encode = async (args: string[]) => {
      if (++calls === 2) throw new Error('ffmpeg crashed')
      await fakeEncode(1000)(args)
    }
    const clips = [clip(), clip({ name: 'blip', start: 10, end: 11.2 })]
    await expect(runAudio({ sourceDir, outDir, clips, encode, log: () => {} })).rejects.toThrow(/ffmpeg crashed/)
    expect(await readdir(outDir)).toEqual([])
  })

  it('leaves no temporary file behind when a clip cannot be put in place', async () => {
    const { sourceDir, outDir } = await sandbox(['rev.mp3'])
    await mkdir(path.join(outDir, 'rev.mp3'))
    await writeFile(path.join(outDir, 'rev.mp3', 'keep'), '')
    await expect(runAudio({ sourceDir, outDir, clips: [clip()], encode: fakeEncode(1000), log: () => {} })).rejects.toThrow()
    expect(await readdir(outDir)).toEqual(['rev.mp3'])
  })

  it('removes old clips that are no longer configured and keeps other files', async () => {
    const { sourceDir, outDir } = await sandbox(['rev.mp3'])
    await writeFile(path.join(outDir, 'horn.mp3'), 'old')
    await writeFile(path.join(outDir, 'notes.txt'), 'keep')
    const lines: string[] = []
    await runAudio({ sourceDir, outDir, clips: [clip()], encode: fakeEncode(1000), log: (line) => lines.push(line) })
    expect((await readdir(outDir)).sort()).toEqual(['notes.txt', 'rev.mp3'])
    expect(lines.join('\n')).toContain('horn.mp3')
  })
})
