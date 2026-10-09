// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { groundOffset, groundScale, headingYaw, unionBounds, yawQuaternion, type Vec3 } from './carAlign.ts'
import { CarError } from './carTypes.ts'

function rotateY([x, y, z]: Vec3, yaw: number): Vec3 {
  return [x * Math.cos(yaw) + z * Math.sin(yaw), y, -x * Math.sin(yaw) + z * Math.cos(yaw)]
}

function rotateByQuaternion(v: Vec3, [qx, qy, qz, qw]: [number, number, number, number]): Vec3 {
  const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const q: Vec3 = [qx, qy, qz]
  const t = cross(q, v).map((c) => 2 * c) as Vec3
  const u = cross(q, t)
  return v.map((c, i) => c + qw * t[i] + u[i]) as Vec3
}

function expectFacesPlusZ(front: Vec3, back: Vec3) {
  const yaw = headingYaw(front, back)
  const heading: Vec3 = [front[0] - back[0], 0, front[2] - back[2]]
  const [x, , z] = rotateY(heading, yaw)
  expect(x).toBeCloseTo(0)
  expect(z).toBeGreaterThan(0)
}

describe('headingYaw', () => {
  it('turns a car facing -Z around', () => expectFacesPlusZ([0, 0, -1], [0, 0, 1]))
  it('turns a car facing +X', () => expectFacesPlusZ([1, 0, 0], [-1, 0, 0]))
  it('leaves a car facing +Z alone', () => expect(headingYaw([0, 0, 1], [0, 0, -1])).toBeCloseTo(0))
  it('rejects wheels on top of each other', () => expect(() => headingYaw([1, 0, 1], [1, 2, 1])).toThrow(CarError))
})

describe('yawQuaternion', () => {
  it('describes the same turn around Y, including just short of a half turn', () => {
    for (const yaw of [Math.PI / 2, Math.PI - 0.3, -(Math.PI - 0.3)]) {
      const [x, y, z] = rotateByQuaternion([1, 0, 2], yawQuaternion(yaw))
      const [ex, ey, ez] = rotateY([1, 0, 2], yaw)
      expect(x).toBeCloseTo(ex)
      expect(y).toBeCloseTo(ey)
      expect(z).toBeCloseTo(ez)
    }
  })
})

describe('bounds', () => {
  it('unions boxes', () => {
    expect(unionBounds([
      { min: [0, 0, 0], max: [1, 1, 1] },
      { min: [-1, 0.5, -2], max: [0.5, 3, 0] },
    ])).toEqual({ min: [-1, 0, -2], max: [1, 3, 1] })
  })

  it('skips boxes that are empty or not finite', () => {
    expect(unionBounds([
      { min: [0, 0, 0], max: [1, 1, 1] },
      { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
      { min: [NaN, 0, 0], max: [5, 5, 5] },
    ])).toEqual({ min: [0, 0, 0], max: [1, 1, 1] })
  })

  it('rejects a list with no usable box', () => {
    expect(() => unionBounds([])).toThrow(CarError)
    expect(() => unionBounds([{ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }])).toThrow(CarError)
  })

  it('scales the length along Z to the target', () => {
    expect(groundScale({ min: [0, 0, -1], max: [0, 0, 1] }, 4.5)).toBe(2.25)
    expect(() => groundScale({ min: [0, 0, 1], max: [0, 0, 1] }, 4.5)).toThrow(CarError)
  })

  it('centres the car and puts it on the ground', () => {
    expect(groundOffset({ min: [-1, 0.2, -3], max: [3, 2, 1] })).toEqual([-1, -0.2, 1])
  })
})
