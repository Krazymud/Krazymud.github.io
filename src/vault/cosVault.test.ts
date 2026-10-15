import { describe, expect, it, vi } from 'vitest'
import {
  CosConflictError,
  CosNotFoundError,
  putVaultUpdate,
  readBlobFile,
  readVaultFile,
} from './cosVault'

const config = { bucket: 'b-125', region: 'ap-guangzhou', vaultPrefix: 'vault' }
const creds = { secretId: 'AKIDtest', secretKey: 'secret', sessionToken: 'tok' }

const vaultFile = {
  version: 1 as const,
  kdf: { alg: 'PBKDF2', hash: 'SHA-256', iterations: 1, salt: '' },
  wrappedKey: '',
  manifest: '',
}

function headerFromInit(init: RequestInit | undefined, name: string): string | null {
  const headers = init?.headers
  if (!headers) return null
  if (headers instanceof Headers) return headers.get(name)
  if (Array.isArray(headers)) {
    const entry = headers.find(([k]) => k.toLowerCase() === name.toLowerCase())
    return entry ? String(entry[1]) : null
  }
  const record = headers as Record<string, string>
  const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? record[key] : null
}

describe('readVaultFile', () => {
  it('returns null etag object body as VaultFile', async () => {
    const file = {
      version: 1 as const,
      kdf: { alg: 'PBKDF2', hash: 'SHA-256', iterations: 1, salt: '' },
      wrappedKey: '',
      manifest: '',
    }
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(file), { status: 200, headers: { ETag: '"abc"' } }),
    )
    const result = await readVaultFile({ fetch: fetchImpl as unknown as typeof fetch, creds, config })
    expect(result.etag).toBe('abc')
    expect(result.file).toEqual(file)
  })

  it('treats 404 as empty vault file shape for callers to interpret', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }))
    await expect(
      readVaultFile({ fetch: fetchImpl as unknown as typeof fetch, creds, config }),
    ).rejects.toMatchObject({ name: 'CosNotFoundError' })
  })
})

describe('readBlobFile', () => {
  it('returns blob bytes on 200', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([9, 8, 7]), { status: 200 }))
    const bytes = await readBlobFile({
      fetch: fetchImpl as unknown as typeof fetch,
      creds,
      config,
      blobName: 'note-1',
    })
    expect(bytes).toEqual(new Uint8Array([9, 8, 7]))
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('blobs/note-1.bin')
  })

  it('throws CosNotFoundError on 404', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }))
    await expect(
      readBlobFile({
        fetch: fetchImpl as unknown as typeof fetch,
        creds,
        config,
        blobName: 'missing',
      }),
    ).rejects.toBeInstanceOf(CosNotFoundError)
  })
})

describe('putVaultUpdate', () => {
  it('raises CosConflictError on 412 for vault.json', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('vault.json')) return new Response('', { status: 412 })
      return new Response('', { status: 200, headers: { ETag: '"b1"' } })
    })
    await expect(
      putVaultUpdate({
        fetch: fetchImpl as unknown as typeof fetch,
        creds,
        config,
        vaultFile,
        etag: 'old',
        blobs: { a: new Uint8Array([1]) },
      }),
    ).rejects.toBeInstanceOf(CosConflictError)
  })

  it('sends If-Match with quoted etag on vault.json PUT', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return new Response('', { status: 200, headers: { ETag: '"new-etag"' } })
    })
    await putVaultUpdate({
      fetch: fetchImpl as unknown as typeof fetch,
      creds,
      config,
      vaultFile,
      etag: 'old-etag',
      blobs: {},
    })
    const vaultPut = calls.find((c) => c.url.includes('vault.json'))
    expect(vaultPut).toBeDefined()
    expect(headerFromInit(vaultPut?.init, 'if-match')).toBe('"old-etag"')
    expect(headerFromInit(vaultPut?.init, 'if-none-match')).toBeNull()
  })

  it('sends If-None-Match: * on vault.json PUT when etag is null', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return new Response('', { status: 200, headers: { ETag: '"created"' } })
    })
    await putVaultUpdate({
      fetch: fetchImpl as unknown as typeof fetch,
      creds,
      config,
      vaultFile,
      etag: null,
      blobs: {},
    })
    const vaultPut = calls.find((c) => c.url.includes('vault.json'))
    expect(vaultPut).toBeDefined()
    expect(headerFromInit(vaultPut?.init, 'if-none-match')).toBe('*')
    expect(headerFromInit(vaultPut?.init, 'if-match')).toBeNull()
  })

  it('PUTs blobs before vault.json', async () => {
    const order: string[] = []
    const fetchImpl = vi.fn(async (url: string) => {
      order.push(String(url))
      return new Response('', { status: 200, headers: { ETag: '"ok"' } })
    })
    await putVaultUpdate({
      fetch: fetchImpl as unknown as typeof fetch,
      creds,
      config,
      vaultFile,
      etag: 'e1',
      blobs: { alpha: new Uint8Array([1]), beta: new Uint8Array([2]) },
    })
    const vaultIdx = order.findIndex((u) => u.includes('vault.json'))
    const alphaIdx = order.findIndex((u) => u.includes('blobs/alpha.bin'))
    const betaIdx = order.findIndex((u) => u.includes('blobs/beta.bin'))
    expect(alphaIdx).toBeGreaterThanOrEqual(0)
    expect(betaIdx).toBeGreaterThanOrEqual(0)
    expect(vaultIdx).toBeGreaterThan(alphaIdx)
    expect(vaultIdx).toBeGreaterThan(betaIdx)
  })
})
