import { signedCosRequest, type CosCreds } from './cosAuth'
import { GitHubWriteError, SYNC_PENDING } from './github'
import { GATE_DENIED } from './vaultErrors'
import type { VaultFile } from './types'

export class CosConflictError extends Error {
  constructor() {
    super('cos precondition failed')
    this.name = 'CosConflictError'
  }
}

export class CosNotFoundError extends Error {
  constructor() {
    super('cos object not found')
    this.name = 'CosNotFoundError'
  }
}

export type CosVaultConfig = {
  bucket: string
  region: string
  vaultPrefix: string
}

function vaultJsonKey(config: CosVaultConfig): string {
  return `${config.vaultPrefix}/vault.json`
}

function blobKey(config: CosVaultConfig, blobName: string): string {
  return `${config.vaultPrefix}/blobs/${blobName}.bin`
}

function parseEtag(header: string | null): string | null {
  if (!header) return null
  const trimmed = header.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function formatIfMatchEtag(etag: string): string {
  return etag.startsWith('"') ? etag : `"${etag}"`
}

function assertCosOk(response: Response): void {
  if (response.status === 401 || response.status === 403) {
    throw new GitHubWriteError(GATE_DENIED)
  }
  if (!response.ok) {
    throw new GitHubWriteError(SYNC_PENDING)
  }
}

export async function readVaultFile(options: {
  fetch: typeof fetch
  creds: CosCreds
  config: CosVaultConfig
}): Promise<{ file: VaultFile; etag: string | null }> {
  const { fetch: fetchImpl, creds, config } = options
  const { url, headers } = await signedCosRequest({
    method: 'GET',
    bucket: config.bucket,
    region: config.region,
    key: vaultJsonKey(config),
    creds,
  })
  const response = await fetchImpl(url, { method: 'GET', headers })
  if (response.status === 404) {
    throw new CosNotFoundError()
  }
  if (response.status === 401 || response.status === 403) {
    throw new GitHubWriteError(GATE_DENIED)
  }
  if (!response.ok) {
    throw new GitHubWriteError(SYNC_PENDING)
  }
  let file: VaultFile
  try {
    file = (await response.json()) as VaultFile
  } catch {
    throw new GitHubWriteError(SYNC_PENDING)
  }
  return { file, etag: parseEtag(response.headers.get('ETag')) }
}

export async function readBlobFile(options: {
  fetch: typeof fetch
  creds: CosCreds
  config: CosVaultConfig
  blobName: string
}): Promise<Uint8Array> {
  const { fetch: fetchImpl, creds, config, blobName } = options
  const { url, headers } = await signedCosRequest({
    method: 'GET',
    bucket: config.bucket,
    region: config.region,
    key: blobKey(config, blobName),
    creds,
  })
  const response = await fetchImpl(url, { method: 'GET', headers })
  if (response.status === 404) {
    throw new CosNotFoundError()
  }
  assertCosOk(response)
  return new Uint8Array(await response.arrayBuffer())
}

export async function putVaultUpdate(options: {
  fetch: typeof fetch
  creds: CosCreds
  config: CosVaultConfig
  vaultFile: VaultFile
  /** null means object must not exist (If-None-Match: *) */
  etag: string | null
  blobs: Record<string, Uint8Array>
}): Promise<{ etag: string }> {
  const { fetch: fetchImpl, creds, config, vaultFile, etag, blobs } = options

  for (const [name, bytes] of Object.entries(blobs)) {
    const { url, headers } = await signedCosRequest({
      method: 'PUT',
      bucket: config.bucket,
      region: config.region,
      key: blobKey(config, name),
      creds,
      body: bytes,
      headers: { 'content-type': 'application/octet-stream' },
    })
    const response = await fetchImpl(url, {
      method: 'PUT',
      headers,
      body: new Uint8Array(bytes),
    })
    assertCosOk(response)
  }

  const body = JSON.stringify(vaultFile)
  const conditionalHeaders: Record<string, string> =
    etag === null ? { 'if-none-match': '*' } : { 'if-match': formatIfMatchEtag(etag) }

  const { url, headers } = await signedCosRequest({
    method: 'PUT',
    bucket: config.bucket,
    region: config.region,
    key: vaultJsonKey(config),
    creds,
    body,
    headers: { 'content-type': 'application/json', ...conditionalHeaders },
  })
  const response = await fetchImpl(url, { method: 'PUT', headers, body })
  if (response.status === 412) {
    throw new CosConflictError()
  }
  assertCosOk(response)
  const newEtag = parseEtag(response.headers.get('ETag'))
  if (!newEtag) {
    throw new GitHubWriteError(SYNC_PENDING)
  }
  return { etag: newEtag }
}
