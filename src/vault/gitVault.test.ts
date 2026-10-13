import { describe, expect, it, vi } from 'vitest'
import { TOKEN_DENIED } from './github'
import { commitVaultUpdate, readVaultFile } from './gitVault'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('commitVaultUpdate', () => {
  it('creates blobs, a tree, a commit, and fast-forwards master', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname
      calls.push(`${init?.method ?? 'GET'} ${path}`)
      if (path.endsWith('/git/ref/heads/master')) return json(200, { object: { sha: 'commit0' } })
      if (path.endsWith('/git/commits/commit0')) return json(200, { tree: { sha: 'tree0' }, sha: 'commit0' })
      if (path.endsWith('/git/blobs')) return json(201, { sha: `blob-${calls.length}` })
      if (path.endsWith('/git/trees')) return json(201, { sha: 'tree1' })
      if (path.endsWith('/git/commits') && init?.method === 'POST') return json(201, { sha: 'commit1' })
      if (path.endsWith('/git/refs/heads/master')) return json(200, { object: { sha: 'commit1' } })
      return json(500, {})
    })
    await commitVaultUpdate({
      fetch: fetchImpl as typeof fetch,
      token: 't',
      message: 'content(vault): update notes',
      vaultFile: { version: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 1, salt: 'aa' }, wrappedKey: 'w', manifest: 'm' },
      blobs: { abc: new Uint8Array([1, 2, 3]) },
      deleteWebJson: true,
    })
    expect(calls.some((c) => c.startsWith('POST') && c.endsWith('/git/blobs'))).toBe(true)
    expect(calls.some((c) => c.includes('/git/refs/heads/master'))).toBe(true)
  })

  it('maps 401 on ref read to TOKEN_DENIED', async () => {
    const fetchImpl = vi.fn(async () => json(401, {}))
    await expect(
      readVaultFile(fetchImpl as typeof fetch, 't'),
    ).rejects.toThrow(TOKEN_DENIED)
  })
})
