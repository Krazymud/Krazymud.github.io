import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LetterOverlay } from './LetterOverlay'

const vault = vi.hoisted(() => ({
  notes: [{ title: 'N1', date: '2024-01-02', blob: 'nb', source: 'n1', hash: 'h' }],
  lists: [{ title: 'L1', blob: 'lb', source: 'l1', hash: 'h' }],
  readBlob: vi.fn(),
  saveNote: vi.fn(),
  saveList: vi.fn(),
  deleteNote: vi.fn(),
  deleteList: vi.fn(),
  toggleListItem: vi.fn(),
}))
vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))

const enc = (s: string) => new TextEncoder().encode(s)

describe('LetterOverlay', () => {
  it('saves a note with edited fields via saveNote', async () => {
    vault.readBlob.mockResolvedValue(enc('hello'))
    vault.saveNote.mockResolvedValue({ ok: true })
    render(<LetterOverlay onClose={() => undefined} />)
    fireEvent.click(screen.getByText('N1'))
    await waitFor(() => expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe('hello'))
    expect(screen.getByTestId('note-letter').dataset.stationery).toBe('typewriter')
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: 'hello!' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(vault.saveNote).toHaveBeenCalledWith({ source: 'n1', title: 'N1', date: '2024-01-02', body: 'hello!' }))
  })

  it('creates a note from a blank sheet without source', async () => {
    vault.saveNote.mockResolvedValue({ ok: true })
    render(<LetterOverlay onClose={() => undefined} />)
    fireEvent.click(screen.getByText('空白信纸'))
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: 'T' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(vault.saveNote).toHaveBeenCalledWith(expect.objectContaining({ source: undefined, title: 'T' })))
  })

  it('toggles a list item via toggleListItem on a form-style letter', async () => {
    vault.readBlob.mockResolvedValue(enc(JSON.stringify({ items: [{ text: 'a', done: false }] })))
    vault.toggleListItem.mockResolvedValue({ ok: true })
    render(<LetterOverlay onClose={() => undefined} initialMode="lists" />)
    fireEvent.click(screen.getByText('L1'))
    const box = await screen.findByRole('checkbox')
    expect(screen.getByTestId('list-letter').dataset.stationery).toBe('form')
    fireEvent.click(box)
    await waitFor(() => expect(vault.toggleListItem).toHaveBeenCalledWith('l1', 0, true))
  })

  it('saves a blank form via saveList', async () => {
    vault.saveList.mockResolvedValue({ ok: true })
    render(<LetterOverlay onClose={() => undefined} initialMode="lists" />)
    fireEvent.click(screen.getByText('空白表格'))
    fireEvent.change(screen.getByLabelText('事项名称'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('新增条目'), { target: { value: 'one\ntwo' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() =>
      expect(vault.saveList).toHaveBeenCalledWith({ source: undefined, title: 'X', items: [{ text: 'one', done: false }, { text: 'two', done: false }] }),
    )
  })
})
