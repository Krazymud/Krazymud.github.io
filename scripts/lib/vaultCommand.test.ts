// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decryptJson, deriveKek, unwrapDek } from '../../src/vault/crypto.ts'
import type { VaultFile, VaultManifest } from '../../src/vault/types.ts'
import { runRekey, runVault, WrongPassphraseError } from './vaultCommand.ts'

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
  await rm(root, { recursive: true, force: true })
})

const run = (passphrase = PASS) => runVault({ sourceDir: src, outDir: out, passphrase, iterations: 1000 })
const blobs = async () => (await readdir(join(out, 'blobs'))).sort()
const vaultText = () => readFile(join(out, 'vault.json'), 'utf8')

async function openAsBrowser(passphrase: string): Promise<VaultManifest> {
  const file = JSON.parse(await vaultText()) as VaultFile
  const dek = await unwrapDek(file.wrappedKey, await deriveKek(passphrase, file.kdf), false)
  return decryptJson<VaultManifest>(dek, file.manifest)
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

describe('runRekey', () => {
  const NEW_PASS = '新的口令也要足够长 才能通过检查'

  it('switches the passphrase without touching the content', async () => {
    await run()
    const before = JSON.parse(await vaultText()) as VaultFile
    const files = await blobs()
    await runRekey({ outDir: out, oldPassphrase: PASS, newPassphrase: NEW_PASS, iterations: 1000 })
    const after = JSON.parse(await vaultText()) as VaultFile

    expect(after.manifest).toBe(before.manifest)
    expect(after.kdf.salt).not.toBe(before.kdf.salt)
    expect(await blobs()).toEqual(files)
    expect(await readdir(out)).not.toContain('vault.json.tmp')
    expect((await openAsBrowser(NEW_PASS)).notes).toHaveLength(1)
    await expect(openAsBrowser(PASS)).rejects.toThrow()
  })

  it('requires the current passphrase', async () => {
    await run()
    await expect(
      runRekey({ outDir: out, oldPassphrase: 'iceland aurora penguin goodbye', newPassphrase: NEW_PASS, iterations: 1000 }),
    ).rejects.toBeInstanceOf(WrongPassphraseError)
  })
})
