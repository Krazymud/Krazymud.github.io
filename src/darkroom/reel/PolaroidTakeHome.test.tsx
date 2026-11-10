import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PolaroidTakeHomeProvider, usePolaroidTakeHome } from './PolaroidTakeHome'

vi.mock('./polaroidRender', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./polaroidRender')>()
  return {
    ...mod,
    renderPolaroidFront: vi.fn(async () => {
      const c = document.createElement('canvas')
      c.width = 100
      c.height = 100
      return c
    }),
    downloadPolaroidsZip: vi.fn(async () => undefined),
    openPrintSheet: vi.fn(async () => undefined),
  }
})

function Opener() {
  const { open } = usePolaroidTakeHome()
  return (
    <button
      type="button"
      onClick={() =>
        open([
          {
            previewUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            caption: '测试',
            date: '2024-01-01',
            index: 0,
          },
        ])
      }
    >
      打开
    </button>
  )
}

describe('PolaroidTakeHome', () => {
  it('opens modal with download and print actions', () => {
    render(
      <PolaroidTakeHomeProvider>
        <Opener />
      </PolaroidTakeHomeProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '打开' }))
    expect(screen.getByTestId('polaroid-take-home')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /下载 ZIP/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /打印剪裁/i })).toBeInTheDocument()
  })
})
