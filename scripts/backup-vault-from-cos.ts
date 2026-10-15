import { mkdir, mkdtemp, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { signedCosRequest, type CosCreds } from '../src/vault/cosAuth.ts'

const VAULT_PREFIX = (process.env.COS_VAULT_PREFIX ?? 'vault').replace(/\/$/, '')
const LOCAL_VAULT = path.resolve('public/vault')

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing ${name}`)
    process.exit(1)
  }
  return value
}

function parseArgs(argv: string[]): { prune: boolean } {
  let prune = false
  for (const arg of argv) {
    if (arg === '--prune') prune = true
    else {
      console.error(`Unknown argument: ${arg}`)
      process.exit(1)
    }
  }
  return { prune }
}

export type ListPage = { keys: string[]; truncated: boolean; nextMarker?: string }

export function parseListObjectsXml(xml: string): ListPage {
  const keys: string[] = []
  for (const block of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const match = block[1].match(/<Key>([^<]*)<\/Key>/)
    if (match?.[1]) keys.push(match[1])
  }
  const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml)
  const nextMarker = xml.match(/<NextMarker>([^<]*)<\/NextMarker>/)?.[1]
  return { keys, truncated, nextMarker: nextMarker || undefined }
}

function isVaultObjectKey(key: string): boolean {
  const vaultJson = `${VAULT_PREFIX}/vault.json`
  const blobsPrefix = `${VAULT_PREFIX}/blobs/`
  if (key === vaultJson) return true
  if (key.startsWith(blobsPrefix) && key.endsWith('.bin')) return true
  return false
}

async function listVaultObjectKeys(
  creds: CosCreds,
  bucket: string,
  region: string,
): Promise<string[]> {
  const prefix = `${VAULT_PREFIX}/`
  const keys: string[] = []
  let marker: string | undefined

  for (;;) {
    const query: Record<string, string> = {
      prefix,
      'max-keys': '1000',
    }
    if (marker) query.marker = marker

    const { url, headers } = await signedCosRequest({
      method: 'GET',
      bucket,
      region,
      key: '',
      creds,
      query,
    })
    const response = await fetch(url, { method: 'GET', headers })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `ListObjects failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`,
      )
    }
    const xml = await response.text()
    const page = parseListObjectsXml(xml)
    for (const key of page.keys) {
      if (isVaultObjectKey(key)) keys.push(key)
    }
    if (!page.truncated) break
    const next = page.nextMarker ?? page.keys[page.keys.length - 1]
    if (!next) break
    marker = next
  }

  keys.sort()
  return keys
}

async function getObjectBytes(
  creds: CosCreds,
  bucket: string,
  region: string,
  key: string,
): Promise<Uint8Array> {
  const { url, headers } = await signedCosRequest({
    method: 'GET',
    bucket,
    region,
    key,
    creds,
  })
  const response = await fetch(url, { method: 'GET', headers })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`GET ${key} failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

function localPathForCosKey(key: string): string {
  const rel = key.slice(VAULT_PREFIX.length + 1)
  return path.join(LOCAL_VAULT, rel)
}

function tempPathForCosKey(tempRoot: string, key: string): string {
  const rel = key.slice(VAULT_PREFIX.length + 1)
  return path.join(tempRoot, rel)
}

async function writeIfChanged(targetPath: string, bytes: Uint8Array): Promise<boolean> {
  await mkdir(path.dirname(targetPath), { recursive: true })
  try {
    const existing = await readFile(targetPath)
    if (existing.length === bytes.length) {
      let same = true
      for (let i = 0; i < bytes.length; i++) {
        if (existing[i] !== bytes[i]) {
          same = false
          break
        }
      }
      if (same) return false
    }
  } catch {
    // missing file — write below
  }
  await writeFile(targetPath, bytes)
  return true
}

export async function backupVaultFromCos(options: { prune: boolean }): Promise<void> {
  const bucket = mustEnv('COS_BUCKET')
  const region = mustEnv('COS_REGION')
  const secretId = mustEnv('COS_SECRET_ID')
  const secretKey = mustEnv('COS_SECRET_KEY')
  const creds: CosCreds = { secretId, secretKey }

  const objectKeys = await listVaultObjectKeys(creds, bucket, region)
  const vaultJsonKey = `${VAULT_PREFIX}/vault.json`
  if (!objectKeys.includes(vaultJsonKey)) {
    throw new Error(`Remote missing required object: ${vaultJsonKey}`)
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'qinglu-vault-backup-'))
  let changed = 0

  try {
    for (const key of objectKeys) {
      const bytes = await getObjectBytes(creds, bucket, region, key)
      const tempPath = tempPathForCosKey(tempRoot, key)
      await mkdir(path.dirname(tempPath), { recursive: true })
      await writeFile(tempPath, bytes)
    }

    for (const key of objectKeys) {
      const tempPath = tempPathForCosKey(tempRoot, key)
      const localPath = localPathForCosKey(key)
      const bytes = await readFile(tempPath)
      if (await writeIfChanged(localPath, new Uint8Array(bytes))) {
        changed++
        console.log(`updated ${localPath}`)
      }
    }

    if (options.prune) {
      const remoteBlobNames = new Set(
        objectKeys
          .filter((k) => k.startsWith(`${VAULT_PREFIX}/blobs/`))
          .map((k) => path.basename(k)),
      )
      const blobsDir = path.join(LOCAL_VAULT, 'blobs')
      let entries: string[] = []
      try {
        entries = await readdir(blobsDir)
      } catch {
        entries = []
      }
      for (const name of entries) {
        if (!name.endsWith('.bin')) continue
        if (!remoteBlobNames.has(name)) {
          const blobPath = path.join(blobsDir, name)
          await unlink(blobPath)
          changed++
          console.log(`pruned ${blobPath}`)
        }
      }
    }

    console.log(`synced ${objectKeys.length} objects (${changed} local changes)`)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  await backupVaultFromCos(options)
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
