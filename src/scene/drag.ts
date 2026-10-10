export const DRAG_SLOP = 8
export const CAR_BAND: [number, number] = [0.25, 0.75]

export function inCarBand(y: number, height: number): boolean {
  return y >= height * CAR_BAND[0] && y <= height * CAR_BAND[1]
}

const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="switch"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

export function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null
}

export type DragPhase = 'idle' | 'pending' | 'dragging'

export class DragTracker {
  private phase: DragPhase = 'idle'
  private startX = 0
  private startY = 0
  private lastX = 0

  get state(): DragPhase {
    return this.phase
  }

  start(x: number, y: number): void {
    this.phase = 'pending'
    this.startX = x
    this.startY = y
    this.lastX = x
  }

  move(x: number, y: number): number | null {
    if (this.phase === 'pending') {
      const dx = x - this.startX
      const dy = y - this.startY
      if (Math.abs(dy) > DRAG_SLOP && Math.abs(dy) >= Math.abs(dx)) {
        this.phase = 'idle'
        return null
      }
      if (Math.abs(dx) <= DRAG_SLOP) return null
      this.phase = 'dragging'
    }
    if (this.phase !== 'dragging') return null
    const delta = x - this.lastX
    this.lastX = x
    return delta
  }

  end(): boolean {
    const wasDragging = this.phase === 'dragging'
    this.phase = 'idle'
    return wasDragging
  }
}
