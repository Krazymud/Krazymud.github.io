// Shared by the browser and the Node scripts: only use globals both provide.
export type VaultKey = Parameters<typeof crypto.subtle.encrypt>[1]

export interface KdfParams {
  name: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  salt: string
}

export const PBKDF2_ITERATIONS = 600_000

const IV_BYTES = 12
const SALT_BYTES = 16
const MIN_CHARS = 16

export class DecryptError extends Error {
  constructor() {
    super('解密失败')
    this.name = 'DecryptError'
  }
}

function own(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes)
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function normalizePassphrase(passphrase: string): string {
  return passphrase.trim().normalize('NFC').replace(/\s+/g, ' ')
}

export function checkPassphrase(passphrase: string): string | null {
  if ([...normalizePassphrase(passphrase)].length >= MIN_CHARS) return null
  return `口令至少要 ${MIN_CHARS} 个字符`
}

export function newKdfParams(iterations = PBKDF2_ITERATIONS): KdfParams {
  return {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    salt: toBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES))),
  }
}

export async function deriveKek(passphrase: string, kdf: KdfParams): Promise<VaultKey> {
  const secret = new TextEncoder().encode(normalizePassphrase(passphrase))
  const base = await crypto.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: kdf.hash, salt: fromBase64(kdf.salt), iterations: kdf.iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function generateDek(): Promise<VaultKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function encryptBytes(key: VaultKey, plain: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, own(plain)))
  const sealed = new Uint8Array(IV_BYTES + cipher.length)
  sealed.set(iv)
  sealed.set(cipher, IV_BYTES)
  return sealed
}

export async function decryptBytes(key: VaultKey, sealed: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = own(sealed)
  if (bytes.length <= IV_BYTES) throw new DecryptError()
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.subarray(0, IV_BYTES) },
      key,
      bytes.subarray(IV_BYTES),
    )
    return new Uint8Array(plain)
  } catch {
    throw new DecryptError()
  }
}

export async function encryptJson(key: VaultKey, value: unknown): Promise<string> {
  return toBase64(await encryptBytes(key, new TextEncoder().encode(JSON.stringify(value))))
}

export async function decryptJson<T>(key: VaultKey, sealed: string): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await decryptBytes(key, fromBase64(sealed)))) as T
}

export async function wrapDek(dek: VaultKey, kek: VaultKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dek))
  return toBase64(await encryptBytes(kek, raw))
}

export async function unwrapDek(wrapped: string, kek: VaultKey, extractable: boolean): Promise<VaultKey> {
  const raw = await decryptBytes(kek, fromBase64(wrapped))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt'])
}
