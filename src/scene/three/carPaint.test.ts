import { BoxGeometry, Color, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'
import { modsFor } from '../../garage/mods'
import { applyMods, finishCar } from './carPaint'

function car() {
  const scene = new Group()
  const named = <T extends MeshStandardMaterial>(material: T, name: string) => Object.assign(material, { name })
  const body = named(new MeshPhysicalMaterial(), 'body')
  const wheel = named(new MeshStandardMaterial(), 'wheel')
  const caliper = named(new MeshStandardMaterial(), 'caliper')
  for (const material of [body, wheel, caliper]) scene.add(new Mesh(new BoxGeometry(), material))
  return { scene, body, wheel, caliper }
}

const shaderStub = () => ({
  uniforms: {} as Record<string, unknown>,
  fragmentShader: 'uniform vec3 diffuse;\nvoid main() {\n\t#include <map_fragment>\n}',
  vertexShader: '',
})

describe('carPaint', () => {
  it('mixes the paint colour in where the body texture alpha marks paint', () => {
    const { scene, body } = car()
    const finish = finishCar(scene)
    const shader = shaderStub()
    body.onBeforeCompile(shader as never, {} as WebGLRenderer)
    expect(shader.uniforms.uPaint).toBe(finish.paint)
    expect(shader.fragmentShader).toContain('uniform vec3 uPaint;')
    expect(shader.fragmentShader).toContain('diffuseColor.rgb = mix( diffuseColor.rgb, uPaint, sampledDiffuseColor.a );')
    expect(body.customProgramCacheKey()).toBe('car-paint')
  })

  it('sets up a scene only once', () => {
    const { scene } = car()
    expect(finishCar(scene)).toBe(finishCar(scene))
  })

  it('colours the paint, rims and calipers', () => {
    const { scene, wheel, caliper } = car()
    const finish = finishCar(scene)
    applyMods(finish, modsFor({ paint: 'blue', rim: 'silver', caliper: 'yellow' }))
    expect(finish.paint.value.getHex()).toBe(new Color('#0e2a6b').getHex())
    expect(wheel.color.getHex()).toBe(new Color('#ffffff').getHex())
    expect(caliper.color.getHex()).toBe(new Color('#d8a400').getHex())
  })

  it('starts at the factory colours', () => {
    const { scene, wheel, caliper } = car()
    const finish = finishCar(scene)
    applyMods(finish, modsFor({ paint: 'midnight', rim: 'gunmetal', caliper: 'red' }))
    expect(finish.paint.value.getHex()).toBe(new Color('#090909').getHex())
    expect(wheel.color.getHex()).toBe(new Color('#b3b3b8').getHex())
    expect(caliper.color.getHex()).toBe(new Color('#9e1c22').getHex())
  })

  it('tolerates a car without the named materials', () => {
    const finish = finishCar(new Group())
    expect(() => applyMods(finish, modsFor({ paint: 'red', rim: 'black', caliper: 'blue' }))).not.toThrow()
  })
})
