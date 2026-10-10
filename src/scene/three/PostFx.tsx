import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, SSAO, Vignette } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { BlendFunction, type ChromaticAberrationEffect } from 'postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import { Vector2, Vector3 } from 'three'
import { onNitro } from '../events'
import type { Fx } from '../fxTiers'
import { nitroOffset } from '../motion'
import { GradeEffect } from './GradeEffect'

const FOCUS = new Vector3(0, 0.6, 0)

export function PostFx({ deterministic, fx }: { deterministic: boolean; fx: Fx }) {
  const aberration = useRef<ChromaticAberrationEffect>(null)
  const nitroAt = useRef(-Infinity)
  const clock = useThree((state) => state.clock)
  const zero = useMemo(() => new Vector2(0, 0), [])
  const grade = useMemo(() => new GradeEffect(), [])
  useEffect(() => () => grade.dispose(), [grade])

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
    // SSAO 依赖 NormalPass，只在开启环境光遮蔽时才付这份渲染开销。
    <EffectComposer multisampling={4} enableNormalPass={fx.ambientOcclusion}>
      {fx.ambientOcclusion && (
        <SSAO samples={16} radius={0.3} intensity={3} bias={0.025} luminanceInfluence={0.6} resolutionScale={0.5} />
      )}
      {fx.depthOfField && <DepthOfField target={FOCUS} worldFocusRange={5} bokehScale={1.5} />}
      <Bloom mipmapBlur luminanceThreshold={0.7} intensity={0.7} />
      {fx.grade && <primitive object={grade} />}
      <ChromaticAberration ref={aberration} offset={zero} radialModulation={false} modulationOffset={0} />
      <Vignette offset={0.3} darkness={0.75} />
      <Noise opacity={deterministic ? 0 : 0.05} blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  )
}
