import { act, render } from '@testing-library/react'
import { Children, isValidElement, useEffect, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Stage } from './Stage'

let canvas: HTMLCanvasElement

const progress = vi.hoisted(() => {
  type Listener = (state: { progress: number }) => void
  const listeners = new Set<Listener>()
  let state = { progress: 0 }
  return {
    listeners,
    getState: () => state,
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(value: number) {
      state = { progress: value }
      listeners.forEach((listener) => listener(state))
    },
  }
})

vi.mock('@react-three/fiber', () => ({
  // Only the component children: the intrinsic three elements and the Suspense content stay out of the DOM.
  Canvas: ({ onCreated, children }: { onCreated: (state: { gl: { domElement: HTMLCanvasElement } }) => void; children?: ReactNode }) => {
    useEffect(() => onCreated({ gl: { domElement: canvas } }), [])
    return Children.toArray(children).filter((child) => isValidElement(child) && typeof child.type === 'function')
  },
  useFrame: () => {},
}))
vi.mock('@react-three/drei', () => ({
  useProgress: Object.assign(() => {
    throw new Error('subscribe to the store instead of rendering with it')
  }, { getState: progress.getState, subscribe: progress.subscribe }),
}))
vi.mock('./Atmosphere', () => ({ Atmosphere: () => null }))
vi.mock('./CameraRig', () => ({ CameraRig: () => null }))
vi.mock('./Car', () => ({ Car: () => null }))
vi.mock('./Floor', () => ({ Floor: () => null }))
vi.mock('./FrameGuard', () => ({ FrameGuard: () => null }))
vi.mock('./PostFx', () => ({ PostFx: () => null }))
vi.mock('./Room', () => ({ Room: () => null }))
vi.mock('./Studio', () => ({ Studio: () => null }))

function loseContext(): Event {
  const event = new Event('webglcontextlost', { cancelable: true })
  canvas.dispatchEvent(event)
  return event
}

describe('Stage', () => {
  beforeEach(() => {
    canvas = document.createElement('canvas')
    progress.set(0)
  })

  it('reports a context loss while mounted, to the latest onFail', () => {
    const first = vi.fn()
    const latest = vi.fn()
    const { rerender, unmount } = render(<Stage scene="garage" onReady={() => {}} onFail={first} />)
    rerender(<Stage scene="garage" onReady={() => {}} onFail={latest} />)
    expect(loseContext().defaultPrevented).toBe(true)
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith('webgl-context-lost')
    unmount()
  })

  it('stops listening for context loss once unmounted', () => {
    const onFail = vi.fn()
    const { unmount } = render(<Stage scene="garage" onReady={() => {}} onFail={onFail} />)
    unmount()
    expect(loseContext().defaultPrevented).toBe(false)
    expect(onFail).not.toHaveBeenCalled()
  })

  it('reports loading progress outside render, until unmounted', async () => {
    progress.set(25)
    const onProgress = vi.fn()
    const { unmount } = render(<Stage scene="garage" onReady={() => {}} onFail={() => {}} onProgress={onProgress} />)
    await act(async () => {})
    expect(onProgress).toHaveBeenLastCalledWith(0.25)

    progress.set(60)
    expect(onProgress).not.toHaveBeenCalledWith(0.6)
    await act(async () => {})
    expect(onProgress).toHaveBeenLastCalledWith(0.6)

    unmount()
    expect(progress.listeners.size).toBe(0)
    progress.set(90)
    await act(async () => {})
    expect(onProgress).not.toHaveBeenCalledWith(0.9)
  })
})
