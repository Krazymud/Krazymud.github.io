export type ZoomState = { scale: number; x: number; y: number }

export const MIN_SCALE = 1
export const MAX_SCALE = 4

const PAN_MIN_SCALE = 1.02

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

export function resetZoom(): ZoomState {
  return { scale: 1, x: 0, y: 0 }
}

export function applyPinch(
  prev: ZoomState,
  startDist: number,
  dist: number,
  startScale: number,
): ZoomState {
  if (startDist <= 0) return prev
  const scale = clampScale(startScale * (dist / startDist))
  if (scale <= MIN_SCALE) {
    return { scale: MIN_SCALE, x: 0, y: 0 }
  }
  return { scale, x: prev.x, y: prev.y }
}

export function applyPan(prev: ZoomState, dx: number, dy: number): ZoomState {
  if (prev.scale <= PAN_MIN_SCALE) {
    return { scale: prev.scale, x: prev.x, y: prev.y }
  }
  return { scale: prev.scale, x: prev.x + dx, y: prev.y + dy }
}
