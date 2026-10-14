import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { copy } from '../../config/copy'
import { studyDay } from '../../trial/day'
import { todaysMemory } from '../memory'
import type { FetchBytes, VaultSession } from '../repo'
import type { VaultFile } from '../types'
import { useVaultMutate, type MutateResult } from '../useVaultMutate'
import { localCalendarToday, type WebClock } from '../web'
import { defaultWebStore, type WebStore } from '../webStore'
import { ListsTab, type ListDraft } from './ListsTab'
import { MemoryCard } from './MemoryCard'
import { NotesTab, type NoteDraft } from './NotesTab'
import { PhotoGrid } from './PhotoGrid'

type Tab = 'photos' | 'notes' | 'lists'

const TABS: { id: Tab; label: string }[] = [
  { id: 'photos', label: '照片' },
  { id: 'notes', label: '笔记' },
  { id: 'lists', label: '清单' },
]

type Editor = { kind: 'note'; draft: NoteDraft } | { kind: 'list'; draft: ListDraft }

const SAVE_FAILED = '没能保存，请再试一次'

interface VaultContentProps {
  session: VaultSession
  file: VaultFile
  fetchBytes: FetchBytes
  onLock: () => void
  webStore?: WebStore | null
  webFetch?: typeof fetch
  clock?: WebClock
}

export function VaultContent({ session, file, fetchBytes, onLock, webStore, webFetch, clock }: VaultContentProps) {
  const [params, setParams] = useSearchParams()
  const [tokenInput, setTokenInput] = useState('')
  const raw = params.get('tab')
  const tab: Tab = raw === 'notes' || raw === 'lists' ? raw : 'photos'
  const [editor, setEditor] = useState<Editor | null>(null)
  const [failed, setFailed] = useState(false)
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
  const { manifest, readBlob: read } = vault
  const memory = useMemo(() => todaysMemory(manifest, studyDay(new Date())), [manifest])

  async function finish(result: Promise<MutateResult>, closeForm: boolean) {
    const outcome = await result
    if (outcome.ok) {
      setFailed(false)
      if (closeForm) setEditor(null)
    } else if (outcome.reason === 'locked' || outcome.reason === 'blob') {
      setFailed(true)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="font-display text-xs tracking-[0.35em] text-fg">{copy.vault.title}</p>
        <button type="button" onClick={onLock} className="border border-line px-3 py-1 text-xs text-muted hover:text-fg">
          锁上
        </button>
      </div>
      {memory && <MemoryCard memory={memory} photos={manifest.photos} read={read} />}
      {vault.tokenSaved ? (
        <button
          type="button"
          onClick={() => {
            setEditor(null)
            setFailed(false)
            void vault.forgetToken()
          }}
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
        {vault.syncing && <p className="mb-3 text-sm text-muted">正在同步…</p>}
        {!vault.syncing && vault.unsynced && <p className="mb-3 text-sm text-muted">还没同步</p>}
        {failed && <p className="mb-3 text-sm text-muted">{SAVE_FAILED}</p>}
        {tab === 'photos' && (
          <PhotoGrid
            photos={manifest.photos}
            read={read}
            canEdit={vault.canEdit}
            syncing={vault.syncing}
            onAdd={async (input) => {
              const outcome = await vault.addPhoto(input)
              await finish(Promise.resolve(outcome), false)
              return outcome.ok
            }}
            onDelete={(source) => void finish(vault.deletePhoto(source), false)}
          />
        )}
        {tab === 'notes' && (
          <NotesTab
            notes={manifest.notes}
            read={read}
            canEdit={vault.canEdit}
            formOpen={editor !== null}
            draft={editor?.kind === 'note' ? editor.draft : null}
            onBeginCreate={() => setEditor({ kind: 'note', draft: { title: '', date: resolvedClock.today(), body: '' } })}
            onBeginEdit={(note, body) =>
              setEditor({ kind: 'note', draft: { source: note.source, title: note.title, date: note.date, body } })
            }
            onDelete={(source) => void finish(vault.deleteNote(source), false)}
            onSave={(input) => void finish(vault.saveNote(input), true)}
            onCancel={() => setEditor(null)}
          />
        )}
        {tab === 'lists' && (
          <ListsTab
            lists={manifest.lists}
            read={read}
            canEdit={vault.canEdit}
            formOpen={editor !== null}
            draft={editor?.kind === 'list' ? editor.draft : null}
            onBeginCreate={() => setEditor({ kind: 'list', draft: { title: '', items: [{ text: '', done: false }] } })}
            onBeginEdit={(list, items) => setEditor({ kind: 'list', draft: { source: list.source, title: list.title, items } })}
            onDelete={(source) => void finish(vault.deleteList(source), false)}
            onSave={(input) => void finish(vault.saveList(input), true)}
            onCancel={() => setEditor(null)}
            onToggle={(source, index, done) => void finish(vault.toggleListItem(source, index, done), false)}
          />
        )}
      </div>
    </section>
  )
}
