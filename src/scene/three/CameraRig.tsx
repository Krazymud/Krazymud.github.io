import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { dampFactor, TRANSITION_LAMBDA } from '../motion'
import { framedCamera, type Pose } from '../poses'

interface CameraRigProps {
  pose: Pose
  deterministic: boolean
}

export function CameraRig({ pose, deterministic }: CameraRigProps) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const goal = useMemo(() => new Vector3(), [])
  const lookGoal = useMemo(() => new Vector3(), [])
  const look = useRef<Vector3 | null>(null)

  useFrame((_, delta) => {
    goal.fromArray(framedCamera(pose, size.width / Math.max(size.height, 1)))
    lookGoal.fromArray(pose.target)
    if (deterministic || look.current === null) {
      camera.position.copy(goal)
      look.current = lookGoal.clone()
    } else {
      const k = dampFactor(TRANSITION_LAMBDA, Math.min(delta, 0.1))
      camera.position.lerp(goal, k)
      look.current.lerp(lookGoal, k)
    }
    camera.lookAt(look.current)
  })

  return null
}
