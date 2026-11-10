import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../../config/copy'
import { TrayOverlay } from './TrayOverlay'

const vault = vi.hoisted(() => ({
  addPhoto: vi.fn(async (): Promise<{ ok: true } | { ok: false; reason: string }> => ({ ok: true })),
  canEdit: true,
  tokenSaved: true,
  tokenError: null as string | null,
  syncing: false,
  loading: false,
}))
vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))
vi.mock('../../vault/photoProcess', () => ({
  processVaultPhoto: vi.fn(async () => ({ full: new Uint8Array([1]), thumb: new Uint8Array([2]), width: 3, height: 4, date: '2026-01-02' })),
}))

const file = () => new File(['x'], 'a.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  vault.canEdit = true
  vault.tokenSaved = true
  vault.tokenError = null
  vault.addPhoto.mockClear()
})

describe('TrayOverlay', () => {
  it('processes a chosen image and adds the photo', async () => {
    render(<TrayOverlay onClose={() => undefined} />)
    const input = screen.getByTestId('tray-file') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file()] } })
    await waitFor(() =>
      expect(vault.addPhoto).toHaveBeenCalledWith({ caption: '', date: '2026-01-02', full: new Uint8Array([1]), thumb: new Uint8Array([2]), width: 3, height: 4 }),
    )
    expect(await screen.findByTestId('develop-plane')).toBeTruthy()
  })

  it('does not open the file picker on mount (iOS needs a tap)', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')
    render(<TrayOverlay onClose={() => undefined} />)
    expect(click).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('选照片'))
    expect(click).toHaveBeenCalledTimes(1)
    click.mockRestore()
  })

  it('is disabled with a sync-gate nudge when there is no gate', () => {
    vault.canEdit = false
    vault.tokenSaved = false
    const onNeedGate = vi.fn()
    render(<TrayOverlay onClose={() => undefined} onNeedGate={onNeedGate} />)
    expect(screen.getByText('选照片')).toBeDisabled()
    expect(screen.getByTestId('edit-blocked')).toHaveTextContent(copy.darkroom.needGate)
    fireEvent.click(screen.getByText(copy.darkroom.openSync))
    expect(onNeedGate).toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('tray-file'), { target: { files: [file()] } })
    expect(vault.addPhoto).not.toHaveBeenCalled()
  })

  it('maps a failed add to Chinese copy', async () => {
    vault.addPhoto.mockResolvedValueOnce({ ok: false, reason: 'locked' })
    render(<TrayOverlay onClose={() => undefined} />)
    fireEvent.change(screen.getByTestId('tray-file'), { target: { files: [file()] } })
    expect(await screen.findByText(copy.darkroom.preparing)).toBeTruthy()
    expect(screen.getByRole('status').textContent).not.toMatch(/locked/)
  })
})
