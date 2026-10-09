// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decryptBytes,
  DecryptError,
  decryptJson,
  deriveKek,
  encryptBytes,
  newKdfParams,
  toBase64,
  unwrapDek,
  type VaultKey,
} from '../../src/vault/crypto.ts'
import type { VaultFile, VaultManifest } from '../../src/vault/types.ts'
import { runRekey, runVault, writeVaultFile, WrongPassphraseError } from './vaultCommand.ts'
import { VaultError } from './vaultSource.ts'

const rmFault = vi.hoisted(() => ({ fails: null as ((fileName: string) => boolean) | null }))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const rm: typeof actual.rm = (path, options) =>
    rmFault.fails?.(String(path).split(/[\\/]/).pop()!) ? Promise.reject(new Error('injected rm failure')) : actual.rm(path, options)
  return { ...actual, rm, default: { ...actual, rm } }
})

const PASS = 'iceland aurora penguin goodnight'
let root = ''
let src = ''
let out = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vault-test-'))
  src = join(root, 'vault-src')
  out = join(root, 'public', 'vault')
  for (const dir of ['photos', 'notes', 'lists']) await mkdir(join(src, dir), { recursive: true })
  const jpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#bf9f62' } }).jpeg().toBuffer()
  await writeFile(join(src, 'photos', 'a.jpg'), jpeg)
  await writeFile(join(src, 'notes', 'a.md'), '---\ntitle: 晚安\ndate: 2024-05-21\n---\n今天的风很温柔。\n')
  await writeFile(join(src, 'lists', 'a.md'), '---\ntitle: 一起去的地方\n---\n- [x] 去看海\n')
})

afterEach(async () => {
  rmFault.fails = null
  await rm(root, { recursive: true, force: true })
})

const run = (passphrase = PASS) => runVault({ sourceDir: src, outDir: out, passphrase, iterations: 1000 })
const blobs = async () => (await readdir(join(out, 'blobs'))).sort()
const vaultText = () => readFile(join(out, 'vault.json'), 'utf8')

async function openAsBrowserWithKey(passphrase: string): Promise<{ dek: VaultKey; manifest: VaultManifest }> {
  const file = JSON.parse(await vaultText()) as VaultFile
  const dek = await unwrapDek(file.wrappedKey, await deriveKek(passphrase, file.kdf), false)
  return { dek, manifest: await decryptJson<VaultManifest>(dek, file.manifest) }
}

async function openAsBrowser(passphrase: string): Promise<VaultManifest> {
  return (await openAsBrowserWithKey(passphrase)).manifest
}

describe('runVault', () => {
  it('creates a vault the browser code can open', async () => {
    expect(await run()).toMatchObject({ photos: 1, notes: 1, lists: 1, written: 4, removed: 0 })
    const manifest = await openAsBrowser(PASS)
    expect(manifest.notes[0]).toMatchObject({ title: '晚安', source: 'notes/a.md' })
    expect(manifest.photos[0]).toMatchObject({ source: 'photos/a.jpg', width: 40, height: 30 })
    expect(await blobs()).toHaveLength(4)
    expect(JSON.parse(await vaultText()).kdf.iterations).toBe(1000)
  })

  it('only writes what changed on later runs', async () => {
    await run()
    const before = await blobs()
    expect(await run()).toMatchObject({ written: 0, removed: 0 })
    expect(await blobs()).toEqual(before)

    await writeFile(join(src, 'notes', 'b.md'), '---\ntitle: 早安\ndate: 2024-05-22\n---\n早。\n')
    await rm(join(src, 'lists', 'a.md'))
    expect(await run()).toMatchObject({ notes: 2, lists: 0, written: 1, removed: 1 })
  })

  it('leaves no temp file behind', async () => {
    await run()
    expect(await readdir(out)).not.toContain('vault.json.tmp')
  })

  it('keeps old blobs when vault.json cannot be written', async () => {
    await run()
    const before = await vaultText()
    const files = await blobs()
    await rm(join(src, 'lists', 'a.md'))
    await mkdir(join(out, 'vault.json.tmp'))
    await expect(run()).rejects.toThrow()
    expect(await vaultText()).toBe(before)
    expect(await blobs()).toEqual(expect.arrayContaining(files))
  })

  it('refuses a wrong passphrase without touching anything', async () => {
    await run()
    const before = await vaultText()
    await expect(run('iceland aurora penguin goodbye')).rejects.toBeInstanceOf(WrongPassphraseError)
    expect(await vaultText()).toBe(before)
  })

  it('reports a damaged manifest instead of a wrong passphrase', async () => {
    await run()
    const file = JSON.parse(await vaultText()) as VaultFile
    await writeFile(join(out, 'vault.json'), JSON.stringify({ ...file, manifest: toBase64(new Uint8Array(40)) }))
    const error = await run().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(VaultError)
    expect(error).not.toBeInstanceOf(WrongPassphraseError)
    expect((error as Error).message).toContain('vault.json 已损坏')
    expect((error as Error).cause).toBeInstanceOf(DecryptError)
  })

  it('passes through manifest errors other than a failed decrypt', async () => {
    await run()
    const file = JSON.parse(await vaultText()) as VaultFile
    const { dek } = await openAsBrowserWithKey(PASS)
    const notJson = toBase64(await encryptBytes(dek, new TextEncoder().encode('not json')))
    await writeFile(join(out, 'vault.json'), JSON.stringify({ ...file, manifest: notJson }))
    await expect(run()).rejects.toBeInstanceOf(SyntaxError)
  })

  it('reports a vault.json that is not valid JSON', async () => {
    await run()
    await writeFile(join(out, 'vault.json'), '{ broken')
    const error = await run().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(VaultError)
    expect((error as Error).message).toContain('vault.json 已损坏')
  })

  it('stores blobs the browser code can decrypt', async () => {
    await run()
    const { dek, manifest } = await openAsBrowserWithKey(PASS)
    const sealed = await readFile(join(out, 'blobs', `${manifest.notes[0].blob}.bin`))
    expect(new TextDecoder().decode(await decryptBytes(dek, sealed))).toBe('今天的风很温柔。')
  })

  it('refuses a weak passphrase for a new vault', async () => {
    await expect(run('short')).rejects.toThrow('口令至少要 16 个字符')
    await expect(readdir(out)).rejects.toThrow()
  })

  it('refuses unsupported photos before writing anything', async () => {
    await writeFile(join(src, 'photos', 'b.gif'), 'gif')
    await expect(run()).rejects.toThrow('不支持的图片格式：photos/b.gif')
    await expect(readFile(join(out, 'vault.json'))).rejects.toThrow()
  })
})

describe('writeVaultFile', () => {
  it('removes its temp file when the final rename fails', async () => {
    await mkdir(join(out, 'vault.json', 'occupied'), { recursive: true })
    const file: VaultFile = { version: 1, kdf: newKdfParams(1000), wrappedKey: '', manifest: '' }
    await expect(writeVaultFile(out, file)).rejects.toThrow()
    expect(await readdir(out)).not.toContain('vault.json.tmp')
  })
})

describe('runRekey', () => {
  const NEW_PASS = '新的口令也要足够长 才能通过检查'

  async function contents(passphrase: string): Promise<Map<string, Uint8Array>> {
    const { dek, manifest } = await openAsBrowserWithKey(passphrase)
    const result = new Map<string, Uint8Array>()
    const items = [
      ...manifest.photos.flatMap((p) => [[`${p.source}#thumb`, p.thumb], [`${p.source}#full`, p.full]]),
      ...manifest.notes.map((n) => [n.source, n.blob]),
      ...manifest.lists.map((l) => [l.source, l.blob]),
    ]
    for (const [source, blob] of items) {
      result.set(source, await decryptBytes(dek, await readFile(join(out, 'blobs', `${blob}.bin`))))
    }
    return result
  }

  it('changes the passphrase and rotates the content key', async () => {
    await run()
    const before = JSON.parse(await vaultText()) as VaultFile
    const oldDek = await unwrapDek(before.wrappedKey, await deriveKek(PASS, before.kdf), false)
    const oldFiles = await blobs()
    const oldContents = await contents(PASS)

    expect(await runRekey({ outDir: out, oldPassphrase: PASS, newPassphrase: NEW_PASS, iterations: 1000 })).toEqual({
      undeleted: [],
    })
    const after = JSON.parse(await vaultText()) as VaultFile

    expect(after.kdf.salt).not.toBe(before.kdf.salt)
    await expect(openAsBrowser(PASS)).rejects.toBeInstanceOf(DecryptError)
    await expect(run(PASS)).rejects.toBeInstanceOf(WrongPassphraseError)
    expect((await openAsBrowser(NEW_PASS)).notes).toHaveLength(1)
    await expect(decryptJson(oldDek, after.manifest)).rejects.toBeInstanceOf(DecryptError)

    const newFiles = await blobs()
    expect(newFiles).toHaveLength(oldFiles.length)
    expect(newFiles.filter((name) => oldFiles.includes(name))).toEqual([])
    expect(await contents(NEW_PASS)).toEqual(oldContents)
    expect(await readdir(out)).not.toContain('vault.json.tmp')
  })

  it('leaves the old vault intact when vault.json cannot be written', async () => {
    await run()
    const before = await vaultText()
    const files = await blobs()
    await mkdir(join(out, 'vault.json.tmp'))
    await expect(runRekey({ outDir: out, oldPassphrase: PASS, newPassphrase: NEW_PASS, iterations: 1000 })).rejects.toThrow()
    expect(await vaultText()).toBe(before)
    expect(await blobs()).toEqual(files)
    expect((await openAsBrowser(PASS)).notes).toHaveLength(1)
  })

  it('tries to remove every new blob and rethrows the original error when cleanup also fails', async () => {
    await run()
    const files = await blobs()
    const stuck = new Set<string>()
    rmFault.fails = (name) => {
      if (files.includes(name) || stuck.size > 0) return false
      stuck.add(name)
      return true
    }
    await mkdir(join(out, 'vault.json.tmp'))
    const error = await runRekey({ outDir: out, oldPassphrase: PASS, newPassphrase: NEW_PASS, iterations: 1000 }).catch(
      (e: unknown) => e,
    )
    expect((error as Error).message).not.toBe('injected rm failure')
    expect(await blobs()).toEqual([...files, ...stuck].sort())
  })

  it('still succeeds when an old blob cannot be removed', async () => {
    await run()
    const [stuck] = await blobs()
    rmFault.fails = (name) => name === stuck
    const result = await runRekey({ outDir: out, oldPassphrase: PASS, newPassphrase: NEW_PASS, iterations: 1000 })
    expect(result).toEqual({ undeleted: [`blobs/${stuck}`] })
    expect((await openAsBrowser(NEW_PASS)).notes).toHaveLength(1)
    rmFault.fails = null
    expect(await run(NEW_PASS)).toMatchObject({ written: 0, removed: 1 })
  })

  it('keeps working with later runs after a rekey', async () => {
    await run()
    await runRekey({ outDir: out, oldPassphrase: PASS, newPassphrase: NEW_PASS, iterations: 1000 })
    expect(await run(NEW_PASS)).toMatchObject({ written: 0, removed: 0 })
  })

  it('rejects a weak new passphrase before touching anything', async () => {
    await run()
    const before = await vaultText()
    const files = await blobs()
    await expect(
      runRekey({ outDir: out, oldPassphrase: PASS, newPassphrase: 'a b c d', iterations: 1000 }),
    ).rejects.toThrow('口令至少要 16 个字符')
    expect(await vaultText()).toBe(before)
    expect(await blobs()).toEqual(files)
  })

  it('requires the current passphrase', async () => {
    await run()
    await expect(
      runRekey({ outDir: out, oldPassphrase: 'iceland aurora penguin goodbye', newPassphrase: NEW_PASS, iterations: 1000 }),
    ).rejects.toBeInstanceOf(WrongPassphraseError)
  })
})
