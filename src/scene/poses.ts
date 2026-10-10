import type { Scene, StillScene } from './types'

export type Vec3 = [number, number, number]

export interface Pose {
  camera: Vec3
  target: Vec3
  light: string
  dim: number
  spin: boolean
  carYaw: number | null
  trackLines: boolean
  sweep: boolean
  rim: number
  still: StillScene
}

const RED = '#9E1C22'
export const GOLD = '#A8894F'
const GARAGE_CAMERA: Vec3 = [-4.6, 2.3, 6.4]
const GARAGE_TARGET: Vec3 = [0, -0.6, 0]

export const POSES: Record<Scene, Pose> = {
  garage: {
    camera: GARAGE_CAMERA,
    target: GARAGE_TARGET,
    light: RED,
    dim: 0,
    spin: true,
    carYaw: null,
    trackLines: false,
    sweep: true,
    rim: 0,
    still: 'garage',
  },
  track: {
    camera: [7.2, 0.7, 0.8],
    target: [0, 0.5, 0],
    light: RED,
    dim: 0.45,
    spin: false,
    carYaw: 0,
    trackLines: true,
    sweep: false,
    rim: 0,
    still: 'track',
  },
  vault: {
    camera: [1.4, 1.5, -7.6],
    target: [0, 0.6, 0],
    light: GOLD,
    dim: 0.35,
    spin: false,
    carYaw: 0,
    trackLines: false,
    sweep: false,
    rim: 1,
    still: 'vault',
  },
  settings: {
    camera: GARAGE_CAMERA,
    target: GARAGE_TARGET,
    light: RED,
    dim: 0.2,
    spin: false,
    carYaw: null,
    trackLines: false,
    sweep: false,
    rim: 0,
    still: 'garage',
  },
}

export function sceneFor(pathname: string): Scene {
  const segment = pathname.split('/')[1]
  if (segment === 'vault') return 'vault'
  if (segment === 'trial') return 'track'
  if (segment === 'settings') return 'settings'
  return 'garage'
}

export const CAMERA_FOV = 40
export const CAR_RADIUS = 2.5

export function framedCamera(pose: Pose, aspect: number, fovDeg = CAMERA_FOV, radius = CAR_RADIUS): Vec3 {
  const offset = pose.camera.map((v, i) => v - pose.target[i])
  const length = Math.hypot(...offset)
  const vHalf = (fovDeg * Math.PI) / 360
  const hHalf = Math.atan(Math.tan(vHalf) * aspect)
  const needed = radius / Math.sin(Math.min(vHalf, hHalf))
  if (!(length > 0)) return [pose.target[0], pose.target[1], pose.target[2] + needed]
  const scale = Math.max(length, needed) / length
  return offset.map((v, i) => pose.target[i] + v * scale) as Vec3
}
