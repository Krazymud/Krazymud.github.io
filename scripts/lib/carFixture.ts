import { Document, Logger, type Buffer as GltfBuffer, type Material, type Node, type Primitive } from '@gltf-transform/core'
import { KHRMaterialsPBRSpecularGlossiness } from '@gltf-transform/extensions'
import sharp from 'sharp'
import { carConfig } from '../car.config.ts'
import type { CarConfig } from './carTypes.ts'

type Vec3 = [number, number, number]
type Rgba = [number, number, number, number]

export const FIXTURE_TAILLIGHT = { x: 44, y: 20 }

const WHEELS: [string, number, number][] = [
  ['FL', 0.85, 1.4],
  ['FR', -0.85, 1.4],
  ['BL', 0.85, -1.4],
  ['BR', -0.85, -1.4],
]

async function png(width: number, height: number, fill: (x: number, y: number) => Rgba): Promise<Uint8Array> {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4)
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

function box(doc: Document, buffer: GltfBuffer, size: Vec3, center: Vec3 = [0, 0, 0]): Primitive {
  const [hx, hy, hz] = size.map((v) => v / 2)
  const positions: number[] = []
  for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [-hz, hz]) positions.push(center[0] + x, center[1] + y, center[2] + z)
  const indices = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3]
  return doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer))
}

export async function buildCarFixture(): Promise<Document> {
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN))
  const buffer = doc.createBuffer()
  const texture = async (name: string, data: Promise<Uint8Array>) =>
    doc.createTexture(name).setURI(`${name}.png`).setMimeType('image/png').setImage(await data)

  const isLamp = (x: number, y: number) => (x === FIXTURE_TAILLIGHT.x && y === FIXTURE_TAILLIGHT.y) || (x === 10 && y === 28)
  const diffuse = await texture('car_body_diffuse', png(64, 32, (x, y) => (isLamp(x, y) ? [200, 30, 20, 255] : [0, 0, 0, 255])))
  const specGloss = await texture('car_body_specularGlossiness', png(64, 32, (x, y) => (x < 8 && y >= 16 ? [60, 128, 26, 178] : [0, 0, 0, 127])))
  const occlusion = await texture('car_body_occlusion', png(64, 32, () => [200, 255, 255, 255]))
  const tireNormal = await texture('car_tire_normal', png(8, 8, () => [128, 128, 255, 255]))
  const tireOcclusion = await texture('car_tire_occlusion', png(8, 8, () => [255, 255, 255, 255]))
  const shadowTexture = await texture('car_shadow_diffuse', png(8, 8, () => [255, 255, 255, 128]))

  const specGlossExtension = doc.createExtension(KHRMaterialsPBRSpecularGlossiness)
  const specGlossMaterial = (name: string): Material =>
    doc.createMaterial(name).setExtension('KHR_materials_pbrSpecularGlossiness', specGlossExtension.createPBRSpecularGlossiness())
  const bodyMaterial = specGlossMaterial('car_body').setBaseColorTexture(diffuse).setOcclusionTexture(occlusion)
  bodyMaterial.setExtension(
    'KHR_materials_pbrSpecularGlossiness',
    specGlossExtension.createPBRSpecularGlossiness().setSpecularGlossinessTexture(specGloss),
  )
  const tireMaterial = specGlossMaterial('car_tire').setNormalTexture(tireNormal).setOcclusionTexture(tireOcclusion)
  const glassMaterial = specGlossMaterial('car_glass')
  const clearcoatMaterial = specGlossMaterial('clearcoat')
  const shadowMaterial = specGlossMaterial('car_shadow').setBaseColorTexture(shadowTexture).setAlphaMode('BLEND')

  const part = (name: string, material: Material, primitive: Primitive): Node =>
    doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive.setMaterial(material)))
  const group = (name: string, ...children: Node[]): Node => {
    const node = doc.createNode(name)
    for (const child of children) node.addChild(child)
    return node
  }

  const top = doc.createNode('Sketchfab_model').setRotation([0, 1, 0, 0]).setScale([0.5, 0.5, 0.5])
  top.addChild(group('car_body', part('car_body_car_body_0', bodyMaterial, box(doc, buffer, [2, 1, 4.4], [0, 0.85, 0]))))
  top.addChild(group('car_glass', part('car_glass_car_glass_0', glassMaterial, box(doc, buffer, [1.6, 0.4, 2], [0, 1.45, -0.2]))))
  top.addChild(group('clearcoat', part('clearcoat_clearcoat_0', clearcoatMaterial, box(doc, buffer, [2.1, 1.1, 4.5], [0, 0.85, 0]))))
  top.addChild(group('car_shadow', part('car_shadow_car_shadow_0', shadowMaterial, box(doc, buffer, [10, 0, 10]))))
  for (const [position, x, z] of WHEELS) {
    const wheel = group(
      `car_wheel_${position}`,
      part(`car_wheel_${position}_car_tire_0`, tireMaterial, box(doc, buffer, [0.3, 0.7, 0.7])),
      part(`car_wheel_${position}_car_body_0`, bodyMaterial, box(doc, buffer, [0.32, 0.5, 0.5])),
    )
    const brake = group(`car_brake_${position}`, part(`car_brake_${position}_car_body_0`, bodyMaterial, box(doc, buffer, [0.1, 0.2, 0.3], [0, 0.1, 0])))
    top.addChild(wheel.setTranslation([x, 0.35, z]))
    top.addChild(brake.setTranslation([x, 0.35, z]))
  }
  const scene = doc.createScene('Sketchfab_Scene').addChild(top)
  doc.getRoot().setDefaultScene(scene)
  return doc
}

export function fixtureConfig(overrides: Partial<CarConfig> = {}): CarConfig {
  return {
    ...carConfig,
    atlas: {
      ...carConfig.atlas,
      plate: { x: 16, y: 2, width: 12, height: 8 },
      taillights: { x: 40, y: 16, width: 16, height: 8 },
      outputSize: [32, 16],
    },
    textureMaxSize: 8,
    ...overrides,
  }
}
