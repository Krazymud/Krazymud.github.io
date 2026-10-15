import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decryptBytes, decryptJson } from '../crypto'
import * as cosVault from '../cosVault'
import { GitHubWriteError, SYNC_PENDING } from '../github'
import * as stsTicket from '../stsTicket'
import { GATE_DENIED } from '../vaultErrors'
import * as photoProcess from '../photoProcess'
import type { VaultSession } from '../repo'
import { makeTestVault, type TestVault } from '../testVault'
import type { ListContent, VaultManifest } from '../types'
import type { WebClock } from '../web'
import { createWebStore, type WebStore } from '../webStore'
import { VaultContent } from './VaultContent'

vi.mock('../cosVault', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cosVault')>()),
  putVaultUpdate: vi.fn(),
  readVaultFile: vi.fn(),
  readBlobFile: vi.fn(),
}))

vi.mock('../stsTicket', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../stsTicket')>()),
  fetchStsTicket: vi.fn(),
}))

vi.mock('../photoProcess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../photoProcess')>()),
  processVaultPhoto: vi.fn(),
}))

const putVaultUpdate = vi.mocked(cosVault.putVaultUpdate)
const readVaultFile = vi.mocked(cosVault.readVaultFile)
const readBlobFile = vi.mocked(cosVault.readBlobFile)
const fetchStsTicket = vi.mocked(stsTicket.fetchStsTicket)

const mockCreds = { secretId: 'id', secretKey: 'key', sessionToken: 'tok', expiredTime: 9_999_999_999 }
const processVaultPhoto = vi.mocked(photoProcess.processVaultPhoto)

/** Site only knows the published vault — new commit blobs are invisible (Pages lag). */
async function rejectUnpublishedBlobs(options: { blobName: string }) {
  const bytes = await vault.fetchBytes(`blobs/${options.blobName}.bin`)
  if (!bytes) throw new GitHubWriteError(SYNC_PENDING)
  return bytes
}

type PutCall = Parameters<typeof cosVault.putVaultUpdate>[0]

let counter = 0
const clock: WebClock = {
  now: () => 1_000 + ++counter,
  uuid: () => `uuid-${counter}`,
  today: () => '2026-10-13',
}
const apiFetch = vi.fn() as unknown as typeof fetch

let vault: TestVault
let session: VaultSession
let store: WebStore
const remote = new Map<string, Uint8Array>()

function renderVault(path = '/vault') {
  const router = createMemoryRouter(
    [
      {
        path: '/vault',
        element: (
          <VaultContent
            session={session}
            file={vault.file}
            fetchBytes={vault.fetchBytes}
            onLock={() => undefined}
            webStore={store}
            webFetch={apiFetch}
            clock={clock}
          />
        ),
      },
    ],
    { initialEntries: [path] },
  )
  return render(<RouterProvider router={router} />)
}

async function committed(call: PutCall): Promise<VaultManifest> {
  return decryptJson<VaultManifest>(vault.dek, call.vaultFile.manifest)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(async () => {
  counter = 0
  vault = await makeTestVault()
  session = { dek: vault.dek, manifest: await decryptJson<VaultManifest>(vault.dek, vault.file.manifest) }
  store = createWebStore(new IDBFactory())!
  await store.saveToken('tok')
  putVaultUpdate.mockReset()
  readVaultFile.mockReset()
  readBlobFile.mockReset()
  fetchStsTicket.mockReset()
  processVaultPhoto.mockReset()
  fetchStsTicket.mockResolvedValue(mockCreds)
  readVaultFile.mockResolvedValue({ file: vault.file, etag: 'base0' })
  remote.clear()
  putVaultUpdate.mockImplementation(async (call) => {
    for (const [name, bytes] of Object.entries(call.blobs)) remote.set(name, bytes)
    return { etag: 'commit1' }
  })
  readBlobFile.mockImplementation(async (options) => {
    const name = options.blobName
    const bytes = remote.get(name) ?? (await vault.fetchBytes(`blobs/${name}.bin`))
    if (!bytes) throw new GitHubWriteError(SYNC_PENDING)
    return bytes
  })
})

afterEach(() => {
  cleanup()
})

describe('VaultContent published edits', () => {
  it('shows edit and delete on a published note once the token is ready', async () => {
    renderVault('/vault?tab=notes')
    const edit = await screen.findByRole('button', { name: '编辑' })
    await waitFor(() => expect(edit).toBeEnabled())
    expect(screen.getByRole('button', { name: '删除' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '新笔记' })).toBeEnabled()
  })

  it('keeps published notes read-only without a token', async () => {
    await store.forgetToken()
    renderVault('/vault?tab=notes')
    expect(await screen.findByText('晚安')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '保存口令' })).toBeEnabled())
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新笔记' })).toBeDisabled()
    expect(putVaultUpdate).not.toHaveBeenCalled()
  })

  it('loads the body into the form and commits the edit under the same source', async () => {
    renderVault('/vault?tab=notes')
    const edit = await screen.findByRole('button', { name: '编辑' })
    await waitFor(() => expect(edit).toBeEnabled())
    await screen.findByText(/今天的风很温柔/)
    fireEvent.click(edit)

    expect(screen.getByRole('textbox', { name: '正文' })).toHaveValue('今天的风很**温柔**。\n\n第二段。')
    expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('晚安')
    fireEvent.change(screen.getByRole('textbox', { name: '标题' }), { target: { value: '晚安啦' } })
    fireEvent.change(screen.getByRole('textbox', { name: '正文' }), { target: { value: '改过的正文' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(putVaultUpdate).toHaveBeenCalledTimes(1))
    const sent = await committed(putVaultUpdate.mock.calls[0][0])
    expect(sent.notes).toHaveLength(1)
    expect(sent.notes[0]).toMatchObject({ title: '晚安啦', source: 'notes/a.md', date: '2024-05-21' })
    const blob = putVaultUpdate.mock.calls[0][0].blobs[sent.notes[0].blob]
    expect(new TextDecoder().decode(await decryptBytes(vault.dek, blob))).toBe('改过的正文')

    expect(await screen.findByText('晚安啦')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '标题' })).not.toBeInTheDocument()
    expect(await screen.findByText('改过的正文')).toBeInTheDocument()
  })

  it('keeps a just-synced note body readable when the site and GitHub cannot serve the new blob yet', async () => {
    readBlobFile.mockImplementation(rejectUnpublishedBlobs)
    renderVault('/vault?tab=notes')
    const create = await screen.findByRole('button', { name: '新笔记' })
    await waitFor(() => expect(create).toBeEnabled())
    fireEvent.click(create)
    fireEvent.change(screen.getByRole('textbox', { name: '标题' }), { target: { value: '新写的' } })
    fireEvent.change(screen.getByRole('textbox', { name: '正文' }), { target: { value: '刚写好' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(putVaultUpdate).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('刚写好')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('正在同步…')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: '清单' }))
    fireEvent.click(screen.getByRole('tab', { name: '笔记' }))
    expect(await screen.findByText('刚写好')).toBeInTheDocument()
    expect(screen.queryByText('这篇笔记打不开')).not.toBeInTheDocument()
  })

  it('keeps a just-edited note readable when the site and GitHub cannot serve the new blob yet', async () => {
    readBlobFile.mockImplementation(rejectUnpublishedBlobs)
    renderVault('/vault?tab=notes')
    const edit = await screen.findByRole('button', { name: '编辑' })
    await screen.findByText(/今天的风很温柔/)
    await waitFor(() => expect(edit).toBeEnabled())
    fireEvent.click(edit)
    fireEvent.change(screen.getByRole('textbox', { name: '正文' }), { target: { value: '改完立刻看' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(putVaultUpdate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('正在同步…')).not.toBeInTheDocument())
    expect(screen.queryByText('这篇笔记打不开')).not.toBeInTheDocument()
    expect(await screen.findByText('改完立刻看')).toBeInTheDocument()
  })

  it('keeps a just-edited list readable when the site and GitHub cannot serve the new blob yet', async () => {
    readBlobFile.mockImplementation(rejectUnpublishedBlobs)
    renderVault('/vault?tab=lists')
    const edit = await screen.findByRole('button', { name: '编辑' })
    await screen.findByText('已完成 1 / 2')
    await waitFor(() => expect(edit).toBeEnabled())
    fireEvent.click(edit)
    fireEvent.change(screen.getByLabelText('条目 2'), { target: { value: '去北海道' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(putVaultUpdate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('正在同步…')).not.toBeInTheDocument())
    expect(screen.queryByText('这个清单打不开')).not.toBeInTheDocument()
    expect(await screen.findByText('已完成 1 / 2')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /一起去的地方/ }))
    expect(await screen.findByText('去北海道')).toBeInTheDocument()
  })

  it('keeps a just-added photo readable when the site and GitHub cannot serve the new blob yet', async () => {
    readBlobFile.mockImplementation(rejectUnpublishedBlobs)
    processVaultPhoto.mockResolvedValue({
      full: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      thumb: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]),
      width: 12,
      height: 8,
      date: '2026-10-13',
    })
    renderVault('/vault?tab=photos')
    const add = await screen.findByRole('button', { name: '加照片' })
    await waitFor(() => expect(add).toBeEnabled())
    fireEvent.change(screen.getByTestId('photo-file-input'), {
      target: { files: [new File(['x'], 'new.jpg', { type: 'image/jpeg' })] },
    })
    fireEvent.change(await screen.findByLabelText('照片说明'), { target: { value: '刚拍的' } })
    fireEvent.click(screen.getByRole('button', { name: '存入' }))

    await waitFor(() => expect(putVaultUpdate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('正在同步…')).not.toBeInTheDocument())
    const tile = await screen.findByRole('button', { name: '查看照片 刚拍的' })
    expect(within(tile).queryByText('打不开')).not.toBeInTheDocument()
    expect(tile.querySelector('img')).not.toBeNull()
  })

  it('deletes a published note after confirmation', async () => {
    renderVault('/vault?tab=notes')
    const remove = await screen.findByRole('button', { name: '删除' })
    await waitFor(() => expect(remove).toBeEnabled())
    fireEvent.click(remove)
    expect(putVaultUpdate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => expect(putVaultUpdate).toHaveBeenCalledTimes(1))
    const sent = await committed(putVaultUpdate.mock.calls[0][0])
    expect(sent.notes).toEqual([])
    expect(await screen.findByText('还没有笔记')).toBeInTheDocument()
  })

  it('toggles a published list item when GitHub cannot hydrate but the site has the blob', async () => {
    readBlobFile.mockRejectedValue(new GitHubWriteError(SYNC_PENDING))
    renderVault('/vault?tab=lists')
    const header = await screen.findByRole('button', { name: /一起去的地方/ })
    await waitFor(() => expect(header).toBeEnabled())
    fireEvent.click(header)
    const row = await screen.findByRole('button', { name: /去冰岛看极光/ })
    await waitFor(() => expect(row).toBeEnabled())
    fireEvent.click(row)

    await waitFor(() => expect(putVaultUpdate).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('已完成 2 / 2')).toBeInTheDocument()
    expect(screen.queryByText('没能保存，请再试一次')).not.toBeInTheDocument()
  })

  it('toggles a published list item through the vault commit, not web.json', async () => {
    renderVault('/vault?tab=lists')
    const header = await screen.findByRole('button', { name: /一起去的地方/ })
    await waitFor(() => expect(header).toBeEnabled())
    fireEvent.click(header)
    const row = await screen.findByRole('button', { name: /去冰岛看极光/ })
    await waitFor(() => expect(row).toBeEnabled())
    fireEvent.click(row)

    await waitFor(() => expect(putVaultUpdate).toHaveBeenCalledTimes(1))
    const call = putVaultUpdate.mock.calls[0][0]
    expect(call.deleteWebJson).toBeUndefined()
    const sent = await committed(call)
    expect(sent.lists[0].source).toBe('lists/a.md')
    const content = JSON.parse(
      new TextDecoder().decode(await decryptBytes(vault.dek, call.blobs[sent.lists[0].blob])),
    ) as ListContent
    expect(content.items.map((item) => item.done)).toEqual([true, true])
    expect(await screen.findByText('已完成 2 / 2')).toBeInTheDocument()
  })

  it('edits a published list with its items and deletes it', async () => {
    renderVault('/vault?tab=lists')
    const edit = await screen.findByRole('button', { name: '编辑' })
    await screen.findByText('已完成 1 / 2')
    await waitFor(() => expect(edit).toBeEnabled())
    fireEvent.click(edit)
    expect(screen.getByLabelText('条目 1')).toHaveValue('去看海')
    fireEvent.change(screen.getByLabelText('条目 2'), { target: { value: '去北海道' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(putVaultUpdate).toHaveBeenCalledTimes(1))
    const call = putVaultUpdate.mock.calls[0][0]
    const sent = await committed(call)
    expect(sent.lists[0]).toMatchObject({ source: 'lists/a.md', title: '一起去的地方' })
    const content = JSON.parse(
      new TextDecoder().decode(await decryptBytes(vault.dek, call.blobs[sent.lists[0].blob])),
    ) as ListContent
    expect(content.items).toEqual([
      { text: '去看海', done: true },
      { text: '去北海道', done: false },
    ])

    await waitFor(() => expect(screen.queryByText('正在同步…')).not.toBeInTheDocument())
    fireEvent.click(await screen.findByRole('button', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() => expect(putVaultUpdate).toHaveBeenCalledTimes(2))
    expect((await committed(putVaultUpdate.mock.calls[1][0])).lists).toEqual([])
  })

  it('shows 正在同步… and locks editing until the commit finishes', async () => {
    const gate = deferred<string>()
    putVaultUpdate.mockReturnValue(gate.promise)
    renderVault('/vault?tab=notes')
    const remove = await screen.findByRole('button', { name: '删除' })
    await waitFor(() => expect(remove).toBeEnabled())
    fireEvent.click(remove)
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    expect(await screen.findByText('正在同步…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新笔记' })).toBeDisabled()

    await act(async () => {
      gate.resolve('commit1')
      await gate.promise
    })
    await waitFor(() => expect(screen.queryByText('正在同步…')).not.toBeInTheDocument())
    expect(screen.queryByText('还没同步')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新笔记' })).toBeEnabled()
  })

  it('keeps the edit and shows the pending and token messages when GitHub rejects the token', async () => {
    putVaultUpdate.mockRejectedValue(new GitHubWriteError(GATE_DENIED))
    renderVault('/vault?tab=notes')
    const remove = await screen.findByRole('button', { name: '删除' })
    await waitFor(() => expect(remove).toBeEnabled())
    fireEvent.click(remove)
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    expect(await screen.findByText('还没同步')).toBeInTheDocument()
    expect(await screen.findByText(GATE_DENIED)).toBeInTheDocument()
    expect(screen.getByText('还没有笔记')).toBeInTheDocument()
    expect(await store.loadVaultPending()).not.toBeNull()
  })

  it('shows 还没同步 without a token message for a network failure', async () => {
    putVaultUpdate.mockRejectedValue(new GitHubWriteError(SYNC_PENDING))
    renderVault('/vault?tab=notes')
    const remove = await screen.findByRole('button', { name: '删除' })
    await waitFor(() => expect(remove).toBeEnabled())
    fireEvent.click(remove)
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    expect(await screen.findByText('还没同步')).toBeInTheDocument()
    expect(screen.queryByText(GATE_DENIED)).not.toBeInTheDocument()
  })

  it('does not commit a note with an empty title', async () => {
    renderVault('/vault?tab=notes')
    const create = await screen.findByRole('button', { name: '新笔记' })
    await waitFor(() => expect(create).toBeEnabled())
    fireEvent.click(create)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByRole('textbox', { name: '标题' })).toHaveAttribute('aria-invalid', 'true')
    expect(putVaultUpdate).not.toHaveBeenCalled()
  })
})

describe('VaultContent token', () => {
  it('saves a token, syncs, and enables editing', async () => {
    await store.forgetToken()
    renderVault('/vault?tab=notes')
    await waitFor(() => expect(screen.getByRole('button', { name: '保存口令' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('同步口令'), { target: { value: '  token-1  ' } })
    fireEvent.click(screen.getByRole('button', { name: '保存口令' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '新笔记' })).toBeEnabled())
    expect(await store.loadToken()).toBe('token-1')
    expect(fetchStsTicket).toHaveBeenCalledWith(expect.objectContaining({ gate: 'token-1' }))
    expect(readVaultFile).toHaveBeenCalled()
  })

  it('forgets the token, closes the form and goes read-only', async () => {
    renderVault('/vault?tab=notes')
    const create = await screen.findByRole('button', { name: '新笔记' })
    await waitFor(() => expect(create).toBeEnabled())
    fireEvent.click(create)
    fireEvent.change(screen.getByRole('textbox', { name: '标题' }), { target: { value: '不保存' } })
    fireEvent.click(screen.getByRole('button', { name: '忘记口令' }))
    expect(screen.queryByDisplayValue('不保存')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '保存口令' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新笔记' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
    await waitFor(async () => expect(await store.loadToken()).toBeNull())
    expect(putVaultUpdate).not.toHaveBeenCalled()
  })

  it('still shows the photo grid', async () => {
    renderVault()
    const grid = await screen.findByRole('tabpanel')
    expect(within(grid).getAllByRole('heading').length).toBeGreaterThan(0)
    expect(screen.queryByText('还没有照片')).not.toBeInTheDocument()
  })
})
