export type FocusId = 'desk' | 'envelope' | 'rolls' | 'lightbox' | 'tray' | 'viewer'

export type Vec3 = [number, number, number]
export interface Anchor {
  position: Vec3
  target: Vec3
  fov: number
}

export const FOCUS_IDS: FocusId[] = ['desk', 'envelope', 'rolls', 'lightbox', 'tray', 'viewer']

export type PropId = Exclude<FocusId, 'desk'>

export const CAMERA_FOV = 32
export const LANDSCAPE_ASPECT = 16 / 9
const TAN_HALF_FOV = Math.tan((CAMERA_FOV / 2) * (Math.PI / 180))
const PORTRAIT_BELOW = 0.9
const FIT_MARGIN = 1.1

export interface DeskLayout {
  portrait: boolean
  props: Record<PropId, Vec3>
  deskSize: [number, number]
  /** Half of the horizontal span (centered on x = 0) that the desk view must keep in frame. */
  halfWidth: number
}

const LANDSCAPE_LAYOUT: DeskLayout = {
  portrait: false,
  props: {
    envelope: [-2.2, 0, 0.2],
    rolls: [-0.6, 0, 0.4],
    lightbox: [1.4, 0, -0.4],
    tray: [2.8, 0, 0.6],
    viewer: [0, 0.9, 0],
  },
  deskSize: [9, 5],
  halfWidth: 3.4,
}

// A tall screen cannot hold a wide row of props, so they are stacked in three rows instead.
const PORTRAIT_LAYOUT: DeskLayout = {
  portrait: true,
  props: {
    lightbox: [0, 0, -1.9],
    envelope: [-1.15, 0, 0],
    viewer: [0, 0.9, 0],
    rolls: [1.15, 0, 0],
    tray: [0, 0, 1.9],
  },
  deskSize: [8, 10],
  halfWidth: 1.8,
}

export function layoutForAspect(aspect: number = LANDSCAPE_ASPECT): DeskLayout {
  return aspect < PORTRAIT_BELOW ? PORTRAIT_LAYOUT : LANDSCAPE_LAYOUT
}

// Camera offsets relative to the prop; halfWidth is the horizontal span the close-up must keep in frame.
const PROP_VIEWS: Record<PropId, { position: Vec3; target: Vec3; halfWidth: number }> = {
  envelope: { position: [0, 1.6, 1.6], target: [0, 0.1, 0], halfWidth: 0.6 },
  rolls: { position: [0, 1.5, 1.5], target: [0, 0.2, 0], halfWidth: 0.55 },
  lightbox: { position: [0, 1.8, 2.0], target: [0, 0.3, 0], halfWidth: 0.85 },
  tray: { position: [0, 1.7, 1.6], target: [0, 0.1, 0], halfWidth: 0.75 },
  viewer: { position: [0, 0.3, 2.4], target: [0, 0, 0], halfWidth: 0.45 },
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** Distance from the target at which a horizontal half-span fits the view of the given aspect. */
export function fitDistance(halfWidth: number, aspect: number): number {
  return (halfWidth * FIT_MARGIN) / (TAN_HALF_FOV * aspect)
}

function pullBack(anchor: Anchor, halfWidth: number, aspect: number): Anchor {
  const current = distance(anchor.position, anchor.target)
  const scale = Math.max(1, fitDistance(halfWidth, aspect) / current)
  if (scale === 1) return anchor
  return {
    ...anchor,
    position: [
      anchor.target[0] + (anchor.position[0] - anchor.target[0]) * scale,
      anchor.target[1] + (anchor.position[1] - anchor.target[1]) * scale,
      anchor.target[2] + (anchor.position[2] - anchor.target[2]) * scale,
    ],
  }
}

function withFov(anchor: Omit<Anchor, 'fov'>): Anchor {
  return { ...anchor, fov: CAMERA_FOV }
}

export function anchorForFocus(focus: FocusId, aspect: number = LANDSCAPE_ASPECT): Anchor {
  const layout = layoutForAspect(aspect)
  if (focus === 'desk') {
    const target: Vec3 = [0, 0, 0.15]
    const base = layout.portrait
      ? { position: [0, 6.2, 3.0] as Vec3, target }
      : { position: [0, 7, 5.4] as Vec3, target }
    return withFov(pullBack(withFov(base), layout.halfWidth, aspect))
  }
  const prop = layout.props[focus]
  const view = PROP_VIEWS[focus]
  return withFov(
    pullBack(withFov({ position: add(prop, view.position), target: add(prop, view.target) }), view.halfWidth, aspect),
  )
}
