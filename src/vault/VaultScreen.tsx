import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { play } from '../audio/sound'
import { DecryptError } from './crypto'
import { defaultKeyStore, type KeyStore } from './keyStore'
import { fetchVaultBytes, loadVaultFile, unlockWithKey, unlockWithPassphrase, type FetchBytes, type VaultSession } from './repo'
import type { VaultFile } from './types'
import { UnlockPanel } from './components/UnlockPanel'
import { VaultContent } from './components/VaultContent'

type VaultState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'locked'; file: VaultFile }
  | { status: 'open'; file: VaultFile; session: VaultSession }

interface VaultScreenProps {
  fetchBytes?: FetchBytes
  keyStore?: KeyStore | null
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <section className="mt-10 border border-accent/60 bg-panel/80 px-5 py-8 text-center">
      <p className="font-display text-xs tracking-[0.35em] text-accent-hi">PRIVATE VAULT</p>
      <div className="mt-4 text-sm text-muted">{children}</div>
    </section>
  )
}

export function VaultScreen({ fetchBytes = fetchVaultBytes, keyStore }: VaultScreenProps) {
  const [store] = useState(() => (keyStore === undefined ? defaultKeyStore() : keyStore))
  const [state, setState] = useState<VaultState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    async function open(): Promise<VaultState> {
      const file = await loadVaultFile(fetchBytes)
      if (!file) return { status: 'empty' }
      const saved = store ? await store.load().catch(() => null) : null
      if (saved) {
        try {
          return { status: 'open', file, session: await unlockWithKey(file, saved) }
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
      void play('unlock')
      setState({ status: 'open', file, session })
      return true
    },
    [store],
  )

  const lock = useCallback(
    async (file: VaultFile) => {
      await store?.clear().catch(() => undefined)
      setState({ status: 'locked', file })
    },
    [store],
  )

  switch (state.status) {
    case 'loading':
      return <p className="mt-10 text-center text-sm text-muted">正在打开保险库…</p>
    case 'empty':
      return <Notice>保险库还是空的。</Notice>
    case 'error':
      return (
        <Notice>
          <p>保险库暂时打不开</p>
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
      return <UnlockPanel canRemember={store !== null} onUnlock={(passphrase, remember) => unlock(state.file, passphrase, remember)} />
    case 'open':
      return <VaultContent session={state.session} fetchBytes={fetchBytes} onLock={() => void lock(state.file)} />
  }
}
