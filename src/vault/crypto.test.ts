import { describe, expect, it } from 'vitest'
import {
  checkPassphrase,
  decryptBytes,
  DecryptError,
  decryptJson,
  deriveKek,
  encryptBytes,
  encryptJson,
  fromBase64,
  generateDek,
  newKdfParams,
  PBKDF2_ITERATIONS,
  toBase64,
  unwrapDek,
  wrapDek,
} from './crypto'

const PASS = 'iceland aurora penguin goodnight'
const text = (s: string) => new TextEncoder().encode(s)
const read = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('base64', () => {
  it('round-trips every byte value', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i)
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })
})

describe('checkPassphrase', () => {
  it('accepts 16 characters or 4 words', () => {
    expect(checkPassphrase('abcdefghijklmnop')).toBeNull()
    expect(checkPassphrase('冰岛 极光 企鹅 晚安')).toBeNull()
  })

  it('rejects shorter passphrases with a reason', () => {
    expect(checkPassphrase('abcdefghijklmno')).toBe('口令至少要 16 个字符，或至少 4 个用空格分开的词')
    expect(checkPassphrase('冰岛 极光 企鹅')).not.toBeNull()
  })

  it('counts Chinese characters one by one', () => {
    expect(checkPassphrase('一二三四五六七八九十一二三四五六')).toBeNull()
  })
})

describe('encryptBytes / decryptBytes', () => {
  it('round-trips and uses a fresh IV every time', async () => {
    const key = await generateDek()
    const a = await encryptBytes(key, text('secret'))
    const b = await encryptBytes(key, text('secret'))
    expect(a.slice(0, 12)).not.toEqual(b.slice(0, 12))
    expect(read(await decryptBytes(key, a))).toBe('secret')
  })

  it('rejects tampered data, wrong keys and truncated input', async () => {
    const key = await generateDek()
    const sealed = await encryptBytes(key, text('secret'))
    const tampered = sealed.slice()
    tampered[20] ^= 1
    await expect(decryptBytes(key, tampered)).rejects.toBeInstanceOf(DecryptError)
    await expect(decryptBytes(await generateDek(), sealed)).rejects.toBeInstanceOf(DecryptError)
    await expect(decryptBytes(key, new Uint8Array(5))).rejects.toBeInstanceOf(DecryptError)
  })

  it('round-trips JSON', async () => {
    const key = await generateDek()
    expect(await decryptJson(key, await encryptJson(key, { a: [1, '二'] }))).toEqual({ a: [1, '二'] })
  })
})

describe('passphrase key wrapping', () => {
  it('uses 600,000 iterations by default with a random 16-byte salt', () => {
    const a = newKdfParams()
    const b = newKdfParams()
    expect(PBKDF2_ITERATIONS).toBe(600_000)
    expect(a).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS })
    expect(fromBase64(a.salt)).toHaveLength(16)
    expect(a.salt).not.toBe(b.salt)
  })

  it('unwraps the content key with the right passphrase only', async () => {
    const kdf = newKdfParams(1000)
    const dek = await generateDek()
    const wrapped = await wrapDek(dek, await deriveKek(PASS, kdf))
    const sealed = await encryptBytes(dek, text('photo'))
    const unwrapped = await unwrapDek(wrapped, await deriveKek(PASS, kdf), false)
    expect(read(await decryptBytes(unwrapped, sealed))).toBe('photo')
    await expect(unwrapDek(wrapped, await deriveKek('iceland aurora penguin goodbye', kdf), false)).rejects.toBeInstanceOf(
      DecryptError,
    )
  })

  it('ignores spaces around the passphrase', async () => {
    const kdf = newKdfParams(1000)
    const dek = await generateDek()
    const wrapped = await wrapDek(dek, await deriveKek(PASS, kdf))
    await expect(unwrapDek(wrapped, await deriveKek(`  ${PASS}  `, kdf), false)).resolves.toBeDefined()
  })

  it('can make the unwrapped key non-extractable', async () => {
    const kdf = newKdfParams(1000)
    const kek = await deriveKek(PASS, kdf)
    const key = await unwrapDek(await wrapDek(await generateDek(), kek), kek, false)
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow()
  })
})
