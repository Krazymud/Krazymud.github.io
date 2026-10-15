import { describe, expect, it, vi } from 'vitest'
import { CosConflictError, putVaultUpdate, readVaultFile } from './cosVault'

const config = { bucket: 'b-125', region: 'ap-guangzhou', vaultPrefix: 'vault' }
const creds = { secretId: 'AKIDtest', secretKey: 'secret', sessionToken: 'tok' }

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
        vaultFile: {
          version: 1,
          kdf: { alg: 'PBKDF2', hash: 'SHA-256', iterations: 1, salt: '' },
          wrappedKey: '',
          manifest: '',
        },
        etag: 'old',
        blobs: { a: new Uint8Array([1]) },
      }),
    ).rejects.toBeInstanceOf(CosConflictError)
  })
})
