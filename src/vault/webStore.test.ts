import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { decryptBytes, encryptBytes } from './crypto'
import { createKeyStore } from './keyStore'
import { emptyWebDoc, type WebDoc } from './web'
import { createWebStore, loadPendingDoc } from './webStore'

describe('createWebStore', () => {
  it('is unavailable without IndexedDB', () => {
    expect(createWebStore(null)).toBeNull()
  })

  it('keeps the token after the data key is cleared and keeps a version 1 key', async () => {
    const factory = new IDBFactory()
    await new Promise<void>((resolve, reject) => {
      const request = factory.open('midnight-garage', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('vault')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const key = crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), 'AES-GCM', false, [
          'encrypt',
          'decrypt',
        ])
        void key.then((value) => {
          const tx = db.transaction('vault', 'readwrite')
          tx.objectStore('vault').put(value, 'dek')
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        })
      }
    })

    const keys = createKeyStore(factory)!
    const webs = createWebStore(factory)!
    const saved = await keys.load()
    const sealed = await encryptBytes(saved!, new Uint8Array([7]))
    await webs.saveToken('github-token')
    await webs.savePending('{"version":1,"sealed":"abc"}')
    await keys.clear()

    expect(await keys.load()).toBeNull()
    expect(await webs.loadToken()).toBe('github-token')
    expect(await webs.loadPending()).toBe('{"version":1,"sealed":"abc"}')
    expect(await decryptBytes(saved!, sealed)).toEqual(new Uint8Array([7]))
    await webs.forgetToken()
    expect(await webs.loadToken()).toBeNull()
    expect(await webs.loadPending()).toBe('{"version":1,"sealed":"abc"}')
  })

  it('drops a pending document it cannot open and does not upload it', async () => {
    const store = createWebStore(new IDBFactory())!
    await store.savePending('not-a-vault-file')
    const upload = vi.fn()
    const doc = await loadPendingDoc(store, async () => {
      throw new Error('bad')
    })
    if (doc) await upload(doc)
    expect(doc).toBeNull()
    expect(upload).not.toHaveBeenCalled()
    expect(await store.loadPending()).toBeNull()

    await store.savePending('sealed-text')
    const opened = await loadPendingDoc(store, async () => emptyWebDoc())
    expect(opened).toEqual(emptyWebDoc())
    expect(await store.loadPending()).toBe('sealed-text')
  })
})
