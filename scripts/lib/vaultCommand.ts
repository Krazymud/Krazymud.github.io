import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  checkPassphrase,
  DecryptError,
  decryptJson,
  deriveKek,
  encryptJson,
  generateDek,
  newKdfParams,
  unwrapDek,
  wrapDek,
  type VaultKey,
} from '../../src/vault/crypto.ts'
import type { VaultFile, VaultManifest } from '../../src/vault/types.ts'
import { photoDate, processPhoto } from './photo.ts'
import { buildVault, referencedBlobs, type SourceItem } from './vaultBuild.ts'
import {
  checkConfigRefs,
  isPhotoFile,
  parseConfig,
  parseList,
  parseNote,
  sha256Hex,
  sortLists,
  VaultError,
} from './vaultSource.ts'

export const VAULT_FILE = 'vault.json'
export const BLOB_DIR = 'blobs'
export const SIZE_WARNING_BYTES = 300 * 1024 * 1024

const IGNORED_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])

export class WrongPassphraseError extends VaultError {
  constructor() {
    super('口令不对')
    this.name = 'WrongPassphraseError'
  }
}

async function listFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && !IGNORED_FILES.has(entry.name.toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

const isMarkdown = (name: string) => name.toLowerCase().endsWith('.md')

export async function scanSource(sourceDir: string): Promise<SourceItem[]> {
  if (!existsSync(sourceDir)) throw new VaultError(`找不到内容文件夹 ${sourceDir}`)
  const configPath = join(sourceDir, 'manifest.yaml')
  const config = parseConfig(existsSync(configPath) ? await readFile(configPath, 'utf8') : null)

  const photoFiles = await listFiles(join(sourceDir, 'photos'))
  const unsupported = photoFiles.find((name) => !isPhotoFile(name))
  if (unsupported) throw new VaultError(`不支持的图片格式：photos/${unsupported}（支持 jpg、png、webp、heic）`)
  const noteFiles = (await listFiles(join(sourceDir, 'notes'))).filter(isMarkdown)
  const listFilesSorted = sortLists((await listFiles(join(sourceDir, 'lists'))).filter(isMarkdown), config.listOrder)
  checkConfigRefs(config, photoFiles, listFilesSorted)

  const items: SourceItem[] = []
  for (const name of photoFiles) {
    const path = join(sourceDir, 'photos', name)
    const bytes = await readFile(path)
    const override = config.photos[name] ?? {}
    items.push({
      kind: 'photo',
      source: `photos/${name}`,
      hash: sha256Hex(bytes),
      caption: override.caption ?? '',
      date: override.date ?? (await photoDate(bytes, (await stat(path)).mtime)),
      load: async () => {
        try {
          return await processPhoto(name, await readFile(path))
        } catch (error) {
          throw new VaultError(`photos/${name} 处理失败：${error instanceof Error ? error.message : String(error)}`)
        }
      },
    })
  }
  for (const name of noteFiles) {
    const text = await readFile(join(sourceDir, 'notes', name), 'utf8')
    items.push({ kind: 'note', source: `notes/${name}`, hash: sha256Hex(text), ...parseNote(`notes/${name}`, text) })
  }
  for (const name of listFilesSorted) {
    const text = await readFile(join(sourceDir, 'lists', name), 'utf8')
    items.push({ kind: 'list', source: `lists/${name}`, hash: sha256Hex(text), ...parseList(`lists/${name}`, text) })
  }
  return items
}

export function vaultExists(outDir: string): boolean {
  return existsSync(join(outDir, VAULT_FILE))
}

async function readVaultFile(outDir: string): Promise<VaultFile | null> {
  if (!vaultExists(outDir)) return null
  return JSON.parse(await readFile(join(outDir, VAULT_FILE), 'utf8')) as VaultFile
}

async function writeVaultFile(outDir: string, file: VaultFile): Promise<void> {
  await writeFile(join(outDir, VAULT_FILE), `${JSON.stringify(file, null, 2)}\n`)
}

async function openVault(file: VaultFile, passphrase: string): Promise<{ dek: VaultKey; manifest: VaultManifest }> {
  const kek = await deriveKek(passphrase, file.kdf)
  try {
    const dek = await unwrapDek(file.wrappedKey, kek, true)
    return { dek, manifest: await decryptJson<VaultManifest>(dek, file.manifest) }
  } catch (error) {
    if (error instanceof DecryptError) throw new WrongPassphraseError()
    throw error
  }
}

export interface RunVaultOptions {
  sourceDir: string
  outDir: string
  passphrase: string
  iterations?: number
  log?: (line: string) => void
}

export interface RunVaultResult {
  photos: number
  notes: number
  lists: number
  written: number
  removed: number
  totalBytes: number
}

export async function runVault(options: RunVaultOptions): Promise<RunVaultResult> {
  const { sourceDir, outDir, passphrase } = options
  const log = options.log ?? (() => undefined)

  const existing = await readVaultFile(outDir)
  let dek: VaultKey
  let previous: VaultManifest | null
  let kdf = existing?.kdf
  let wrappedKey = existing?.wrappedKey
  if (existing) {
    ;({ dek, manifest: previous } = await openVault(existing, passphrase))
  } else {
    const weak = checkPassphrase(passphrase)
    if (weak) throw new VaultError(weak)
    kdf = newKdfParams(options.iterations)
    dek = await generateDek()
    wrappedKey = await wrapDek(dek, await deriveKek(passphrase, kdf))
    previous = null
  }

  const items = await scanSource(sourceDir)
  const { manifest, writes } = await buildVault(items, previous, dek, (source, reused) =>
    log(`${reused ? '沿用' : '加密'} ${source}`),
  )

  const blobDir = join(outDir, BLOB_DIR)
  await mkdir(blobDir, { recursive: true })
  for (const [name, bytes] of writes) await writeFile(join(blobDir, `${name}.bin`), bytes)
  const keep = referencedBlobs(manifest)
  let removed = 0
  for (const file of await readdir(blobDir)) {
    if (file.endsWith('.bin') && !keep.has(file.slice(0, -'.bin'.length))) {
      await rm(join(blobDir, file))
      removed++
    }
  }
  await writeVaultFile(outDir, { version: 1, kdf: kdf!, wrappedKey: wrappedKey!, manifest: await encryptJson(dek, manifest) })

  let totalBytes = (await stat(join(outDir, VAULT_FILE))).size
  for (const file of await readdir(blobDir)) totalBytes += (await stat(join(blobDir, file))).size
  return {
    photos: manifest.photos.length,
    notes: manifest.notes.length,
    lists: manifest.lists.length,
    written: writes.size,
    removed,
    totalBytes,
  }
}

export interface RunRekeyOptions {
  outDir: string
  oldPassphrase: string
  newPassphrase: string
  iterations?: number
}

export async function runRekey(options: RunRekeyOptions): Promise<void> {
  const existing = await readVaultFile(options.outDir)
  if (!existing) throw new VaultError('还没有保险库，先运行 npm run vault')
  const weak = checkPassphrase(options.newPassphrase)
  if (weak) throw new VaultError(weak)
  const { dek } = await openVault(existing, options.oldPassphrase)
  const kdf = newKdfParams(options.iterations)
  const wrappedKey = await wrapDek(dek, await deriveKek(options.newPassphrase, kdf))
  await writeVaultFile(options.outDir, { ...existing, kdf, wrappedKey })
}
