import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilmOverlay } from './FilmStrip'

const vault = vi.hoisted(() => ({
  rolls: [
    { id: 'sea', title: '海滨', photoSources: ['p2', 'p1'] },
    { id: 'city', title: '城市', photoSources: ['p3'] },
  ],
  photos: [
    { source: 'p1', thumb: 't1', full: 'f1', caption: 'a', date: '', width: 1, height: 1, hash: 'h' },
    { source: 'p2', thumb: 't2', full: 'f2', caption: 'b', date: '', width: 1, height: 1, hash: 'h' },
    { source: 'p3', thumb: 't3', full: 'f3', caption: 'c', date: '', width: 1, height: 1, hash: 'h' },
  ],
  readBlob: vi.fn(),
}))
vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))

let n = 0
const revoke = vi.fn()
beforeEach(() => {
  n = 0
  vault.readBlob.mockImplementation(async (name: string) => new Uint8Array([1]))
  URL.createObjectURL = vi.fn(() => `blob:${n++}`) as never
  URL.revokeObjectURL = revoke
})
afterEach(() => revoke.mockClear())

describe('FilmOverlay', () => {
  it('lists strip thumbs in roll order after selecting a roll', async () => {
    render(<FilmOverlay mode="rolls" onClose={() => undefined} />)
    fireEvent.click(screen.getByText('海滨'))
    const frames = await screen.findAllByTestId('strip-frame')
    expect(frames.map((f) => f.dataset.source)).toEqual(['p2', 'p1'])
    await waitFor(() => expect(vault.readBlob).toHaveBeenCalledWith('t2'))
    expect(vault.readBlob).toHaveBeenCalledWith('t1')
    expect(vault.readBlob).not.toHaveBeenCalledWith('t3')
  })

  it('revokes thumb urls on unmount', async () => {
    const { unmount } = render(<FilmOverlay mode="rolls" onClose={() => undefined} />)
    fireEvent.click(screen.getByText('海滨'))
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
    unmount()
    expect(revoke).toHaveBeenCalledTimes(2)
  })

  it('lightbox shows full blob of selected frame', async () => {
    render(<FilmOverlay mode="lightbox" onClose={() => undefined} />)
    fireEvent.click(screen.getByText('城市'))
    fireEvent.click(await screen.findByTestId('strip-frame'))
    await waitFor(() => expect(vault.readBlob).toHaveBeenCalledWith('f3'))
    expect(await screen.findByTestId('frame-view')).toBeTruthy()
  })
})
