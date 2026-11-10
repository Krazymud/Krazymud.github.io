import { useState } from 'react'
import { copy } from '../../config/copy'
import { useDarkroomVault } from '../VaultBridge'

interface SyncDrawerProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SyncDrawer({ open: controlledOpen, onOpenChange }: SyncDrawerProps = {}) {
  const { tokenSaved, unsynced, tokenError, syncing, saveToken, forgetToken, retrySync, lock } = useDarkroomVault()
  const [innerOpen, setInnerOpen] = useState(false)
  const [gate, setGate] = useState('')
  const open = controlledOpen ?? innerOpen
  const setOpen = (next: boolean) => {
    setInnerOpen(next)
    onOpenChange?.(next)
  }

  return (
    <aside data-testid="sync-drawer" className="absolute right-3 top-3 z-20 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 text-xs">
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="dr-btn dr-panel px-3 py-2">
          {copy.darkroom.syncGate}
        </button>
        <button type="button" onClick={lock} className="dr-btn dr-panel px-3 py-2">
          上锁
        </button>
      </div>
      {syncing && <span role="status" className="dr-panel dr-muted px-2 py-1">{copy.darkroom.syncing}</span>}
      {!syncing && unsynced && (
        <span className="dr-panel dr-warn flex items-center gap-2 px-2 py-1">
          {copy.darkroom.unsynced}
          {tokenSaved && !tokenError && (
            <button type="button" onClick={() => void retrySync()} className="dr-btn px-2 py-1">
              {copy.darkroom.retrySync}
            </button>
          )}
        </span>
      )}
      {tokenError && <span role="alert" className="dr-panel dr-warn px-2 py-1">{tokenError}</span>}
      {open &&
        (tokenSaved ? (
          <button type="button" onClick={() => void forgetToken()} className="dr-btn dr-panel px-3 py-2">
            {copy.darkroom.forgetGate}
          </button>
        ) : (
          <form
            className="dr-panel flex gap-2 p-2"
            onSubmit={(e) => {
              e.preventDefault()
              void saveToken(gate).then(() => setGate(''))
            }}
          >
            <input
              type="password"
              aria-label={copy.darkroom.syncGate}
              value={gate}
              onChange={(e) => setGate(e.target.value)}
              className="dr-input w-40 px-2 py-2 text-base"
            />
            <button type="submit" className="dr-btn px-3 py-2">
              {copy.darkroom.saveGate}
            </button>
          </form>
        ))}
    </aside>
  )
}
