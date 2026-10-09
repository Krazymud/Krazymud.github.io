import { CarError } from './carTypes.ts'

export type Vec3 = [number, number, number]

export interface Bounds {
  min: Vec3
  max: Vec3
}

export function headingYaw(front: Vec3, back: Vec3): number {
  const dx = front[0] - back[0]
  const dz = front[2] - back[2]
  if (Math.hypot(dx, dz) < 1e-9) throw new CarError('前轮和后轮在水平面上重合，无法判断车头方向')
  return -Math.atan2(dx, dz)
}

export function yawQuaternion(yaw: number): [number, number, number, number] {
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
}

export function unionBounds(list: Bounds[]): Bounds {
  const axes = [0, 1, 2] as const
  return {
    min: axes.map((i) => Math.min(...list.map((b) => b.min[i]))) as Vec3,
    max: axes.map((i) => Math.max(...list.map((b) => b.max[i]))) as Vec3,
  }
}

export function groundScale(bounds: Bounds, targetLength: number): number {
  const length = bounds.max[2] - bounds.min[2]
  if (!(length > 0)) throw new CarError('车模型在前后方向上没有长度，无法缩放')
  return targetLength / length
}

export function groundOffset(bounds: Bounds): Vec3 {
  return [-(bounds.min[0] + bounds.max[0]) / 2, -bounds.min[1], -(bounds.min[2] + bounds.max[2]) / 2]
}
