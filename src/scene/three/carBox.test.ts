import { BoxGeometry, Group, Mesh, PlaneGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { carSpaceBox } from './carBox'

describe('carSpaceBox', () => {
  it('measures the car in its own frame, ignoring the turntable angle and the shadow plane', () => {
    const turntable = new Group()
    turntable.rotation.y = 0.7
    const car = new Group()
    car.position.y = 0.3
    car.add(new Mesh(new BoxGeometry(2, 1, 4)))
    const shadow = new Mesh(new PlaneGeometry(9, 9))
    shadow.name = 'car_shadow_car_shadow_0'
    car.add(shadow)
    turntable.add(car)

    const box = carSpaceBox(car)
    expect(box.min.toArray().map((value) => +value.toFixed(6))).toEqual([-1, -0.5, -2])
    expect(box.max.toArray().map((value) => +value.toFixed(6))).toEqual([1, 0.5, 2])
  })
})
