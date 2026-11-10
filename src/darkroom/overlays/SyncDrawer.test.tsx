import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../../config/copy'
import { SyncDrawer } from './SyncDrawer'

const vault = vi.hoisted(() => ({
  tokenSaved: false,
  unsynced: true,
  saveToken: vi.fn(async () => undefined),
  forgetToken: vi.fn(async () => undefined),
  lock: vi.fn(),
}))
vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))

beforeEach(() => {
  vault.tokenSaved = false
  vault.unsynced = true
  vi.clearAllMocks()
})

describe('SyncDrawer', () => {
  it('saves the gate token and shows unsynced', async () => {
    render(<SyncDrawer />)
    fireEvent.click(screen.getByText(copy.darkroom.syncGate))
    expect(screen.getByText(copy.darkroom.unsynced)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(copy.darkroom.syncGate), { target: { value: 'tok' } })
    fireEvent.click(screen.getByText(copy.darkroom.saveGate))
    await waitFor(() => expect(vault.saveToken).toHaveBeenCalledWith('tok'))
  })

  it('offers forget when token saved', () => {
    vault.tokenSaved = true
    vault.unsynced = false
    render(<SyncDrawer />)
    fireEvent.click(screen.getByText(copy.darkroom.syncGate))
    fireEvent.click(screen.getByText(copy.darkroom.forgetGate))
    expect(vault.forgetToken).toHaveBeenCalled()
    expect(screen.queryByText(copy.darkroom.unsynced)).toBeNull()
  })

  it('lock button calls lock', () => {
    render(<SyncDrawer />)
    fireEvent.click(screen.getByText('上锁'))
    expect(vault.lock).toHaveBeenCalled()
  })
})
