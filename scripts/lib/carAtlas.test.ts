// @vitest-environment node
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { carConfig } from '../car.config.ts'
import {
  buildBodyTextures,
  convertAtlas,
  decodeRgba,
  fitWebp,
  isTaillight,
  PAINT_BASE,
  PAINT_ROUGHNESS,
  paintPlate,
  plateSvg,
  PLATE_ROUGHNESS,
  specGlossPixel,
  type RawImage,
} from './carAtlas.ts'
import { CarError, type AtlasConfig } from './carTypes.ts'

const W = 16
const H = 8
const config: AtlasConfig = {
  ...carConfig.atlas,
  plate: { x: 0, y: 0, width: 4, height: 4 },
  taillights: { x: 8, y: 0, width: 8, height: 4 },
  outputSize: [8, 4],
}

type Rgba = [number, number, number, number]

function image(fill: (x: number, y: number) => Rgba, width = W, height = H): RawImage {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4)
  return { data, width, height }
}

const png = (img: RawImage) => sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } }).png().toBuffer()
const rgbAt = (rgb: Uint8Array, x: number, y: number, width = W) => [...rgb.slice((y * width + x) * 3, (y * width + x) * 3 + 3)]

const RED: Rgba = [200, 30, 20, 255]
const diffuse = image((x, y) => ((x === 10 && y === 2) || (x === 6 && y === 6) ? RED : [0, 0, 0, 255]))
const specGloss = image((x, y) => (x === 5 && y === 5 ? [60, 128, 26, 178] : [10, 10, 10, 127]))
const occlusion = image(() => [200, 255, 255, 255])

describe('specGlossPixel', () => {
  it('keeps a plain dielectric as it is', () => {
    const out = specGlossPixel([0.5, 0.5, 0.5], [0.04, 0.04, 0.04], 0.5)
    expect(out.metallic).toBeCloseTo(0)
    out.base.forEach((v) => expect(v).toBeCloseTo(0.5))
    expect(out.roughness).toBeCloseTo(0.5)
  })

  it('turns a bright specular over black into polished metal', () => {
    const out = specGlossPixel([0, 0, 0], [0.95, 0.95, 0.95], 0.95)
    expect(out.metallic).toBeCloseTo(1, 3)
    out.base.forEach((v) => expect(v).toBeCloseTo(0.95, 2))
    expect(out.roughness).toBeCloseTo(0.05)
  })

  it('treats zero-gloss padding as rough non-metal', () => {
    expect(specGlossPixel([0.2, 0.2, 0.2], [1, 1, 1], 0)).toEqual({ base: [0.2, 0.2, 0.2], roughness: 1, metallic: 0 })
  })
})

describe('isTaillight', () => {
  it('picks red and amber lamp pixels only', () => {
    expect(isTaillight([120, 0, 5])).toBe(true)
    expect(isTaillight([255, 170, 40])).toBe(true)
    expect(isTaillight([255, 255, 255])).toBe(false)
    expect(isTaillight([50, 10, 10])).toBe(false)
  })
})

describe('convertAtlas', () => {
  const out = convertAtlas(diffuse, specGloss, occlusion, config)

  it('paints the body area matte black', () => {
    expect(rgbAt(out.baseColor, 5, 5)).toEqual([PAINT_BASE, PAINT_BASE, PAINT_BASE])
    expect(rgbAt(out.orm, 5, 5)).toEqual([200, Math.round(PAINT_ROUGHNESS * 255), 0])
  })

  it('lights up red pixels inside the taillight area only', () => {
    expect(rgbAt(out.emissive, 10, 2)).toEqual([200, 30, 20])
    expect(rgbAt(out.emissive, 6, 6)).toEqual([0, 0, 0])
    expect(out.emissivePixels).toBe(1)
    expect(rgbAt(out.baseColor, 10, 2)).toEqual([200, 30, 20])
    expect(rgbAt(out.orm, 10, 2)[2]).toBe(0)
  })

  it('makes the plate a plain non-metal', () => {
    expect(rgbAt(out.orm, 1, 1)).toEqual([200, Math.round(PLATE_ROUGHNESS * 255), 0])
  })

  it('copies the occlusion into the red channel', () => {
    expect(rgbAt(out.orm, 3, 7)[0]).toBe(200)
  })

  it('marks only paint pixels in the paint mask', () => {
    expect(out.paintMask.length).toBe(W * H)
    expect(out.paintMask[5 * W + 5]).toBe(255)
    expect(out.paintMask[7 * W + 3]).toBe(0)
    expect(out.paintMask[2 * W + 10]).toBe(0)
  })

  it('keeps the plate out of the paint mask', () => {
    const paintedPlate = image((x, y) => ((x === 1 && y === 1) || (x === 5 && y === 5) ? [60, 128, 26, 178] : [10, 10, 10, 127]))
    const mask = convertAtlas(diffuse, paintedPlate, occlusion, config).paintMask
    expect(mask[1 * W + 1]).toBe(0)
    expect(mask[5 * W + 5]).toBe(255)
  })

  it('rejects textures of different sizes', () => {
    const small = image(() => [0, 0, 0, 255], 8, 8)
    expect(() => convertAtlas(diffuse, specGloss, small, config)).toThrow(CarError)
  })
})

describe('plate', () => {
  it('writes only the new number', () => {
    const svg = plateSvg('WE-456', 302, 200)
    expect(svg).toContain('WE-456')
    expect(svg).not.toMatch(/NEW YORK|EMPIRE/)
  })

  it('escapes plate text before putting it into the SVG', async () => {
    const svg = plateSvg(`<R&D "1">'`, 302, 200)
    expect(svg).toContain('&lt;R&amp;D &quot;1&quot;&gt;&apos;</text>')
    await expect(paintPlate(new Uint8Array(64 * 32 * 3), 64, 32, { x: 8, y: 8, width: 30, height: 20 }, 'R&D <1>')).resolves.toBeDefined()
  })

  it('draws inside the plate area and nowhere else', async () => {
    const width = 64
    const height = 32
    const plate = { x: 8, y: 8, width: 30, height: 20 }
    const painted = await paintPlate(new Uint8Array(width * height * 3), width, height, plate, 'WE-456')
    let bright = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [r] = rgbAt(painted, x, y, width)
        const inside = x >= plate.x && x < plate.x + plate.width && y >= plate.y && y < plate.y + plate.height
        if (!inside) expect(r).toBe(0)
        else if (r > 150) bright++
      }
    }
    expect(bright).toBeGreaterThan(50)
  })

  it('mirrors the plate vertically to match the flipped plate UVs', async () => {
    const width = 80
    const height = 48
    const plate = { x: 4, y: 4, width: 60, height: 40 }
    const painted = await paintPlate(new Uint8Array(width * height * 3), width, height, plate, 'WE-456')
    const upright = await sharp(Buffer.from(plateSvg('WE-456', plate.width, plate.height)))
      .flatten({ background: '#000000' })
      .removeAlpha()
      .raw()
      .toBuffer()
    let dark = 0
    let mismatched = 0
    for (let y = 0; y < plate.height; y++) {
      for (let x = 0; x < plate.width; x++) {
        const [r] = rgbAt(painted, plate.x + x, plate.y + y, width)
        const expected = upright[((plate.height - 1 - y) * plate.width + x) * 3]
        if (r < 80) dark++
        if (Math.abs(r - expected) > 8) mismatched++
      }
    }
    expect(dark).toBeGreaterThan(100)
    expect(mismatched).toBe(0)
  })

  it('refuses a plate area outside the texture', async () => {
    await expect(paintPlate(new Uint8Array(16 * 8 * 3), 16, 8, { x: 10, y: 0, width: 10, height: 4 }, 'WE-456')).rejects.toThrow(CarError)
  })
})

describe('buildBodyTextures', () => {
  it('encodes all three maps as WebP at the output size', async () => {
    const result = await buildBodyTextures(
      { diffuse: await png(diffuse), specularGlossiness: await png(specGloss), occlusion: await png(occlusion) },
      config,
    )
    expect(result.emissivePixels).toBe(1)
    for (const data of [result.baseColor, result.orm, result.emissive]) {
      const meta = await sharp(data).metadata()
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 8, 4])
    }
    expect(await sharp(result.baseColor).metadata()).toMatchObject({ channels: 4, hasAlpha: true })
    expect((await sharp(result.orm).metadata()).hasAlpha).toBe(false)
  })

  it('keeps the colour under unpainted pixels when shrinking', async () => {
    const lamps = image((x, y) => (x >= 10 && x < 12 && y >= 2 && y < 4 ? RED : [0, 0, 0, 255]))
    const result = await buildBodyTextures(
      { diffuse: await png(lamps), specularGlossiness: await png(specGloss), occlusion: await png(occlusion) },
      config,
    )
    const raw = await sharp(result.baseColor).raw().toBuffer()
    const lamp = [...raw.subarray((1 * 8 + 5) * 4, (1 * 8 + 5) * 4 + 4)]
    expect(lamp[3]).toBe(0)
    expect(lamp[0]).toBeGreaterThan(40)
    expect(raw[(2 * 8 + 2) * 4 + 3]).toBeGreaterThan(0)
  })

  it('fails when the taillight area has no lamp pixels', async () => {
    const dark = image(() => [0, 0, 0, 255])
    const images = { diffuse: await png(dark), specularGlossiness: await png(specGloss), occlusion: await png(occlusion) }
    await expect(buildBodyTextures(images, config)).rejects.toThrow(CarError)
    await expect(buildBodyTextures(images, config)).rejects.toThrow(/尾灯/)
  })
})

describe('decodeRgba and fitWebp', () => {
  it('always decodes to four channels', async () => {
    const gray = await sharp({ create: { width: 4, height: 2, channels: 3, background: '#808080' } }).toColourspace('b-w').png().toBuffer()
    const decoded = await decodeRgba(gray)
    expect(decoded.data.length).toBe(4 * 2 * 4)
  })

  it('shrinks to the longest side without enlarging', async () => {
    const big = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#808080' } }).png().toBuffer()
    expect(await sharp(await fitWebp(big, 10)).metadata()).toMatchObject({ format: 'webp', width: 10, height: 5 })
    expect(await sharp(await fitWebp(big, 100)).metadata()).toMatchObject({ width: 40, height: 20 })
  })
})
