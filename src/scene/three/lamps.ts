export interface Lamp {
  kind: 'head' | 'tail'
  position: [number, number, number]
}

export interface CarBox {
  min: [number, number, number]
  max: [number, number, number]
}

// 车头朝车模局部坐标 z 的哪一边；各比例是相对包围盒的位置。都在浏览器里对着车模核对。
export const FRONT: 1 | -1 = 1
const LAMP = {
  head: { side: 0.72, height: 0.45, depth: 0.97 },
  tail: { side: 0.75, height: 0.55, depth: 0.98 },
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

export function lampsFor({ min, max }: CarBox): Lamp[] {
  const centerX = (min[0] + max[0]) / 2
  const halfX = (max[0] - min[0]) / 2
  const centerZ = (min[2] + max[2]) / 2
  const halfZ = (max[2] - min[2]) / 2
  return (['head', 'tail'] as const).flatMap((kind) => {
    const { side, height, depth } = LAMP[kind]
    const z = centerZ + (kind === 'head' ? FRONT : -FRONT) * halfZ * depth
    const y = lerp(min[1], max[1], height)
    return [-1, 1].map((sign) => ({ kind, position: [centerX + sign * halfX * side, y, z] as [number, number, number] }))
  })
}

export function facingFade(cosine: number): number {
  const t = Math.min(Math.max((cosine - 0.05) / 0.45, 0), 1)
  return t * t * (3 - 2 * t)
}
