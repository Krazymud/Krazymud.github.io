import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { createCanvas } from 'canvas'
import { afterEach } from 'vitest'
import { resetPrefsCache } from '../prefs/prefs'

if (typeof HTMLCanvasElement !== 'undefined') {
  const canvasBacking = new WeakMap<HTMLCanvasElement, ReturnType<typeof createCanvas>>()

  HTMLCanvasElement.prototype.getContext = function (type: string): RenderingContext | null {
    if (type === '2d') {
      const w = this.width || 1
      const h = this.height || 1
      let node = canvasBacking.get(this)
      if (!node || node.width !== w || node.height !== h) {
        node = createCanvas(w, h)
        canvasBacking.set(this, node)
      }
      return node.getContext('2d') as unknown as CanvasRenderingContext2D
    }
    return null
  }
}

afterEach(() => {
  cleanup()
  resetPrefsCache()
})
