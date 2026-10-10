import { useTexture } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

const url = (name: string) => `${import.meta.env.BASE_URL}textures/${name}.webp`

export const TEXTURE_URLS = {
  floor: [url('garage_floor_diff'), url('garage_floor_rough'), url('garage_floor_nor')],
  wall: [url('wall_metal_diff'), url('wall_metal_rough'), url('wall_metal_nor')],
} satisfies Record<string, [string, string, string]>

export function useTiledTextures(urls: [string, string, string], repeat: [number, number]) {
  const [base, rough, normal] = useTexture(urls) as Texture[]
  const textures = useMemo(() => {
    const [map, roughnessMap, normalMap] = [base, rough, normal].map((texture) => {
      const tiled = texture.clone()
      tiled.wrapS = tiled.wrapT = RepeatWrapping
      tiled.repeat.set(repeat[0], repeat[1])
      tiled.anisotropy = 4
      tiled.needsUpdate = true
      return tiled
    })
    map.colorSpace = SRGBColorSpace
    return { map, roughnessMap, normalMap }
  }, [base, rough, normal, repeat[0], repeat[1]])
  useEffect(
    () => () => {
      textures.map.dispose()
      textures.roughnessMap.dispose()
      textures.normalMap.dispose()
    },
    [textures],
  )
  return textures
}
