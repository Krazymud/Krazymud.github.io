import { useEffect, useRef, useState } from 'react'
import { useDarkroomVault } from '../VaultBridge'
import { vaultToReelContent, type ReelPhotoUrls } from './vaultToReelContent'
import type { ListContent } from '../../vault/types'

const STORAGE_KEY = 'reel-vault-content'

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

function parseList(bytes: Uint8Array): ListContent {
  try {
    const raw = JSON.parse(decodeText(bytes)) as ListContent
    return { items: Array.isArray(raw.items) ? raw.items : [] }
  } catch {
    return { items: [] }
  }
}

export function ReelShellHost() {
  const { photos, notes, lists, readBlob, loading, lock } = useDarkroomVault()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blobUrls = useRef<string[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (loading) {
          setReady(false)
          return
        }
        for (const u of blobUrls.current) URL.revokeObjectURL(u)
        blobUrls.current = []
        const urls: ReelPhotoUrls = {}
        for (const p of photos) {
          const [thumbBytes, fullBytes] = await Promise.all([
            readBlob(p.thumb).catch(() => readBlob(p.full)),
            readBlob(p.full).catch(() => readBlob(p.thumb)),
          ])
          const thumb = URL.createObjectURL(new Blob([thumbBytes as BlobPart]))
          const full = URL.createObjectURL(new Blob([fullBytes as BlobPart]))
          blobUrls.current.push(thumb, full)
          urls[p.hash] = { photo: thumb, thumb, full }
        }
        const notePayload = await Promise.all(
          notes.map(async (entry) => ({
            entry,
            text: decodeText(await readBlob(entry.blob).catch(() => new Uint8Array())),
          })),
        )
        const listPayload = await Promise.all(
          lists.map(async (entry) => ({
            entry,
            content: parseList(await readBlob(entry.blob).catch(() => new Uint8Array())),
          })),
        )
        const content = vaultToReelContent({ photos, notes: notePayload, lists: listPayload, urls })
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(content))
        if (alive) {
          setError(null)
          setReady(true)
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'reel failed')
      }
    })()
    return () => {
      alive = false
      for (const u of blobUrls.current) URL.revokeObjectURL(u)
      blobUrls.current = []
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [photos, notes, lists, readBlob, loading])

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-[#f3e6d2]" style={{ background: '#040302' }}>
        <p className="text-sm opacity-80">{error}</p>
        <button type="button" className="border border-[#ee5546]/70 px-4 py-2 text-sm" onClick={lock}>
          锁上
        </button>
      </div>
    )
  }

  if (!ready) {
    return (
      <p className="flex min-h-dvh items-center justify-center text-sm tracking-[0.2em] text-[#f3e6d2]/70" style={{ background: '#040302' }}>
        loading the next reel…
      </p>
    )
  }

  return (
    <div className="relative min-h-dvh" data-testid="reel-shell-host">
      <button
        type="button"
        onClick={lock}
        className="fixed left-4 top-4 z-30 text-xs tracking-[0.15em] text-[#f3e6d2]/55 hover:text-[#f3e6d2]"
        style={{ fontFamily: 'JB Mono, monospace' }}
      >
        锁上
      </button>
      <iframe
        data-testid="reel-shell"
        title="A Roll For Two"
        src="/reel-shell/index.html?vault=1"
        className="fixed inset-0 h-dvh w-full border-0"
        allow="autoplay"
      />
    </div>
  )
}
