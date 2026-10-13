import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptBytes, generateDek } from '../crypto'
import type { FetchBytes, VaultSession } from '../repo'
import { emptyWebDoc, openWebFile, sealWebFile, type WebClock, type WebDoc } from '../web'
import { createWebStore, type WebStore } from '../webStore'
import { VaultContent } from './VaultContent'

const clock: WebClock = { now: () => 50, uuid: () => 'note-1', today: () => '2026-10-13' }
let session: VaultSession
let store: WebStore
let site: Uint8Array | null
let siteError: Error | null
let webFetch: ReturnType<typeof vi.fn>

const fetchBytes: FetchBytes = async (path) => {
  if (path !== 'web.json') return null
  if (siteError) throw siteError
  return site
}

function renderVault() {
  const router = createMemoryRouter(
    [
      {
        path: '/vault',
        element: (
          <VaultContent
            session={session}
            fetchBytes={fetchBytes}
            sweep={false}
            onLock={() => undefined}
            webStore={store}
            webFetch={webFetch as typeof fetch}
            clock={clock}
          />
        ),
      },
    ],
    { initialEntries: ['/vault'] },
  )
  return render(<RouterProvider router={router} />)
}

function github(handler: (method: string) => Response) {
  webFetch = vi.fn(async (_url: string, init?: RequestInit) => handler(init?.method ?? 'GET'))
}

beforeEach(async () => {
  session = {
    dek: await generateDek(),
    manifest: { photos: [], notes: [], lists: [] },
  }
  store = createWebStore(new IDBFactory())!
  site = null
  siteError = null
  github((method) => new Response('{}', { status: method === 'PUT' ? 201 : 404 }))
})

describe('VaultContent web sync', () => {
  it('disables edits until a token is saved, then commits a new note', async () => {
    renderVault()
    fireEvent.click(await screen.findByRole('tab', { name: '笔记' }))
    expect(screen.getByRole('button', { name: '新笔记' })).toBeDisabled()
    expect(screen.getByText('还没有笔记')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '保存令牌' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('令牌'), { target: { value: '  token-1  ' } })
    fireEvent.click(screen.getByRole('button', { name: '保存令牌' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '新笔记' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '新笔记' }))
    fireEvent.change(screen.getByRole('textbox', { name: '标题' }), { target: { value: '网页日记' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText('网页日记')).toBeInTheDocument()
    await waitFor(() =>
      expect(webFetch.mock.calls.some((call) => (call[1] as RequestInit | undefined)?.method === 'PUT')).toBe(true),
    )
    const put = webFetch.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === 'PUT')
    const body = JSON.parse(String((put![1] as RequestInit).body)) as { message: string; content: string }
    expect(body.message).toBe('content(vault): update web notes')
    const doc = await openWebFile(session.dek, new TextDecoder().decode(Uint8Array.from(atob(body.content), (char) => char.charCodeAt(0))))
    expect(doc.notes[0]).toMatchObject({ id: 'note-1', title: '网页日记', date: '2026-10-13' })
    await waitFor(async () => expect(await store.loadPending()).toBeNull())
    expect(screen.queryByLabelText('今日回忆')).not.toBeInTheDocument()
  })

  it('does not submit a file the current key cannot open', async () => {
    site = new TextEncoder().encode(JSON.stringify({ version: 2, sealed: 'nope' }))
    renderVault()
    expect(await screen.findByText('网页上的笔记打不开')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '保存令牌' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('令牌'), { target: { value: 'token-1' } })
    fireEvent.click(screen.getByRole('button', { name: '保存令牌' }))
    fireEvent.click(screen.getByRole('tab', { name: '笔记' }))
    expect(screen.getByRole('button', { name: '新笔记' })).toBeDisabled()
    expect(webFetch).not.toHaveBeenCalled()
  })

  it('keeps a check and shows the pending banner when the token cannot write', async () => {
    const published = {
      title: '一起去的地方',
      blob: 'l1',
      source: 'lists/a.md',
      hash: 'a',
    }
    session = {
      ...session,
      manifest: {
        photos: [],
        notes: [],
        lists: [published],
      },
    }
    await store.saveToken('token-1')
    github((method) => new Response(method === 'GET' ? JSON.stringify({ message: 'no' }) : '{}', { status: method === 'GET' ? 404 : 401 }))
    const listPlain = new TextEncoder().encode(JSON.stringify({ items: [{ text: '去看海', done: false }] }))
    const listBlob = await encryptBytes(session.dek, listPlain)
    const fetchLists: FetchBytes = async (path) => {
      if (path === 'web.json') return null
      if (path === 'blobs/l1.bin') return listBlob
      return null
    }
    const router = createMemoryRouter(
      [
        {
          path: '/vault',
          element: (
            <VaultContent
              session={session}
              fetchBytes={fetchLists}
              sweep={false}
              onLock={() => undefined}
              webStore={store}
              webFetch={webFetch as typeof fetch}
              clock={clock}
            />
          ),
        },
      ],
      { initialEntries: ['/vault?tab=lists'] },
    )
    render(<RouterProvider router={router} />)
    const header = await screen.findByRole('button', { name: /一起去的地方/ })
    await waitFor(() => expect(header).toBeEnabled())
    fireEvent.click(header)
    const row = await screen.findByRole('button', { name: /去看海/ })
    await waitFor(() => expect(row).toBeEnabled())
    fireEvent.click(row)
    expect(screen.getByRole('button', { name: /去看海/ })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('还没同步')).toBeInTheDocument()
    expect(await screen.findByText('令牌不能写这个仓库')).toBeInTheDocument()
    expect(screen.getByText('去看海').className).toContain('line-through')
    expect(await store.loadPending()).not.toBeNull()
  })

  it('shows a pending document when the site file cannot be read', async () => {
    const pending: WebDoc = {
      ...emptyWebDoc(),
      notes: [{ id: 'p1', title: '还在本机', date: '2026-10-13', body: '', updatedAt: 4 }],
    }
    await store.savePending(await sealWebFile(session.dek, pending))
    await store.saveToken('token-1')
    siteError = new Error('offline')
    github(() => new Response('{}', { status: 404 }))
    renderVault()
    fireEvent.click(await screen.findByRole('tab', { name: '笔记' }))
    expect(await screen.findByText('还在本机')).toBeInTheDocument()
    expect(screen.getByText('还没同步')).toBeInTheDocument()
  })

  it('forgets the token and cancels a form without writing', async () => {
    await store.saveToken('token-1')
    renderVault()
    fireEvent.click(await screen.findByRole('tab', { name: '笔记' }))
    const create = await screen.findByRole('button', { name: '新笔记' })
    await waitFor(() => expect(create).toBeEnabled())
    fireEvent.click(create)
    fireEvent.change(screen.getByRole('textbox', { name: '标题' }), { target: { value: '不保存' } })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByDisplayValue('不保存')).not.toBeInTheDocument()
    expect(webFetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '忘记令牌' }))
    expect(await screen.findByRole('button', { name: '保存令牌' })).toBeInTheDocument()
    expect(await store.loadToken()).toBeNull()
    expect(screen.getByRole('button', { name: '新笔记' })).toBeDisabled()
  })
})
