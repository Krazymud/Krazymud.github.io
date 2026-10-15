import { useCallback, useEffect, useRef, useState } from 'react'
import type { CosCreds } from './cosAuth'
import { COS_VAULT_CONFIG, STS_ISSUER_URL } from './cosConfig'
import {
  CosConflictError,
  CosNotFoundError,
  putVaultUpdate,
  readBlobFile,
  readVaultFile,
} from './cosVault'
import { decryptBytes, decryptJson, type VaultKey } from './crypto'
import { GitHubWriteError, SYNC_PENDING } from './github'
import type { FetchBytes } from './repo'
import { fetchStsTicket, ticketValid, type StsCreds } from './stsTicket'
import type { VaultFile, VaultManifest } from './types'
import { GATE_DENIED } from './vaultErrors'
import { loadPendingDoc, type WebStore } from './webStore'
import { mergeWebDocs, openWebFile, type WebDoc } from './web'
import {
  absorbWebDoc,
  addPhoto as addWorkingPhoto,
  deleteList as deleteWorkingList,
  deleteNote as deleteWorkingNote,
  deletePhoto as deleteWorkingPhoto,
  emptyWorking,
  mergeWorking,
  openWorking,
  saveList as saveWorkingList,
  saveNote as saveWorkingNote,
  sealVaultFile,
  sealWorking,
  toggleListItem as toggleWorkingListItem,
  WorkingBlobError,
  WorkingValidationError,
  type WorkingVault,
} from './working'

export interface VaultClock {
  now(): number
  uuid(): string
}

export type MutateResult = { ok: true } | { ok: false; reason: 'title' | 'date' | 'blob' | 'locked' }

type Phase = 'loading' | 'ready'

type Apply = (working: WorkingVault) => Promise<WorkingVault>

function isDenied(error: unknown): boolean {
  return error instanceof GitHubWriteError && error.message === GATE_DENIED
}

// Records the working vault never touched come from an older snapshot; sending them would revive
// anything another device deleted since.
function onlyEdits(working: WorkingVault): WorkingVault {
  const edited = (item: { source: string }) => working.updatedAt[item.source] !== undefined
  return {
    ...working,
    manifest: {
      photos: working.manifest.photos.filter(edited),
      notes: working.manifest.notes.filter(edited),
      lists: working.manifest.lists.filter(edited),
    },
  }
}

function referencedBlobs(working: WorkingVault): Record<string, Uint8Array> {
  const { photos, notes, lists } = working.manifest
  const names = new Set<string>([
    ...photos.flatMap((p) => [p.thumb, p.full]),
    ...notes.map((n) => n.blob),
    ...lists.map((l) => l.blob),
  ])
  const out: Record<string, Uint8Array> = {}
  for (const [name, bytes] of Object.entries(working.dirtyBlobs)) {
    if (names.has(name)) out[name] = bytes
  }
  return out
}

export function useVaultMutate(options: {
  dek: VaultKey
  file: VaultFile
  manifest: VaultManifest
  fetchBytes: FetchBytes
  store: WebStore | null
  apiFetch: typeof fetch
  clock: VaultClock
}) {
  const { dek, file, manifest, fetchBytes, store, apiFetch, clock } = options
  const [working, setWorking] = useState<WorkingVault>(() => emptyWorking(manifest))
  const [phase, setPhase] = useState<Phase>('loading')
  const [syncing, setSyncing] = useState(false)
  const [unsynced, setUnsynced] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)

  const workingRef = useRef(working)
  const fileRef = useRef(file)
  const baseEtagRef = useRef<string | null>(null)
  const phaseRef = useRef<Phase>('loading')
  const gateRef = useRef<string | null>(null)
  const ticketRef = useRef<{ gate: string; creds: StsCreds } | null>(null)
  const syncingRef = useRef(false)
  const webMigratedRef = useRef(false)
  const unsyncedRef = useRef(false)
  const depth = useRef(0)
  const tail = useRef(Promise.resolve())
  const alive = useRef(true)
  const generation = useRef(0)
  const dekRef = useRef(dek)
  const storeRef = useRef(store)
  const fetchRef = useRef(apiFetch)
  const bytesRef = useRef(fetchBytes)
  const clockRef = useRef(clock)
  dekRef.current = dek
  storeRef.current = store
  fetchRef.current = apiFetch
  bytesRef.current = fetchBytes
  clockRef.current = clock

  function markUnsynced(value: boolean) {
    unsyncedRef.current = value
    if (alive.current) setUnsynced(value)
  }

  function adopt(next: WorkingVault) {
    workingRef.current = next
    if (alive.current) setWorking(next)
  }

  async function persist(next: WorkingVault) {
    const current = storeRef.current
    if (!current) return
    try {
      await current.saveVaultPending(await sealWorking(dekRef.current, next))
    } catch {
      markUnsynced(true)
    }
  }

  function exclusive<T>(job: () => Promise<T>): Promise<T> {
    depth.current += 1
    syncingRef.current = true
    setSyncing(true)
    const run = tail.current.then(job)
    tail.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run.finally(() => {
      depth.current -= 1
      if (depth.current === 0) {
        syncingRef.current = false
        if (alive.current) setSyncing(false)
      }
    })
  }

  async function ensureTicket(gate: string): Promise<StsCreds> {
    const nowSec = Math.floor(Date.now() / 1000)
    const cached = ticketRef.current
    if (cached?.gate === gate && ticketValid(cached.creds, nowSec)) return cached.creds
    const creds = await fetchStsTicket({ fetch: fetchRef.current, issuerUrl: STS_ISSUER_URL, gate })
    ticketRef.current = { gate, creds }
    return creds
  }

  async function rebaseFromCos(local: WorkingVault, creds: CosCreds): Promise<WorkingVault> {
    try {
      const remote = await readVaultFile({ fetch: fetchRef.current, creds, config: COS_VAULT_CONFIG })
      const remoteManifest = await decryptJson<VaultManifest>(dekRef.current, remote.file.manifest)
      const merged = mergeWorking(emptyWorking(remoteManifest), onlyEdits(local))
      fileRef.current = remote.file
      baseEtagRef.current = remote.etag
      return merged
    } catch (error) {
      if (error instanceof CosNotFoundError) {
        const remoteManifest = await decryptJson<VaultManifest>(dekRef.current, fileRef.current.manifest)
        baseEtagRef.current = null
        return mergeWorking(emptyWorking(remoteManifest), onlyEdits(local))
      }
      throw error
    }
  }

  async function rebase(local: WorkingVault, gate: string): Promise<WorkingVault> {
    const creds = await ensureTicket(gate)
    return rebaseFromCos(local, creds)
  }

  async function push(start: WorkingVault, gate: string): Promise<WorkingVault> {
    const creds = await ensureTicket(gate)
    let local = start
    if (baseEtagRef.current === null) {
      local = await rebaseFromCos(local, creds)
      adopt(local)
    }
    let retried = false
    for (;;) {
      const vaultFile = await sealVaultFile(dekRef.current, local, fileRef.current)
      try {
        const { etag } = await putVaultUpdate({
          fetch: fetchRef.current,
          creds,
          config: COS_VAULT_CONFIG,
          vaultFile,
          etag: baseEtagRef.current,
          blobs: referencedBlobs(local),
        })
        fileRef.current = vaultFile
        baseEtagRef.current = etag
        if (webMigratedRef.current) {
          webMigratedRef.current = false
          try {
            await storeRef.current?.clearPending()
            await storeRef.current?.clearSynced()
          } catch {
            // Absorbing the same web.json again later is harmless.
          }
        }
        return {
          ...emptyWorking(local.manifest),
          dirtyBlobs: referencedBlobs(local),
        }
      } catch (error) {
        if (!(error instanceof CosConflictError)) throw error
        if (retried) throw new GitHubWriteError(SYNC_PENDING)
        retried = true
        local = await rebaseFromCos(local, creds)
        adopt(local)
        await persist(local)
      }
    }
  }

  async function syncPending(): Promise<void> {
    const saved = gateRef.current
    if (!saved) {
      markUnsynced(true)
      return
    }
    try {
      adopt(await push(workingRef.current, saved))
      markUnsynced(false)
      if (alive.current) setTokenError(null)
      try {
        await storeRef.current?.clearVaultPending()
      } catch {
        // A stale pending seal only replays edits the vault already has.
      }
    } catch (error) {
      markUnsynced(true)
      if (alive.current) setTokenError(isDenied(error) ? GATE_DENIED : null)
    }
  }

  async function readCosBlob(name: string): Promise<Uint8Array | null> {
    const gate = gateRef.current
    if (!gate) return null
    try {
      const creds = await ensureTicket(gate)
      return await readBlobFile({
        fetch: fetchRef.current,
        creds,
        config: COS_VAULT_CONFIG,
        blobName: name,
      })
    } catch (error) {
      if (error instanceof GitHubWriteError) throw error
      if (error instanceof CosNotFoundError) return null
      return null
    }
  }

  async function hydrateList(current: WorkingVault, source: string): Promise<WorkingVault> {
    const entry = current.manifest.lists.find((item) => item.source === source)
    if (!entry || current.dirtyBlobs[entry.blob]) return current
    let bytes: Uint8Array | null = null
    try {
      bytes = await bytesRef.current(`blobs/${entry.blob}.bin`)
    } catch {
      bytes = null
    }
    if (bytes === null) {
      try {
        bytes = await readCosBlob(entry.blob)
      } catch (error) {
        if (error instanceof GitHubWriteError) throw error
        throw new WorkingBlobError()
      }
    }
    if (bytes === null) throw new WorkingBlobError()
    return { ...current, dirtyBlobs: { ...current.dirtyBlobs, [entry.blob]: bytes } }
  }

  function mutate(apply: Apply): Promise<MutateResult> {
    if (phaseRef.current !== 'ready' || gateRef.current === null || syncingRef.current) {
      return Promise.resolve({ ok: false, reason: 'locked' })
    }
    return exclusive(async (): Promise<MutateResult> => {
      let next: WorkingVault
      try {
        next = await apply(workingRef.current)
      } catch (error) {
        if (error instanceof WorkingValidationError) return { ok: false, reason: error.reason }
        if (error instanceof WorkingBlobError || error instanceof GitHubWriteError) {
          if (alive.current && isDenied(error)) setTokenError(GATE_DENIED)
          return { ok: false, reason: 'blob' }
        }
        throw error
      }
      if (next === workingRef.current) return { ok: true }
      adopt(next)
      await persist(next)
      await syncPending()
      return { ok: true }
    })
  }

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    const id = ++generation.current
    void (async () => {
      const current = store
      let savedGate: string | null = null
      if (current) {
        try {
          savedGate = await current.loadToken()
        } catch {
          savedGate = null
        }
      }
      if (generation.current !== id) return

      let latestFile = file
      let latestManifest = manifest
      let baseEtag: string | null = null
      let denied = false
      if (savedGate) {
        try {
          const creds = await ensureTicket(savedGate)
          const remote = await readVaultFile({
            fetch: fetchRef.current,
            creds,
            config: COS_VAULT_CONFIG,
          })
          latestManifest = await decryptJson<VaultManifest>(dek, remote.file.manifest)
          latestFile = remote.file
          baseEtag = remote.etag
        } catch (error) {
          if (error instanceof CosNotFoundError) {
            baseEtag = null
          } else {
            denied = isDenied(error)
          }
        }
      }
      if (generation.current !== id) return

      let pending: WorkingVault | null = null
      let sealed: string | null = null
      if (current) {
        try {
          sealed = await current.loadVaultPending()
        } catch {
          sealed = null
        }
      }
      if (generation.current !== id) return
      if (sealed !== null) {
        try {
          pending = await openWorking(dek, sealed)
        } catch {
          await current?.clearVaultPending()
        }
      }
      if (generation.current !== id) return

      let next = emptyWorking(latestManifest)
      if (pending) next = mergeWorking(next, onlyEdits(pending))
      let migrated = false
      if (savedGate) {
        try {
          let remoteText: string | null = null
          try {
            const bytes = await bytesRef.current('web.json')
            if (bytes) remoteText = new TextDecoder().decode(bytes)
          } catch {
            remoteText = null
          }
          let webDoc: WebDoc | null = null
          if (remoteText !== null) webDoc = await openWebFile(dek, remoteText)
          if (current) {
            const old = await loadPendingDoc(current, (text) => openWebFile(dek, text))
            if (old) webDoc = webDoc ? mergeWebDocs(webDoc, old) : old
          }
          if (webDoc !== null) {
            next = await absorbWebDoc(next, webDoc, dek, clockRef.current, async (name) => {
              try {
                return await readCosBlob(name)
              } catch {
                return null
              }
            })
            migrated = true
            webMigratedRef.current = true
          }
        } catch {
          migrated = false
        }
      }
      if (generation.current !== id) return

      fileRef.current = latestFile
      baseEtagRef.current = baseEtag
      gateRef.current = savedGate
      workingRef.current = next
      phaseRef.current = 'ready'
      setWorking(next)
      setToken(savedGate)
      setTokenError(denied ? GATE_DENIED : null)
      setPhase('ready')
      if (pending !== null || migrated) markUnsynced(true)
      if (migrated) await persist(next)
      if ((pending !== null || migrated) && savedGate !== null) await exclusive(syncPending)
    })()
    return () => {
      generation.current += 1
    }
  }, [dek, file, manifest, store])

  const canEdit = phase === 'ready' && token !== null && !syncing

  const readBlob = useCallback(async (name: string): Promise<Uint8Array<ArrayBuffer>> => {
    const local = workingRef.current.dirtyBlobs[name]
    if (local) return decryptBytes(dekRef.current, local)
    let bytes: Uint8Array | null = null
    let failure: unknown = null
    try {
      bytes = await bytesRef.current(`blobs/${name}.bin`)
    } catch (error) {
      failure = error
    }
    if (bytes === null) {
      try {
        bytes = await readCosBlob(name)
      } catch (error) {
        failure = error
      }
    }
    if (bytes === null) throw failure ?? new Error(`missing blob ${name}`)
    return decryptBytes(dekRef.current, bytes)
  }, [])

  return {
    working,
    manifest: working.manifest,
    loading: phase === 'loading',
    syncing,
    unsynced,
    tokenError,
    tokenSaved: token !== null,
    canEdit,
    readBlob,
    saveToken: async (value: string) => {
      const current = storeRef.current
      const next = value.trim()
      if (!current || next === '' || phaseRef.current === 'loading') return
      await current.saveToken(next)
      gateRef.current = next
      ticketRef.current = null
      setToken(next)
      setTokenError(null)
      await exclusive(async () => {
        if (unsyncedRef.current) {
          await syncPending()
          return
        }
        try {
          adopt(await rebase(workingRef.current, next))
        } catch (error) {
          if (alive.current) setTokenError(isDenied(error) ? GATE_DENIED : null)
        }
      })
    },
    forgetToken: async () => {
      const current = storeRef.current
      if (!current) return
      gateRef.current = null
      ticketRef.current = null
      setToken(null)
      setTokenError(null)
      await current.forgetToken()
    },
    retrySync: () => {
      if (phaseRef.current !== 'ready' || gateRef.current === null || syncingRef.current) return Promise.resolve()
      return exclusive(syncPending)
    },
    saveNote: (input: { source?: string; title: string; date: string; body: string }) =>
      mutate((w) => saveWorkingNote(w, input, clockRef.current, dekRef.current)),
    deleteNote: (source: string) => mutate(async (w) => deleteWorkingNote(w, source, clockRef.current.now())),
    saveList: (input: { source?: string; title: string; items: { text: string; done: boolean }[] }) =>
      mutate((w) => saveWorkingList(w, input, clockRef.current, dekRef.current)),
    deleteList: (source: string) => mutate(async (w) => deleteWorkingList(w, source, clockRef.current.now())),
    toggleListItem: (source: string, index: number, done: boolean) =>
      mutate(async (w) =>
        toggleWorkingListItem(await hydrateList(w, source), source, index, done, clockRef.current.now(), dekRef.current),
      ),
    addPhoto: (input: {
      caption: string
      date: string
      full: Uint8Array
      thumb: Uint8Array
      width: number
      height: number
    }) => mutate((w) => addWorkingPhoto(w, input, clockRef.current, dekRef.current)),
    deletePhoto: (source: string) => mutate(async (w) => deleteWorkingPhoto(w, source, clockRef.current.now())),
  }
}
