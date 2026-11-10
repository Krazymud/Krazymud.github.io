import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LettersBeat } from './LettersBeat'

const next = vi.fn()

vi.mock('./ReelStage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./ReelStage')>()
  return { ...mod, useReel: () => ({ scene: 'letters', go: vi.fn(), next }) }
})

const vault = vi.hoisted(() => ({
  notes: [] as { title: string; blob: string; source: string; hash: string; date?: string }[],
  readBlob: vi.fn(),
  loading: false,
}))

vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))

const enc = (s: string) => new TextEncoder().encode(s)

beforeEach(() => {
  vi.clearAllMocks()
  vault.notes = []
  vault.loading = false
  vault.readBlob.mockReset()
})

describe('LettersBeat', () => {
  it('shows invite and skip when vault has no notes', () => {
    render(<LettersBeat />)
    expect(screen.getByTestId('letters-beat')).toHaveAttribute('data-empty', 'true')
    expect(screen.getByText(/还没有信/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /略过|继续/i }))
    expect(next).toHaveBeenCalledOnce()
  })

  it('shows first note title and body', async () => {
    vault.notes = [{ title: '昨夜', date: '2024-11-01', blob: 'nb', source: 'n1', hash: 'h' }]
    vault.readBlob.mockResolvedValue(enc('烛光下的字句'))
    render(<LettersBeat />)
    expect(screen.getByTestId('letters-beat')).toHaveAttribute('data-empty', 'false')
    expect(screen.getByTestId('letters-card')).toBeInTheDocument()
    expect(screen.getByText('昨夜')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('烛光下的字句')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /继续/i }))
    expect(next).toHaveBeenCalledOnce()
  })
})
