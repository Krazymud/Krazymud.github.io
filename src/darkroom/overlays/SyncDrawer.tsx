import { useState } from 'react'
import { copy } from '../../config/copy'
import { useDarkroomVault } from '../VaultBridge'

export function SyncDrawer() {
  const { tokenSaved, unsynced, saveToken, forgetToken, lock } = useDarkroomVault()
  const [open, setOpen] = useState(false)
  const [gate, setGate] = useState('')

  return (
    <aside data-testid="sync-drawer" className="absolute right-4 top-4 z-20 flex flex-col items-end gap-2 text-xs">
      <div className="flex gap-2">
        {unsynced && <span className="self-center text-muted">{copy.darkroom.unsynced}</span>}
        <button type="button" onClick={() => setOpen((v) => !v)} className="border border-line bg-black/60 px-3 py-1 text-fg">
          {copy.darkroom.syncGate}
        </button>
        <button type="button" onClick={lock} className="border border-line bg-black/60 px-3 py-1 text-fg">
          上锁
        </button>
      </div>
      {open &&
        (tokenSaved ? (
          <button type="button" onClick={() => void forgetToken()} className="border border-line bg-black/70 px-3 py-1 text-muted">
            {copy.darkroom.forgetGate}
          </button>
        ) : (
          <form
            className="flex gap-2 bg-black/70 p-2"
            onSubmit={(e) => {
              e.preventDefault()
              void saveToken(gate).then(() => setGate(''))
            }}
          >
            <input type="password" aria-label={copy.darkroom.syncGate} value={gate} onChange={(e) => setGate(e.target.value)} className="border border-line bg-bg px-2 py-1" />
            <button type="submit" className="border border-line px-3 py-1 text-fg">
              {copy.darkroom.saveGate}
            </button>
          </form>
        ))}
    </aside>
  )
}
