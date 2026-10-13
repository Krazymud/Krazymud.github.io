import { useEffect, useRef, useState } from 'react'
import { decryptJson, type VaultKey } from './crypto'
import { GitHubWriteError, SYNC_PENDING, TOKEN_DENIED } from './github'
import { commitVaultUpdate, GitHubRefNotFastForwardError, readBlobFile, readVaultFile } from './gitVault'
import type { FetchBytes } from './repo'
import type { VaultFile, VaultManifest } from './types'
import type { WebStore } from './webStore'
import {
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

export const VAULT_COMMIT_MESSAGE = 'content(vault): update vault'

export interface VaultClock {
  now(): number
  uuid(): string
}

export type MutateResult = { ok: true } | { ok: false; reason: 'title' | 'date' | 'blob' | 'locked' }

type Phase = 'loading' | 'ready'

type Apply = (working: WorkingVault) => Promise<WorkingVault>

// TODO(Task 6): fold a readable remote or pending web.json into the working vault and delete it on commit.
async function migrateWebDoc(working: WorkingVault): Promise<WorkingVault> {
  return working
}

function isDenied(error: unknown): boolean {
  return error instanceof GitHubWriteError && error.message === TOKEN_DENIED
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
  const freshRef = useRef(false)
  const phaseRef = useRef<Phase>('loading')
  const tokenRef = useRef<string | null>(null)
  const syncingRef = useRef(false)
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

  async function rebase(local: WorkingVault, saved: string): Promise<WorkingVault> {
    const remote = await readVaultFile(fetchRef.current, saved)
    const remoteManifest = await decryptJson<VaultManifest>(dekRef.current, remote.manifest)
    const merged = mergeWorking(emptyWorking(remoteManifest), onlyEdits(local))
    fileRef.current = remote
    freshRef.current = true
    return merged
  }

  async function push(start: WorkingVault, saved: string): Promise<WorkingVault> {
    let local = start
    if (!freshRef.current) {
      local = await rebase(local, saved)
      adopt(local)
    }
    let retried = false
    for (;;) {
      const vaultFile = await sealVaultFile(dekRef.current, local, fileRef.current)
      try {
        await commitVaultUpdate({
          fetch: fetchRef.current,
          token: saved,
          message: VAULT_COMMIT_MESSAGE,
          vaultFile,
          blobs: referencedBlobs(local),
        })
        fileRef.current = vaultFile
        freshRef.current = true
        return emptyWorking(local.manifest)
      } catch (error) {
        if (!(error instanceof GitHubRefNotFastForwardError)) throw error
        if (retried) throw new GitHubWriteError(SYNC_PENDING)
        retried = true
        local = await rebase(local, saved)
        adopt(local)
        await persist(local)
      }
    }
  }

  async function syncPending(): Promise<void> {
    const saved = tokenRef.current
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
      if (alive.current) setTokenError(isDenied(error) ? TOKEN_DENIED : null)
    }
  }

  async function hydrateList(current: WorkingVault, source: string): Promise<WorkingVault> {
    const entry = current.manifest.lists.find((item) => item.source === source)
    if (!entry || current.dirtyBlobs[entry.blob]) return current
    const saved = tokenRef.current
    let bytes: Uint8Array | null
    try {
      bytes = saved
        ? await readBlobFile(fetchRef.current, saved, entry.blob)
        : await bytesRef.current(`blobs/${entry.blob}.bin`)
    } catch (error) {
      if (error instanceof GitHubWriteError) throw error
      throw new WorkingBlobError()
    }
    if (bytes === null) throw new WorkingBlobError()
    return { ...current, dirtyBlobs: { ...current.dirtyBlobs, [entry.blob]: bytes } }
  }

  function mutate(apply: Apply): Promise<MutateResult> {
    if (phaseRef.current !== 'ready' || tokenRef.current === null || syncingRef.current) {
      return Promise.resolve({ ok: false, reason: 'locked' })
    }
    return exclusive(async (): Promise<MutateResult> => {
      let next: WorkingVault
      try {
        next = await apply(workingRef.current)
      } catch (error) {
        if (error instanceof WorkingValidationError) return { ok: false, reason: error.reason }
        if (error instanceof WorkingBlobError || error instanceof GitHubWriteError) {
          if (alive.current && isDenied(error)) setTokenError(TOKEN_DENIED)
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
      let savedToken: string | null = null
      if (current) {
        try {
          savedToken = await current.loadToken()
        } catch {
          savedToken = null
        }
      }
      if (generation.current !== id) return

      let latestFile = file
      let latestManifest = manifest
      let fresh = false
      let denied = false
      if (savedToken) {
        try {
          const remote = await readVaultFile(fetchRef.current, savedToken)
          latestManifest = await decryptJson<VaultManifest>(dek, remote.manifest)
          latestFile = remote
          fresh = true
        } catch (error) {
          denied = isDenied(error)
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
      next = await migrateWebDoc(next)
      if (generation.current !== id) return

      fileRef.current = latestFile
      freshRef.current = fresh
      tokenRef.current = savedToken
      workingRef.current = next
      phaseRef.current = 'ready'
      setWorking(next)
      setToken(savedToken)
      setTokenError(denied ? TOKEN_DENIED : null)
      setPhase('ready')
      if (pending !== null) markUnsynced(true)
      if (pending !== null && savedToken !== null) await exclusive(syncPending)
    })()
    return () => {
      generation.current += 1
    }
  }, [dek, file, manifest, store])

  const canEdit = phase === 'ready' && token !== null && !syncing

  return {
    working,
    manifest: working.manifest,
    loading: phase === 'loading',
    syncing,
    unsynced,
    tokenError,
    tokenSaved: token !== null,
    canEdit,
    saveToken: async (value: string) => {
      const current = storeRef.current
      const next = value.trim()
      if (!current || next === '' || phaseRef.current === 'loading') return
      await current.saveToken(next)
      tokenRef.current = next
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
          if (alive.current) setTokenError(isDenied(error) ? TOKEN_DENIED : null)
        }
      })
    },
    forgetToken: async () => {
      const current = storeRef.current
      if (!current) return
      tokenRef.current = null
      setToken(null)
      setTokenError(null)
      await current.forgetToken()
    },
    retrySync: () => {
      if (phaseRef.current !== 'ready' || tokenRef.current === null || syncingRef.current) return Promise.resolve()
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
