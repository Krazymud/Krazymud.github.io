import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { studyDay } from '../../trial/day'
import { todaysMemory } from '../memory'
import { readBlob, type FetchBytes, type VaultSession } from '../repo'
import type { ReadBlob } from '../useBlob'
import { useWebVault } from '../useWebVault'
import { localCalendarToday, publishedItemDone, type WebClock } from '../web'
import { defaultWebStore, type WebStore } from '../webStore'
import { GoldSweep } from './GoldSweep'
import { ListsTab } from './ListsTab'
import { MemoryCard } from './MemoryCard'
import { NotesTab } from './NotesTab'
import { PhotoGrid } from './PhotoGrid'

type Tab = 'photos' | 'notes' | 'lists'

const TABS: { id: Tab; label: string }[] = [
  { id: 'photos', label: '照片' },
  { id: 'notes', label: '笔记' },
  { id: 'lists', label: '清单' },
]

interface VaultContentProps {
  session: VaultSession
  fetchBytes: FetchBytes
  sweep: boolean
  onLock: () => void
  webStore?: WebStore | null
  webFetch?: typeof fetch
  clock?: WebClock
}

export function VaultContent({ session, fetchBytes, sweep, onLock, webStore, webFetch, clock }: VaultContentProps) {
  const [params, setParams] = useSearchParams()
  const [tokenInput, setTokenInput] = useState('')
  const raw = params.get('tab')
  const tab: Tab = raw === 'notes' || raw === 'lists' ? raw : 'photos'
  const read = useCallback<ReadBlob>((name) => readBlob(fetchBytes, session.dek, name), [fetchBytes, session])
  const { manifest } = session
  const memory = useMemo(() => todaysMemory(manifest, studyDay(new Date())), [manifest])
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
  const vault = useWebVault({
    dek: session.dek,
    fetchBytes,
    store,
    webFetch: webFetch ?? globalThis.fetch,
    clock: resolvedClock,
  })

  return (
    <section>
      {sweep && <GoldSweep />}
      <div className="flex items-center justify-between">
        <p className="font-display text-xs tracking-[0.35em] text-accent-hi">PRIVATE VAULT</p>
        <button type="button" onClick={onLock} className="border border-line px-3 py-1 text-xs text-muted hover:text-fg">
          锁上
        </button>
      </div>
      {memory && <MemoryCard memory={memory} photos={manifest.photos} read={read} />}
      {vault.tokenSaved ? (
        <button
          type="button"
          onClick={() => void vault.forgetToken()}
          className="mt-4 border border-line px-3 py-1 text-xs text-muted hover:text-fg"
        >
          忘记令牌
        </button>
      ) : (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void vault.saveToken(tokenInput).then(() => setTokenInput(''))
          }}
        >
          <input
            type="password"
            aria-label="令牌"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            className="min-w-0 flex-1 border border-line bg-bg px-3 py-1 text-xs"
          />
          <button
            type="submit"
            disabled={vault.loading}
            className="border border-line px-3 py-1 text-xs text-muted hover:text-fg disabled:opacity-40"
          >
            保存令牌
          </button>
        </form>
      )}
      {vault.tokenError && <p className="mt-2 text-xs text-muted">{vault.tokenError}</p>}
      <div role="tablist" className="mt-4 grid grid-cols-3 border-b border-line">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setParams(item.id === 'photos' ? {} : { tab: item.id }, { replace: true })}
            className={`py-2 text-sm ${tab === item.id ? 'border-b-2 border-accent-hi text-fg' : 'text-muted hover:text-fg'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4">
        {vault.broken && <p className="mb-3 text-sm text-muted">网页上的笔记打不开</p>}
        {vault.unsynced && <p className="mb-3 text-sm text-muted">还没同步</p>}
        {tab === 'photos' && <PhotoGrid photos={manifest.photos} read={read} />}
        {tab === 'notes' && (
          <NotesTab
            notes={manifest.notes}
            read={read}
            webNotes={vault.doc.notes}
            canEdit={vault.canEdit}
            formOpen={vault.editor !== null}
            draft={vault.editor?.kind === 'note' ? vault.editor.draft : null}
            onBeginCreate={() => vault.beginNote()}
            onBeginEdit={(note) => vault.beginNote(note)}
            onDelete={(id) => vault.deleteNote(id)}
            onSave={vault.saveNote}
            onCancel={vault.cancelEdit}
          />
        )}
        {tab === 'lists' && (
          <ListsTab
            lists={manifest.lists}
            read={read}
            webLists={vault.doc.lists}
            canEdit={vault.canEdit}
            formOpen={vault.editor !== null}
            draft={vault.editor?.kind === 'list' ? vault.editor.draft : null}
            publishedDone={(source, index, count, fallback) => publishedItemDone(vault.doc, source, index, count, fallback)}
            onBeginCreate={() => vault.beginList()}
            onBeginEdit={(list) => vault.beginList(list)}
            onDelete={(id) => vault.deleteList(id)}
            onSave={vault.saveList}
            onCancel={vault.cancelEdit}
            onTogglePublished={(source, index, done) => vault.togglePublished(source, index, done)}
            onToggleWeb={(listId, itemId) => vault.toggleWebItem(listId, itemId)}
          />
        )}
      </div>
    </section>
  )
}
