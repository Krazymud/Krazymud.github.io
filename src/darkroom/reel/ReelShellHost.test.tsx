import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReelShellHost } from './ReelShellHost'

const mockContentWindow = vi.hoisted(() => ({ postMessage: vi.fn() }))

const vault = vi.hoisted(() => ({
  photos: [
    {
      source: 'photos/p1',
      thumb: 'photos/p1-thumb',
      full: 'photos/p1-full',
      caption: 'a',
      date: '2024-01-01',
      width: 1,
      height: 1,
      hash: 'ph1',
    },
    {
      source: 'photos/p2',
      thumb: 'photos/p2-thumb',
      full: 'photos/p2-full',
      caption: 'b',
      date: '2024-01-02',
      width: 1,
      height: 1,
      hash: 'ph2',
    },
  ],
  notes: [
    {
      source: 'notes/n1',
      title: '夜',
      date: '2026-03-01',
      blob: 'notes/n1.blob',
      hash: 'nh1',
    },
  ],
  lists: [] as { source: string; title: string; blob: string; hash: string }[],
  loading: false,
  lock: vi.fn(),
  readBlob: vi.fn(async () => new Uint8Array([0xff, 0xd8, 0xff])),
  saveNote: vi.fn(),
  saveList: vi.fn(),
  deleteNote: vi.fn(),
  deleteList: vi.fn(),
}))

vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  vault.loading = false
  vault.notes = [
    {
      source: 'notes/n1',
      title: '夜',
      date: '2026-03-01',
      blob: 'notes/n1.blob',
      hash: 'nh1',
    },
  ]
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    configurable: true,
    get() {
      return mockContentWindow as unknown as Window
    },
  })
})

describe('ReelShellHost', () => {
  it('keeps iframe key stable when only note hashes change', async () => {
    const { rerender } = render(<ReelShellHost />)
    const iframe = await screen.findByTestId('reel-shell')

    vault.notes = [
      {
        source: 'notes/n1',
        title: '夜',
        date: '2026-03-01',
        blob: 'notes/n1.blob',
        hash: 'nh-changed',
      },
    ]
    rerender(<ReelShellHost />)
    await waitFor(() => expect(vault.readBlob.mock.calls.length).toBeGreaterThan(2))
    const iframeAfter = screen.getByTestId('reel-shell')
    expect(iframeAfter).toBe(iframe)
  })

  it('handles paper-save for notes and posts paper-result', async () => {
    vault.saveNote.mockResolvedValue({ ok: false, reason: 'title' })
    render(<ReelShellHost />)
    const iframe = await screen.findByTestId('reel-shell')
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          roll: 'paper-save',
          kind: 'note',
          id: 'p1',
          page: { source: 'notes/n1', title: '夜', date: '2026-03-01', body: '风' },
        },
        source: mockContentWindow as unknown as Window,
      }),
    )

    await waitFor(() =>
      expect(vault.saveNote).toHaveBeenCalledWith({
        source: 'notes/n1',
        title: '夜',
        date: '2026-03-01',
        body: '风',
      }),
    )
    await waitFor(() =>
      expect(mockContentWindow.postMessage).toHaveBeenCalledWith(
        { roll: 'paper-result', id: 'p1', ok: false, reason: 'title' },
        '*',
      ),
    )
  })
})
