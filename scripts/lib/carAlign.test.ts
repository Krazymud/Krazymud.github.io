// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { groundOffset, groundScale, headingYaw, unionBounds, yawQuaternion, type Vec3 } from './carAlign.ts'
import { CarError } from './carTypes.ts'

function rotateY([x, y, z]: Vec3, yaw: number): Vec3 {
  return [x * Math.cos(yaw) + z * Math.sin(yaw), y, -x * Math.sin(yaw) + z * Math.cos(yaw)]
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
  it('describes the same turn around Y', () => {
    const [x, y, z, w] = yawQuaternion(Math.PI)
    expect([x, z]).toEqual([0, 0])
    expect(y).toBeCloseTo(1)
    expect(w).toBeCloseTo(0)
  })
})

describe('bounds', () => {
  it('unions boxes', () => {
    expect(unionBounds([
      { min: [0, 0, 0], max: [1, 1, 1] },
      { min: [-1, 0.5, -2], max: [0.5, 3, 0] },
    ])).toEqual({ min: [-1, 0, -2], max: [1, 3, 1] })
  })

  it('scales the length along Z to the target', () => {
    expect(groundScale({ min: [0, 0, -1], max: [0, 0, 1] }, 4.5)).toBe(2.25)
    expect(() => groundScale({ min: [0, 0, 1], max: [0, 0, 1] }, 4.5)).toThrow(CarError)
  })

  it('centres the car and puts it on the ground', () => {
    expect(groundOffset({ min: [-1, 0.2, -3], max: [3, 2, 1] })).toEqual([-1, -0.2, 1])
  })
})
