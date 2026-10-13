import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('opens links in a new tab', async () => {
    render(<NotesTab notes={notes.slice(0, 1)} read={reader({ n1: '看 [x](https://example.com)' })} />)
    await screen.findByText('看 [x](https://example.com)')
    fireEvent.click(screen.getByRole('button', { name: /晚安/ }))
    const link = screen.getByRole('link', { name: 'x' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('says so when there are no notes', () => {
    render(<NotesTab notes={[]} read={reader({})} />)
    expect(screen.getByText('还没有笔记')).toBeInTheDocument()
  })
})

describe('published notes editing', () => {
  const props = { notes: notes.slice(0, 1), read: reader({ n1: '已发布 **正文**' }) }

  it('offers no edit or delete without canEdit', async () => {
    render(<NotesTab {...props} onBeginCreate={() => undefined} onBeginEdit={() => undefined} onDelete={() => undefined} />)
    await screen.findByText('已发布 正文')
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新笔记' })).toBeDisabled()
  })

  it('edits a published note with its loaded body and keeps its source', async () => {
    const onBeginEdit = vi.fn()
    render(<NotesTab {...props} canEdit onBeginEdit={onBeginEdit} onDelete={() => undefined} />)
    await screen.findByText('已发布 正文')
    fireEvent.click(screen.getByRole('button', { name: '编辑' }))
    expect(onBeginEdit).toHaveBeenCalledWith(notes[0], '已发布 **正文**')
  })

  it('waits for the body before editing and disables edit when it cannot be read', async () => {
    render(<NotesTab notes={notes.slice(1)} read={reader({})} canEdit onBeginEdit={() => undefined} onDelete={() => undefined} />)
    await screen.findByText('这篇笔记打不开')
    expect(screen.getByRole('button', { name: '编辑' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '删除' })).toBeEnabled()
  })

  it('shows the form in place of the card being edited', async () => {
    const onSave = vi.fn()
    render(
      <NotesTab
        {...props}
        canEdit
        formOpen
        draft={{ source: 'notes/a.md', title: '晚安', date: '2024-05-21', body: '已发布 **正文**' }}
        onBeginEdit={() => undefined}
        onDelete={() => undefined}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    )
    expect(screen.getByRole('textbox', { name: '正文' })).toHaveValue('已发布 **正文**')
    fireEvent.change(screen.getByRole('textbox', { name: '标题' }), { target: { value: '晚安啦' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).toHaveBeenCalledWith({ source: 'notes/a.md', title: '晚安啦', date: '2024-05-21', body: '已发布 **正文**' })
    expect(screen.queryByRole('button', { name: /晚安/ })).not.toBeInTheDocument()
  })

  it('confirms before deleting by source, and not while a form is open', async () => {
    const onDelete = vi.fn()
    const { rerender } = render(<NotesTab {...props} canEdit onBeginEdit={() => undefined} onDelete={onDelete} />)
    await screen.findByText('已发布 正文')
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    rerender(<NotesTab {...props} canEdit formOpen onBeginEdit={() => undefined} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onDelete).not.toHaveBeenCalled()
    rerender(<NotesTab {...props} canEdit onBeginEdit={() => undefined} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onDelete).toHaveBeenCalledWith('notes/a.md')
  })

  it('does not save an empty title or a bad date, and cancel writes nothing', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(
      <NotesTab
        notes={[]}
        read={reader({})}
        canEdit
        formOpen
        draft={{ title: '  ', date: '2026-02-31', body: '' }}
        onBeginCreate={() => undefined}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByRole('button', { name: '新笔记' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: '标题' })).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(screen.getByRole('textbox', { name: '标题' }), { target: { value: '标题' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByLabelText('日期')).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-10-13' } })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('lists newer notes first', async () => {
    render(<NotesTab notes={[notes[1], notes[0]]} read={reader({ n1: 'a', n2: 'b' })} />)
    await screen.findByText('a')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('晚安'),
      expect.stringContaining('坏掉的'),
    ])
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

describe('published list editing', () => {
  it('toggles a published row by source and index', async () => {
    const onToggle = vi.fn()
    render(<ListsTab lists={lists} read={reader({ l1: listJson })} canEdit onToggle={onToggle} onBeginCreate={() => undefined} />)
    expect(await screen.findByText('已完成 1 / 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /一起去的地方/ }))
    const row = screen.getByRole('button', { name: /去冰岛看极光/ })
    expect(row).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(row)
    expect(onToggle).toHaveBeenCalledWith('lists/a.md', 1, true)
    fireEvent.click(screen.getByRole('button', { name: /去看海/ }))
    expect(onToggle).toHaveBeenCalledWith('lists/a.md', 0, false)
  })

  it('offers no edit, delete or toggle without canEdit', async () => {
    render(<ListsTab lists={lists} read={reader({ l1: listJson })} onToggle={() => undefined} onBeginCreate={() => undefined} />)
    fireEvent.click(await screen.findByRole('button', { name: /一起去的地方/ }))
    expect(screen.getByRole('button', { name: '新清单' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /去看海/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument()
  })

  it('edits a published list with its loaded items', async () => {
    const onBeginEdit = vi.fn()
    render(<ListsTab lists={lists} read={reader({ l1: listJson })} canEdit onBeginEdit={onBeginEdit} onDelete={() => undefined} />)
    await screen.findByText('已完成 1 / 2')
    fireEvent.click(screen.getByRole('button', { name: '编辑' }))
    expect(onBeginEdit).toHaveBeenCalledWith(lists[0], [
      { text: '去看海', done: true },
      { text: '去冰岛看极光', done: false },
    ])
  })

  it('disables edit for a list that cannot be read', async () => {
    render(<ListsTab lists={lists} read={reader({})} canEdit onBeginEdit={() => undefined} onDelete={() => undefined} />)
    await screen.findByText('这个清单打不开')
    expect(screen.getByRole('button', { name: '编辑' })).toBeDisabled()
  })

  it('confirms a whole-list delete by source, and not while a form is open', async () => {
    const onDelete = vi.fn()
    const view = render(<ListsTab lists={lists} read={reader({ l1: listJson })} canEdit onBeginEdit={() => undefined} onDelete={onDelete} />)
    await screen.findByText('已完成 1 / 2')
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    view.rerender(<ListsTab lists={lists} read={reader({ l1: listJson })} canEdit formOpen onBeginEdit={() => undefined} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onDelete).not.toHaveBeenCalled()
    view.rerender(<ListsTab lists={lists} read={reader({ l1: listJson })} canEdit onBeginEdit={() => undefined} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onDelete).toHaveBeenCalledWith('lists/a.md')
  })

  it('saves an edited list with its source, dropping blank rows', async () => {
    const onSave = vi.fn()
    render(
      <ListsTab
        lists={lists}
        read={reader({ l1: listJson })}
        canEdit
        formOpen
        draft={{ source: 'lists/a.md', title: '买菜', items: [{ text: '   ', done: false }, { text: '牛奶', done: true }] }}
        onBeginCreate={() => undefined}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: /一起去的地方/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '加一条' }))
    const rows = screen.getAllByRole('textbox')
    fireEvent.change(rows[rows.length - 1], { target: { value: '面包' } })
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0])
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).toHaveBeenCalledWith({
      source: 'lists/a.md',
      title: '买菜',
      items: [
        { text: '牛奶', done: true },
        { text: '面包', done: false },
      ],
    })
  })

  it('does not save a list without a title', () => {
    const onSave = vi.fn()
    render(<ListsTab lists={[]} read={reader({})} canEdit formOpen draft={{ title: ' ', items: [] }} onSave={onSave} onCancel={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('says there are no lists', () => {
    render(<ListsTab lists={[]} read={reader({})} onBeginCreate={() => undefined} canEdit />)
    expect(screen.getByText('还没有清单')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新清单' })).toBeEnabled()
  })
})

describe('PhotoGrid editing', () => {
  const processed = { full: new Uint8Array([1]), thumb: new Uint8Array([2]), width: 10, height: 20, date: '2024-06-01' }
  const pickFile = () =>
    fireEvent.change(screen.getByTestId('photo-file-input'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })

  it('hides editing controls without canEdit and disables them while syncing', () => {
    const { rerender } = render(<PhotoGrid photos={photos} read={reader({})} onAdd={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '加照片' })).toBeNull()
    rerender(<PhotoGrid photos={photos} read={reader({})} canEdit syncing onAdd={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByRole('button', { name: '加照片' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: '删除' })[0]).toBeDisabled()
  })

  it('processes a picked file, confirms caption/date and adds it', async () => {
    const onAdd = vi.fn().mockResolvedValue(true)
    const processPhoto = vi.fn().mockResolvedValue(processed)
    render(<PhotoGrid photos={[]} read={reader({})} canEdit onAdd={onAdd} processPhoto={processPhoto} />)
    expect(screen.getByTestId('photo-file-input')).toHaveAttribute('accept', 'image/*')
    pickFile()
    fireEvent.change(await screen.findByLabelText('照片说明'), { target: { value: '海边' } })
    fireEvent.click(screen.getByRole('button', { name: '存入' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ ...processed, caption: '海边', date: '2024-06-01' }))
    await waitFor(() => expect(screen.queryByLabelText('照片说明')).toBeNull())
  })

  it('shows 这张照片打不开 on PhotoProcessError', async () => {
    const { PhotoProcessError } = await import('../photoProcess')
    const processPhoto = vi.fn().mockRejectedValue(new PhotoProcessError())
    render(<PhotoGrid photos={[]} read={reader({})} canEdit onAdd={vi.fn()} processPhoto={processPhoto} />)
    pickFile()
    expect(await screen.findByText('这张照片打不开')).toBeInTheDocument()
  })

  it('deletes only after a second confirm click', () => {
    const onDelete = vi.fn()
    render(<PhotoGrid photos={photos} read={reader({})} canEdit onAdd={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0])
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onDelete).toHaveBeenCalledWith('photos/a.jpg')
  })
})
