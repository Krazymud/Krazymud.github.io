import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
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

function parseArgs(argv: string[]): { dryRun: boolean; force: boolean } {
  let dryRun = false
  let force = false
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true
    else if (arg === '--force') force = true
    else {
      console.error(`Unknown argument: ${arg}`)
      process.exit(1)
    }
  }
  return { dryRun, force }
}

async function listLocalObjects(): Promise<{ vaultJsonPath: string; blobKeys: string[] }> {
  const vaultJsonPath = path.join(LOCAL_VAULT, 'vault.json')
  try {
    await readFile(vaultJsonPath)
  } catch {
    console.error(`Missing local ${vaultJsonPath}`)
    process.exit(1)
  }

  const blobsDir = path.join(LOCAL_VAULT, 'blobs')
  let blobFiles: string[] = []
  try {
    const entries = await readdir(blobsDir, { withFileTypes: true })
    blobFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.bin')).map((e) => e.name)
  } catch {
    console.error(`Missing or unreadable ${blobsDir}`)
    process.exit(1)
  }

  blobFiles.sort()
  const blobKeys = blobFiles.map((name) => `${VAULT_PREFIX}/blobs/${name}`)
  return { vaultJsonPath, blobKeys }
}

function cosKeyVaultJson(): string {
  return `${VAULT_PREFIX}/vault.json`
}

async function headObject(
  creds: CosCreds,
  bucket: string,
  region: string,
  key: string,
): Promise<boolean> {
  const { url, headers } = await signedCosRequest({
    method: 'HEAD',
    bucket,
    region,
    key,
    creds,
  })
  const response = await fetch(url, { method: 'HEAD', headers })
  if (response.status === 404) return false
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`HEAD ${key} failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`)
  }
  return true
}

async function putObject(
  creds: CosCreds,
  bucket: string,
  region: string,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const { url, headers } = await signedCosRequest({
    method: 'PUT',
    bucket,
    region,
    key,
    creds,
    body,
    headers: { 'content-type': contentType },
  })
  const response = await fetch(url, { method: 'PUT', headers, body })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`PUT ${key} failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`)
  }
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

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export async function migrateVaultToCos(options: { dryRun: boolean; force: boolean }): Promise<void> {
  const { vaultJsonPath, blobKeys } = await listLocalObjects()
  const vaultKey = cosKeyVaultJson()

  if (options.dryRun) {
    console.log(vaultKey)
    for (const key of blobKeys) {
      console.log(key)
    }
    console.log(`blobs: ${blobKeys.length}`)
    return
  }

  const bucket = mustEnv('COS_BUCKET')
  const region = mustEnv('COS_REGION')
  const secretId = mustEnv('COS_SECRET_ID')
  const secretKey = mustEnv('COS_SECRET_KEY')
  const creds: CosCreds = { secretId, secretKey }

  const remoteExists = await headObject(creds, bucket, region, vaultKey)
  if (remoteExists && !options.force) {
    console.error(`Remote ${vaultKey} already exists; pass --force to overwrite`)
    process.exit(1)
  }

  const localVaultBytes = new Uint8Array(await readFile(vaultJsonPath))

  for (const key of blobKeys) {
    const blobName = path.basename(key)
    const localPath = path.join(LOCAL_VAULT, 'blobs', blobName)
    const body = new Uint8Array(await readFile(localPath))
    await putObject(creds, bucket, region, key, body, 'application/octet-stream')
    console.log(`uploaded ${key}`)
  }

  await putObject(creds, bucket, region, vaultKey, localVaultBytes, 'application/json')
  console.log(`uploaded ${vaultKey}`)

  const allKeys = [...blobKeys, vaultKey]
  for (const key of allKeys) {
    const ok = await headObject(creds, bucket, region, key)
    if (!ok) {
      throw new Error(`verify HEAD failed: ${key} not found after upload`)
    }
  }

  const downloaded = await getObjectBytes(creds, bucket, region, vaultKey)
  if (!bytesEqual(localVaultBytes, downloaded)) {
    throw new Error('verify failed: downloaded vault.json does not match local bytes')
  }
  console.log('verified vault.json byte equality')
  console.log(`done: ${allKeys.length} objects`)
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  await migrateVaultToCos(options)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
