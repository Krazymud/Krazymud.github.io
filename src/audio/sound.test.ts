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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { sources } = fakeAudio(async () => {
      throw new Error('bad mp3')
    })
    unlockAudio()
    await expect(play('unlock')).resolves.toBeUndefined()
    expect(sources).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
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
