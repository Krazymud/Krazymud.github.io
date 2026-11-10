import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { downloadPolaroidsZip, openPrintSheet, renderPolaroidFront, type PolaroidFrameInput } from './polaroidRender'

export type PolaroidWallFrame = {
  previewUrl: string
  caption: string
  date: string
  index: number
}

type PolaroidApi = {
  open: (frames: PolaroidWallFrame[]) => void
}

const PolaroidTakeHomeContext = createContext<PolaroidApi | null>(null)

export function usePolaroidTakeHome(): PolaroidApi {
  const ctx = useContext(PolaroidTakeHomeContext)
  if (!ctx) throw new Error('usePolaroidTakeHome must be used inside PolaroidTakeHomeProvider')
  return ctx
}

async function wallFramesToInputs(frames: PolaroidWallFrame[]): Promise<PolaroidFrameInput[]> {
  const slice = frames.slice(0, 8)
  return Promise.all(
    slice.map(async (frame) => {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('preview load failed'))
        el.src = frame.previewUrl
      })
      return {
        image: img,
        caption: frame.caption,
        date: frame.date,
        index: frame.index,
      }
    }),
  )
}

function PolaroidModal({
  open,
  frames,
  onClose,
}: {
  open: boolean
  frames: PolaroidWallFrame[]
  onClose: () => void
}) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [busy, setBusy] = useState<'download' | 'print' | null>(null)

  useEffect(() => {
    if (!open || frames.length === 0) {
      setPreviewUrls([])
      return
    }
    let cancelled = false
    const urls: string[] = []
    ;(async () => {
      for (const frame of frames.slice(0, 8)) {
        if (cancelled) return
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image()
            el.onload = () => resolve(el)
            el.onerror = () => reject(new Error('load failed'))
            el.src = frame.previewUrl
          })
          const canvas = await renderPolaroidFront(img, {
            caption: frame.caption,
            date: frame.date,
            index: frame.index,
          })
          urls.push(canvas.toDataURL('image/jpeg', 0.72))
        } catch {
          urls.push(frame.previewUrl)
        }
      }
      if (!cancelled) setPreviewUrls(urls)
    })()
    return () => {
      cancelled = true
    }
  }, [open, frames])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const run = async (kind: 'download' | 'print') => {
    if (frames.length === 0 || busy) return
    setBusy(kind)
    try {
      const inputs = await wallFramesToInputs(frames)
      if (kind === 'download') await downloadPolaroidsZip(inputs)
      else await openPrintSheet(inputs)
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      data-testid="polaroid-take-home"
      className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="带走拍立得"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-[920px] rounded-xl border border-white/10 bg-[#1b1410] px-8 py-7 text-center text-[#f3e6d2]">
        <button
          type="button"
          className="absolute right-5 top-4 border-0 bg-transparent text-lg text-[#f3e6d2]"
          aria-label="关闭"
          onClick={onClose}
        >
          ✕
        </button>
        <h3 className="font-display text-3xl text-accent-hi">带走拍立得</h3>
        <p className="mt-2 text-[11px] uppercase tracking-widest text-muted">墙上至多八张 · 正反各一张</p>
        <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8" data-testid="polaroid-row">
          {(previewUrls.length ? previewUrls : frames.map((f) => f.previewUrl)).map((url, i) => (
            <img
              key={`${url}-${i}`}
              src={url}
              alt=""
              className={`w-full shadow-lg ${i % 2 === 0 ? '-rotate-2' : 'rotate-2'}`}
            />
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            disabled={!!busy || frames.length === 0}
            className="rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-wider disabled:opacity-40"
            onClick={() => void run('download')}
          >
            {busy === 'download' ? '打包中…' : '下载 ZIP'}
          </button>
          <button
            type="button"
            disabled={!!busy || frames.length === 0}
            className="rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-wider disabled:opacity-40"
            onClick={() => void run('print')}
          >
            {busy === 'print' ? '准备中…' : '打印剪裁'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PolaroidTakeHomeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; frames: PolaroidWallFrame[] }>({
    open: false,
    frames: [],
  })

  const open = useCallback((frames: PolaroidWallFrame[]) => {
    setState({ open: true, frames: frames.slice(0, 8) })
  }, [])

  const onClose = useCallback(() => setState((s) => ({ ...s, open: false })), [])

  const api = useMemo(() => ({ open }), [open])

  return (
    <PolaroidTakeHomeContext.Provider value={api}>
      {children}
      <PolaroidModal open={state.open} frames={state.frames} onClose={onClose} />
    </PolaroidTakeHomeContext.Provider>
  )
}
