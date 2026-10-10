import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Box3, Group, Mesh, MeshStandardMaterial, Texture, Vector3, type Object3D } from 'three'
import { modsFor } from '../../garage/mods'
import { usePrefs } from '../../prefs/prefs'
import { damp, WHEEL_SPEED } from '../motion'
import type { Pose } from '../poses'
import { initialTurntable, stepTurntable } from '../turntable'
import { applyMods, finishCar } from './carPaint'
import { Turntable, TURNTABLE_HEIGHT } from './Turntable'
import { useCarDrag } from './useCarDrag'
import { useIgnitionLevel } from './useIgnitionLevel'

export const CAR_URL = `${import.meta.env.BASE_URL}models/car.glb`

interface CarRig {
  wheels: Group[]
}

function rigCar(scene: Object3D): CarRig {
  const cached = scene.userData.rig as CarRig | undefined
  if (cached) return cached
  scene.updateMatrixWorld(true)
  const targets: Object3D[] = []
  scene.traverse((object) => {
    if (typeof object.userData.wheel === 'string') targets.push(object)
  })
  // meshopt 量化会挪动节点原点，所以绕包围盒中心另建枢轴，按场景的 X 轴（车的横向）转
  const wheels = targets.map((wheel) => {
    const pivot = new Group()
    pivot.name = `pivot_${wheel.userData.wheel}`
    pivot.position.copy(scene.worldToLocal(new Box3().setFromObject(wheel).getCenter(new Vector3())))
    scene.add(pivot)
    pivot.updateMatrixWorld(true)
    pivot.attach(wheel)
    return pivot
  })
  scene.traverse((object) => {
    if (object instanceof Mesh && !Array.isArray(object.material) && object.material.transparent) {
      object.material.depthWrite = false
      object.renderOrder = 1
    }
  })
  const rig = { wheels }
  scene.userData.rig = rig
  return rig
}

function disposeObject(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    for (const material of [object.material].flat()) {
      for (const value of Object.values(material)) if (value instanceof Texture) value.dispose()
      material.dispose()
    }
  })
}

function glowingMaterials(scene: Object3D): MeshStandardMaterial[] {
  const found = new Set<MeshStandardMaterial>()
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    for (const material of [object.material].flat()) {
      if (material instanceof MeshStandardMaterial && material.emissiveMap) {
        material.userData.baseEmissive ??= material.emissiveIntensity
        found.add(material)
      }
    }
  })
  return [...found]
}

interface CarProps {
  pose: Pose
  deterministic: boolean
}

export function Car({ pose, deterministic }: CarProps) {
  const { scene } = useGLTF(CAR_URL, false, true)
  const rig = useMemo(() => rigCar(scene), [scene])
  const glow = useMemo(() => glowingMaterials(scene), [scene])
  const finish = useMemo(() => finishCar(scene), [scene])
  const { paint, rim, caliper } = usePrefs()
  useLayoutEffect(() => applyMods(finish, modsFor({ paint, rim, caliper })), [finish, paint, rim, caliper])
  const lights = useIgnitionLevel()
  const group = useRef<Group>(null)
  const turntable = useRef(initialTurntable(pose.carYaw ?? 0))
  const wheelSpeed = useRef(0)
  useCarDrag(turntable, pose.spin && !deterministic)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (!deterministic) turntable.current = stepTurntable(turntable.current, dt, { spin: pose.spin, holdYaw: pose.carYaw })
    if (group.current) group.current.rotation.y = turntable.current.angle
    wheelSpeed.current = damp(wheelSpeed.current, pose.trackLines && !deterministic ? WHEEL_SPEED : 0, 2, dt)
    for (const wheel of rig.wheels) wheel.rotation.x += wheelSpeed.current * dt
    for (const material of glow) material.emissiveIntensity = (material.userData.baseEmissive as number) * lights.current
  })

  useEffect(() => () => disposeObject(scene), [scene])

  return (
    <group ref={group}>
      <Turntable pose={pose} deterministic={deterministic} />
      <primitive object={scene} position-y={TURNTABLE_HEIGHT} />
    </group>
  )
}
