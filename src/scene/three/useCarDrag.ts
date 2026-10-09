import { useEffect, type RefObject } from 'react'
import { DragTracker, inCarBand, isInteractive } from '../drag'
import { dragBy, grab, release, type Turntable } from '../turntable'

export function useCarDrag(turntable: RefObject<Turntable>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const tracker = new DragTracker()
    let pointer: number | null = null
    let lastTime = 0

    const finish = (timeStamp: number) => {
      pointer = null
      if (tracker.end()) turntable.current = release(turntable.current, (timeStamp - lastTime) / 1000)
    }
    const down = (event: PointerEvent) => {
      if (pointer !== null || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
      if (isInteractive(event.target) || !inCarBand(event.clientY, window.innerHeight)) return
      pointer = event.pointerId
      lastTime = event.timeStamp
      tracker.start(event.clientX, event.clientY)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return
      const wasDragging = tracker.state === 'dragging'
      const dx = tracker.move(event.clientX, event.clientY)
      if (tracker.state === 'idle') {
        pointer = null
        return
      }
      if (dx === null) return
      if (!wasDragging) turntable.current = grab(turntable.current)
      turntable.current = dragBy(turntable.current, dx, (event.timeStamp - lastTime) / 1000)
      lastTime = event.timeStamp
    }
    const up = (event: PointerEvent) => {
      if (event.pointerId === pointer) finish(event.timeStamp)
    }

    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      finish(performance.now())
    }
  }, [enabled, turntable])
}
