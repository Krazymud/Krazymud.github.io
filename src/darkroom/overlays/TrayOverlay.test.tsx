import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrayOverlay } from './TrayOverlay'

const vault = vi.hoisted(() => ({ addPhoto: vi.fn(async () => ({ ok: true })) }))
vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))
vi.mock('../../vault/photoProcess', () => ({
  processVaultPhoto: vi.fn(async () => ({ full: new Uint8Array([1]), thumb: new Uint8Array([2]), width: 3, height: 4, date: '2026-01-02' })),
}))

describe('TrayOverlay', () => {
  it('processes a chosen image and adds the photo', async () => {
    render(<TrayOverlay onClose={() => undefined} />)
    const input = screen.getByTestId('tray-file') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() =>
      expect(vault.addPhoto).toHaveBeenCalledWith({ caption: '', date: '2026-01-02', full: new Uint8Array([1]), thumb: new Uint8Array([2]), width: 3, height: 4 }),
    )
    expect(await screen.findByTestId('develop-plane')).toBeTruthy()
  })
})
