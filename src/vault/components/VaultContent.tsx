import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { readBlob, type FetchBytes, type VaultSession } from '../repo'
import type { ReadBlob } from '../useBlob'
import { GoldSweep } from './GoldSweep'
import { ListsTab } from './ListsTab'
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
  onLock: () => void
}

export function VaultContent({ session, fetchBytes, onLock }: VaultContentProps) {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = raw === 'notes' || raw === 'lists' ? raw : 'photos'
  const read = useCallback<ReadBlob>((name) => readBlob(fetchBytes, session.dek, name), [fetchBytes, session])
  const { manifest } = session

  return (
    <section>
      <GoldSweep />
      <div className="flex items-center justify-between">
        <p className="font-display text-xs tracking-[0.35em] text-accent-hi">PRIVATE VAULT</p>
        <button type="button" onClick={onLock} className="border border-line px-3 py-1 text-xs text-muted hover:text-fg">
          锁上
        </button>
      </div>
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
        {tab === 'photos' && <PhotoGrid photos={manifest.photos} read={read} />}
        {tab === 'notes' && <NotesTab notes={manifest.notes} read={read} />}
        {tab === 'lists' && <ListsTab lists={manifest.lists} read={read} />}
      </div>
    </section>
  )
}
