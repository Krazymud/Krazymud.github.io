import type { VaultKey } from './crypto'
import { GARAGE_DB, GARAGE_DB_VERSION, upgradeGarageDb } from './db'

export interface KeyStore {
  load(): Promise<VaultKey | null>
  save(key: VaultKey): Promise<void>
  clear(): Promise<void>
}

const STORE = 'vault'
const KEY = 'dek'

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function createKeyStore(factory: IDBFactory | null): KeyStore | null {
  if (!factory) return null
  const idb = factory
  let database: Promise<IDBDatabase> | null = null

  function open(): Promise<IDBDatabase> {
    database ??= new Promise((resolve, reject) => {
      const request = idb.open(GARAGE_DB, GARAGE_DB_VERSION)
      request.onupgradeneeded = () => upgradeGarageDb(request.result)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return database
  }

  async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open()
    return settle(action(db.transaction(STORE, mode).objectStore(STORE)))
  }

  return {
    async load() {
      const value = (await run('readonly', (store) => store.get(KEY))) as VaultKey | undefined
      return value ?? null
    },
    async save(key) {
      await run('readwrite', (store) => store.put(key, KEY))
    },
    async clear() {
      await run('readwrite', (store) => store.delete(KEY))
    },
  }
}

export function defaultKeyStore(): KeyStore | null {
  return createKeyStore(typeof indexedDB === 'undefined' ? null : indexedDB)
}
