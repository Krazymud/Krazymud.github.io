import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { play } from '../audio/sound'
import { copy } from '../config/copy'
import { DecryptError } from '../vault/crypto'
import { defaultKeyStore, type KeyStore } from '../vault/keyStore'
import { fetchVaultBytes, loadVaultFile, unlockWithKey, unlockWithPassphrase, type FetchBytes, type VaultSession } from '../vault/repo'
import type { VaultFile } from '../vault/types'
import { UnlockGate } from './overlays/UnlockGate'

type DarkroomState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'locked'; file: VaultFile }
  | { status: 'ready'; file: VaultFile; session: VaultSession }

interface DarkroomAppProps {
  fetchBytes?: FetchBytes
  keyStore?: KeyStore | null
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <section className="glass-panel mx-auto mt-10 max-w-md rounded-lg px-5 py-8 text-center">
      <p className="font-display text-xs text-fg">{copy.siteName}</p>
      <div className="mt-4 text-sm text-muted">{children}</div>
    </section>
  )
}

export function DarkroomApp({ fetchBytes = fetchVaultBytes, keyStore }: DarkroomAppProps) {
  const [store] = useState(() => (keyStore === undefined ? defaultKeyStore() : keyStore))
  const [state, setState] = useState<DarkroomState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    async function open(): Promise<DarkroomState> {
      const file = await loadVaultFile(fetchBytes)
      if (!file) return { status: 'empty' }
      const saved = store ? await store.load().catch(() => null) : null
      if (saved) {
        try {
          return { status: 'ready', file, session: await unlockWithKey(file, saved) }
        } catch {
          await store?.clear().catch(() => undefined)
        }
      }
      return { status: 'locked', file }
    }
    open().then(
      (next) => alive && setState(next),
      () => alive && setState({ status: 'error' }),
    )
    return () => {
      alive = false
    }
  }, [fetchBytes, store, attempt])

  const unlock = useCallback(
    async (file: VaultFile, passphrase: string, remember: boolean) => {
      let session: VaultSession
      try {
        session = await unlockWithPassphrase(file, passphrase)
      } catch (error) {
        if (error instanceof DecryptError) return false
        throw error
      }
      if (remember && store) await store.save(session.dek).catch(() => undefined)
      void play('unseal')
      setState({ status: 'ready', file, session })
      return true
    },
    [store],
  )

  switch (state.status) {
    case 'loading':
      return <p className="mt-10 text-center text-sm text-muted">{copy.darkroom.opening}</p>
    case 'empty':
      return <Notice>{copy.darkroom.empty}</Notice>
    case 'error':
      return (
        <Notice>
          <p>{copy.darkroom.broken}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: 'loading' })
              setAttempt((n) => n + 1)
            }}
            className="mt-4 border border-accent-hi px-6 py-2 text-sm text-fg"
          >
            重试
          </button>
        </Notice>
      )
    case 'locked':
      return <UnlockGate canRemember={store !== null} onUnlock={(passphrase, remember) => unlock(state.file, passphrase, remember)} />
    case 'ready':
      return (
        <div data-testid="darkroom-ready">
          {/* Task 4 mounts Canvas here */}
          <p>ready</p>
        </div>
      )
  }
}
