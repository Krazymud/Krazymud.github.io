import { Node, type Document, type Material, type Texture } from '@gltf-transform/core'
import {
  EXTTextureWebP,
  KHRMaterialsClearcoat,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsPBRSpecularGlossiness,
} from '@gltf-transform/extensions'
import { flatten, getBounds, join, prune } from '@gltf-transform/functions'
import { groundOffset, groundScale, headingYaw, unionBounds, yawQuaternion, type Bounds, type Vec3 } from './carAlign.ts'
import { buildBodyTextures, fitWebp } from './carAtlas.ts'
import { assignRoles } from './carRoles.ts'
import { CarError, type CarConfig, type Role } from './carTypes.ts'

export function linearColor(hex: string): [number, number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return [channel(16), channel(8), channel(0), 1]
}

export interface CarReport {
  meshes: string[]
  materials: string[]
}

export function describeCar(doc: Document): CarReport {
  return {
    meshes: doc.getRoot().listMeshes().map((mesh) => mesh.getName()),
    materials: doc.getRoot().listMaterials().map((material) => material.getName()),
  }
}

async function createMaterials(doc: Document, config: CarConfig): Promise<Record<Role, Material>> {
  const image = (fragment: string): Uint8Array => {
    const data = doc.getRoot().listTextures().find((texture) => texture.getURI().includes(fragment))?.getImage()
    if (!data) throw new CarError(`模型里找不到贴图 ${fragment}`)
    return data
  }
  const webp = (name: string, data: Uint8Array): Texture => doc.createTexture(name).setImage(data).setMimeType('image/webp').setURI(`${name}.webp`)

  const atlas = await buildBodyTextures(
    {
      diffuse: image(config.atlas.diffuse),
      specularGlossiness: image(config.atlas.specularGlossiness),
      occlusion: image(config.atlas.occlusion),
    },
    config.atlas,
  )
  const baseColor = webp('body_base', atlas.baseColor)
  const orm = webp('body_orm', atlas.orm)
  const emissive = webp('body_emissive', atlas.emissive)
  const tireNormal = webp('tire_normal', await fitWebp(image(config.tireNormal), config.textureMaxSize, 90))
  const tireOcclusion = webp('tire_occlusion', await fitWebp(image(config.tireOcclusion), config.textureMaxSize))
  const shadowTexture = webp('shadow', await fitWebp(image(config.shadowTexture), config.textureMaxSize))

  const clearcoat = doc.createExtension(KHRMaterialsClearcoat)
  const emissiveStrength = doc.createExtension(KHRMaterialsEmissiveStrength)

  const body = doc
    .createMaterial('body')
    .setBaseColorTexture(baseColor)
    .setMetallicRoughnessTexture(orm)
    .setOcclusionTexture(orm)
    .setMetallicFactor(1)
    .setRoughnessFactor(1)
    .setEmissiveTexture(emissive)
    .setEmissiveFactor([1, 1, 1])
  body.setExtension('KHR_materials_clearcoat', clearcoat.createClearcoat().setClearcoatFactor(0.3).setClearcoatRoughnessFactor(0.25))
  body.setExtension('KHR_materials_emissive_strength', emissiveStrength.createEmissiveStrength().setEmissiveStrength(3))

  const wheel = doc
    .createMaterial('wheel')
    .setBaseColorTexture(baseColor)
    .setBaseColorFactor([0.45, 0.45, 0.48, 1])
    .setMetallicRoughnessTexture(orm)
    .setOcclusionTexture(orm)
    .setMetallicFactor(1)
    .setRoughnessFactor(0.8)
  const caliper = doc.createMaterial('caliper').setBaseColorFactor(linearColor('#9E1C22')).setMetallicFactor(0.2).setRoughnessFactor(0.4)
  const glass = doc.createMaterial('glass').setBaseColorFactor(linearColor('#050607')).setMetallicFactor(0).setRoughnessFactor(0.05)
  const tire = doc
    .createMaterial('tire')
    .setBaseColorFactor(linearColor('#1A1A1A'))
    .setMetallicFactor(0)
    .setRoughnessFactor(0.9)
    .setNormalTexture(tireNormal)
    .setOcclusionTexture(tireOcclusion)
  const shadow = doc
    .createMaterial('shadow')
    .setBaseColorFactor([0, 0, 0, 1])
    .setBaseColorTexture(shadowTexture)
    .setAlphaMode('BLEND')
    .setMetallicFactor(0)
    .setRoughnessFactor(1)
  return { body, wheel, caliper, glass, tire, shadow }
}

function removeMeshes(doc: Document, patterns: RegExp[]) {
  for (const mesh of doc.getRoot().listMeshes()) {
    if (!patterns.some((pattern) => pattern.test(mesh.getName()))) continue
    for (const parent of mesh.listParents()) if (parent instanceof Node) parent.setMesh(null)
    mesh.dispose()
  }
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function mergeWheels(doc: Document, wheels: CarConfig['wheels']) {
  for (const [position, name] of Object.entries(wheels)) {
    const node = doc.getRoot().listNodes().find((candidate) => candidate.getName() === name)
    if (!node) throw new CarError(`模型里找不到车轮节点 ${name}`)
    if (node.getMesh()) throw new CarError(`车轮节点 ${name} 自己带有网格，无法合并`)
    const mesh = doc.createMesh(`wheel_${position}`)
    for (const child of node.listChildren()) {
      const offset = child.getMatrix().some((value, i) => Math.abs(value - IDENTITY[i]) > 1e-6)
      if (offset || child.listChildren().length > 0) {
        throw new CarError(`车轮 ${name} 的子节点 ${child.getName()} 带有自己的变换或子节点，无法合并`)
      }
      for (const primitive of child.getMesh()?.listPrimitives() ?? []) mesh.addPrimitive(primitive)
      child.dispose()
    }
    if (mesh.listPrimitives().length === 0) throw new CarError(`车轮 ${name} 下面没有网格`)
    node.setMesh(mesh).setExtras({ ...node.getExtras(), wheel: position })
  }
}

function alignCar(doc: Document, targetLength: number, shadow: Material) {
  const root = doc.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const parts = scene.listChildren()
  const wheelAt = (position: string): Vec3 => {
    const wheel = parts.find((node) => node.getExtras().wheel === position)
    if (!wheel) throw new CarError(`摆正时找不到车轮 ${position}`)
    return wheel.getWorldTranslation() as Vec3
  }
  const midpoint = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  const front = midpoint(wheelAt('FL'), wheelAt('FR'))
  const back = midpoint(wheelAt('BL'), wheelAt('BR'))

  const car = doc.createNode('car').setRotation(yawQuaternion(headingYaw(front, back)))
  for (const part of parts) {
    scene.removeChild(part)
    car.addChild(part)
  }
  scene.addChild(car)

  const solidBounds = (): Bounds =>
    unionBounds(
      car
        .listChildren()
        .filter((node) => !node.getMesh()?.listPrimitives().some((primitive) => primitive.getMaterial() === shadow))
        .map((node) => getBounds(node) as Bounds),
    )
  const scale = groundScale(solidBounds(), targetLength)
  car.setScale([scale, scale, scale])
  car.setTranslation(groundOffset(solidBounds()))
}

export async function processCar(doc: Document, config: CarConfig): Promise<void> {
  const root = doc.getRoot()
  const roles = assignRoles(root.listMeshes().map((mesh) => mesh.getName()), config.roles, config.remove)
  const materials = await createMaterials(doc, config)

  removeMeshes(doc, config.remove)
  for (const mesh of root.listMeshes()) {
    const role = roles.get(mesh.getName())
    if (!role) continue
    for (const primitive of mesh.listPrimitives()) primitive.setMaterial(materials[role])
  }
  doc.createExtension(KHRMaterialsPBRSpecularGlossiness).dispose()
  doc.createExtension(EXTTextureWebP).setRequired(true)

  mergeWheels(doc, config.wheels)
  await doc.transform(prune(), flatten(), join({ filter: (node) => node.getExtras().wheel === undefined }))
  alignCar(doc, config.targetLength, materials.shadow)
  await doc.transform(prune())
}
