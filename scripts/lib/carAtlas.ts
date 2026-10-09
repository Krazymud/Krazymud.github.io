import sharp from 'sharp'
import { CarError, type AtlasConfig, type Rect } from './carTypes.ts'

export type Rgb = [number, number, number]

export interface RawImage {
  data: Uint8Array
  width: number
  height: number
}

export interface PixelOut {
  base: Rgb
  roughness: number
  metallic: number
}

export const DIELECTRIC = 0.04
export const PAINT_BASE = 9
export const PAINT_ROUGHNESS = 0.55
export const PLATE_ROUGHNESS = 0.6

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const unit = (rgb: Rgb): Rgb => [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255]

export async function decodeRgba(image: Uint8Array): Promise<RawImage> {
  const { data, info } = await sharp(image).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 4) throw new CarError(`贴图解码后应有 4 个通道，实际 ${info.channels} 个`)
  return { data, width: info.width, height: info.height }
}

export function solveMetallic(diffuse: number, specular: number, oneMinusSpecularStrength: number): number {
  if (specular < DIELECTRIC) return 0
  const a = DIELECTRIC
  const b = (diffuse * oneMinusSpecularStrength) / (1 - DIELECTRIC) + specular - 2 * DIELECTRIC
  const c = DIELECTRIC - specular
  const discriminant = Math.max(b * b - 4 * a * c, 0)
  return clamp01((-b + Math.sqrt(discriminant)) / (2 * a))
}

export function specGlossPixel(diffuse: Rgb, specular: Rgb, glossiness: number): PixelOut {
  if (glossiness === 0) return { base: diffuse, roughness: 1, metallic: 0 }
  const oneMinus = 1 - Math.max(...specular)
  const metallic = solveMetallic(luminance(diffuse), luminance(specular), oneMinus)
  const t = metallic * metallic
  const dielectricScale = oneMinus / (1 - DIELECTRIC) / Math.max(1 - metallic, 1e-4)
  const base = diffuse.map((d, i) =>
    clamp01(d * dielectricScale * (1 - t) + ((specular[i] - DIELECTRIC * (1 - metallic)) / Math.max(metallic, 1e-4)) * t),
  ) as Rgb
  return { base, roughness: 1 - glossiness, metallic }
}

export function isPaint(rgb: Rgb, paint: Rgb, tolerance: number): boolean {
  return rgb.every((value, i) => Math.abs(value - paint[i]) <= tolerance)
}

export function isTaillight([r, g, b]: Rgb): boolean {
  return r >= 90 && r >= 1.6 * b && g <= 0.85 * r
}

export function inRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

export interface AtlasPixels {
  baseColor: Uint8Array
  orm: Uint8Array
  emissive: Uint8Array
  emissivePixels: number
  width: number
  height: number
}

function classify(x: number, y: number, diffuse: Rgb, specular: Rgb, glossiness: number, lit: boolean, config: AtlasConfig): PixelOut {
  if (inRect(x, y, config.plate)) return { base: unit(diffuse), roughness: PLATE_ROUGHNESS, metallic: 0 }
  if (isPaint(specular, config.paintSpecular, config.paintTolerance)) {
    const paint = PAINT_BASE / 255
    return { base: [paint, paint, paint], roughness: PAINT_ROUGHNESS, metallic: 0 }
  }
  if (lit) return { base: unit(diffuse), roughness: 1 - glossiness, metallic: 0 }
  return specGlossPixel(unit(diffuse), unit(specular), glossiness)
}

export function convertAtlas(diffuse: RawImage, specGloss: RawImage, occlusion: RawImage, config: AtlasConfig): AtlasPixels {
  const { width, height } = diffuse
  for (const other of [specGloss, occlusion]) {
    if (other.width !== width || other.height !== height) {
      throw new CarError(`车身贴图尺寸不一致：${width}×${height} 和 ${other.width}×${other.height}`)
    }
  }
  const baseColor = new Uint8Array(width * height * 3)
  const orm = new Uint8Array(width * height * 3)
  const emissive = new Uint8Array(width * height * 3)
  let emissivePixels = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const o = (y * width + x) * 3
      const d: Rgb = [diffuse.data[i], diffuse.data[i + 1], diffuse.data[i + 2]]
      const s: Rgb = [specGloss.data[i], specGloss.data[i + 1], specGloss.data[i + 2]]
      const glossiness = specGloss.data[i + 3] / 255
      const lit = inRect(x, y, config.taillights) && isTaillight(d)
      const pixel = classify(x, y, d, s, glossiness, lit, config)
      baseColor[o] = Math.round(pixel.base[0] * 255)
      baseColor[o + 1] = Math.round(pixel.base[1] * 255)
      baseColor[o + 2] = Math.round(pixel.base[2] * 255)
      orm[o] = occlusion.data[i]
      orm[o + 1] = Math.round(pixel.roughness * 255)
      orm[o + 2] = Math.round(pixel.metallic * 255)
      if (lit) {
        emissive.set(d, o)
        emissivePixels++
      }
    }
  }
  return { baseColor, orm, emissive, emissivePixels, width, height }
}

export function plateSvg(text: string, width: number, height: number): string {
  const border = Math.max(1, Math.round(height * 0.05))
  const radius = Math.round(height * 0.07)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<rect width="${width}" height="${height}" rx="${radius}" fill="#1c1c1f"/>`,
    `<rect x="${border}" y="${border}" width="${width - 2 * border}" height="${height - 2 * border}" rx="${Math.max(0, radius - border)}" fill="#d4d4d8"/>`,
    `<text x="${width / 2}" y="${height / 2}" dominant-baseline="central" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(height * 0.36)}" textLength="${Math.round(width * 0.8)}" lengthAdjust="spacingAndGlyphs" fill="#1c1c1f">${text}</text>`,
    '</svg>',
  ].join('')
}

export async function paintPlate(rgb: Uint8Array, width: number, height: number, plate: Rect, text: string): Promise<Uint8Array> {
  if (plate.x < 0 || plate.y < 0 || plate.x + plate.width > width || plate.y + plate.height > height) {
    throw new CarError(`车牌区域 ${plate.x},${plate.y} ${plate.width}×${plate.height} 超出贴图 ${width}×${height}`)
  }
  const overlay = await sharp(Buffer.from(plateSvg(text, plate.width, plate.height))).flop().png().toBuffer()
  const { data, info } = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .composite([{ input: overlay, left: plate.x, top: plate.y }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.channels !== 3) throw new CarError(`车牌合成后应有 3 个通道，实际 ${info.channels} 个`)
  return data
}

export interface BodyTextures {
  baseColor: Uint8Array
  orm: Uint8Array
  emissive: Uint8Array
  emissivePixels: number
}

export async function buildBodyTextures(
  images: { diffuse: Uint8Array; specularGlossiness: Uint8Array; occlusion: Uint8Array },
  config: AtlasConfig,
): Promise<BodyTextures> {
  const [diffuse, specGloss, occlusion] = await Promise.all([
    decodeRgba(images.diffuse),
    decodeRgba(images.specularGlossiness),
    decodeRgba(images.occlusion),
  ])
  const pixels = convertAtlas(diffuse, specGloss, occlusion, config)
  if (pixels.emissivePixels === 0) throw new CarError('尾灯区域里没有找到红橙色像素，请检查 car.config.ts 的 taillights')
  const withPlate = await paintPlate(pixels.baseColor, pixels.width, pixels.height, config.plate, config.plateText)
  const [outWidth, outHeight] = config.outputSize
  const encode = (data: Uint8Array) =>
    sharp(data, { raw: { width: pixels.width, height: pixels.height, channels: 3 } })
      .resize(outWidth, outHeight, { fit: 'fill' })
      .webp({ quality: 82 })
      .toBuffer()
  return {
    baseColor: await encode(withPlate),
    orm: await encode(pixels.orm),
    emissive: await encode(pixels.emissive),
    emissivePixels: pixels.emissivePixels,
  }
}

export function fitWebp(image: Uint8Array, maxSize: number, quality = 82): Promise<Uint8Array> {
  return sharp(image).resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer()
}
