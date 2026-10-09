import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { decryptBytes, encryptBytes } from './crypto'
import { createKeyStore } from './keyStore'

describe('createKeyStore', () => {
  it('is unavailable without IndexedDB', () => {
    expect(createKeyStore(null)).toBeNull()
  })

  it('saves, loads and clears a non-extractable key', async () => {
    const store = createKeyStore(new IDBFactory())!
    expect(await store.load()).toBeNull()

    const key = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ])
    await store.save(key)
    const loaded = await store.load()
    const sealed = await encryptBytes(key, new Uint8Array([7]))
    expect(await decryptBytes(loaded!, sealed)).toEqual(new Uint8Array([7]))

    await store.clear()
    expect(await store.load()).toBeNull()
  })
})
