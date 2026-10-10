import { useFrame } from '@react-three/fiber'
import { useRef, type MutableRefObject } from 'react'
import type { Ambience } from '../ambience'
import { damp, TRANSITION_LAMBDA } from '../motion'
import type { Pose } from '../poses'
import { useIgnitionLevel } from './useIgnitionLevel'

export interface RoomLevel {
  presence: number
  glow: number
}

export const ROOM_ANCHOR = { position: [5.26, 0, -7.31] as [number, number, number], rotationY: Math.atan2(-0.584, 0.812) }

export function useRoomLevel(pose: Pose, ambience: Ambience, deterministic: boolean): MutableRefObject<RoomLevel> {
  const lights = useIgnitionLevel()
  const level = useRef<RoomLevel>({ presence: pose.room, glow: pose.room * ambience.strips })
  useFrame((_, delta) => {
    const presence = deterministic ? pose.room : damp(level.current.presence, pose.room, TRANSITION_LAMBDA, Math.min(delta, 0.1))
    level.current.presence = presence
    level.current.glow = presence * ambience.strips * lights.current
  }, -1)
  return level
}
