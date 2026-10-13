import { describe, expect, it, vi } from 'vitest'
import { generateDek } from './crypto'
import { GitHubWriteError, SYNC_PENDING, syncWebFile, TOKEN_DENIED, WEB_COMMIT_MESSAGE } from './github'
import { emptyWebDoc, openWebFile, sealWebFile, WebFileError, type WebDoc } from './web'

const dekPromise = generateDek()

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function callsOf(fetchImpl: ReturnType<typeof vi.fn>) {
  return fetchImpl.mock.calls.map((call) => {
    const [url, init] = call as [string, RequestInit | undefined]
    return {
      url,
      method: init?.method ?? 'GET',
      cache: init?.cache,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    }
  })
}

describe('syncWebFile', () => {
  it('creates the file when the repo does not have one', async () => {
    const dek = await dekPromise
    const local: WebDoc = { ...emptyWebDoc(), notes: [{ id: 'n1', title: '网页', date: '2026-10-13', body: '', updatedAt: 3 }] }
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(new URL(url).host).toBe('api.github.com')
      expect((init?.headers as Headers).get('Authorization')).toBe('Bearer secret-token')
      if (!init?.method) return json(404, { message: 'Not Found' })
      return json(201, { content: { sha: 'created' } })
    })
    const result = await syncWebFile({ fetch: fetchImpl as typeof fetch, token: 'secret-token', local, dek })
    expect((await openWebFile(dek, result.text)).notes[0].title).toBe('网页')
    const calls = await callsOf(fetchImpl)
    expect(calls).toHaveLength(2)
    expect(calls[0].cache).toBe('no-store')
    expect(calls[1].body.message).toBe(WEB_COMMIT_MESSAGE)
    expect(calls[1].body.sha).toBeUndefined()
    expect(calls[1].body.branch).toBe('master')
    expect(calls[1].url).toBe(
      'https://api.github.com/repos/Krazymud/Krazymud.github.io/contents/public/vault/web.json',
    )
  })

  it('puts the sha from the repository and merges onto that document', async () => {
    const dek = await dekPromise
    const remote = await sealWebFile(dek, {
      ...emptyWebDoc(),
      notes: [{ id: 'remote', title: '仓库', date: '2026-10-13', body: '', updatedAt: 5 }],
    })
    const local: WebDoc = { ...emptyWebDoc(), notes: [{ id: 'local', title: '本机', date: '2026-10-13', body: '', updatedAt: 6 }] }
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method) return json(200, { sha: 'abc123', content: btoa(remote), encoding: 'base64' })
      return json(200, {})
    })
    const result = await syncWebFile({ fetch: fetchImpl as typeof fetch, token: 't', local, dek })
    expect((await openWebFile(dek, result.text)).notes.map((note) => note.id).sort()).toEqual(['local', 'remote'])
    const calls = await callsOf(fetchImpl)
    expect(calls[0].url).toContain('?ref=master')
    expect(calls[1].body.sha).toBe('abc123')
  })

  it('refetches once after 409 and uses the new sha', async () => {
    const dek = await dekPromise
    const first = await sealWebFile(dek, emptyWebDoc())
    const second = await sealWebFile(dek, {
      ...emptyWebDoc(),
      notes: [{ id: 'other', title: '另一台', date: '2026-10-13', body: '', updatedAt: 8 }],
    })
    const seen: string[] = []
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method) {
        const sha = seen.length === 0 ? 'first' : 'second'
        seen.push(sha)
        return json(200, { sha, content: btoa(sha === 'first' ? first : second), encoding: 'base64' })
      }
      return json(seen.length === 1 ? 409 : 200, {})
    })
    const local: WebDoc = { ...emptyWebDoc(), notes: [{ id: 'mine', title: '我的', date: '2026-10-13', body: '', updatedAt: 9 }] }
    const result = await syncWebFile({ fetch: fetchImpl as typeof fetch, token: 't', local, dek })
    const calls = await callsOf(fetchImpl)
    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(2)
    expect(calls[3].body.sha).toBe('second')
    expect((await openWebFile(dek, result.text)).notes.map((note) => note.id).sort()).toEqual(['mine', 'other'])
  })

  it('refetches once after 422 and uses the new sha', async () => {
    const dek = await dekPromise
    const remote = await sealWebFile(dek, {
      ...emptyWebDoc(),
      notes: [{ id: 'other', title: '另一台', date: '2026-10-13', body: '', updatedAt: 8 }],
    })
    let gets = 0
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method) {
        gets += 1
        if (gets === 1) return json(404, { message: 'Not Found' })
        return json(200, { sha: 'second', content: btoa(remote), encoding: 'base64' })
      }
      return json(gets === 1 ? 422 : 200, {})
    })
    const local: WebDoc = { ...emptyWebDoc(), notes: [{ id: 'mine', title: '我的', date: '2026-10-13', body: '', updatedAt: 9 }] }
    const result = await syncWebFile({ fetch: fetchImpl as typeof fetch, token: 't', local, dek })
    const calls = await callsOf(fetchImpl)
    expect(calls.filter((call) => call.method === 'GET').map((call) => call.cache)).toEqual(['no-store', 'no-store'])
    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(2)
    expect(calls[1].body.sha).toBeUndefined()
    expect(calls[3].body.sha).toBe('second')
    expect((await openWebFile(dek, result.text)).notes.map((note) => note.id).sort()).toEqual(['mine', 'other'])
  })

  it('stops after a second 422', async () => {
    const dek = await dekPromise
    const conflict = vi.fn(async (_url: string, init?: RequestInit) =>
      json(init?.method ? 422 : 200, { sha: 'x', content: btoa(await sealWebFile(dek, emptyWebDoc())) }),
    )
    await expect(syncWebFile({ fetch: conflict as typeof fetch, token: 't', local: emptyWebDoc(), dek })).rejects.toThrow(
      SYNC_PENDING,
    )
    expect(conflict).toHaveBeenCalledTimes(4)
  })

  it('stops after a second 409 and does not open a file it cannot decrypt', async () => {
    const dek = await dekPromise
    const conflict = vi.fn(async (_url: string, init?: RequestInit) => json(init?.method ? 409 : 200, { sha: 'x', content: btoa(await sealWebFile(dek, emptyWebDoc())) }))
    await expect(syncWebFile({ fetch: conflict as typeof fetch, token: 't', local: emptyWebDoc(), dek })).rejects.toThrow(SYNC_PENDING)
    expect(conflict).toHaveBeenCalledTimes(4)

    const broken = vi.fn(async () => json(200, { sha: 'x', content: btoa(JSON.stringify({ version: 2, sealed: 'nope' })) }))
    await expect(syncWebFile({ fetch: broken as typeof fetch, token: 't', local: emptyWebDoc(), dek })).rejects.toBeInstanceOf(WebFileError)
    expect(broken).toHaveBeenCalledTimes(1)
  })

  it('turns 401 and 403 into the token error', async () => {
    const dek = await dekPromise
    for (const status of [401, 403]) {
      const fetchImpl = vi.fn(async () => json(status, {}))
      await expect(syncWebFile({ fetch: fetchImpl as typeof fetch, token: 't', local: emptyWebDoc(), dek })).rejects.toThrow(
        TOKEN_DENIED,
      )
      await expect(syncWebFile({ fetch: fetchImpl as typeof fetch, token: 't', local: emptyWebDoc(), dek })).rejects.toBeInstanceOf(
        GitHubWriteError,
      )
    }
  })
})
