import { describe, expect, it, vi } from 'vitest'
import { SYNC_PENDING, TOKEN_DENIED } from './github'
import {
  commitVaultUpdate,
  GitHubRefNotFastForwardError,
  readBlobFile,
  readVaultFile,
  VAULT_JSON_PATH,
  WEB_JSON_PATH,
} from './gitVault'
import type { VaultFile } from './types'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const VAULT_FILE: VaultFile = {
  version: 1,
  kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 1, salt: 'aa' },
  wrappedKey: 'w',
  manifest: 'm',
}

type Call = { method: string; path: string; search: string; accept: string | null; body: unknown }

function gitServer(overrides: { patch?: Response; commitRead?: Response } = {}) {
  const calls: Call[] = []
  let blobCount = 0
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ method, path: parsed.pathname, search: parsed.search, accept: headers.get('Accept'), body })
    const path = parsed.pathname
    if (method === 'GET' && path.endsWith('/git/commits/parent0')) {
      return overrides.commitRead ?? json(200, { sha: 'parent0', tree: { sha: 'tree0' } })
    }
    if (method === 'POST' && path.endsWith('/git/blobs')) return json(201, { sha: `blob${++blobCount}` })
    if (method === 'POST' && path.endsWith('/git/trees')) return json(201, { sha: 'tree1' })
    if (method === 'POST' && path.endsWith('/git/commits')) return json(201, { sha: 'commit1' })
    if (method === 'PATCH' && path.endsWith('/git/refs/heads/master')) {
      return overrides.patch ?? json(200, { object: { sha: 'commit1' } })
    }
    return json(500, {})
  })
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch }
}

function commit(fetchImpl: typeof fetch, extra: { deleteWebJson?: boolean } = {}) {
  return commitVaultUpdate({
    fetch: fetchImpl,
    token: 't',
    message: 'content(vault): update notes',
    vaultFile: VAULT_FILE,
    parentSha: 'parent0',
    blobs: { abc: new Uint8Array([1, 2, 3]) },
    ...extra,
  })
}

describe('commitVaultUpdate', () => {
  it('parents the commit on the caller SHA without re-reading the branch tip', async () => {
    const { calls, fetchImpl } = gitServer()
    const sha = await commit(fetchImpl, { deleteWebJson: true })

    expect(sha).toBe('commit1')
    expect(calls.some((c) => c.method === 'GET' && c.path.includes('/git/ref'))).toBe(false)
    const created = calls.find((c) => c.method === 'POST' && c.path.endsWith('/git/commits'))!
    expect(created.body).toEqual({ message: 'content(vault): update notes', tree: 'tree1', parents: ['parent0'] })
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.path).toMatch(/\/git\/refs\/heads\/master$/)
    expect(patch.body).toEqual({ sha: 'commit1', force: false })
  })

  it('builds the tree on base_tree with vault.json, blobs, and a web.json deletion', async () => {
    const { calls, fetchImpl } = gitServer()
    await commit(fetchImpl, { deleteWebJson: true })

    const tree = calls.find((c) => c.method === 'POST' && c.path.endsWith('/git/trees'))!
    expect(tree.body).toEqual({
      base_tree: 'tree0',
      tree: [
        { path: VAULT_JSON_PATH, mode: '100644', type: 'blob', sha: 'blob1' },
        { path: 'public/vault/blobs/abc.bin', mode: '100644', type: 'blob', sha: 'blob2' },
        { path: WEB_JSON_PATH, mode: '100644', type: 'blob', sha: null },
      ],
    })
    const blobs = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/git/blobs'))
    expect(blobs[0].body).toEqual({
      content: btoa(JSON.stringify(VAULT_FILE)),
      encoding: 'base64',
    })
    expect(blobs[1].body).toEqual({ content: btoa('\x01\x02\x03'), encoding: 'base64' })
  })

  it('leaves web.json alone unless asked to delete it', async () => {
    const { calls, fetchImpl } = gitServer()
    await commit(fetchImpl)
    const tree = calls.find((c) => c.method === 'POST' && c.path.endsWith('/git/trees'))!
    const paths = (tree.body as { tree: { path: string }[] }).tree.map((e) => e.path)
    expect(paths).not.toContain(WEB_JSON_PATH)
  })

  it('throws GitHubRefNotFastForwardError when the ref update answers 422', async () => {
    const { fetchImpl } = gitServer({ patch: json(422, { message: 'Update is not a fast forward' }) })
    await expect(commit(fetchImpl)).rejects.toBeInstanceOf(GitHubRefNotFastForwardError)
  })

  it.each([401, 403])('maps %i on the ref update to TOKEN_DENIED', async (status) => {
    const { fetchImpl } = gitServer({ patch: json(status, {}) })
    await expect(commit(fetchImpl)).rejects.toThrow(TOKEN_DENIED)
  })

  it.each([401, 403])('maps %i while reading the parent commit to TOKEN_DENIED', async (status) => {
    const { calls, fetchImpl } = gitServer({ commitRead: json(status, {}) })
    await expect(commit(fetchImpl)).rejects.toThrow(TOKEN_DENIED)
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
  })

  it('maps a 500 on the ref update to SYNC_PENDING', async () => {
    const { fetchImpl } = gitServer({ patch: json(500, {}) })
    await expect(commit(fetchImpl)).rejects.toThrow(SYNC_PENDING)
  })
})

describe('readVaultFile', () => {
  it('reads vault.json at the branch tip commit and returns that commit SHA', async () => {
    const calls: Call[] = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const parsed = new URL(url)
      calls.push({
        method: init?.method ?? 'GET',
        path: parsed.pathname,
        search: parsed.search,
        accept: new Headers(init?.headers).get('Accept'),
        body: undefined,
      })
      if (parsed.pathname.endsWith('/git/ref/heads/master')) return json(200, { object: { sha: 'tip7' } })
      if (parsed.pathname.endsWith(`/contents/${VAULT_JSON_PATH}`)) return new Response(JSON.stringify(VAULT_FILE))
      return json(500, {})
    })

    const result = await readVaultFile(fetchImpl as unknown as typeof fetch, 't')

    expect(result).toEqual({ file: VAULT_FILE, commitSha: 'tip7' })
    const contents = calls.find((c) => c.path.includes('/contents/'))!
    expect(contents.search).toBe('?ref=tip7')
    expect(contents.accept).toBe('application/vnd.github.raw')
  })

  it('maps 401 on the ref read to TOKEN_DENIED', async () => {
    const fetchImpl = vi.fn(async () => json(401, {}))
    await expect(readVaultFile(fetchImpl as unknown as typeof fetch, 't')).rejects.toThrow(TOKEN_DENIED)
  })

  it('maps a failed contents read to SYNC_PENDING', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('/git/ref/') ? json(200, { object: { sha: 'tip7' } }) : json(404, {}),
    )
    await expect(readVaultFile(fetchImpl as unknown as typeof fetch, 't')).rejects.toThrow(SYNC_PENDING)
  })
})

describe('readBlobFile', () => {
  it('reads raw bytes so blobs over the 1 MB contents limit still load', async () => {
    // fill() stays cheap on CI; TypedArray.map over 1.5 MB was timing out the default 5s budget.
    const big = new Uint8Array(1_500_000).fill(7)
    big[0] = 1
    big[big.length - 1] = 9
    let accept: string | null = null
    let requested = ''
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      requested = new URL(url).pathname + new URL(url).search
      accept = new Headers(init?.headers).get('Accept')
      return new Response(big)
    })

    const bytes = await readBlobFile(fetchImpl as unknown as typeof fetch, 't', 'deadbeef')

    expect(accept).toBe('application/vnd.github.raw')
    expect(requested).toMatch(/\/contents\/public\/vault\/blobs\/deadbeef\.bin\?ref=master$/)
    expect(bytes.byteLength).toBe(1_500_000)
    expect(bytes[0]).toBe(1)
    expect(bytes[bytes.length - 1]).toBe(9)
  })

  it('reads against an explicit commit SHA when provided', async () => {
    let requested = ''
    const fetchImpl = vi.fn(async (url: string) => {
      requested = new URL(url).pathname + new URL(url).search
      return new Response(new Uint8Array([4, 5]))
    })

    await readBlobFile(fetchImpl as unknown as typeof fetch, 't', 'deadbeef', 'abc123')

    expect(requested).toMatch(/\/contents\/public\/vault\/blobs\/deadbeef\.bin\?ref=abc123$/)
  })

  it.each([
    [401, TOKEN_DENIED],
    [403, TOKEN_DENIED],
    [404, SYNC_PENDING],
  ])('maps %i to %s', async (status, message) => {
    const fetchImpl = vi.fn(async () => json(status, {}))
    await expect(readBlobFile(fetchImpl as unknown as typeof fetch, 't', 'x')).rejects.toThrow(message)
  })
})
