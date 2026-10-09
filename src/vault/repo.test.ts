import { afterEach, describe, expect, it, vi } from 'vitest'
import { DecryptError, toBase64 } from './crypto'
import { fetchVaultBytes, loadVaultFile, readBlob, unlockWithKey, unlockWithPassphrase } from './repo'
import { makeTestVault, TEST_PASSPHRASE } from './testVault'

const read = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('fetchVaultBytes', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps 404 and the HTML fallback page to null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    expect(await fetchVaultBytes('vault.json')).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })))
    expect(await fetchVaultBytes('vault.json')).toBeNull()
  })

  it('returns the bytes and throws on server errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2]))))
    expect(await fetchVaultBytes('blobs/a.bin')).toEqual(new Uint8Array([1, 2]))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    await expect(fetchVaultBytes('vault.json')).rejects.toThrow('HTTP 500')
  })
})

describe('vault repo', () => {
  it('treats a missing vault.json as an empty vault', async () => {
    expect(await loadVaultFile(async () => null)).toBeNull()
  })

  it('unlocks with the passphrase and reads blobs', async () => {
    const vault = await makeTestVault()
    const file = (await loadVaultFile(vault.fetchBytes))!
    const session = await unlockWithPassphrase(file, TEST_PASSPHRASE)
    expect(session.manifest.notes[0].title).toBe('晚安')
    expect(read(await readBlob(vault.fetchBytes, session.dek, 'note-a'))).toContain('温柔')
    await expect(crypto.subtle.exportKey('raw', session.dek)).rejects.toThrow()
  })

  it('rejects a wrong passphrase', async () => {
    const vault = await makeTestVault()
    await expect(unlockWithPassphrase(vault.file, 'iceland aurora penguin goodbye')).rejects.toBeInstanceOf(DecryptError)
  })

  it('does not blame the passphrase when the manifest is damaged', async () => {
    const vault = await makeTestVault()
    const file = { ...vault.file, manifest: toBase64(new Uint8Array(40)) }
    const error = await unlockWithPassphrase(file, TEST_PASSPHRASE).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(DecryptError)
    expect((error as Error).cause).toBeInstanceOf(DecryptError)
  })

  it('unlocks with a remembered key', async () => {
    const vault = await makeTestVault()
    expect((await unlockWithKey(vault.file, vault.dek)).manifest.photos).toHaveLength(2)
  })

  it('fails to read a broken or missing blob', async () => {
    const vault = await makeTestVault({ brokenBlobs: ['note-a'] })
    await expect(readBlob(vault.fetchBytes, vault.dek, 'note-a')).rejects.toBeInstanceOf(DecryptError)
    await expect(readBlob(vault.fetchBytes, vault.dek, 'nope')).rejects.toThrow('missing blob nope')
  })
})
