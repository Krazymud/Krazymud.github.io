import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PhotoEntry } from '../types'
import { PhotoViewer } from './PhotoViewer'

const photos: PhotoEntry[] = [
  { date: '2024-05-01', caption: '海边', width: 100, height: 100, full: 'f1', thumb: 't1', source: 'a', hash: 'h1' },
  { date: '2024-05-02', caption: '', width: 100, height: 100, full: 'f2', thumb: 't2', source: 'b', hash: 'h2' },
]

function read(name: string) {
  return Promise.resolve(new TextEncoder().encode(name === 'f1' || name === 'f2' ? 'x' : ''))
}

describe('PhotoViewer', () => {
  it('portals the dialog to document.body and locks background scroll', () => {
    const onClose = vi.fn()
    render(
      <div data-testid="host">
        <PhotoViewer photos={photos} index={0} read={read} onIndex={() => {}} onClose={onClose} />
      </div>,
    )
    const dialog = screen.getByRole('dialog', { name: '照片' })
    expect(dialog.parentElement).toBe(document.body)
    expect(document.body.style.overflow).toBe('hidden')
    expect(within(dialog).getByRole('button', { name: '关闭' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '上一张' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('resets image transform on double-click', async () => {
    render(<PhotoViewer photos={photos} index={0} read={read} onIndex={() => {}} onClose={() => {}} />)
    const img = await screen.findByRole('img', { name: '海边' })
    expect(img).toHaveStyle({ transform: 'translate(0px, 0px) scale(1)' })
    fireEvent.doubleClick(img)
    expect(img).toHaveStyle({ transform: 'translate(0px, 0px) scale(1)' })
  })

  it('closes when tapping non-control overlay areas but not image or nav buttons', async () => {
    const onClose = vi.fn()
    const onIndex = vi.fn()
    render(
      <PhotoViewer photos={photos} index={0} read={read} onIndex={onIndex} onClose={onClose} />,
    )
    const dialog = screen.getByRole('dialog', { name: '照片' })
    await screen.findByRole('img', { name: '海边' })

    fireEvent.click(within(dialog).getByText('1 / 2'))
    expect(onClose).toHaveBeenCalledTimes(1)

    onClose.mockClear()
    fireEvent.click(screen.getByRole('img', { name: '海边' }))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: '下一张' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(onIndex).toHaveBeenCalledWith(1)
  })
})
