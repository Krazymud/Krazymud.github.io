export type FocusId = 'desk' | 'envelope' | 'rolls' | 'lightbox' | 'tray' | 'viewer'

export type Vec3 = [number, number, number]
export interface Anchor {
  position: Vec3
  target: Vec3
}

export const FOCUS_IDS: FocusId[] = ['desk', 'envelope', 'rolls', 'lightbox', 'tray', 'viewer']

const ANCHORS: Record<FocusId, Anchor> = {
  desk: { position: [0, 3.2, 4.6], target: [0, 0.3, 0] },
  envelope: { position: [-2.2, 1.6, 1.8], target: [-2.2, 0.1, 0.2] },
  rolls: { position: [-0.6, 1.5, 1.9], target: [-0.6, 0.2, 0.4] },
  lightbox: { position: [1.4, 1.8, 1.6], target: [1.4, 0.3, -0.4] },
  tray: { position: [2.8, 1.7, 2.2], target: [2.8, 0.1, 0.6] },
  viewer: { position: [0, 1.2, 2.4], target: [0, 0.9, 0] },
}

export function anchorForFocus(focus: FocusId): Anchor {
  return ANCHORS[focus]
}
