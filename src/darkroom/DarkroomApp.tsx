import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useImmersive } from '../app/immersive'
import { play } from '../audio/sound'
import { copy } from '../config/copy'
import { DecryptError } from '../vault/crypto'
import { defaultKeyStore, type KeyStore } from '../vault/keyStore'
import { fetchVaultBytes, loadVaultFile, unlockWithKey, unlockWithPassphrase, type FetchBytes, type VaultSession } from '../vault/repo'
import type { WebStore } from '../vault/webStore'
import type { VaultFile } from '../vault/types'
import { UnlockGate } from './overlays/UnlockGate'
import { ReelStage } from './reel/ReelStage'
import { DeskCounts, VaultBridge } from './VaultBridge'

type DarkroomState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'locked'; file: VaultFile }
  | { status: 'ready'; file: VaultFile; session: VaultSession }

interface DarkroomAppProps {
  fetchBytes?: FetchBytes
  keyStore?: KeyStore | null
  webStore?: WebStore | null
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <section
      className="dr-opening relative flex min-h-dvh items-center justify-center overflow-hidden px-4"
      style={{ background: '#0b0705', color: '#f3e6d2' }}
    >
      <div className="dr-opening-bokeh" aria-hidden />
      <div className="relative z-10 mx-auto max-w-md px-5 py-8 text-center">
        <p className="text-xs tracking-[0.2em]" style={{ fontFamily: 'Fraunces, serif' }}>
          {copy.siteName}
        </p>
        <div className="mt-4 text-sm opacity-80">{children}</div>
      </div>
    </section>
  )
}

export function DarkroomApp({ fetchBytes = fetchVaultBytes, keyStore, webStore }: DarkroomAppProps) {
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

  const lock = useCallback(() => {
    void store?.clear().catch(() => undefined)
    setState((prev) => (prev.status === 'ready' ? { status: 'locked', file: prev.file } : prev))
  }, [store])

  // Always immersive: lock / empty / ready all use darkroom chrome, never light glass shell.
  useImmersive(true)

  switch (state.status) {
    case 'loading':
      return (
        <p className="mt-10 text-center text-sm" style={{ color: '#c4b39c' }}>
          {copy.darkroom.opening}
        </p>
      )
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
        <VaultBridge session={state.session} file={state.file} fetchBytes={fetchBytes} onLock={lock} webStore={webStore}>
          <div data-testid="darkroom-ready" className="relative">
            <ReelStage />
            <DeskCounts />
          </div>
        </VaultBridge>
      )
  }
}
