// @vitest-environment node
import { Document, type Node } from '@gltf-transform/core'
import { getBounds } from '@gltf-transform/functions'
import { describe, expect, it } from 'vitest'
import { carConfig } from '../car.config.ts'
import { buildCarFixture, fixtureConfig } from './carFixture.ts'
import { clampTexcoords, describeCar, linearColor, processCar } from './carModel.ts'
import { CarError } from './carTypes.ts'

async function processed(): Promise<Document> {
  const doc = await buildCarFixture()
  await processCar(doc, fixtureConfig())
  return doc
}

const meshNodes = (doc: Document) => doc.getRoot().listNodes().filter((node) => node.getMesh() !== null)
const materialsOf = (node: Node) => node.getMesh()!.listPrimitives().map((p) => p.getMaterial()?.getName())
const material = (doc: Document, name: string) => doc.getRoot().listMaterials().find((m) => m.getName() === name)!

describe('linearColor', () => {
  it('converts sRGB hex to linear factors', () => {
    expect(linearColor('#FFFFFF')).toEqual([1, 1, 1, 1])
    expect(linearColor('#000000')).toEqual([0, 0, 0, 1])
    expect(linearColor('#9E1C22')[0]).toBeCloseTo(0.342, 3)
  })
})

describe('describeCar', () => {
  it('lists the original meshes and materials', async () => {
    const report = describeCar(await buildCarFixture())
    expect(report.meshes).toContain('car_wheel_FL_car_tire_0')
    expect(report.materials).toEqual(expect.arrayContaining(['car_body', 'clearcoat']))
  })
})

describe('clampTexcoords', () => {
  it('pulls UVs that barely overshoot [0,1] back in so they can be quantized, and leaves tiling UVs alone', () => {
    const doc = new Document()
    const uv = (values: number[]) => doc.createAccessor().setType('VEC2').setArray(new Float32Array(values))
    const nudged = uv([-0.008, 0.5, 1.004, 1])
    const tiled = uv([0, 0, 2, 3])
    doc
      .createMesh()
      .addPrimitive(doc.createPrimitive().setAttribute('TEXCOORD_0', nudged))
      .addPrimitive(doc.createPrimitive().setAttribute('TEXCOORD_0', tiled))
    clampTexcoords(doc)
    expect([...nudged.getArray()!]).toEqual([0, 0.5, 1, 1])
    expect([...tiled.getArray()!]).toEqual([0, 0, 2, 3])
  })
})

describe('processCar', () => {
  it('replaces the Spec-Gloss materials with one material per role and drops the clearcoat shell', async () => {
    const doc = await processed()
    expect(doc.getRoot().listMaterials().map((m) => m.getName()).sort()).toEqual(['body', 'caliper', 'glass', 'shadow', 'tire', 'wheel'])
    expect(doc.getRoot().listMeshes().map((m) => m.getName())).not.toContain('clearcoat_clearcoat_0')
    const used = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)
    expect(used).not.toContain('KHR_materials_pbrSpecularGlossiness')
    expect(used).toEqual(expect.arrayContaining(['EXT_texture_webp', 'KHR_materials_clearcoat', 'KHR_materials_emissive_strength']))
    expect(doc.getRoot().listTextures().every((t) => t.getMimeType() === 'image/webp')).toBe(true)
  })

  it('gives the body clearcoat and glowing taillights, and the calipers ox-blood red', async () => {
    const doc = await processed()
    const body = material(doc, 'body')
    expect(body.getExtension('KHR_materials_clearcoat')).not.toBeNull()
    expect(body.getEmissiveTexture()).not.toBeNull()
    const caliper = material(doc, 'caliper').getBaseColorFactor()
    linearColor('#9E1C22').forEach((v, i) => expect(caliper[i]).toBeCloseTo(v, 6))
    expect(material(doc, 'shadow').getAlphaMode()).toBe('BLEND')
    expect(material(doc, 'glass').getAlphaMode()).toBe('OPAQUE')
  })

  it('keeps four wheels as separate nodes, each with tire and rim', async () => {
    const doc = await processed()
    const wheels = meshNodes(doc).filter((node) => node.getExtras().wheel !== undefined)
    expect(wheels.map((node) => node.getExtras().wheel).sort()).toEqual(['BL', 'BR', 'FL', 'FR'])
    for (const wheel of wheels) expect(materialsOf(wheel).sort()).toEqual(['tire', 'wheel'])
  })

  it('joins everything else by material', async () => {
    const doc = await processed()
    const rest = meshNodes(doc).filter((node) => node.getExtras().wheel === undefined)
    expect(rest.flatMap(materialsOf).sort()).toEqual(['body', 'caliper', 'glass', 'shadow'])
  })

  it('turns the car to face +Z, puts it on the ground and scales it to the target length', async () => {
    const doc = await processed()
    const scene = doc.getRoot().getDefaultScene()!
    expect(scene.listChildren().map((node) => node.getName())).toEqual(['car'])
    const solid = meshNodes(doc).filter((node) => !materialsOf(node).includes('shadow'))
    const bounds = solid.map((node) => getBounds(node))
    const min = [0, 1, 2].map((i) => Math.min(...bounds.map((b) => b.min[i])))
    const max = [0, 1, 2].map((i) => Math.max(...bounds.map((b) => b.max[i])))
    expect(min[1]).toBeCloseTo(0, 5)
    expect(max[2] - min[2]).toBeCloseTo(4.5, 5)
    expect((min[0] + max[0]) / 2).toBeCloseTo(0, 5)
    expect((min[2] + max[2]) / 2).toBeCloseTo(0, 5)
    const wheelZ = (position: string) => meshNodes(doc).find((node) => node.getExtras().wheel === position)!.getWorldTranslation()[2]
    expect(wheelZ('FL')).toBeGreaterThan(0)
    expect(wheelZ('FR')).toBeGreaterThan(0)
    expect(wheelZ('BL')).toBeLessThan(0)
  })

  it('removes meshes the same way when a removal pattern carries the y flag', async () => {
    const doc = await buildCarFixture()
    await processCar(doc, fixtureConfig({ remove: [/clearcoat_0$/y] }))
    expect(doc.getRoot().listMaterials().map((m) => m.getName())).not.toContain('clearcoat')
  })

  it('rejects a config rule that matches no mesh', async () => {
    const doc = await buildCarFixture()
    const roles = [...carConfig.roles, { role: 'body' as const, mesh: /^spoiler_/ }]
    await expect(processCar(doc, fixtureConfig({ roles }))).rejects.toThrow(CarError)
  })

  it('rejects wheel parts that carry their own offset', async () => {
    const doc = await buildCarFixture()
    doc.getRoot().listNodes().find((node) => node.getName() === 'car_wheel_FL_car_tire_0')!.setTranslation([0.1, 0, 0])
    const result = processCar(doc, fixtureConfig())
    await expect(result).rejects.toThrow(CarError)
    await expect(result).rejects.toThrow(/car_wheel_FL_car_tire_0/)
  })

  it('pulls wheel UVs that barely overshoot [0,1] back in', async () => {
    const doc = await buildCarFixture()
    const rim = doc.getRoot().listMeshes().find((mesh) => mesh.getName() === 'car_wheel_FL_car_body_0')!.listPrimitives()[0]
    const values = Array.from({ length: 8 }, (_, i) => [i % 2 ? 1.004 : -0.008, i / 7]).flat()
    rim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(values)).setBuffer(doc.getRoot().listBuffers()[0]))
    await processCar(doc, fixtureConfig())
    const wheel = meshNodes(doc).find((node) => node.getExtras().wheel === 'FL')!
    const uv = wheel.getMesh()!.listPrimitives().find((p) => p.getMaterial()?.getName() === 'wheel')!.getAttribute('TEXCOORD_0')!
    expect(Math.min(...uv.getArray()!)).toBe(0)
    expect(Math.max(...uv.getArray()!)).toBe(1)
  })
})
