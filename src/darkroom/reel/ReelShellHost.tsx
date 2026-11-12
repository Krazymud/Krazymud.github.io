import { useEffect, useMemo, useRef, useState } from 'react'
import { useDarkroomVault } from '../VaultBridge'
import { vaultToReelContent, type ReelPhotoUrls } from './vaultToReelContent'
import type { ListContent } from '../../vault/types'

const STORAGE_KEY = 'reel-vault-content'
const SHELL_SRC = '/reel-shell/index.html?vault=1&embed=1'

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

function manifestKey(photos: { hash: string }[], notes: { hash: string }[], lists: { hash: string }[]) {
  return [
    photos.map((p) => p.hash).join(','),
    notes.map((n) => n.hash).join(','),
    lists.map((l) => l.hash).join(','),
  ].join('|')
}

export function ReelShellHost() {
  const { photos, notes, lists, readBlob, loading, lock } = useDarkroomVault()
  const [payload, setPayload] = useState<{ json: string; key: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const blobUrls = useRef<string[]>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const key = useMemo(() => manifestKey(photos, notes, lists), [photos, notes, lists])

  // Revoke object URLs only when the host unmounts (not on every rebuild).
  useEffect(() => {
    return () => {
      for (const u of blobUrls.current) URL.revokeObjectURL(u)
      blobUrls.current = []
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (loading) {
        setPayload(null)
        return
      }
      try {
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
          urls[p.source] = urls[p.hash]
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
        const json = JSON.stringify(content)
        sessionStorage.setItem(STORAGE_KEY, json)
        if (alive) {
          setError(null)
          setPayload({ json, key })
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'reel failed')
      }
    })()
    return () => {
      alive = false
    }
  }, [photos, notes, lists, readBlob, loading, key])

  const pushContent = () => {
    const win = iframeRef.current?.contentWindow
    if (!win || !payload) return
    try {
      const content = JSON.parse(payload.json) as unknown
      win.postMessage({ roll: 'vault-content', content }, '*')
    } catch {
      /* ignore */
    }
  }

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

  if (!payload) {
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
        key={payload.key}
        ref={iframeRef}
        data-testid="reel-shell"
        title="暗房"
        src={SHELL_SRC}
        className="fixed inset-0 h-dvh w-full border-0"
        allow="autoplay"
        onLoad={pushContent}
      />
    </div>
  )
}
