import { decryptBytes, decryptJson, deriveKek, unwrapDek, type VaultKey } from './crypto'
import type { VaultFile, VaultManifest } from './types'

export type FetchBytes = (path: string) => Promise<Uint8Array | null>

export interface VaultSession {
  dek: VaultKey
  manifest: VaultManifest
}

const BASE = `${import.meta.env.BASE_URL}vault/`

export const fetchVaultBytes: FetchBytes = async (path) => {
  const response = await fetch(`${BASE}${path}`, { cache: path === 'vault.json' ? 'no-cache' : 'default' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`)
  // The dev server answers unknown paths with index.html.
  if (response.headers.get('content-type')?.includes('text/html')) return null
  return new Uint8Array(await response.arrayBuffer())
}

export async function loadVaultFile(fetchBytes: FetchBytes): Promise<VaultFile | null> {
  const bytes = await fetchBytes('vault.json')
  return bytes === null ? null : (JSON.parse(new TextDecoder().decode(bytes)) as VaultFile)
}

export async function unlockWithKey(file: VaultFile, dek: VaultKey): Promise<VaultSession> {
  return { dek, manifest: await decryptJson<VaultManifest>(dek, file.manifest) }
}

// Only a failed unwrap means a wrong passphrase; a DecryptError after that is a damaged manifest.
export async function unlockWithPassphrase(file: VaultFile, passphrase: string): Promise<VaultSession> {
  const kek = await deriveKek(passphrase, file.kdf)
  const dek = await unwrapDek(file.wrappedKey, kek, false)
  try {
    return await unlockWithKey(file, dek)
  } catch (error) {
    throw new Error('vault manifest is damaged', { cause: error })
  }
}

export async function readBlob(fetchBytes: FetchBytes, dek: VaultKey, name: string): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = await fetchBytes(`blobs/${name}.bin`)
  if (bytes === null) throw new Error(`missing blob ${name}`)
  return decryptBytes(dek, bytes)
}
