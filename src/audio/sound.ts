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
    context ??= createContext()
    if (buffers.size === 0 && !getPrefs().muted) {
      for (const name of SOUND_NAMES) {
        const buffer = load(context, name)
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
  if (typeof context?.close === 'function') context.close().catch(warn)
  context = null
  buffers.clear()
}
