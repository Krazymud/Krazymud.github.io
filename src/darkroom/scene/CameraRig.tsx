import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { anchorForFocus, type FocusId } from './cameraFocus'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function CameraRig({ focus }: { focus: FocusId }) {
  const camera = useThree((s) => s.camera)
  const anchor = useMemo(() => anchorForFocus(focus), [focus])
  const look = useRef(new Vector3(...anchor.target))
  const goal = useMemo(() => new Vector3(...anchor.position), [anchor])
  const goalLook = useMemo(() => new Vector3(...anchor.target), [anchor])

  useEffect(() => {
    if (prefersReducedMotion()) {
      camera.position.copy(goal)
      look.current.copy(goalLook)
      camera.lookAt(goalLook)
    }
  }, [camera, goal, goalLook])

  useFrame((_, dt) => {
    if (prefersReducedMotion()) return
    const k = 1 - Math.exp(-4 * dt)
    camera.position.lerp(goal, k)
    look.current.lerp(goalLook, k)
    camera.lookAt(look.current)
  })
  return null
}
