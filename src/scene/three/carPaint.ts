import { Color, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import type { Mods } from '../../garage/mods'

export interface CarFinish {
  paint: { value: Color }
  wheel: MeshStandardMaterial | null
  wheelSurface: { metalness: number; roughness: number }
  caliper: MeshStandardMaterial | null
}

function materialsByName(scene: Object3D): Map<string, MeshStandardMaterial> {
  const found = new Map<string, MeshStandardMaterial>()
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    for (const material of [object.material].flat()) {
      if (material instanceof MeshStandardMaterial) found.set(material.name, material)
    }
  })
  return found
}

export function finishCar(scene: Object3D): CarFinish {
  const cached = scene.userData.finish as CarFinish | undefined
  if (cached) return cached
  const materials = materialsByName(scene)
  const paint = { value: new Color('#090909') }
  const body = materials.get('body')
  if (body) {
    // 车身贴图的 alpha 是构建脚本写入的车漆遮罩；材质不透明，alpha 不参与混合。
    body.onBeforeCompile = (shader) => {
      shader.uniforms.uPaint = paint
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 uPaint;\nvoid main() {')
        .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, uPaint, sampledDiffuseColor.a );')
    }
    body.customProgramCacheKey = () => 'car-paint'
    body.needsUpdate = true
  }
  const wheel = materials.get('wheel') ?? null
  const finish: CarFinish = {
    paint,
    wheel,
    wheelSurface: { metalness: wheel?.metalness ?? 1, roughness: wheel?.roughness ?? 1 },
    caliper: materials.get('caliper') ?? null,
  }
  scene.userData.finish = finish
  return finish
}

export function applyMods(finish: CarFinish, mods: Mods): void {
  finish.paint.value.set(mods.paint.hex)
  if (finish.wheel) {
    finish.wheel.color.set(mods.rim.hex)
    Object.assign(finish.wheel, mods.rim.surface ?? finish.wheelSurface)
  }
  finish.caliper?.color.set(mods.caliper.hex)
}
