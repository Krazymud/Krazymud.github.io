import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { FetchBytes, VaultSession } from '../vault/repo'
import type { ListEntry, NoteEntry, VaultFile } from '../vault/types'
import { useVaultMutate, type MutateResult } from '../vault/useVaultMutate'
import { localCalendarToday, type WebClock } from '../vault/web'
import { defaultWebStore, type WebStore } from '../vault/webStore'
import { classifyPhotosIntoRolls, type FilmRoll } from './rolls'

type Mutate = ReturnType<typeof useVaultMutate>

export type DarkroomVault = {
  rolls: FilmRoll[]
  notes: NoteEntry[]
  lists: ListEntry[]
  loading: boolean
  readBlob: Mutate['readBlob']
  saveNote: Mutate['saveNote']
  saveList: Mutate['saveList']
  addPhoto: Mutate['addPhoto']
  deletePhoto: Mutate['deletePhoto']
  tokenSaved: boolean
  saveToken: (gate: string) => Promise<void>
  forgetToken: () => Promise<void>
  unsynced: boolean
  lock: () => void
}

export type { MutateResult }

const VaultBridgeContext = createContext<DarkroomVault | null>(null)

interface VaultBridgeProps {
  session: VaultSession
  file: VaultFile
  fetchBytes: FetchBytes
  onLock: () => void
  webStore?: WebStore | null
  webFetch?: typeof fetch
  clock?: WebClock
  children: ReactNode
}

export function VaultBridge({ session, file, fetchBytes, onLock, webStore, webFetch, clock, children }: VaultBridgeProps) {
  const store = useMemo(() => (webStore === undefined ? defaultWebStore() : webStore), [webStore])
  const resolvedClock = useMemo<WebClock>(
    () =>
      clock ?? {
        now: () => Date.now(),
        uuid: () => crypto.randomUUID(),
        today: () => localCalendarToday(new Date()),
      },
    [clock],
  )
  const vault = useVaultMutate({
    dek: session.dek,
    file,
    manifest: session.manifest,
    fetchBytes,
    store,
    apiFetch: webFetch ?? globalThis.fetch,
    clock: resolvedClock,
  })
  const { manifest } = vault
  const rolls = useMemo(() => classifyPhotosIntoRolls(manifest.photos), [manifest.photos])

  const value: DarkroomVault = {
    rolls,
    notes: manifest.notes,
    lists: manifest.lists,
    loading: vault.loading,
    readBlob: vault.readBlob,
    saveNote: vault.saveNote,
    saveList: vault.saveList,
    addPhoto: vault.addPhoto,
    deletePhoto: vault.deletePhoto,
    tokenSaved: vault.tokenSaved,
    saveToken: vault.saveToken,
    forgetToken: vault.forgetToken,
    unsynced: vault.unsynced,
    lock: onLock,
  }
  return <VaultBridgeContext.Provider value={value}>{children}</VaultBridgeContext.Provider>
}

export function useDarkroomVault(): DarkroomVault {
  const value = useContext(VaultBridgeContext)
  if (!value) throw new Error('useDarkroomVault must be used inside VaultBridge')
  return value
}

export function DeskCounts() {
  const { rolls, notes } = useDarkroomVault()
  return (
    <p data-testid="desk-counts" className="pointer-events-none absolute left-4 top-4 text-xs text-muted">
      <span data-testid="roll-count">{rolls.length}</span> 卷胶片 · <span data-testid="note-count">{notes.length}</span> 则笔记
    </p>
  )
}
