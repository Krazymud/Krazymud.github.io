import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { initialTurntable } from '../turntable'
import { useCarDrag } from './useCarDrag'

function pointer(type: string, x: number) {
  window.dispatchEvent(new PointerEvent(type, { pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: x, clientY: window.innerHeight / 2 }))
}

describe('useCarDrag', () => {
  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])('lets go of the car on %s', (type) => {
    const turntable = { current: initialTurntable() }
    renderHook(() => useCarDrag(turntable, true))
    pointer('pointerdown', 100)
    pointer('pointermove', 140)
    expect(turntable.current.dragging).toBe(true)
    pointer(type, 140)
    expect(turntable.current.dragging).toBe(false)
  })
})
