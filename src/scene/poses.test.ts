import { describe, expect, it } from 'vitest'
import { CAMERA_FOV, CAR_RADIUS, framedCamera, GOLD, POSES, sceneFor, type Pose } from './poses'

const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]))

describe('sceneFor', () => {
  it('maps every route to a scene', () => {
    expect(sceneFor('/')).toBe('garage')
    expect(sceneFor('/trial')).toBe('track')
    expect(sceneFor('/vault')).toBe('vault')
    expect(sceneFor('/settings')).toBe('settings')
    expect(sceneFor('/2018/09/05/leetcode05/')).toBe('garage')
  })
})

describe('POSES', () => {
  it('dims each page as the spec says', () => {
    expect(POSES.garage.dim).toBe(0)
    expect(POSES.track.dim).toBe(0.45)
    expect(POSES.vault.dim).toBe(0.35)
    expect(POSES.settings.dim).toBe(0.2)
  })

  it('spins and sweeps only in the garage', () => {
    expect(Object.entries(POSES).filter(([, p]) => p.spin).map(([s]) => s)).toEqual(['garage'])
    expect(Object.entries(POSES).filter(([, p]) => p.sweep).map(([s]) => s)).toEqual(['garage'])
  })

  it('lights the vault in champagne gold and the rest in ox-blood red', () => {
    expect(POSES.vault.light).toBe('#A8894F')
    expect(POSES.garage.light).toBe('#9E1C22')
    expect(POSES.track.light).toBe('#9E1C22')
  })

  it('rims only the vault in gold', () => {
    expect(Object.entries(POSES).filter(([, p]) => p.rim > 0).map(([s]) => s)).toEqual(['vault'])
    expect(POSES.vault.rim).toBe(1)
    expect(GOLD).toBe(POSES.vault.light)
  })

  it('shows the settings page from the garage camera without spinning', () => {
    expect(POSES.settings.camera).toEqual(POSES.garage.camera)
    expect(POSES.settings.still).toBe('garage')
    expect(POSES.settings.spin).toBe(false)
  })

  it('shows the track lines only on the trial page and squares the car up away from the garage', () => {
    expect(POSES.track.trackLines).toBe(true)
    expect(POSES.garage.trackLines || POSES.vault.trackLines || POSES.settings.trackLines).toBe(false)
    expect(POSES.track.carYaw).toBe(0)
    expect(POSES.vault.carYaw).toBe(0)
  })
})

describe('framedCamera', () => {
  const pose: Pose = { ...POSES.garage, camera: [0, 0, 8], target: [0, 0, 0] }

  it('keeps the base camera when the car already fits', () => {
    expect(framedCamera(pose, 16 / 9)).toEqual([0, 0, 8])
  })

  it('pulls back on a narrow portrait screen, along the same direction', () => {
    const [x, y, z] = framedCamera(pose, 9 / 16)
    expect(x).toBe(0)
    expect(y).toBe(0)
    expect(z).toBeGreaterThan(8)
    const hHalf = Math.atan(Math.tan((CAMERA_FOV * Math.PI) / 360) * (9 / 16))
    expect(distance([x, y, z], [0, 0, 0])).toBeCloseTo(CAR_RADIUS / Math.sin(hHalf), 6)
  })
})
