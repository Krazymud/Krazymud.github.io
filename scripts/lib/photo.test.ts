// @vitest-environment node
import exifr from 'exifr'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import { photoDate, processPhoto, type HeicDecoder } from './photo.ts'

function canvas(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#c1272d' } })
}

const GPS_EXIF = {
  IFD0: { Make: 'Test' },
  IFD2: { DateTimeOriginal: '2024:05:20 18:30:00' },
  IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '31/1 14/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '121/1 28/1 0/1' },
}

describe('processPhoto', () => {
  it('shrinks to 2000px, makes a 400px square thumbnail and strips all metadata', async () => {
    const source = await canvas(3000, 1500).withExif(GPS_EXIF).jpeg().toBuffer()
    expect(await exifr.gps(source)).toMatchObject({ latitude: expect.any(Number) })

    const result = await processPhoto('IMG_0001.JPG', source)
    expect(result).toMatchObject({ width: 2000, height: 1000 })
    const full = await sharp(result.full).metadata()
    expect(full).toMatchObject({ format: 'webp', width: 2000, height: 1000 })
    expect(full.exif).toBeUndefined()
    expect(await sharp(result.thumb).metadata()).toMatchObject({ format: 'webp', width: 400, height: 400 })
  })

  it('never enlarges small photos', async () => {
    const source = await canvas(300, 200).png().toBuffer()
    expect(await processPhoto('small.png', source)).toMatchObject({ width: 300, height: 200 })
  })

  it('turns photos upright using the EXIF orientation', async () => {
    const source = await canvas(64, 32).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    expect(await processPhoto('turned.jpg', source)).toMatchObject({ width: 32, height: 64 })
  })

  it('decodes HEIC through the injected decoder', async () => {
    const decode = vi.fn<HeicDecoder>(async () => ({ width: 6, height: 4, data: new Uint8ClampedArray(6 * 4 * 4).fill(128) }))
    const bytes = new Uint8Array([1, 2, 3])
    const result = await processPhoto('IMG_0002.HEIC', bytes, decode)
    expect(decode).toHaveBeenCalledWith({ buffer: bytes })
    expect(result).toMatchObject({ width: 6, height: 4 })
    expect(await sharp(result.full).metadata()).toMatchObject({ format: 'webp' })
    expect(await sharp(result.thumb).metadata()).toMatchObject({ width: 400, height: 400 })
  })
})

describe('photoDate', () => {
  it('uses the EXIF capture date', async () => {
    const source = await canvas(8, 8).withExif(GPS_EXIF).jpeg().toBuffer()
    expect(await photoDate(source, new Date(2000, 0, 1))).toBe('2024-05-20')
  })

  it('falls back to the given date when there is no EXIF date', async () => {
    const source = await canvas(8, 8).png().toBuffer()
    expect(await photoDate(source, new Date(2023, 0, 2, 12))).toBe('2023-01-02')
  })
})
