import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decryptBytes, decryptJson, type VaultKey } from './crypto'
import { GitHubWriteError, SYNC_PENDING, TOKEN_DENIED } from './github'
import * as gitVault from './gitVault'
import type { FetchBytes } from './repo'
import { makeTestVault, type TestVault } from './testVault'
import type { ListContent, VaultFile, VaultManifest } from './types'
import { useVaultMutate } from './useVaultMutate'
import { emptyWorking, openWorking, saveNote, sealWorking, sealVaultFile } from './working'
import { sealWebFile, type WebDoc } from './web'
import { createWebStore, type WebStore } from './webStore'

vi.mock('./gitVault', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./gitVault')>()),
  commitVaultUpdate: vi.fn(),
  readVaultFile: vi.fn(),
  readBlobFile: vi.fn(),
  readWebFileText: vi.fn(),
}))

const commitVaultUpdate = vi.mocked(gitVault.commitVaultUpdate)
const readVaultFile = vi.mocked(gitVault.readVaultFile)
const readBlobFile = vi.mocked(gitVault.readBlobFile)
const readWebFileText = vi.mocked(gitVault.readWebFileText)

type Commit = Parameters<typeof gitVault.commitVaultUpdate>[0]

const SYNCING = '正在同步…'
const apiFetch = vi.fn() as unknown as typeof fetch

let vault: TestVault
let manifest: VaultManifest
let store: WebStore
let counter = 0

const clock = {
  now: () => 1_000 + ++counter,
  uuid: () => `uuid-${counter}`,
}

function Harness(props: {
  dek: VaultKey
  file: VaultFile
  manifest: VaultManifest
  fetchBytes: FetchBytes
  store: WebStore | null
}) {
  const v = useVaultMutate({ ...props, apiFetch, clock })
  return (
    <div>
      {v.syncing && <p>{SYNCING}</p>}
      {v.unsynced && <p>还没同步</p>}
      {v.tokenError && <p role="alert">{v.tokenError}</p>}
      <p>{v.loading ? 'loading' : 'ready'}</p>
      <p>{v.tokenSaved ? 'token' : 'no-token'}</p>
      <ul>
        {v.manifest.notes.map((n) => (
          <li key={n.source}>{n.title}</li>
        ))}
        {v.manifest.photos.map((p) => (
          <li key={p.source}>{`photo:${p.source}`}</li>
        ))}
      </ul>
      <button disabled={!v.canEdit} onClick={() => void v.saveNote({ title: '新笔记', date: '2026-10-13', body: '你好' })}>
        保存笔记
      </button>
      <button disabled={!v.canEdit} onClick={() => void v.saveNote({ title: '   ', date: '2026-10-13', body: '空' })}>
        保存空标题
      </button>
      <button disabled={!v.canEdit} onClick={() => void v.deleteNote('notes/a.md')}>
        删除晚安
      </button>
      <button disabled={!v.canEdit} onClick={() => void v.toggleListItem('lists/a.md', 1, true)}>
        打勾
      </button>
      <button disabled={!v.canEdit} onClick={() => void v.deletePhoto('photos/b.jpg')}>
        删除照片
      </button>
      <button onClick={() => void v.saveToken('late-token')}>保存令牌</button>
      <button onClick={() => void v.forgetToken()}>忘记令牌</button>
    </div>
  )
}

function mount(overrides: Partial<Parameters<typeof Harness>[0]> = {}) {
  return render(
    <Harness dek={vault.dek} file={vault.file} manifest={manifest} fetchBytes={vault.fetchBytes} store={store} {...overrides} />,
  )
}

function saveButton() {
  return screen.getByRole('button', { name: '保存笔记' })
}

async function ready() {
  await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument())
}

async function committedManifest(call: Commit): Promise<VaultManifest> {
  return decryptJson<VaultManifest>(vault.dek, call.vaultFile.manifest)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(async () => {
  counter = 0
  vault = await makeTestVault()
  manifest = await decryptJson<VaultManifest>(vault.dek, vault.file.manifest)
  store = createWebStore(new IDBFactory())!
  await store.saveToken('tok')
  commitVaultUpdate.mockReset()
  readVaultFile.mockReset()
  readBlobFile.mockReset()
  readWebFileText.mockReset()
  readWebFileText.mockResolvedValue(null)
  readVaultFile.mockResolvedValue({ file: vault.file, commitSha: 'base0' })
  commitVaultUpdate.mockResolvedValue('commit1')
})

afterEach(() => {
  cleanup()
})

describe('useVaultMutate', () => {
  it('locks edits with the syncing message until the commit finishes', async () => {
    const gate = deferred<string>()
    commitVaultUpdate.mockReturnValue(gate.promise)
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.queryByText(SYNCING)).toBeNull()

    fireEvent.click(saveButton())

    expect(await screen.findByText(SYNCING)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: '打勾' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '删除晚安' })).toBeDisabled()
    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(1))
    expect(screen.getByText('新笔记')).toBeInTheDocument()

    await act(async () => {
      gate.resolve('commit1')
      await gate.promise
    })

    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    expect(saveButton()).toBeEnabled()
    expect(screen.queryByText('还没同步')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(commitVaultUpdate).toHaveBeenCalledTimes(1)
    await waitFor(async () => expect(await store.loadVaultPending()).toBeNull())

    const call = commitVaultUpdate.mock.calls[0][0]
    expect(call.token).toBe('tok')
    expect(call.deleteWebJson).toBeUndefined()
    const sent = await committedManifest(call)
    expect(sent.notes.map((n) => n.title).sort()).toEqual(['新笔记', '晚安'])
    const added = sent.notes.find((n) => n.title === '新笔记')!
    expect(Object.keys(call.blobs)).toEqual([added.blob])
    expect(new TextDecoder().decode(await decryptBytes(vault.dek, call.blobs[added.blob]))).toBe('你好')
  })

  it('shows the token error and keeps the edit pending when GitHub answers 401', async () => {
    commitVaultUpdate.mockRejectedValue(new GitHubWriteError(TOKEN_DENIED))
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())

    fireEvent.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(TOKEN_DENIED)
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    expect(screen.getByText('还没同步')).toBeInTheDocument()
    expect(screen.getByText('新笔记')).toBeInTheDocument()
    expect(saveButton()).toBeEnabled()

    const sealed = await store.loadVaultPending()
    expect(sealed).not.toBeNull()
    const pending = await openWorking(vault.dek, sealed!)
    expect(pending.manifest.notes.map((n) => n.title)).toContain('新笔记')
  })

  it('shows 还没同步 without a token error for a network failure', async () => {
    commitVaultUpdate.mockRejectedValue(new GitHubWriteError(SYNC_PENDING))
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())

    fireEvent.click(saveButton())

    expect(await screen.findByText('还没同步')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(SYNCING)).toBeNull()
  })

  it('does not commit an invalid note and releases the lock', async () => {
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: '保存空标题' }))

    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    expect(commitVaultUpdate).not.toHaveBeenCalled()
    expect(screen.queryByText('空')).toBeNull()
    expect(saveButton()).toBeEnabled()
    expect(await store.loadVaultPending()).toBeNull()
  })

  it('disables every edit without a saved token and never commits', async () => {
    await store.forgetToken()
    mount()
    await ready()

    expect(screen.getByText('no-token')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: '打勾' })).toBeDisabled()
    expect(readVaultFile).not.toHaveBeenCalled()
    expect(commitVaultUpdate).not.toHaveBeenCalled()
    expect(screen.getByText('晚安')).toBeInTheDocument()
  })

  it('enables editing after a token is saved and syncs the latest remote vault first', async () => {
    await store.forgetToken()
    mount()
    await ready()
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '保存令牌' }))

    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(await store.loadToken()).toBe('late-token')
    expect(readVaultFile).toHaveBeenCalledWith(apiFetch, 'late-token')
    expect(commitVaultUpdate).not.toHaveBeenCalled()

    fireEvent.click(saveButton())
    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(1))
    expect(commitVaultUpdate.mock.calls[0][0].token).toBe('late-token')

    fireEvent.click(screen.getByRole('button', { name: '忘记令牌' }))
    await waitFor(() => expect(saveButton()).toBeDisabled())
    expect(await store.loadToken()).toBeNull()
  })

  it('starts from the vault in the repository when a token is saved', async () => {
    const remoteManifest: VaultManifest = {
      ...manifest,
      notes: [...manifest.notes, { title: '别处写的', date: '2026-10-12', blob: 'remote-note', source: 'web/notes/remote', hash: 'r' }],
    }
    readVaultFile.mockResolvedValue({
      file: await sealVaultFile(vault.dek, emptyWorking(remoteManifest), vault.file),
      commitSha: 'remote1',
    })
    mount()
    expect(await screen.findByText('别处写的')).toBeInTheDocument()
  })

  it('retries once against the latest repository vault after a non-fast-forward update', async () => {
    const remoteManifest: VaultManifest = {
      ...manifest,
      notes: [...manifest.notes, { title: '别处写的', date: '2026-10-12', blob: 'remote-note', source: 'web/notes/remote', hash: 'r' }],
    }
    const remoteFile = await sealVaultFile(vault.dek, emptyWorking(remoteManifest), vault.file)
    commitVaultUpdate.mockRejectedValueOnce(new gitVault.GitHubRefNotFastForwardError())
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    readVaultFile.mockResolvedValue({ file: remoteFile, commitSha: 'remote1' })

    fireEvent.click(saveButton())

    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    expect(screen.queryByText('还没同步')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()

    expect(commitVaultUpdate.mock.calls[0][0].parentSha).toBe('base0')
    const retry = commitVaultUpdate.mock.calls[1][0]
    expect(retry.parentSha).toBe('remote1')
    const sent = await committedManifest(retry)
    expect(sent.notes.map((n) => n.title).sort()).toEqual(['别处写的', '新笔记', '晚安'])
    const added = sent.notes.find((n) => n.title === '新笔记')!
    expect(Object.keys(retry.blobs)).toEqual([added.blob])
    expect(screen.getByText('别处写的')).toBeInTheDocument()
    expect(await store.loadVaultPending()).toBeNull()
  })

  it('never overwrites a commit another device pushed after unlock', async () => {
    const remote = { tip: 'base0', file: vault.file, commits: 0 }
    readVaultFile.mockImplementation(async () => ({ file: remote.file, commitSha: remote.tip }))
    commitVaultUpdate.mockImplementation(async (call) => {
      if (call.parentSha !== remote.tip) throw new gitVault.GitHubRefNotFastForwardError()
      remote.tip = `mine${++remote.commits}`
      remote.file = call.vaultFile
      return remote.tip
    })
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(readVaultFile).toHaveBeenCalledTimes(1)

    const otherManifest: VaultManifest = {
      ...manifest,
      notes: [...manifest.notes, { title: '别处写的', date: '2026-10-12', blob: 'remote-note', source: 'web/notes/remote', hash: 'r' }],
    }
    remote.file = await sealVaultFile(vault.dek, emptyWorking(otherManifest), vault.file)
    remote.tip = 'other1'

    fireEvent.click(saveButton())

    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    expect(commitVaultUpdate.mock.calls.map(([call]) => call.parentSha)).toEqual(['base0', 'other1'])
    expect(remote.tip).toBe('mine1')
    const published = await decryptJson<VaultManifest>(vault.dek, remote.file.manifest)
    expect(published.notes.map((n) => n.title).sort()).toEqual(['别处写的', '新笔记', '晚安'])
    expect(screen.queryByText('还没同步')).toBeNull()
    expect(screen.getByText('别处写的')).toBeInTheDocument()

    const reads = readVaultFile.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: '删除晚安' }))
    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    expect(commitVaultUpdate.mock.calls[2][0].parentSha).toBe('mine1')
    expect(readVaultFile).toHaveBeenCalledTimes(reads)
    expect(remote.tip).toBe('mine2')
  })

  it('gives up after a second non-fast-forward and keeps the edit', async () => {
    commitVaultUpdate.mockRejectedValue(new gitVault.GitHubRefNotFastForwardError())
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())

    fireEvent.click(saveButton())

    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('还没同步')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('新笔记')).toBeInTheDocument()
    expect(await store.loadVaultPending()).not.toBeNull()
  })

  it('removes deleted records without uploading blobs', async () => {
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: '删除晚安' }))
    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())

    const call = commitVaultUpdate.mock.calls[0][0]
    expect((await committedManifest(call)).notes).toEqual([])
    expect(call.blobs).toEqual({})
    expect(screen.queryByText('晚安')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '删除照片' }))
    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(2))
    const second = await committedManifest(commitVaultUpdate.mock.calls[1][0])
    expect(second.photos.map((p) => p.source)).toEqual(['photos/a.jpg'])
    expect(second.notes).toEqual([])
  })

  it('hydrates a published list from the site before toggling and uploads only the new blob', async () => {
    readBlobFile.mockRejectedValue(new GitHubWriteError(SYNC_PENDING))
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: '打勾' }))
    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())

    expect(readBlobFile).not.toHaveBeenCalled()
    const call = commitVaultUpdate.mock.calls[0][0]
    const sent = await committedManifest(call)
    const list = sent.lists.find((l) => l.source === 'lists/a.md')!
    expect(list.blob).not.toBe('list-a')
    expect(Object.keys(call.blobs)).toEqual([list.blob])
    const content = JSON.parse(new TextDecoder().decode(await decryptBytes(vault.dek, call.blobs[list.blob]))) as ListContent
    expect(content.items).toEqual([
      { text: '去看海', done: true },
      { text: '去冰岛看极光', done: true },
    ])
  })

  it('falls back to GitHub when the site is missing the list blob', async () => {
    const original = await vault.fetchBytes('blobs/list-a.bin')
    const siteMiss: FetchBytes = async (path) => (path === 'blobs/list-a.bin' ? null : vault.fetchBytes(path))
    readBlobFile.mockResolvedValue(original!)
    mount({ fetchBytes: siteMiss })
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: '打勾' }))
    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(1))
    expect(readBlobFile).toHaveBeenCalledWith(apiFetch, 'tok', 'list-a')
  })

  it('does not commit when the list blob cannot be read from the site or GitHub', async () => {
    const siteMiss: FetchBytes = async (path) => (path === 'blobs/list-a.bin' ? null : vault.fetchBytes(path))
    readBlobFile.mockRejectedValue(new GitHubWriteError(TOKEN_DENIED))
    mount({ fetchBytes: siteMiss })
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: '打勾' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(TOKEN_DENIED)
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    expect(commitVaultUpdate).not.toHaveBeenCalled()
    expect(await store.loadVaultPending()).toBeNull()
  })

  it('replays a pending edit from an earlier visit once a token is available', async () => {
    commitVaultUpdate.mockRejectedValueOnce(new GitHubWriteError(SYNC_PENDING))
    const first = mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    fireEvent.click(saveButton())
    expect(await screen.findByText('还没同步')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    first.unmount()
    expect(commitVaultUpdate).toHaveBeenCalledTimes(1)

    mount()

    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    expect(screen.getByText('新笔记')).toBeInTheDocument()
    expect(screen.queryByText('还没同步')).toBeNull()
    const call = commitVaultUpdate.mock.calls[1][0]
    const sent = await committedManifest(call)
    const added = sent.notes.find((n) => n.title === '新笔记')!
    expect(Object.keys(call.blobs)).toEqual([added.blob])
    expect(await store.loadVaultPending()).toBeNull()
  })

  it('shows a pending edit as unsynced and read-only when there is no token', async () => {
    await store.forgetToken()
    const pending = await saveNote(
      emptyWorking(manifest),
      { title: '离线写的', date: '2026-10-13', body: 'x' },
      { now: () => 5, uuid: () => 'off' },
      vault.dek,
    )
    await store.saveVaultPending(await sealWorking(vault.dek, pending))

    mount()

    expect(await screen.findByText('离线写的')).toBeInTheDocument()
    expect(screen.getByText('还没同步')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    expect(commitVaultUpdate).not.toHaveBeenCalled()
  })

  it('drops an unreadable pending seal and starts from the vault', async () => {
    await store.saveVaultPending('not a seal')
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(commitVaultUpdate).not.toHaveBeenCalled()
    expect(await store.loadVaultPending()).toBeNull()
    expect(screen.queryByText('还没同步')).toBeNull()
  })

  it('falls back to the site vault and rebases before the first commit when the repository read fails', async () => {
    readVaultFile.mockRejectedValueOnce(new GitHubWriteError(SYNC_PENDING))
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.getByText('晚安')).toBeInTheDocument()
    expect(readVaultFile).toHaveBeenCalledTimes(1)

    fireEvent.click(saveButton())

    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(1))
    expect(readVaultFile).toHaveBeenCalledTimes(2)
  })

  it('reports a rejected token while loading the repository vault', async () => {
    readVaultFile.mockRejectedValue(new GitHubWriteError(TOKEN_DENIED))
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent(TOKEN_DENIED)
    expect(screen.getByText('晚安')).toBeInTheDocument()
  })

  it('reaches ready read-only when IndexedDB cannot load the token', async () => {
    const brokenStore: WebStore = {
      ...store,
      loadToken: vi.fn().mockRejectedValue(new DOMException('IDB read failed')),
      loadVaultPending: vi.fn().mockRejectedValue(new DOMException('IDB read failed')),
    }
    mount({ store: brokenStore })
    await ready()
    expect(screen.getByText('no-token')).toBeInTheDocument()
    expect(screen.getByText('晚安')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    expect(readVaultFile).not.toHaveBeenCalled()
    expect(commitVaultUpdate).not.toHaveBeenCalled()
  })

  it('does not commit when list hydration hits a network TypeError on GitHub and the site misses the blob', async () => {
    const siteMiss: FetchBytes = async (path) => (path === 'blobs/list-a.bin' ? null : vault.fetchBytes(path))
    readBlobFile.mockRejectedValue(new TypeError('Failed to fetch'))
    mount({ fetchBytes: siteMiss })
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: '打勾' }))

    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    expect(commitVaultUpdate).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(await store.loadVaultPending()).toBeNull()
  })

  it('absorbs web.json into the vault, deletes it on commit, and clears old web pending keys', async () => {
    const doc: WebDoc = {
      notes: [{ id: 'n1', title: '网页笔记', date: '2024-06-01', body: '正文', updatedAt: 50 }],
      lists: [],
      checks: {},
      tombstones: { notes: [], lists: [] },
    }
    readWebFileText.mockResolvedValue(await sealWebFile(vault.dek, doc))
    await store.savePending(await sealWebFile(vault.dek, doc))
    await store.saveSynced(await sealWebFile(vault.dek, doc))

    mount()

    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    const call = commitVaultUpdate.mock.calls[0][0]
    expect(call.deleteWebJson).toBe(true)
    const sent = await committedManifest(call)
    expect(sent.notes.find((n) => n.source === 'web/notes/n1')?.title).toBe('网页笔记')
    expect(screen.getByText('网页笔记')).toBeInTheDocument()
    expect(await store.loadPending()).toBeNull()
    expect(await store.loadSynced()).toBeNull()
  })

  it('does not delete web.json when none exists', async () => {
    mount()
    await ready()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    fireEvent.click(saveButton())
    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(1))
    expect(commitVaultUpdate.mock.calls[0][0].deleteWebJson).toBeUndefined()
  })

  it('clears IDB web pending after absorbing legacy pending with no remote web.json', async () => {
    const doc: WebDoc = {
      notes: [{ id: 'n-idb', title: '本地遗留', date: '2024-06-01', body: '正文', updatedAt: 50 }],
      lists: [],
      checks: {},
      tombstones: { notes: [], lists: [] },
    }
    readWebFileText.mockResolvedValue(null)
    await store.savePending(await sealWebFile(vault.dek, doc))
    await store.saveSynced(await sealWebFile(vault.dek, doc))

    mount()

    await waitFor(() => expect(commitVaultUpdate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText(SYNCING)).toBeNull())
    const call = commitVaultUpdate.mock.calls[0][0]
    expect(call.deleteWebJson).toBeUndefined()
    const sent = await committedManifest(call)
    expect(sent.notes.find((n) => n.source === 'web/notes/n-idb')?.title).toBe('本地遗留')
    expect(screen.getByText('本地遗留')).toBeInTheDocument()
    expect(await store.loadPending()).toBeNull()
    expect(await store.loadSynced()).toBeNull()
  })
})
