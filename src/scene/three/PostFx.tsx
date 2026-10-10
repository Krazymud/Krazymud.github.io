import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { BlendFunction, type ChromaticAberrationEffect } from 'postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import { Vector2 } from 'three'
import { onNitro } from '../events'
import type { Fx } from '../fxTiers'
import { nitroOffset } from '../motion'

export function PostFx({ deterministic }: { deterministic: boolean; fx: Fx }) {
  const aberration = useRef<ChromaticAberrationEffect>(null)
  const nitroAt = useRef(-Infinity)
  const clock = useThree((state) => state.clock)
  const zero = useMemo(() => new Vector2(0, 0), [])

  useEffect(
    () =>
      onNitro(() => {
        nitroAt.current = clock.elapsedTime
      }),
    [clock],
  )

  useFrame(({ clock: frameClock }) => {
    const offset = nitroOffset(frameClock.elapsedTime - nitroAt.current)
    aberration.current?.offset.set(offset, offset)
  })

  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.7} intensity={0.7} />
      <ChromaticAberration ref={aberration} offset={zero} radialModulation={false} modulationOffset={0} />
      <Vignette offset={0.3} darkness={0.75} />
      <Noise opacity={deterministic ? 0 : 0.05} blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  )
}
