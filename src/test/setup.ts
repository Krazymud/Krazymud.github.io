import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetPrefsCache } from '../prefs/prefs'

/**
 * jsdom's canvas 2d is incomplete; Deploy uses `npm ci --ignore-scripts`,
 * so we cannot rely on the native `canvas` package. Provide a lightweight
 * ImageData-backed 2d context for unit tests (labels, polaroids, book tex).
 */
function installJsdomCanvas2dPolyfill(): void {
  if (typeof HTMLCanvasElement === 'undefined') return

  type Store = { w: number; h: number; data: Uint8ClampedArray }
  const stores = new WeakMap<HTMLCanvasElement, Store>()

  function storeFor(el: HTMLCanvasElement): Store {
    const w = Math.max(1, el.width | 0)
    const h = Math.max(1, el.height | 0)
    let s = stores.get(el)
    if (!s || s.w !== w || s.h !== h) {
      s = { w, h, data: new Uint8ClampedArray(w * h * 4) }
      stores.set(el, s)
    }
    return s
  }

  function parseColor(input: string): [number, number, number, number] {
    const c = input.trim().toLowerCase()
    if (c.startsWith('#')) {
      const hex = c.slice(1)
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16),
          parseInt(hex[1] + hex[1], 16),
          parseInt(hex[2] + hex[2], 16),
          255,
        ]
      }
      if (hex.length >= 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
          255,
        ]
      }
    }
    const rgb = c.match(/^rgba?\(([^)]+)\)$/)
    if (rgb) {
      const parts = rgb[1].split(',').map((p) => Number(p.trim()))
      return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts.length > 3 ? Math.round(parts[3] * 255) : 255]
    }
    return [0, 0, 0, 255]
  }

  function fillRect(s: Store, x: number, y: number, w: number, h: number, rgba: [number, number, number, number]) {
    const x0 = Math.max(0, Math.floor(x))
    const y0 = Math.max(0, Math.floor(y))
    const x1 = Math.min(s.w, Math.ceil(x + w))
    const y1 = Math.min(s.h, Math.ceil(y + h))
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * s.w + px) * 4
        s.data[i] = rgba[0]
        s.data[i + 1] = rgba[1]
        s.data[i + 2] = rgba[2]
        s.data[i + 3] = rgba[3]
      }
    }
  }

  const nativeGetContext = HTMLCanvasElement.prototype.getContext

  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type, options) {
    if (type === '2d') {
      const el = this
      const ctx = {
        canvas: el,
        fillStyle: '#000000',
        strokeStyle: '#000000',
        font: '10px sans-serif',
        textAlign: 'start' as CanvasTextAlign,
        textBaseline: 'alphabetic' as CanvasTextBaseline,
        globalAlpha: 1,
        lineWidth: 1,
        shadowColor: 'transparent',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        filter: 'none',
        save() {},
        restore() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        rect() {},
        arc() {},
        fill() {},
        stroke() {},
        clip() {},
        translate() {},
        rotate() {},
        scale() {},
        setTransform() {},
        resetTransform() {},
        clearRect(x: number, y: number, w: number, h: number) {
          fillRect(storeFor(el), x, y, w, h, [0, 0, 0, 0])
        },
        fillRect(x: number, y: number, w: number, h: number) {
          fillRect(storeFor(el), x, y, w, h, parseColor(String(this.fillStyle)))
        },
        strokeRect() {},
        fillText(_t: string, x: number, y: number) {
          // Approximate glyph footprint so getImageData near band/title finds ink.
          fillRect(storeFor(el), x - 40, y - 24, 80, 28, parseColor(String(this.fillStyle)))
        },
        strokeText() {},
        measureText(t: string) {
          return { width: String(t).length * 8 } as TextMetrics
        },
        drawImage(
          image: CanvasImageSource,
          sx: number,
          sy?: number,
          sw?: number,
          sh?: number,
          dx?: number,
          dy?: number,
          dw?: number,
          dh?: number,
        ) {
          const s = storeFor(el)
          // Support both drawImage(img,dx,dy) and drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh)
          let destX = 0
          let destY = 0
          let destW = s.w
          let destH = s.h
          if (typeof sw === 'number' && typeof dx === 'number') {
            destX = dx
            destY = dy ?? 0
            destW = dw ?? sw
            destH = dh ?? sh ?? destW
          } else {
            destX = sx
            destY = sy ?? 0
            const anyImg = image as { width?: number; height?: number }
            destW = anyImg.width ?? s.w
            destH = anyImg.height ?? s.h
          }
          // If source is one of our canvases, blit pixels; else paint a solid stand-in.
          if (image instanceof HTMLCanvasElement) {
            const src = storeFor(image)
            for (let row = 0; row < destH; row++) {
              for (let col = 0; col < destW; col++) {
                const sxPix = Math.min(src.w - 1, Math.floor((col / Math.max(1, destW)) * src.w))
                const syPix = Math.min(src.h - 1, Math.floor((row / Math.max(1, destH)) * src.h))
                const si = (syPix * src.w + sxPix) * 4
                const dxPix = Math.floor(destX + col)
                const dyPix = Math.floor(destY + row)
                if (dxPix < 0 || dyPix < 0 || dxPix >= s.w || dyPix >= s.h) continue
                const di = (dyPix * s.w + dxPix) * 4
                s.data[di] = src.data[si]
                s.data[di + 1] = src.data[si + 1]
                s.data[di + 2] = src.data[si + 2]
                s.data[di + 3] = src.data[si + 3]
              }
            }
          } else {
            fillRect(s, destX, destY, destW, destH, [100, 140, 90, 255])
          }
        },
        createImageData(w: number, h?: number) {
          const width = Math.max(1, Math.floor(w))
          const height = Math.max(1, Math.floor(h ?? w))
          return {
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height,
            colorSpace: 'srgb',
          } as ImageData
        },
        getImageData(x: number, y: number, w: number, h: number) {
          const s = storeFor(el)
          const out = new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4)
          for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
              const sx = Math.floor(x + col)
              const sy = Math.floor(y + row)
              const oi = (row * w + col) * 4
              if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) {
                out[oi + 3] = 0
                continue
              }
              const si = (sy * s.w + sx) * 4
              out[oi] = s.data[si]
              out[oi + 1] = s.data[si + 1]
              out[oi + 2] = s.data[si + 2]
              out[oi + 3] = s.data[si + 3]
            }
          }
          return { data: out, width: w, height: h, colorSpace: 'srgb' } as ImageData
        },
        putImageData(imageData: ImageData, dx: number, dy: number) {
          const s = storeFor(el)
          const { width: w, height: h, data } = imageData
          for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
              const tx = Math.floor(dx + col)
              const ty = Math.floor(dy + row)
              if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) continue
              const si = (row * w + col) * 4
              const di = (ty * s.w + tx) * 4
              s.data[di] = data[si]
              s.data[di + 1] = data[si + 1]
              s.data[di + 2] = data[si + 2]
              s.data[di + 3] = data[si + 3]
            }
          }
        },
        createLinearGradient() {
          return { addColorStop() {} }
        },
        createRadialGradient() {
          return { addColorStop() {} }
        },
        createPattern() {
          return null
        },
      }
      return ctx as unknown as CanvasRenderingContext2D
    }
    return nativeGetContext.call(this, type, options)
  } as typeof HTMLCanvasElement.prototype.getContext

  HTMLCanvasElement.prototype.toDataURL = function () {
    return 'data:image/png;base64,AAAA'
  }
  HTMLCanvasElement.prototype.toBlob = function (cb) {
    cb?.(new Blob([new Uint8Array([0])], { type: 'image/png' }))
  }
}

installJsdomCanvas2dPolyfill()

afterEach(() => {
  cleanup()
  resetPrefsCache()
})
