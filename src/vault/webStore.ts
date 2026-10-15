import { GARAGE_DB, GARAGE_DB_VERSION, upgradeGarageDb } from './db'
import type { WebDoc } from './web'

export interface WebStore {
  /** IndexedDB key `token`; value is the COS sync gate secret (not a GitHub PAT). */
  loadToken(): Promise<string | null>
  saveToken(token: string): Promise<void>
  forgetToken(): Promise<void>
  loadPending(): Promise<string | null>
  savePending(text: string): Promise<void>
  clearPending(): Promise<void>
  loadSynced(): Promise<string | null>
  saveSynced(text: string): Promise<void>
  clearSynced(): Promise<void>
  loadVaultPending(): Promise<string | null>
  saveVaultPending(text: string): Promise<void>
  clearVaultPending(): Promise<void>
}

const STORE = 'vault-web'
const TOKEN = 'token'
const PENDING = 'pending'
const SYNCED = 'synced'
const VAULT_PENDING = 'vaultPending'

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function createWebStore(factory: IDBFactory | null): WebStore | null {
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

  async function get(key: string): Promise<string | null> {
    const value = await run('readonly', (store) => store.get(key))
    return typeof value === 'string' ? value : null
  }

  return {
    loadToken: () => get(TOKEN),
    saveToken: (token) => run('readwrite', (store) => store.put(token, TOKEN)).then(() => undefined),
    forgetToken: () => run('readwrite', (store) => store.delete(TOKEN)).then(() => undefined),
    loadPending: () => get(PENDING),
    savePending: (text) => run('readwrite', (store) => store.put(text, PENDING)).then(() => undefined),
    clearPending: () => run('readwrite', (store) => store.delete(PENDING)).then(() => undefined),
    loadSynced: () => get(SYNCED),
    saveSynced: (text) => run('readwrite', (store) => store.put(text, SYNCED)).then(() => undefined),
    clearSynced: () => run('readwrite', (store) => store.delete(SYNCED)).then(() => undefined),
    loadVaultPending: () => get(VAULT_PENDING),
    saveVaultPending: (text) => run('readwrite', (store) => store.put(text, VAULT_PENDING)).then(() => undefined),
    clearVaultPending: () => run('readwrite', (store) => store.delete(VAULT_PENDING)).then(() => undefined),
  }
}

export function defaultWebStore(): WebStore | null {
  return createWebStore(typeof indexedDB === 'undefined' ? null : indexedDB)
}

async function loadStoredDoc(
  load: () => Promise<string | null>,
  clear: () => Promise<void>,
  open: (text: string) => Promise<WebDoc>,
): Promise<WebDoc | null> {
  const text = await load()
  if (text === null) return null
  try {
    return await open(text)
  } catch {
    await clear()
    return null
  }
}

export function loadPendingDoc(store: WebStore, open: (text: string) => Promise<WebDoc>): Promise<WebDoc | null> {
  return loadStoredDoc(() => store.loadPending(), () => store.clearPending(), open)
}

export function loadSyncedDoc(store: WebStore, open: (text: string) => Promise<WebDoc>): Promise<WebDoc | null> {
  return loadStoredDoc(() => store.loadSynced(), () => store.clearSynced(), open)
}
