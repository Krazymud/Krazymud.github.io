import { render } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Stage } from './Stage'

let canvas: HTMLCanvasElement

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ onCreated }: { onCreated: (state: { gl: { domElement: HTMLCanvasElement } }) => void; children?: ReactNode }) => {
    useEffect(() => onCreated({ gl: { domElement: canvas } }), [])
    return null
  },
  useFrame: () => {},
}))
vi.mock('@react-three/drei', () => ({ useProgress: (select: (state: { progress: number }) => number) => select({ progress: 0 }) }))
vi.mock('./CameraRig', () => ({ CameraRig: () => null }))
vi.mock('./Car', () => ({ Car: () => null }))
vi.mock('./Floor', () => ({ Floor: () => null }))
vi.mock('./FrameGuard', () => ({ FrameGuard: () => null }))
vi.mock('./PostFx', () => ({ PostFx: () => null }))
vi.mock('./Studio', () => ({ Studio: () => null }))

function loseContext(): Event {
  const event = new Event('webglcontextlost', { cancelable: true })
  canvas.dispatchEvent(event)
  return event
}

describe('Stage', () => {
  beforeEach(() => {
    canvas = document.createElement('canvas')
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
})
