import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrayWallBeat } from './TrayWallBeat'

const next = vi.fn()
const openPolaroid = vi.fn()

vi.mock('./ReelStage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./ReelStage')>()
  return { ...mod, useReel: () => ({ scene: 'trayWall', go: vi.fn(), next }) }
})

vi.mock('./PolaroidTakeHome', () => ({
  usePolaroidTakeHome: () => ({ open: openPolaroid }),
}))

const vault = vi.hoisted(() => ({
  photos: [] as {
    source: string
    thumb: string
    full: string
    caption: string
    date: string
    width: number
    height: number
    hash: string
  }[],
  readBlob: vi.fn(),
}))

vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))

beforeEach(() => {
  vi.clearAllMocks()
  vault.photos = []
  vault.readBlob.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:thumb')
  URL.revokeObjectURL = vi.fn()
})

describe('TrayWallBeat', () => {
  it('offers polaroid take-home when photos exist', async () => {
    vault.photos = [
      { source: 'p1', thumb: 't1', full: 'f1', caption: '海边', date: '2024-06-01', width: 1, height: 1, hash: 'h' },
    ]
    vault.readBlob.mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff]))
    render(<TrayWallBeat />)
    const btn = screen.getByRole('button', { name: /带走拍立得/i })
    fireEvent.click(btn)
    await waitFor(() => expect(vault.readBlob).toHaveBeenCalledWith('t1'))
    await waitFor(() =>
      expect(openPolaroid).toHaveBeenCalledWith([
        expect.objectContaining({ caption: '海边', date: '2024-06-01', index: 0, previewUrl: 'blob:thumb' }),
      ]),
    )
  })

  it('disables polaroid when vault has no photos', () => {
    render(<TrayWallBeat />)
    expect(screen.getByRole('button', { name: /带走拍立得/i })).toBeDisabled()
  })
})
