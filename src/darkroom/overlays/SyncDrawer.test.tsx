import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../../config/copy'
import { SyncDrawer } from './SyncDrawer'

const vault = vi.hoisted(() => ({
  tokenSaved: false,
  unsynced: true,
  tokenError: null as string | null,
  syncing: false,
  retrySync: vi.fn(async () => undefined),
  saveToken: vi.fn(async () => undefined),
  forgetToken: vi.fn(async () => undefined),
  lock: vi.fn(),
}))
vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))

beforeEach(() => {
  vault.tokenSaved = false
  vault.unsynced = true
  vault.tokenError = null
  vault.syncing = false
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

  it('offers a retry when a saved gate is still unsynced', () => {
    vault.tokenSaved = true
    render(<SyncDrawer />)
    fireEvent.click(screen.getByText(copy.darkroom.retrySync))
    expect(vault.retrySync).toHaveBeenCalled()
  })

  it('shows the denied-gate error and no retry', () => {
    vault.tokenSaved = true
    vault.tokenError = '同步口令不对'
    render(<SyncDrawer />)
    expect(screen.getByRole('alert')).toHaveTextContent('同步口令不对')
    expect(screen.queryByText(copy.darkroom.retrySync)).toBeNull()
  })

  it('shows syncing progress instead of unsynced', () => {
    vault.syncing = true
    render(<SyncDrawer />)
    expect(screen.getByRole('status')).toHaveTextContent(copy.darkroom.syncing)
    expect(screen.queryByText(copy.darkroom.unsynced)).toBeNull()
  })

  it('can be opened by its parent', () => {
    render(<SyncDrawer open />)
    expect(screen.getByLabelText(copy.darkroom.syncGate)).toBeTruthy()
  })
})
