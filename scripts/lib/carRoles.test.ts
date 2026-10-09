// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { carConfig } from '../car.config.ts'
import { assignRoles } from './carRoles.ts'
import { CarError } from './carTypes.ts'

const GOBLIN_MESHES = [
  'car_wheel_BL_car_tire_0',
  'car_wheel_BL_car_body_0',
  'car_brake_BL_car_body_0',
  'car_wheel_BR_car_body_0',
  'car_wheel_BR_car_tire_0',
  'car_brake_BR_car_body_0',
  'car_wheel_FL_car_body_0',
  'car_wheel_FL_car_tire_0',
  'car_brake_FL_car_body_0',
  'car_wheel_FR_car_tire_0',
  'car_wheel_FR_car_body_0',
  'car_brake_FR_car_body_0',
  'car_glass_car_glass_0',
  'clearcoat_clearcoat_0',
  'car_body_car_body_0',
  'car_shadow_car_shadow_0',
]

describe('assignRoles', () => {
  it('covers every V12 Goblin mesh with the shipped config', () => {
    const roles = assignRoles(GOBLIN_MESHES, carConfig.roles, carConfig.remove)
    expect(roles.get('car_body_car_body_0')).toBe('body')
    expect(roles.get('car_wheel_FL_car_body_0')).toBe('wheel')
    expect(roles.get('car_wheel_BR_car_tire_0')).toBe('tire')
    expect(roles.get('car_brake_FR_car_body_0')).toBe('caliper')
    expect(roles.get('car_glass_car_glass_0')).toBe('glass')
    expect(roles.get('car_shadow_car_shadow_0')).toBe('shadow')
    expect(roles.has('clearcoat_clearcoat_0')).toBe(false)
    expect(roles.size).toBe(15)
  })

  it('rejects a rule that matches nothing', () => {
    const rules = [...carConfig.roles, { role: 'body' as const, mesh: /^spoiler_/ }]
    expect(() => assignRoles(GOBLIN_MESHES, rules, carConfig.remove)).toThrow(/spoiler_/)
  })

  it('rejects a mesh that no rule covers', () => {
    expect(() => assignRoles([...GOBLIN_MESHES, 'car_spoiler_0'], carConfig.roles, carConfig.remove)).toThrow(/car_spoiler_0/)
  })

  it('rejects a removal pattern that matches nothing', () => {
    expect(() => assignRoles(GOBLIN_MESHES, carConfig.roles, [/^roof_box_/])).toThrow(CarError)
  })
})
