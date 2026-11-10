import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../../config/copy'
import { LetterOverlay } from './LetterOverlay'

type Entry = { title: string; blob: string; source: string; hash: string; date?: string }

const vault = vi.hoisted(() => ({
  notes: [] as Entry[],
  lists: [] as Entry[],
  loading: false,
  canEdit: true,
  tokenSaved: true,
  tokenError: null as string | null,
  syncing: false,
  readBlob: vi.fn(),
  saveNote: vi.fn(),
  saveList: vi.fn(),
  deleteNote: vi.fn(),
  deleteList: vi.fn(),
  toggleListItem: vi.fn(),
}))
vi.mock('../VaultBridge', () => ({ useDarkroomVault: () => vault }))

const enc = (s: string) => new TextEncoder().encode(s)

beforeEach(() => {
  vi.resetAllMocks()
  vault.notes = [{ title: 'N1', date: '2024-01-02', blob: 'nb', source: 'n1', hash: 'h' }]
  vault.lists = [{ title: 'L1', blob: 'lb', source: 'l1', hash: 'h' }]
  vault.loading = false
  vault.canEdit = true
  vault.tokenSaved = true
  vault.tokenError = null
  vault.syncing = false
})

describe('LetterOverlay', () => {
  it('saves a note with edited fields via saveNote', async () => {
    vault.readBlob.mockResolvedValue(enc('hello'))
    vault.saveNote.mockResolvedValue({ ok: true })
    render(<LetterOverlay onClose={() => undefined} />)
    fireEvent.click(screen.getByText('N1'))
    await waitFor(() => expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe('hello'))
    expect(screen.getByTestId('note-letter').dataset.stationery).toBe('typewriter')
    expect(screen.getByTestId('note-letter')).toHaveClass('dr-letter-paper')
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: 'hello!' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(vault.saveNote).toHaveBeenCalledWith({ source: 'n1', title: 'N1', date: '2024-01-02', body: 'hello!' }))
  })

  it('creates a note from a blank sheet without source', async () => {
    vault.saveNote.mockResolvedValue({ ok: true })
    render(<LetterOverlay onClose={() => undefined} />)
    fireEvent.click(screen.getByText(copy.darkroom.letterBlankNote))
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: 'T' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(vault.saveNote).toHaveBeenCalledWith(expect.objectContaining({ source: undefined, title: 'T' })))
  })

  it('selects the created note after saving a blank sheet', async () => {
    vault.readBlob.mockResolvedValue(enc('body'))
    vault.saveNote.mockImplementation(async () => {
      vault.notes = [...vault.notes, { title: 'T', date: '2024-02-03', blob: 'nb2', source: 'n2', hash: 'h' }]
      return { ok: true }
    })
    const { rerender } = render(<LetterOverlay onClose={() => undefined} />)
    fireEvent.click(screen.getByText(copy.darkroom.letterBlankNote))
    expect(screen.queryByText('撕掉')).toBeNull()
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: 'T' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(vault.saveNote).toHaveBeenCalled())
    rerender(<LetterOverlay onClose={() => undefined} />)
    expect(await screen.findByText('撕掉')).toBeTruthy()
    await waitFor(() => expect(vault.readBlob).toHaveBeenCalledWith('nb2'))
    expect((screen.getByLabelText('标题') as HTMLInputElement).value).toBe('T')
  })

  it('resets the selection after a note is deleted', async () => {
    vault.readBlob.mockResolvedValue(enc('hello'))
    vault.deleteNote.mockResolvedValue({ ok: true })
    render(<LetterOverlay onClose={() => undefined} />)
    fireEvent.click(screen.getByText('N1'))
    fireEvent.click(await screen.findByText('撕掉'))
    await waitFor(() => expect(vault.deleteNote).toHaveBeenCalledWith('n1'))
    await waitFor(() => expect(screen.queryByTestId('note-letter')).toBeNull())
  })

  it('toggles a list item via toggleListItem on a form-style letter', async () => {
    vault.readBlob.mockResolvedValue(enc(JSON.stringify({ items: [{ text: 'a', done: false }] })))
    vault.toggleListItem.mockResolvedValue({ ok: true })
    render(<LetterOverlay onClose={() => undefined} initialMode="lists" />)
    fireEvent.click(screen.getByText('L1'))
    const box = await screen.findByRole('checkbox')
    expect(screen.getByTestId('list-letter').dataset.stationery).toBe('form')
    expect(screen.getByTestId('list-letter')).toHaveClass('dr-letter-paper', 'dr-letter-form')
    fireEvent.click(box)
    await waitFor(() => expect(vault.toggleListItem).toHaveBeenCalledWith('l1', 0, true))
  })

  it('saves a blank form via saveList', async () => {
    vault.saveList.mockResolvedValue({ ok: true })
    render(<LetterOverlay onClose={() => undefined} initialMode="lists" />)
    fireEvent.click(screen.getByText(copy.darkroom.letterBlankList))
    fireEvent.change(screen.getByLabelText('事项名称'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('新增条目'), { target: { value: 'one\ntwo' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() =>
      expect(vault.saveList).toHaveBeenCalledWith({ source: undefined, title: 'X', items: [{ text: 'one', done: false }, { text: 'two', done: false }] }),
    )
  })

  it('selects a just-created list so its items can be toggled', async () => {
    vault.readBlob.mockResolvedValue(enc(JSON.stringify({ items: [{ text: 'one', done: false }] })))
    vault.toggleListItem.mockResolvedValue({ ok: true })
    vault.saveList.mockImplementation(async () => {
      vault.lists = [...vault.lists, { title: 'X', blob: 'lb2', source: 'l2', hash: 'h' }]
      return { ok: true }
    })
    const { rerender } = render(<LetterOverlay onClose={() => undefined} initialMode="lists" />)
    fireEvent.click(screen.getByText(copy.darkroom.letterBlankList))
    fireEvent.change(screen.getByLabelText('事项名称'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('新增条目'), { target: { value: 'one' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(vault.saveList).toHaveBeenCalled())
    rerender(<LetterOverlay onClose={() => undefined} initialMode="lists" />)
    expect(await screen.findByText('作废')).toBeTruthy()
    const box = await screen.findByRole('checkbox')
    await waitFor(() => expect(box).not.toBeDisabled())
    fireEvent.click(box)
    await waitFor(() => expect(vault.toggleListItem).toHaveBeenCalledWith('l2', 0, true))
  })
})

describe('LetterOverlay without a sync gate', () => {
  beforeEach(() => {
    vault.canEdit = false
    vault.tokenSaved = false
    vault.readBlob.mockResolvedValue(enc('hello'))
  })

  it('disables saving, explains why and points at the sync drawer', async () => {
    const onNeedGate = vi.fn()
    render(<LetterOverlay onClose={() => undefined} onNeedGate={onNeedGate} />)
    expect(screen.getByTestId('edit-blocked')).toHaveTextContent(copy.darkroom.needGate)
    fireEvent.click(screen.getByText(copy.darkroom.letterBlankNote))
    const save = screen.getByText('保存')
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(vault.saveNote).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(copy.darkroom.openSync))
    expect(onNeedGate).toHaveBeenCalled()
  })

  it('disables list toggles and deletes', async () => {
    vault.readBlob.mockResolvedValue(enc(JSON.stringify({ items: [{ text: 'a', done: false }] })))
    render(<LetterOverlay onClose={() => undefined} initialMode="lists" />)
    fireEvent.click(screen.getByText('L1'))
    expect(await screen.findByRole('checkbox')).toBeDisabled()
    expect(screen.getByText('作废')).toBeDisabled()
  })

  it('shows the denied-gate copy instead of the missing-gate copy', () => {
    vault.tokenSaved = true
    vault.tokenError = '同步口令不对'
    render(<LetterOverlay onClose={() => undefined} />)
    expect(screen.getByTestId('edit-blocked')).toHaveTextContent(copy.darkroom.gateDenied)
  })

  it('maps a locked result to Chinese copy and never prints the raw reason', async () => {
    vault.canEdit = true
    vault.tokenSaved = true
    vault.saveNote.mockResolvedValue({ ok: false, reason: 'locked' })
    render(<LetterOverlay onClose={() => undefined} />)
    fireEvent.click(screen.getByText(copy.darkroom.letterBlankNote))
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(screen.getByRole('status')).not.toBeEmptyDOMElement())
    expect(screen.getByRole('status').textContent).not.toMatch(/locked|blob/)
  })

  it('maps a blob failure to Chinese copy', async () => {
    vault.canEdit = true
    vault.tokenSaved = true
    vault.saveNote.mockResolvedValue({ ok: false, reason: 'blob' })
    render(<LetterOverlay onClose={() => undefined} />)
    fireEvent.click(screen.getByText(copy.darkroom.letterBlankNote))
    fireEvent.click(screen.getByText('保存'))
    expect(await screen.findByText(copy.darkroom.blobFailed)).toBeTruthy()
  })
})
