import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ListEntry, NoteEntry, PhotoEntry } from '../types'
import type { ReadBlob } from '../useBlob'
import { ListsTab } from './ListsTab'
import { NotesTab } from './NotesTab'
import { monthLabel, PhotoGrid } from './PhotoGrid'

function reader(blobs: Record<string, string>): ReadBlob {
  return async (name) => {
    if (!(name in blobs)) throw new Error('broken')
    return new TextEncoder().encode(blobs[name])
  }
}

const decryptedImages = () => document.querySelectorAll('img[src^="blob:"]')

const photos: PhotoEntry[] = [
  { caption: '第一次去海边', date: '2024-05-20', width: 2000, height: 1500, thumb: 't1', full: 'f1', source: 'photos/a.jpg', hash: 'a' },
  { caption: '', date: '2024-05-02', width: 1500, height: 2000, thumb: 't2', full: 'f2', source: 'photos/b.jpg', hash: 'b' },
  { caption: '', date: '2024-03-02', width: 1500, height: 2000, thumb: 't3', full: 'f3', source: 'photos/c.jpg', hash: 'c' },
]

describe('PhotoGrid', () => {
  it('labels months in Chinese', () => {
    expect(monthLabel('2024-05-20')).toBe('2024 年 5 月')
  })

  it('groups decrypted thumbnails by month', async () => {
    render(<PhotoGrid photos={photos} read={reader({ t1: '1', t2: '2', t3: '3' })} />)
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['2024 年 5 月', '2024 年 3 月'])
    await waitFor(() => expect(decryptedImages()).toHaveLength(3))
  })

  it('shows a placeholder only for a thumbnail that cannot be decrypted', async () => {
    render(<PhotoGrid photos={photos} read={reader({ t1: '1', t3: '3' })} />)
    expect(await screen.findByText('打不开')).toBeInTheDocument()
    await waitFor(() => expect(decryptedImages()).toHaveLength(2))
  })

  it('says so when there are no photos', () => {
    render(<PhotoGrid photos={[]} read={reader({})} />)
    expect(screen.getByText('还没有照片')).toBeInTheDocument()
  })

  it('opens the viewer, moves with the arrow keys and closes with Escape', async () => {
    render(<PhotoGrid photos={photos} read={reader({ t1: '1', t2: '2', t3: '3', f1: 'F1', f2: 'F2' })} />)
    fireEvent.click(screen.getByRole('button', { name: '查看照片 第一次去海边' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument()
    expect(await within(dialog).findByRole('img', { name: '第一次去海边' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(within(dialog).getByText('2 / 3')).toBeInTheDocument()
    expect(await within(dialog).findByRole('img', { name: '2024-05-02' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(await within(dialog).findByText('这张照片打不开')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

const notes: NoteEntry[] = [
  { title: '晚安', date: '2024-05-21', blob: 'n1', source: 'notes/a.md', hash: 'a' },
  { title: '坏掉的', date: '2024-05-01', blob: 'n2', source: 'notes/b.md', hash: 'b' },
]

describe('NotesTab', () => {
  it('previews notes and expands one into rendered Markdown', async () => {
    render(<NotesTab notes={notes} read={reader({ n1: '今天的风很**温柔**。\n\n第二段。' })} />)
    expect(await screen.findByText('今天的风很温柔。 第二段。')).toBeInTheDocument()
    expect(await screen.findByText('这篇笔记打不开')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /晚安/ }))
    expect(screen.getByText('温柔').tagName).toBe('STRONG')
  })

  it('says so when there are no notes', () => {
    render(<NotesTab notes={[]} read={reader({})} />)
    expect(screen.getByText('还没有笔记')).toBeInTheDocument()
  })
})

const lists: ListEntry[] = [{ title: '一起去的地方', blob: 'l1', source: 'lists/a.md', hash: 'a' }]
const listJson = JSON.stringify({
  items: [
    { text: '去看海', done: true },
    { text: '去冰岛看极光', done: false },
  ],
})

describe('ListsTab', () => {
  it('shows progress and the items', async () => {
    render(<ListsTab lists={lists} read={reader({ l1: listJson })} />)
    expect(await screen.findByText('已完成 1 / 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /一起去的地方/ }))
    expect(screen.getByText('去看海')).toHaveClass('line-through')
    expect(screen.getByText('去冰岛看极光')).not.toHaveClass('line-through')
  })

  it('marks a list that cannot be decrypted', async () => {
    render(<ListsTab lists={lists} read={reader({})} />)
    expect(await screen.findByText('这个清单打不开')).toBeInTheDocument()
  })
})
