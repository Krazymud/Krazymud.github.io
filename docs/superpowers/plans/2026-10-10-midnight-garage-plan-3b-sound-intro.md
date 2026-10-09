# 计划 3B：开场与音效 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首次访问的转速表开场（点「点火」进入车库、灯光闪亮）、关键时刻的真实录音音效、顶部静音开关。

**Architecture:** 音效由 `npm run audio`（ffmpeg）从 `assets-src/audio/` 截取成 4 个小 MP3 放进 `public/audio/`；`src/audio/sound.ts` 用 Web Audio API 播放，首次用户手势时创建 `AudioContext` 并下载解码。偏好增加 `muted`、`introSeen`。`src/scene/loading.ts` 发布加载进度（3D 代码块 30% + 资源 70%，静帧模式单独标记），`Intro` 覆盖层据此画转速表；点火时发 `ignition` 事件，3D 里由 `useIgnitionLevel` 把摄影棚灯光和车上发光材质从 0 闪到 1。

**Tech Stack:** React 19、TypeScript 6、Vitest 5（jsdom）、@react-three/fiber 9.8.1、@react-three/drei 10.7.9、three 0.186.1、ffmpeg-static 5.3.0（仅开发依赖）。

Spec: `docs/superpowers/specs/2026-10-10-midnight-garage-sound-intro-design.md`

## Global Constraints

- `three`、`@react-three/*`、`postprocessing` 只能在 `src/scene/three/` 内导入；主包不得引入 `three`；主包 gzip 小于 200 KB。
- 音频文件：每个不超过 150 KB，合计不超过 250 KB；只在第一次用户手势之后才下载。
- 任何声音错误都静默（只在开发模式 `console.warn`），不得影响页面。
- 偏好仍存在 `midnight-garage/prefs`，与学习进度分开；每个字段单独校验，坏值回退默认。
- 界面文案用中文；代码注释只写代码本身表达不了的约束。
- `ffmpeg-static` 精确版本 `5.3.0`，放在 `devDependencies`。
- 不提交 `assets-src/`；不推送；在分支 `feature/sound-intro` 上实施。
- 现有测试全部保持通过；`npx tsc -b` 无错误。

---

### Task 1: 偏好增加 `muted` 与 `introSeen`

**Files:**
- Modify: `src/prefs/prefs.ts`
- Test: `src/prefs/prefs.test.ts`, `src/pages/SettingsPage.test.tsx:58`

**Interfaces:**
- Produces: `Prefs { scene3d: boolean; muted: boolean; introSeen: boolean }`；`DEFAULT_PREFS = { scene3d: true, muted: false, introSeen: false }`。

- [ ] **Step 1: 改测试** — `src/prefs/prefs.test.ts`：

把 `'turns the 3D garage on by default'` 用例改为：

```ts
  it('turns the 3D garage and sound on, and has not shown the intro yet', () => {
    expect(getPrefs()).toEqual({ scene3d: true, muted: false, introSeen: false })
  })
```

把 `'saves the switch apart from the progress data'` 里的断言改为：

```ts
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ scene3d: false, muted: false, introSeen: false })
```

在 `'ignores damaged values'` 用例之后加：

```ts
  it('checks each field on its own', () => {
    localStorage.setItem(PREFS_KEY, '{"scene3d":false,"muted":"yes","introSeen":1}')
    expect(readPrefs()).toEqual({ scene3d: false, muted: false, introSeen: false })
    localStorage.setItem(PREFS_KEY, '{"muted":true,"introSeen":true}')
    expect(readPrefs()).toEqual({ scene3d: true, muted: true, introSeen: true })
  })
```

`src/pages/SettingsPage.test.tsx` 第 58 行改为：

```ts
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ scene3d: false, muted: false, introSeen: false })
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/prefs src/pages/SettingsPage.test.tsx`
Expected: FAIL（缺少 `muted`、`introSeen`）。

- [ ] **Step 3: 实现** — `src/prefs/prefs.ts` 中 `Prefs`、`DEFAULT_PREFS`、`readPrefs` 改为：

```ts
export interface Prefs {
  scene3d: boolean
  muted: boolean
  introSeen: boolean
}

export const DEFAULT_PREFS: Prefs = { scene3d: true, muted: false, introSeen: false }

export function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PREFS }
    const record = parsed as Record<string, unknown>
    const pick = (key: keyof Prefs): boolean => {
      const value = record[key]
      return typeof value === 'boolean' ? value : DEFAULT_PREFS[key]
    }
    return { scene3d: pick('scene3d'), muted: pick('muted'), introSeen: pick('introSeen') }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}
```

- [ ] **Step 4: 运行测试与类型检查**

Run: `npx vitest run src/prefs src/pages/SettingsPage.test.tsx` → PASS；`npx tsc -b` → 无错误；`npm test` → 全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/prefs/prefs.ts src/prefs/prefs.test.ts src/pages/SettingsPage.test.tsx
git commit -m "feat(prefs): mute and intro-seen preferences"
```

---

### Task 2: 音效处理脚本 `npm run audio`

**Files:**
- Create: `scripts/lib/audio.ts`, `scripts/lib/audio.test.ts`, `scripts/audio.config.ts`, `scripts/audio.ts`
- Modify: `package.json`（脚本 `audio`、devDependency `ffmpeg-static`）, `.gitattributes`
- Generate: `public/audio/ignition.mp3`, `public/audio/rev.mp3`, `public/audio/blip.mp3`, `public/audio/unlock.mp3`

**Interfaces:**
- Produces: `public/audio/<name>.mp3`，`name ∈ {ignition, rev, blip, unlock}`（Task 3 按此 URL 加载）。

源文件已由控制者放好（不提交）：`assets-src/audio/ignition.mp3`（Freesound #659560）、`assets-src/audio/rev.mp3`（#478756）、`assets-src/audio/unlock.mp3`（#396448）。

- [ ] **Step 1: 安装依赖**

Run: `npm install --save-dev --save-exact ffmpeg-static@5.3.0`
在 `package.json` 的 `scripts` 里 `"stills"` 之后加：`"audio": "tsx scripts/audio.ts"`。
`.gitattributes` 末尾加一行：`public/audio/** -text`

- [ ] **Step 2: 写失败测试** — `scripts/lib/audio.test.ts`：

```ts
// @vitest-environment node
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AudioError, ffmpegArgs, MAX_CLIP_BYTES, runAudio, validateClips, type AudioClip } from './audio.ts'

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
    expect(() => validateClips([clip({ fadeIn: 2, fadeOut: 2 })])).toThrow(/淡入淡出/)
    expect(() => validateClips([clip(), clip()])).toThrow(/重复/)
    expect(() => validateClips([clip(), clip({ name: 'blip' })])).not.toThrow()
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
    await expect(runAudio({ sourceDir, outDir, clips: [clip()], encode: fakeEncode(10), log: () => {} })).rejects.toThrow(/rev\.mp3/)
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
    await expect(
      runAudio({ sourceDir, outDir, clips: [clip()], encode: fakeEncode(MAX_CLIP_BYTES + 1), log: () => {} }),
    ).rejects.toThrow(/rev/)
    expect(await readdir(outDir)).toEqual([])
  })
})
```

- [ ] **Step 3: 运行，确认失败**

Run: `npx vitest run scripts/lib/audio.test.ts`
Expected: FAIL（`./audio.ts` 不存在）。

- [ ] **Step 4: 实现** — `scripts/lib/audio.ts`：

```ts
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
```

`scripts/audio.config.ts`：

```ts
import type { AudioClip } from './lib/audio.ts'

// assets-src/audio 里的源文件（Freesound，均为 CC0）：
// ignition.mp3 = #659560 EwanPenman11「Ferrari start up and drive off」
// rev.mp3 = #478756 richwise「Supercar rev」
// unlock.mp3 = #396448 hz37「Car Lock」
export const audioConfig: AudioClip[] = [
  { name: 'ignition', source: 'ignition.mp3', start: 20.3, end: 28.6, fadeIn: 0.05, fadeOut: 0.6, loudness: -16 },
  { name: 'rev', source: 'rev.mp3', start: 6.0, end: 8.9, fadeIn: 0.03, fadeOut: 0.4, loudness: -16 },
  { name: 'blip', source: 'rev.mp3', start: 10.0, end: 11.2, fadeIn: 0.03, fadeOut: 0.3, loudness: -18 },
  { name: 'unlock', source: 'unlock.mp3', start: 0, end: 0.6, fadeIn: 0, fadeOut: 0.05, loudness: -20 },
]
```

`scripts/audio.ts`：

```ts
import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import { audioConfig } from './audio.config.ts'
import { AudioError, runAudio } from './lib/audio.ts'

const SOURCE_DIR = 'assets-src/audio'
const OUT_DIR = 'public/audio'

const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string | null
const run = promisify(execFile)

try {
  if (!ffmpeg) throw new AudioError('ffmpeg-static 没有为这个平台提供 ffmpeg')
  await mkdir(OUT_DIR, { recursive: true })
  const results = await runAudio({
    sourceDir: SOURCE_DIR,
    outDir: OUT_DIR,
    clips: audioConfig,
    encode: async (args) => {
      await run(ffmpeg, args)
    },
    log: (line) => console.log(line),
  })
  const total = results.reduce((sum, result) => sum + result.bytes, 0)
  console.log(`已写入 ${OUT_DIR}（${results.length} 个，共 ${(total / 1024).toFixed(1)} KB）`)
} catch (error) {
  if (!(error instanceof AudioError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
```

- [ ] **Step 5: 运行测试与类型检查**

Run: `npx vitest run scripts/lib/audio.test.ts` → PASS；`npx tsc -b` → 无错误。

- [ ] **Step 6: 生成音效**

Run: `npm run audio`
Expected: 打印 4 行「已处理 …」和总计；`public/audio/` 下有 `ignition.mp3`、`rev.mp3`、`blip.mp3`、`unlock.mp3`，每个 ≤ 150 KB，合计 ≤ 250 KB。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitattributes scripts/lib/audio.ts scripts/lib/audio.test.ts scripts/audio.config.ts scripts/audio.ts public/audio
git commit -m "feat(audio): npm run audio cuts the CC0 recordings into four clips"
```

---

### Task 3: 声音模块 `src/audio/sound.ts`

**Files:**
- Create: `src/audio/sound.ts`, `src/audio/sound.test.ts`

**Interfaces:**
- Consumes: `getPrefs().muted`（Task 1）；`public/audio/<name>.mp3`（Task 2）。
- Produces:
  - `type SoundName = 'ignition' | 'rev' | 'blip' | 'unlock'`
  - `unlockAudio(): void`
  - `play(name: SoundName): Promise<void>`
  - `stopAll(): void`
  - `soundUrl(name: SoundName): string`
  - `READY_TIMEOUT_MS = 1500`
  - 测试用：`setAudioContextFactory(factory: (() => AudioContext) | null): void`、`resetSound(): void`

- [ ] **Step 1: 写失败测试** — `src/audio/sound.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPrefsCache, setPrefs } from '../prefs/prefs'
import { play, READY_TIMEOUT_MS, resetSound, setAudioContextFactory, soundUrl, stopAll, unlockAudio } from './sound'

interface FakeSource {
  buffer: unknown
  onended: (() => void) | null
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

function fakeAudio(decode: (bytes: ArrayBuffer) => Promise<unknown> = async (bytes) => ({ bytes })) {
  const sources: FakeSource[] = []
  const context = {
    state: 'suspended',
    destination: {},
    resume: vi.fn(async () => undefined),
    decodeAudioData: vi.fn(decode),
    createBufferSource: () => {
      const source: FakeSource = { buffer: null, onended: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
      sources.push(source)
      return source
    },
  }
  const factory = vi.fn(() => context as unknown as AudioContext)
  setAudioContextFactory(factory)
  return { context, factory, sources }
}

describe('sound', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPrefsCache()
    resetSound()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ArrayBuffer(8))))
  })
  afterEach(() => {
    resetSound()
    setAudioContextFactory(null)
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('stays silent before the first tap', async () => {
    const { factory, sources } = fakeAudio()
    await play('rev')
    expect(factory).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(sources).toHaveLength(0)
  })

  it('creates one context on the first tap, resumes it and fetches every clip', async () => {
    const { context, factory } = fakeAudio()
    unlockAudio()
    unlockAudio()
    expect(factory).toHaveBeenCalledTimes(1)
    expect(context.resume).toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      '/audio/ignition.mp3',
      '/audio/rev.mp3',
      '/audio/blip.mp3',
      '/audio/unlock.mp3',
    ])
    expect(soundUrl('rev')).toBe('/audio/rev.mp3')
  })

  it('plays a clip after the first tap', async () => {
    const { sources } = fakeAudio()
    unlockAudio()
    await play('rev')
    expect(sources).toHaveLength(1)
    expect(sources[0].start).toHaveBeenCalled()
    expect(sources[0].buffer).not.toBeNull()
    expect(sources[0].connect).toHaveBeenCalled()
  })

  it('stays silent when muted', async () => {
    const { sources } = fakeAudio()
    setPrefs({ muted: true })
    unlockAudio()
    await play('rev')
    expect(sources).toHaveLength(0)
  })

  it('swallows a clip that cannot be decoded', async () => {
    const { sources } = fakeAudio(async () => {
      throw new Error('bad mp3')
    })
    unlockAudio()
    await expect(play('unlock')).resolves.toBeUndefined()
    expect(sources).toHaveLength(0)
  })

  it('gives up on a clip that is not ready in time', async () => {
    vi.useFakeTimers()
    const { sources } = fakeAudio(() => new Promise(() => {}))
    unlockAudio()
    const playing = play('ignition')
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS)
    await playing
    expect(sources).toHaveLength(0)
  })

  it('restarts a clip instead of layering it', async () => {
    const { sources } = fakeAudio()
    unlockAudio()
    await play('rev')
    await play('rev')
    expect(sources).toHaveLength(2)
    expect(sources[0].stop).toHaveBeenCalled()
    expect(sources[1].stop).not.toHaveBeenCalled()
  })

  it('stops everything at once', async () => {
    const { sources } = fakeAudio()
    unlockAudio()
    await play('rev')
    await play('unlock')
    stopAll()
    expect(sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true)
  })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/audio`
Expected: FAIL（`./sound` 不存在）。

- [ ] **Step 3: 实现** — `src/audio/sound.ts`：

```ts
import { getPrefs } from '../prefs/prefs'

export type SoundName = 'ignition' | 'rev' | 'blip' | 'unlock'

const SOUND_NAMES: readonly SoundName[] = ['ignition', 'rev', 'blip', 'unlock']
export const READY_TIMEOUT_MS = 1500

type ContextFactory = () => AudioContext

const defaultFactory: ContextFactory = () => new AudioContext()
let createContext: ContextFactory = defaultFactory
let context: AudioContext | null = null
const buffers = new Map<SoundName, Promise<AudioBuffer>>()
const playing = new Map<SoundName, AudioBufferSourceNode>()

function warn(error: unknown): void {
  if (import.meta.env.DEV) console.warn('[sound]', error)
}

export function soundUrl(name: SoundName): string {
  return `${import.meta.env.BASE_URL}audio/${name}.mp3`
}

async function load(ctx: AudioContext, name: SoundName): Promise<AudioBuffer> {
  const response = await fetch(soundUrl(name))
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
  return ctx.decodeAudioData(await response.arrayBuffer())
}

export function unlockAudio(): void {
  try {
    if (context === null) {
      const ctx = createContext()
      context = ctx
      for (const name of SOUND_NAMES) {
        const buffer = load(ctx, name)
        buffer.catch(warn)
        buffers.set(name, buffer)
      }
    }
    if (context.state === 'suspended') context.resume().catch(warn)
  } catch (error) {
    warn(error)
  }
}

function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function stop(name: SoundName): void {
  const source = playing.get(name)
  if (!source) return
  playing.delete(name)
  try {
    source.stop()
  } catch (error) {
    warn(error)
  }
}

export async function play(name: SoundName): Promise<void> {
  const ctx = context
  const buffer = buffers.get(name)
  if (ctx === null || buffer === undefined || getPrefs().muted) return
  try {
    const ready = await within(buffer, READY_TIMEOUT_MS)
    if (ready === null || context !== ctx || getPrefs().muted) return
    stop(name)
    const source = ctx.createBufferSource()
    source.buffer = ready
    source.connect(ctx.destination)
    source.onended = () => {
      if (playing.get(name) === source) playing.delete(name)
    }
    playing.set(name, source)
    source.start()
  } catch (error) {
    warn(error)
  }
}

export function stopAll(): void {
  for (const name of [...playing.keys()]) stop(name)
}

export function setAudioContextFactory(factory: ContextFactory | null): void {
  createContext = factory ?? defaultFactory
}

export function resetSound(): void {
  stopAll()
  context = null
  buffers.clear()
}
```

- [ ] **Step 4: 运行测试与类型检查**

Run: `npx vitest run src/audio` → PASS；`npx tsc -b` → 无错误。

- [ ] **Step 5: Commit**

```bash
git add src/audio
git commit -m "feat(audio): Web Audio player that waits for a tap and never throws"
```

---

### Task 4: 加载进度仓库、点火事件、Stage 进度回调

**Files:**
- Create: `src/scene/loading.ts`, `src/scene/loading.test.ts`
- Modify: `src/scene/events.ts`, `src/scene/events.test.ts`, `src/scene/types.ts`, `src/scene/three/Stage.tsx`, `src/scene/SceneHost.tsx`, `src/scene/SceneHost.test.tsx`

**Interfaces:**
- Produces:
  - `src/scene/loading.ts`：`type LoadingKind = '3d' | 'still'`；`interface Loading { kind: LoadingKind; fraction: number }`；`CHUNK_SHARE = 0.3`；`stageProgress(chunkLoaded: boolean, assets: number): number`；`getLoading(): Loading`；`setLoading(next: Loading): void`；`useLoading(): Loading`；`resetLoading(): void`。
  - `src/scene/events.ts`：`emitIgnition(): void`；`onIgnition(listener: () => void): () => void`；`setIgnitionPending(pending: boolean): void`；`isIgnitionPending(): boolean`。
  - `StageProps.onProgress?: (fraction: number) => void`（0–1）。

- [ ] **Step 1: 写失败测试**

`src/scene/loading.test.ts`：

```ts
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CHUNK_SHARE, getLoading, resetLoading, setLoading, stageProgress, useLoading } from './loading'

describe('loading progress', () => {
  beforeEach(() => resetLoading())

  it('counts the 3D code as the first 30 percent and the assets as the rest', () => {
    expect(stageProgress(false, 0.9)).toBe(0)
    expect(stageProgress(true, 0)).toBe(CHUNK_SHARE)
    expect(stageProgress(true, 0.5)).toBeCloseTo(0.65)
    expect(stageProgress(true, 2)).toBe(1)
  })

  it('starts empty and tells hook users about changes', () => {
    expect(getLoading()).toEqual({ kind: '3d', fraction: 0 })
    const { result } = renderHook(() => useLoading())
    act(() => setLoading({ kind: 'still', fraction: 1 }))
    expect(result.current).toEqual({ kind: 'still', fraction: 1 })
  })
})
```

`src/scene/events.test.ts` 末尾（`describe('nitro events', ...)` 之后）加：

```ts
describe('ignition events', () => {
  it('clears the pending flag and reaches subscribers', () => {
    const listener = vi.fn()
    const off = onIgnition(listener)
    setIgnitionPending(true)
    expect(isIgnitionPending()).toBe(true)
    emitIgnition()
    expect(isIgnitionPending()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    emitIgnition()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
```

并把该文件的导入改为：

```ts
import { emitIgnition, emitNitro, isIgnitionPending, onIgnition, onNitro, setIgnitionPending } from './events'
```

`src/scene/SceneHost.test.tsx`：导入里加 `import { getLoading, resetLoading } from './loading'`；`beforeEach` 里加 `resetLoading()`；在 `'dims the scene for each page'` 之前加：

```ts
  it('reports still mode to the loading progress', async () => {
    render(<SceneHost scene="garage" webgl2={() => false} />)
    await waitFor(() => expect(getLoading()).toEqual({ kind: 'still', fraction: 1 }))
  })

  it('reports 3D loading progress until the first frame', async () => {
    let report: ((fraction: number) => void) | undefined
    let ready: (() => void) | undefined
    function Stage({ onReady, onProgress }: StageProps) {
      report = onProgress
      ready = onReady
      return <div data-testid="fake-stage" />
    }
    render(<SceneHost scene="garage" loadStage={async () => ({ Stage })} webgl2={yes} />)
    await screen.findByTestId('fake-stage')
    await waitFor(() => expect(getLoading()).toEqual({ kind: '3d', fraction: 0.3 }))
    act(() => report?.(0.5))
    expect(getLoading().fraction).toBeCloseTo(0.65)
    act(() => report?.(0.2))
    expect(getLoading().fraction).toBeCloseTo(0.65)
    act(() => ready?.())
    expect(getLoading()).toEqual({ kind: '3d', fraction: 1 })
  })
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/scene`
Expected: FAIL（`./loading` 不存在、事件函数未导出、SceneHost 未上报）。

- [ ] **Step 3: 实现**

`src/scene/loading.ts`：

```ts
import { useSyncExternalStore } from 'react'

export type LoadingKind = '3d' | 'still'

export interface Loading {
  kind: LoadingKind
  fraction: number
}

export const CHUNK_SHARE = 0.3

const INITIAL: Loading = { kind: '3d', fraction: 0 }
let state: Loading = INITIAL
const listeners = new Set<() => void>()

export function stageProgress(chunkLoaded: boolean, assets: number): number {
  if (!chunkLoaded) return 0
  return CHUNK_SHARE + (1 - CHUNK_SHARE) * Math.min(Math.max(assets, 0), 1)
}

export function getLoading(): Loading {
  return state
}

export function setLoading(next: Loading): void {
  if (next.kind === state.kind && next.fraction === state.fraction) return
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLoading(): Loading {
  return useSyncExternalStore(subscribe, getLoading, getLoading)
}

export function resetLoading(): void {
  state = INITIAL
}
```

`src/scene/events.ts` 末尾追加：

```ts
const ignitionListeners = new Set<Listener>()
let ignitionPending = false

export function setIgnitionPending(pending: boolean): void {
  ignitionPending = pending
}

export function isIgnitionPending(): boolean {
  return ignitionPending
}

export function emitIgnition(): void {
  ignitionPending = false
  for (const listener of ignitionListeners) listener()
}

export function onIgnition(listener: Listener): () => void {
  ignitionListeners.add(listener)
  return () => {
    ignitionListeners.delete(listener)
  }
}
```

`src/scene/types.ts` 的 `StageProps` 在 `onFail` 之后加：

```ts
  onProgress?: (fraction: number) => void
```

`src/scene/three/Stage.tsx`：
- 导入改为 `import { useProgress } from '@react-three/drei'`（新增一行），`import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'`。
- 在 `FirstFrame` 之后加：

```tsx
function ReportProgress({ onProgress }: { onProgress: (fraction: number) => void }) {
  const progress = useProgress((state) => state.progress)
  useEffect(() => {
    onProgress(progress / 100)
  }, [progress, onProgress])
  return null
}
```

- 函数签名改为 `export function Stage({ scene, onReady, onFail, onProgress, deterministic = false }: StageProps)`。
- 在 `<Suspense fallback={null}>` 之前加一行：`{onProgress && <ReportProgress onProgress={onProgress} />}`

`src/scene/SceneHost.tsx`：
- 导入加 `import { setLoading, stageProgress } from './loading'`。
- 在 `const [stillGone, setStillGone] = useState(false)` 之后加：

```tsx
  const [assets, setAssets] = useState(0)
  const reportProgress = useCallback((fraction: number) => setAssets((current) => Math.max(current, fraction)), [])

  useEffect(() => {
    setLoading(mode === '3d' ? { kind: '3d', fraction: ready ? 1 : stageProgress(Stage !== null, assets) } : { kind: 'still', fraction: 1 })
  }, [mode, Stage, assets, ready])
```

- `<Stage scene={scene} onReady={markReady} onFail={fail} />` 改为 `<Stage scene={scene} onReady={markReady} onFail={fail} onProgress={reportProgress} />`。

- [ ] **Step 4: 运行测试与类型检查**

Run: `npx vitest run src/scene` → PASS；`npx tsc -b` → 无错误；`npm test` → 全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/scene/loading.ts src/scene/loading.test.ts src/scene/events.ts src/scene/events.test.ts src/scene/types.ts src/scene/three/Stage.tsx src/scene/SceneHost.tsx src/scene/SceneHost.test.tsx
git commit -m "feat(scene): loading progress store and ignition event"
```

---

### Task 5: 点火时 3D 灯光从 0 闪亮

**Files:**
- Modify: `src/scene/motion.ts`, `src/scene/motion.test.ts`, `src/scene/three/Studio.tsx`, `src/scene/three/Car.tsx`
- Create: `src/scene/three/useIgnitionLevel.ts`

**Interfaces:**
- Consumes: `isIgnitionPending`、`onIgnition`（Task 4）。
- Produces: `ignitionLevel(t: number): number`、`IGNITION_FLICKER_S = 0.8`（`src/scene/motion.ts`）；`useIgnitionLevel(): { readonly current: number }`（`src/scene/three/useIgnitionLevel.ts`）。

- [ ] **Step 1: 写失败测试** — `src/scene/motion.test.ts`：导入里加 `IGNITION_FLICKER_S, ignitionLevel`，末尾加：

```ts
describe('ignitionLevel', () => {
  it('is dark before ignition and fully on after the flicker', () => {
    expect(ignitionLevel(-1)).toBe(0)
    expect(ignitionLevel(IGNITION_FLICKER_S)).toBe(1)
    expect(ignitionLevel(10)).toBe(1)
  })

  it('flickers on twice before settling', () => {
    const samples = [0.05, 0.15, 0.27, 0.4].map(ignitionLevel)
    expect(samples).toEqual([1, 0.1, 1, 0.1])
  })

  it('ramps up steadily after the second flicker', () => {
    const ramp = [0.5, 0.6, 0.7, 0.79].map(ignitionLevel)
    for (let i = 1; i < ramp.length; i++) expect(ramp[i]).toBeGreaterThan(ramp[i - 1])
  })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/scene/motion.test.ts`
Expected: FAIL（`ignitionLevel` 未导出）。

- [ ] **Step 3: 实现**

`src/scene/motion.ts` 末尾追加：

```ts
export const IGNITION_FLICKER_S = 0.8
const FLICKER_LOW = 0.1
const FLICKER: [until: number, level: number][] = [
  [0.1, 1],
  [0.22, FLICKER_LOW],
  [0.32, 1],
  [0.5, FLICKER_LOW],
]

export function ignitionLevel(t: number): number {
  if (t < 0) return 0
  if (t >= IGNITION_FLICKER_S) return 1
  for (const [until, level] of FLICKER) if (t < until) return level
  const rampStart = FLICKER[FLICKER.length - 1][0]
  return FLICKER_LOW + ((1 - FLICKER_LOW) * (t - rampStart)) / (IGNITION_FLICKER_S - rampStart)
}
```

`src/scene/three/useIgnitionLevel.ts`：

```ts
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { isIgnitionPending, onIgnition } from '../events'
import { ignitionLevel } from '../motion'

export function useIgnitionLevel(): { readonly current: number } {
  const clock = useThree((state) => state.clock)
  const level = useRef(isIgnitionPending() ? 0 : 1)
  const startedAt = useRef<number | null>(null)

  useEffect(
    () =>
      onIgnition(() => {
        startedAt.current = clock.elapsedTime
      }),
    [clock],
  )

  useFrame(({ clock: frameClock }) => {
    if (startedAt.current !== null) level.current = ignitionLevel(frameClock.elapsedTime - startedAt.current)
    else if (!isIgnitionPending()) level.current = 1
  })

  return level
}
```

`src/scene/three/Studio.tsx`：
- 导入：`import { useFrame, useThree } from '@react-three/fiber'`；新增 `import { useIgnitionLevel } from './useIgnitionLevel'`。
- 在常量区加 `const KEY_INTENSITY = 150`，并把主光 JSX 里的 `intensity={150}` 改为 `intensity={KEY_INTENSITY}`。
- 组件体最开头（`const key = useRef...` 之前）加：

```tsx
  const lights = useIgnitionLevel()
  const scene = useThree((state) => state.scene)
```

- `useFrame` 回调里，在 `goal.set(pose.light)` 之后加：

```tsx
    scene.environmentIntensity = lights.current
    if (key.current) key.current.intensity = KEY_INTENSITY * lights.current
```

- 把 `if (rimSpot.current) rimSpot.current.intensity = RIM_SPOT_INTENSITY * rim.current` 改为：

```tsx
    if (rimSpot.current) rimSpot.current.intensity = RIM_SPOT_INTENSITY * rim.current * lights.current
```

`src/scene/three/Car.tsx`：
- three 导入改为 `import { Box3, Group, Mesh, MeshStandardMaterial, Texture, Vector3, type Object3D } from 'three'`；新增 `import { useIgnitionLevel } from './useIgnitionLevel'`。
- 在 `disposeObject` 之后加：

```tsx
function glowingMaterials(scene: Object3D): MeshStandardMaterial[] {
  const found = new Set<MeshStandardMaterial>()
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    for (const material of [object.material].flat()) {
      if (material instanceof MeshStandardMaterial && material.emissiveMap) {
        material.userData.baseEmissive ??= material.emissiveIntensity
        found.add(material)
      }
    }
  })
  return [...found]
}
```

- 组件体里 `const rig = useMemo(...)` 之后加：

```tsx
  const glow = useMemo(() => glowingMaterials(scene), [scene])
  const lights = useIgnitionLevel()
```

- `useFrame` 回调末尾加：

```tsx
    for (const material of glow) material.emissiveIntensity = (material.userData.baseEmissive as number) * lights.current
```

- [ ] **Step 4: 运行测试与类型检查**

Run: `npx vitest run src/scene` → PASS；`npx tsc -b` → 无错误；`npm test` → 全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/scene/motion.ts src/scene/motion.test.ts src/scene/three/useIgnitionLevel.ts src/scene/three/Studio.tsx src/scene/three/Car.tsx
git commit -m "feat(scene): studio and lamps flicker on at ignition"
```

---

### Task 6: 开场覆盖层（转速表 + 点火）

**Files:**
- Create: `src/intro/Tachometer.tsx`, `src/intro/Intro.tsx`, `src/intro/Intro.test.tsx`

**Interfaces:**
- Consumes: `useLoading`（Task 4）、`emitIgnition`（Task 4）、`unlockAudio`、`play`（Task 3）、`setPrefs`（Task 1）、`usePrefersReducedMotion`（`src/scene/hooks.ts`）。
- Produces: `Intro({ onDone }: { onDone: () => void })`；常量 `INTRO_MIN_MS = 1500`、`INTRO_FALLBACK_MS = 8000`、`STILL_FILL_MS = 1200`、`INTRO_FADE_MS = 600`。

- [ ] **Step 1: 写失败测试** — `src/intro/Intro.test.tsx`：

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { play, unlockAudio } from '../audio/sound'
import { getPrefs } from '../prefs/prefs'
import { onIgnition } from '../scene/events'
import { resetLoading, setLoading } from '../scene/loading'
import { INTRO_FADE_MS, INTRO_FALLBACK_MS, INTRO_MIN_MS, Intro, STILL_FILL_MS } from './Intro'

vi.mock('../audio/sound', () => ({ play: vi.fn(async () => undefined), unlockAudio: vi.fn() }))

const ignite = () => screen.queryByRole('button', { name: '点火' })
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('Intro', () => {
  beforeEach(() => {
    localStorage.clear()
    resetLoading()
    vi.useFakeTimers()
    vi.mocked(play).mockClear()
    vi.mocked(unlockAudio).mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('fills the tachometer on its own in still mode and then offers ignition', () => {
    setLoading({ kind: 'still', fraction: 1 })
    render(<Intro onDone={() => {}} />)
    expect(ignite()).toBeNull()
    advance(STILL_FILL_MS)
    expect(screen.getByText('100%')).toBeInTheDocument()
    advance(INTRO_MIN_MS - STILL_FILL_MS)
    expect(ignite()).toBeInTheDocument()
  })

  it('follows the 3D loading progress', () => {
    render(<Intro onDone={() => {}} />)
    act(() => setLoading({ kind: '3d', fraction: 0.65 }))
    advance(INTRO_MIN_MS)
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(ignite()).toBeNull()
    act(() => setLoading({ kind: '3d', fraction: 1 }))
    expect(ignite()).toBeInTheDocument()
  })

  it('offers ignition anyway after 8 seconds', () => {
    render(<Intro onDone={() => {}} />)
    act(() => setLoading({ kind: '3d', fraction: 0.4 }))
    advance(INTRO_FALLBACK_MS)
    expect(ignite()).toBeInTheDocument()
  })

  it('starts the engine, lights up and remembers the intro', () => {
    const lit = vi.fn()
    const off = onIgnition(lit)
    const onDone = vi.fn()
    setLoading({ kind: 'still', fraction: 1 })
    render(<Intro onDone={onDone} />)
    advance(INTRO_MIN_MS)
    fireEvent.click(ignite()!)
    expect(unlockAudio).toHaveBeenCalled()
    expect(play).toHaveBeenCalledWith('ignition')
    expect(lit).toHaveBeenCalledTimes(1)
    expect(getPrefs().introSeen).toBe(true)
    expect(onDone).not.toHaveBeenCalled()
    advance(INTRO_FADE_MS)
    expect(onDone).toHaveBeenCalledTimes(1)
    off()
  })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/intro`
Expected: FAIL（`./Intro` 不存在）。

- [ ] **Step 3: 实现**

`src/intro/Tachometer.tsx`：

```tsx
const SWEEP_DEG = 240
const START_DEG = -120
const MAX_RPM = 8
const REDLINE = 7

function polar(deg: number, radius: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180
  return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)]
}

function arc(fromDeg: number, toDeg: number, radius: number): string {
  const [x1, y1] = polar(fromDeg, radius)
  const [x2, y2] = polar(toDeg, radius)
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${toDeg - fromDeg > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

interface TachometerProps {
  value: number
  animate: boolean
}

export function Tachometer({ value, animate }: TachometerProps) {
  const clamped = Math.min(Math.max(value, 0), 1)
  const redFrom = START_DEG + (SWEEP_DEG * REDLINE) / MAX_RPM
  return (
    <svg viewBox="0 0 200 200" className="h-56 w-56" aria-hidden>
      <path d={arc(START_DEG, redFrom, 80)} fill="none" stroke="var(--color-line)" strokeWidth="6" />
      <path d={arc(redFrom, START_DEG + SWEEP_DEG, 80)} fill="none" stroke="var(--accent-hi)" strokeWidth="6" />
      {Array.from({ length: MAX_RPM + 1 }, (_, rpm) => {
        const deg = START_DEG + (SWEEP_DEG * rpm) / MAX_RPM
        const [x1, y1] = polar(deg, 68)
        const [x2, y2] = polar(deg, 76)
        const [tx, ty] = polar(deg, 56)
        return (
          <g key={rpm}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="2" />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" className="fill-current font-display text-[11px]">
              {rpm}
            </text>
          </g>
        )
      })}
      <g
        style={{
          transform: `rotate(${START_DEG + SWEEP_DEG * clamped}deg)`,
          transformOrigin: '100px 100px',
          transition: animate ? 'transform 300ms ease-out' : 'none',
        }}
      >
        <line x1="100" y1="100" x2="100" y2="34" stroke="var(--accent-hi)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="100" r="6" fill="var(--accent-hi)" />
      <text x="100" y="150" textAnchor="middle" className="fill-current font-display text-[10px] tracking-[0.3em]">
        ×1000 RPM
      </text>
    </svg>
  )
}
```

`src/intro/Intro.tsx`：

```tsx
import { useEffect, useState } from 'react'
import { play, unlockAudio } from '../audio/sound'
import { setPrefs } from '../prefs/prefs'
import { emitIgnition } from '../scene/events'
import { usePrefersReducedMotion } from '../scene/hooks'
import { useLoading } from '../scene/loading'
import { Tachometer } from './Tachometer'

export const INTRO_MIN_MS = 1500
export const INTRO_FALLBACK_MS = 8000
export const STILL_FILL_MS = 1200
export const INTRO_FADE_MS = 600
const TICK_MS = 50

interface IntroProps {
  onDone: () => void
}

export function Intro({ onDone }: IntroProps) {
  const loading = useLoading()
  const reduced = usePrefersReducedMotion()
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const elapsed = now - startedAt
  const value = loading.kind === 'still' ? (reduced ? 1 : Math.min(1, elapsed / STILL_FILL_MS)) : loading.fraction
  const canIgnite = (value >= 1 && elapsed >= INTRO_MIN_MS) || elapsed >= INTRO_FALLBACK_MS

  function ignite() {
    if (leaving) return
    setLeaving(true)
    unlockAudio()
    void play('ignition')
    emitIgnition()
    setPrefs({ introSeen: true })
    window.setTimeout(onDone, reduced ? 0 : INTRO_FADE_MS)
  }

  return (
    <div
      role="dialog"
      aria-label="点火开场"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink text-fg transition-opacity ease-out"
      style={{ opacity: leaving ? 0 : 1, transitionDuration: reduced ? '0ms' : `${INTRO_FADE_MS}ms` }}
    >
      <p className="font-display text-xs tracking-[0.35em] text-accent-hi">MIDNIGHT GARAGE</p>
      <div className="mt-6 text-muted">
        <Tachometer value={value} animate={!reduced} />
      </div>
      <p className="font-display text-lg tabular-nums">{Math.round(Math.min(value, 1) * 100)}%</p>
      <div className="mt-8 flex h-32 items-center">
        {canIgnite ? (
          <button
            type="button"
            onClick={ignite}
            disabled={leaving}
            className="flex h-28 w-28 items-center justify-center rounded-full border border-accent-hi bg-accent/20 font-display text-lg tracking-[0.3em]"
          >
            点火
          </button>
        ) : (
          <p className="text-xs text-muted">引擎预热中…</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试与类型检查**

Run: `npx vitest run src/intro` → PASS；`npx tsc -b` → 无错误。

- [ ] **Step 5: Commit**

```bash
git add src/intro
git commit -m "feat(intro): tachometer intro that ends with an ignition button"
```

---

### Task 7: 外壳接入（开场、静音开关、音频解锁、后台停声）

**Files:**
- Modify: `src/app/Layout.tsx`, `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `Intro`（Task 6）、`setIgnitionPending`（Task 4）、`unlockAudio`、`stopAll`（Task 3）、`getPrefs`、`setPrefs`、`usePrefs`（Task 1）。

- [ ] **Step 1: 写失败测试** — `src/app/App.test.tsx`：导入里加 `fireEvent` 与 `import { PREFS_KEY, resetPrefsCache } from '../prefs/prefs'`，把 `beforeEach(() => localStorage.clear())` 改为：

```ts
  beforeEach(() => {
    localStorage.clear()
    resetPrefsCache()
  })
```

在 `describe('app shell', ...)` 末尾加：

```ts
  it('shows the ignition intro on the first visit to the garage only', () => {
    renderAt('/')
    expect(screen.getByRole('dialog', { name: '点火开场' })).toBeInTheDocument()
  })

  it('skips the intro once it has been seen, and on other pages', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ introSeen: true }))
    renderAt('/')
    expect(screen.queryByRole('dialog', { name: '点火开场' })).toBeNull()
  })

  it('skips the intro when a visit starts on another page', () => {
    renderAt('/settings')
    expect(screen.queryByRole('dialog', { name: '点火开场' })).toBeNull()
  })

  it('mutes and unmutes from the top bar', () => {
    renderAt('/settings')
    const mute = screen.getByRole('button', { name: '静音' })
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(mute)
    const unmute = screen.getByRole('button', { name: '取消静音' })
    expect(unmute).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!).muted).toBe(true)
    fireEvent.click(unmute)
    expect(screen.getByRole('button', { name: '静音' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/app`
Expected: FAIL（没有开场、没有静音按钮）。

- [ ] **Step 3: 实现** — `src/app/Layout.tsx` 改为：

```tsx
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { stopAll, unlockAudio } from '../audio/sound'
import { Intro } from '../intro/Intro'
import { getPrefs, setPrefs, usePrefs } from '../prefs/prefs'
import { useProgress } from '../progress/ProgressProvider'
import { setIgnitionPending } from '../scene/events'
import { sceneFor } from '../scene/poses'
import { SceneHost } from '../scene/SceneHost'

const NAV = [
  { to: '/', label: '车库', end: true },
  { to: '/trial', label: '赛道试炼', end: false },
  { to: '/vault', label: '保险库', end: false },
  { to: '/settings', label: '设置', end: false },
]

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const { saveFailed } = useProgress()
  const { muted } = usePrefs()
  const scene = sceneFor(pathname)
  const [intro, setIntro] = useState(() => {
    const show = !getPrefs().introSeen && pathname === '/'
    if (show) setIgnitionPending(true)
    return show
  })

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopAll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  function toggleMute() {
    setPrefs({ muted: !muted })
    if (!muted) stopAll()
  }

  return (
    <div
      data-theme={scene === 'vault' ? 'vault' : undefined}
      onPointerDownCapture={unlockAudio}
      onKeyDownCapture={unlockAudio}
      className={
        scene === 'garage'
          ? 'relative min-h-dvh bg-ink text-fg touch-pan-y touch-pinch-zoom select-none'
          : 'relative min-h-dvh bg-ink text-fg'
      }
    >
      <SceneHost scene={scene} />
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-4 text-xs">
        <span className="font-display tracking-[0.35em] text-accent-hi">MIDNIGHT GARAGE</span>
        <nav className="flex items-center gap-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'border-b border-accent-hi text-fg' : 'text-muted hover:text-fg')}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            aria-label={muted ? '取消静音' : '静音'}
            aria-pressed={muted}
            onClick={toggleMute}
            className="text-muted hover:text-fg"
          >
            <SpeakerIcon muted={muted} />
          </button>
        </nav>
      </header>
      {saveFailed && (
        <p role="alert" className="relative z-10 mx-5 mt-3 border border-accent px-3 py-2 text-xs">
          进度暂时无法保存到这台设备，建议去「设置」导出进度。
        </p>
      )}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pt-6 pb-10">
        <Outlet />
      </main>
      {intro && <Intro onDone={() => setIntro(false)} />}
    </div>
  )
}
```

- [ ] **Step 4: 运行测试与类型检查**

Run: `npx vitest run src/app` → PASS；`npx tsc -b` → 无错误；`npm test` → 全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/app/Layout.tsx src/app/App.test.tsx
git commit -m "feat(shell): intro on first visit, mute switch and audio unlock"
```

---

### Task 8: 各处播放音效

**Files:**
- Modify: `src/vault/components/UnlockPanel.tsx`, `src/vault/VaultScreen.tsx`, `src/vault/VaultScreen.test.tsx`, `src/trial/TrialScreen.tsx`, `src/trial/TrialScreen.test.tsx`, `src/pages/HomePage.tsx`
- Create: `src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: `play(name)`（Task 3）。

- [ ] **Step 1: 写失败测试**

`src/vault/VaultScreen.test.tsx`：导入里加 `import { play } from '../audio/sound'`，在导入之后加：

```ts
vi.mock('../audio/sound', () => ({ play: vi.fn(async () => undefined) }))
```

在 `describe('VaultScreen', ...)` 里加：

```ts
  it('starts the engine on submit and plays the unlock sound when it opens', async () => {
    vi.mocked(play).mockClear()
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await enter(TEST_PASSPHRASE)
    await screen.findByRole('tab', { name: '照片' })
    expect(vi.mocked(play).mock.calls.map(([name]) => name)).toEqual(['ignition', 'unlock'])
  })

  it('does not play the unlock sound for a wrong passphrase', async () => {
    vi.mocked(play).mockClear()
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await enter('iceland aurora penguin goodbye')
    await screen.findByRole('alert')
    expect(vi.mocked(play).mock.calls.map(([name]) => name)).toEqual(['ignition'])
  })
```

`src/trial/TrialScreen.test.tsx`：导入里加 `import { play } from '../audio/sound'`，导入之后加：

```ts
vi.mock('../audio/sound', () => ({ play: vi.fn(async () => undefined) }))
```

`beforeEach` 里加 `vi.mocked(play).mockClear()`。在 `'fires the nitro event on the fifth correct answer in a row'` 之后加：

```ts
  it('revs on the nitro combo and again when the lap is finished', async () => {
    renderTrial()
    for (const [index, word] of WORDS.entries()) {
      await screen.findByRole('heading', { name: word.w })
      fireEvent.click(options().find((b) => b.textContent?.includes(word.m.slice(3)))!)
      const good = await screen.findByRole('button', { name: '会了' })
      expect(vi.mocked(play)).toHaveBeenCalledTimes(index === 4 ? 1 : 0)
      fireEvent.click(good)
    }
    await screen.findByText('圈速')
    expect(vi.mocked(play).mock.calls.map(([name]) => name)).toEqual(['rev', 'rev'])
  })

  it('stays quiet when an already finished lap is opened again', async () => {
    renderTrial()
    for (const word of WORDS) {
      await screen.findByRole('heading', { name: word.w })
      fireEvent.click(options().find((b) => !b.textContent?.includes(word.m.slice(3)))!)
      act(() => {
        vi.advanceTimersByTime(1500)
      })
    }
    await screen.findByText('圈速')
    cleanup()
    vi.mocked(play).mockClear()
    renderTrial()
    await screen.findByText('圈速')
    expect(play).not.toHaveBeenCalled()
  })
```

并在该文件 `@testing-library/react` 的导入里加上 `cleanup`。

`src/pages/HomePage.test.tsx`（新建）：

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { play } from '../audio/sound'
import { ProgressProvider } from '../progress/ProgressProvider'
import { HomePage } from './HomePage'

vi.mock('../audio/sound', () => ({ play: vi.fn(async () => undefined) }))

describe('HomePage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(play).mockClear()
  })

  it('blips the throttle when she sets off', () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <HomePage /> },
        { path: '/trial', element: <p>赛道</p> },
      ],
      { initialEntries: ['/'] },
    )
    render(
      <ProgressProvider>
        <RouterProvider router={router} />
      </ProgressProvider>,
    )
    fireEvent.click(screen.getByRole('link', { name: /出发/ }))
    expect(play).toHaveBeenCalledWith('blip')
  })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/vault/VaultScreen.test.tsx src/trial/TrialScreen.test.tsx src/pages/HomePage.test.tsx`
Expected: FAIL（尚未调用 `play`）。

- [ ] **Step 3: 实现**

`src/vault/components/UnlockPanel.tsx`：导入加 `import { play } from '../../audio/sound'`；`submit()` 里在 `setBusy(true)` 之前加一行：

```ts
    void play('ignition')
```

`src/vault/VaultScreen.tsx`：导入加 `import { play } from '../audio/sound'`；`unlock` 回调里 `setState({ status: 'open', file, session })` 之前加：

```ts
      void play('unlock')
```

`src/trial/TrialScreen.tsx`：
- 导入加 `import { play } from '../audio/sound'`。
- 把

```ts
  useEffect(() => {
    if (nitro) emitNitro()
  }, [nitro, cursor])
```

改为

```ts
  useEffect(() => {
    if (!nitro) return
    emitNitro()
    void play('rev')
  }, [nitro, cursor])

  const finished = session !== undefined && isFinished(session)
  const finishedOnOpen = useRef<boolean | null>(null)
  useEffect(() => {
    if (session === undefined) return
    if (finishedOnOpen.current === null) {
      finishedOnOpen.current = finished
      return
    }
    if (finished && !finishedOnOpen.current) {
      finishedOnOpen.current = true
      void play('rev')
    }
  }, [session, finished])
```

- 把 `if (isFinished(session)) {` 改为 `if (finished) {`。

`src/pages/HomePage.tsx`：导入加 `import { play } from '../audio/sound'`；「今日试炼」那个 `<Link to="/trial" ...>` 加属性：

```tsx
          onClick={() => {
            if (!finished) void play('blip')
          }}
```

- [ ] **Step 4: 运行测试与类型检查**

Run: `npx vitest run src/vault src/trial src/pages` → PASS；`npx tsc -b` → 无错误；`npm test` → 全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/vault/components/UnlockPanel.tsx src/vault/VaultScreen.tsx src/vault/VaultScreen.test.tsx src/trial/TrialScreen.tsx src/trial/TrialScreen.test.tsx src/pages/HomePage.tsx src/pages/HomePage.test.tsx
git commit -m "feat(audio): ignition, unlock, nitro, set-off and lap sounds"
```

---

### Task 9: 鸣谢与最终验证

**Files:**
- Modify: `src/pages/SettingsPage.tsx`, `src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: 写失败测试** — `src/pages/SettingsPage.test.tsx` 的鸣谢用例（查找 `getByRole('region', { name: '鸣谢' })` 的那个 `it`）末尾加：

```ts
    expect(credits.getByRole('link', { name: 'Ferrari start up and drive off' })).toHaveAttribute(
      'href',
      'https://freesound.org/people/EwanPenman11/sounds/659560/',
    )
    expect(credits.getByRole('link', { name: 'Supercar rev' })).toHaveAttribute('href', 'https://freesound.org/people/richwise/sounds/478756/')
    expect(credits.getByRole('link', { name: 'Car Lock' })).toHaveAttribute('href', 'https://freesound.org/people/hz37/sounds/396448/')
```

（该用例里 `credits` 已经是 `within(screen.getByRole('region', { name: '鸣谢' }))` 的结果。）

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: FAIL（找不到这些链接）。

- [ ] **Step 3: 实现** — `src/pages/SettingsPage.tsx` 鸣谢区里，ECDICT 那一段 `<p>` 之后、Rajdhani 那一段之前加：

```tsx
        <p>
          音效来自 Freesound（CC0）：EwanPenman11「
          <a href="https://freesound.org/people/EwanPenman11/sounds/659560/" target="_blank" rel="noreferrer" className="underline">
            Ferrari start up and drive off
          </a>
          」、richwise「
          <a href="https://freesound.org/people/richwise/sounds/478756/" target="_blank" rel="noreferrer" className="underline">
            Supercar rev
          </a>
          」、hz37「
          <a href="https://freesound.org/people/hz37/sounds/396448/" target="_blank" rel="noreferrer" className="underline">
            Car Lock
          </a>
          」。
        </p>
```

- [ ] **Step 4: 全量验证**

Run: `npm test` → 全部通过；`npx tsc -b` → 无错误；`npm run build` → 成功。
检查：`dist/assets/index-*.js` 不含 `WebGLRenderer`；主包 gzip < 200 KB；`dist/audio/` 有 4 个 mp3。

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx
git commit -m "feat(settings): credit the CC0 sound recordings"
```

- [ ] **Step 6: 浏览器检查（控制者执行）**

清空本地存储后打开 `/`：转速表随加载转满 → 点「点火」→ 听到点火声、车库灯光闪两下亮起、覆盖层淡出；刷新后不再出现开场。静音开关切换后不再出声。保险库按住 START → 点火声，口令正确 → 解锁声。赛道连对 5 个 → 轰鸣；首页点「出发」→ 短轰油。
