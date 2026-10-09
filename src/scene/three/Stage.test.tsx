import { render } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Stage } from './Stage'

const canvas = document.createElement('canvas')

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ onCreated }: { onCreated: (state: { gl: { domElement: HTMLCanvasElement } }) => void; children?: ReactNode }) => {
    useEffect(() => onCreated({ gl: { domElement: canvas } }), [])
    return null
  },
  useFrame: () => {},
}))
vi.mock('./CameraRig', () => ({ CameraRig: () => null }))
vi.mock('./Car', () => ({ Car: () => null }))
vi.mock('./Floor', () => ({ Floor: () => null }))
vi.mock('./FrameGuard', () => ({ FrameGuard: () => null }))
vi.mock('./PostFx', () => ({ PostFx: () => null }))
vi.mock('./Studio', () => ({ Studio: () => null }))

const loseContext = () => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))

describe('Stage', () => {
  it('reports a context loss while mounted, to the latest onFail', () => {
    const first = vi.fn()
    const latest = vi.fn()
    const { rerender, unmount } = render(<Stage scene="garage" onReady={() => {}} onFail={first} />)
    rerender(<Stage scene="garage" onReady={() => {}} onFail={latest} />)
    loseContext()
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith('webgl-context-lost')
    unmount()
  })

  it('ignores the context loss caused by disposing the renderer after unmount', () => {
    const onFail = vi.fn()
    const { unmount } = render(<Stage scene="garage" onReady={() => {}} onFail={onFail} />)
    unmount()
    loseContext()
    expect(onFail).not.toHaveBeenCalled()
  })
})
