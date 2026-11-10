import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../../config/copy'
import { ViewerOverlay } from './ViewerOverlay'

const vault = vi.hoisted(() => ({
  rolls: [
    { id: 'sea', title: '海滨', photoSources: ['p2', 'p1'] },
    { id: 'city', title: '城市', photoSources: ['p3'] },
  ],
  photos: [
    { source: 'p1', thumb: 't1', full: 'f1', caption: 'a', date: '', width: 1, height: 1, hash: 'h' },
    { source: 'p2', thumb: 't2', full: 'f2', caption: 'b', date: '', width: 1, height: 1, hash: 'h' },
    { source: 'p3', thumb: 't3', full: 'f3', caption: 'c', date: '', width: 1, height: 1, hash: 'h' },
    { source: 'p4', thumb: 't4', full: 'f4', caption: 'd', date: '', width: 1, height: 1, hash: 'h' },
  ],
  readBlob: vi.fn(async () => new Uint8Array([1])),
}))
vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:x') as never
  URL.revokeObjectURL = vi.fn()
  vault.readBlob.mockClear()
})

describe('ViewerOverlay', () => {
  it('steps through every photo in roll order, ending with unfiled ones', async () => {
    render(<ViewerOverlay onClose={() => undefined} />)
    expect(screen.getByTestId('viewer-position')).toHaveTextContent('1 / 4')
    await waitFor(() => expect(vault.readBlob).toHaveBeenCalledWith('f2'))
    fireEvent.click(screen.getByText(copy.darkroom.next))
    await waitFor(() => expect(vault.readBlob).toHaveBeenCalledWith('f1'))
    fireEvent.click(screen.getByText(copy.darkroom.next))
    fireEvent.click(screen.getByText(copy.darkroom.next))
    await waitFor(() => expect(vault.readBlob).toHaveBeenCalledWith('f4'))
    expect(screen.getByTestId('viewer-position')).toHaveTextContent('4 / 4')
    expect(screen.getByText(copy.darkroom.next)).toBeDisabled()
    fireEvent.click(screen.getByText(copy.darkroom.prev))
    expect(screen.getByTestId('viewer-position')).toHaveTextContent('3 / 4')
  })

  it('has an HTML back control', () => {
    const onClose = vi.fn()
    render(<ViewerOverlay onClose={onClose} />)
    fireEvent.click(screen.getByText(copy.darkroom.back))
    expect(onClose).toHaveBeenCalled()
  })
})
