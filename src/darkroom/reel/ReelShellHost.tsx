import { useEffect, useMemo, useRef, useState } from 'react'
import { useDarkroomVault } from '../VaultBridge'
import { vaultToReelContent, type ReelPhotoUrls } from './vaultToReelContent'
import type { ListContent, ListEntry, NoteEntry, PhotoEntry } from '../../vault/types'

const STORAGE_KEY = 'reel-vault-content'
const SHELL_SRC = '/reel-shell/index.html?vault=1&embed=1&v=radio2'
const BLOB_MS = 5_000
const BUILD_MS = 12_000

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

function photoManifestKey(photos: { hash: string }[]) {
  return photos.map((p) => p.hash).join(',') || 'empty'
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export function ReelShellHost() {
  const { photos, notes, lists, readBlob, loading, lock, saveNote, saveList, deleteNote, deleteList } =
    useDarkroomVault()
  const [payload, setPayload] = useState<{ json: string; key: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const blobUrls = useRef<string[]>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const key = useMemo(() => photoManifestKey(photos), [photos])

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
      if (loading) return

      const urls: ReelPhotoUrls = {}
      const collected: string[] = []
      const read = async (name: string) => {
        try {
          return await withTimeout(readBlob(name), BLOB_MS)
        } catch {
          return null
        }
      }

      const build = async () => {
        await Promise.all(
          photos.map(async (p: PhotoEntry) => {
            const [thumbBytes, fullBytes] = await Promise.all([
              read(p.thumb).then((b) => b ?? read(p.full)),
              read(p.full).then((b) => b ?? read(p.thumb)),
            ])
            if (!thumbBytes && !fullBytes) return
            const thumb = URL.createObjectURL(new Blob([(thumbBytes ?? fullBytes) as BlobPart]))
            const full = URL.createObjectURL(new Blob([(fullBytes ?? thumbBytes) as BlobPart]))
            collected.push(thumb, full)
            urls[p.hash] = { photo: thumb, thumb, full }
            urls[p.source] = urls[p.hash]
          }),
        )
        const notePayload = await Promise.all(
          notes.map(async (entry: NoteEntry) => ({
            entry,
            text: decodeText((await read(entry.blob)) ?? new Uint8Array()),
          })),
        )
        const listPayload = await Promise.all(
          lists.map(async (entry: ListEntry) => ({
            entry,
            content: parseList((await read(entry.blob)) ?? new Uint8Array()),
          })),
        )
        return vaultToReelContent({ photos, notes: notePayload, lists: listPayload, urls })
      }

      try {
        let content
        try {
          content = await withTimeout(build(), BUILD_MS)
        } catch {
          content = vaultToReelContent({
            photos,
            notes: notes.map((entry) => ({ entry, text: '' })),
            lists: lists.map((entry) => ({ entry, content: { items: [] } })),
            urls,
          })
        }
        for (const u of blobUrls.current) URL.revokeObjectURL(u)
        blobUrls.current = collected
        const json = JSON.stringify(content)
        sessionStorage.setItem(STORAGE_KEY, json)
        if (alive) {
          setError(null)
          setPayload({ json, key })
        }
      } catch (e) {
        for (const u of collected) URL.revokeObjectURL(u)
        if (!alive) return
        try {
          const content = vaultToReelContent({ photos: [], notes: [], lists: [], urls: {} })
          const json = JSON.stringify(content)
          sessionStorage.setItem(STORAGE_KEY, json)
          setError(null)
          setPayload({ json, key: `${photoManifestKey(photos)}-empty` })
        } catch {
          setError(e instanceof Error ? e.message : 'reel failed')
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [photos, notes, lists, readBlob, loading, key])

  useEffect(() => {
    if (!loading || payload) return
    const t = window.setTimeout(() => {
      const content = vaultToReelContent({ photos: [], notes: [], lists: [], urls: {} })
      const json = JSON.stringify(content)
      try {
        sessionStorage.setItem(STORAGE_KEY, json)
      } catch {
        /* ignore */
      }
      setPayload({ json, key: 'hydrate-timeout' })
    }, BUILD_MS)
    return () => clearTimeout(t)
  }, [loading, payload])

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

  useEffect(() => {
    if (!payload?.json) return
    pushContent()
  }, [payload?.json])

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      const win = iframeRef.current?.contentWindow
      if (!win) return
      if (event.source !== win) return
      const data = event.data as {
        roll?: string
        kind?: string
        id?: string
        source?: string
        page?: {
          source?: string
          title?: string
          date?: string
          body?: string
          items?: { text: string; done: boolean }[]
        }
      }
      if (!data?.roll) return

      if (data.roll === 'paper-save' && data.kind === 'note' && data.id && data.page) {
        const page = data.page
        const result = await saveNote({
          ...(page.source ? { source: page.source } : {}),
          title: page.title ?? '',
          date: page.date ?? '',
          body: page.body ?? '',
        })
        win.postMessage(
          {
            roll: 'paper-result',
            id: data.id,
            ok: result.ok,
            reason: result.ok ? undefined : result.reason,
          },
          '*',
        )
        return
      }

      if (data.roll === 'paper-save' && data.kind === 'list' && data.id && data.page) {
        const page = data.page
        const result = await saveList({
          ...(page.source ? { source: page.source } : {}),
          title: page.title ?? '',
          items: page.items ?? [],
        })
        win.postMessage(
          {
            roll: 'paper-result',
            id: data.id,
            ok: result.ok,
            reason: result.ok ? undefined : result.reason,
          },
          '*',
        )
        return
      }

      if (data.roll === 'paper-delete' && data.id && (data.kind === 'note' || data.kind === 'list')) {
        if (!data.source) {
          win.postMessage({ roll: 'paper-result', id: data.id, ok: true }, '*')
          return
        }
        const result =
          data.kind === 'note' ? await deleteNote(data.source) : await deleteList(data.source)
        win.postMessage(
          {
            roll: 'paper-result',
            id: data.id,
            ok: result.ok,
            reason: result.ok ? undefined : result.reason,
          },
          '*',
        )
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [saveNote, saveList, deleteNote, deleteList])

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
