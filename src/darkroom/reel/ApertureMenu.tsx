import { useCallback, useEffect, useState } from 'react'
import type { PhotoEntry } from '../../vault/types'
import { useDarkroomVault } from '../VaultBridge'
import { usePolaroidTakeHome, type PolaroidWallFrame } from './PolaroidTakeHome'
import {
  readClarity,
  readLightMode,
  writeClarity,
  writeLightMode,
  type ClarityLevel,
  type LightMode,
} from './reelPrefs'
import { useReelRadio } from './ReelRadio'

function polaroidCaption(photo: PhotoEntry): string {
  const cap = photo.caption?.trim()
  if (cap) return cap
  if (photo.date?.trim()) return photo.date.trim()
  return ''
}

export function ApertureMenu() {
  const [open, setOpen] = useState(false)
  const [clarity, setClarity] = useState<ClarityLevel>(() => readClarity())
  const [light, setLight] = useState<LightMode>(() => readLightMode())
  const [loadingPolaroid, setLoadingPolaroid] = useState(false)
  const vault = useDarkroomVault()
  const photos = vault.photos ?? []
  const readBlob = vault.readBlob
  const lock = vault.lock
  const unsynced = vault.unsynced
  const syncing = vault.syncing
  const tokenSaved = vault.tokenSaved
  const retrySync = vault.retrySync
  const { open: openPolaroid } = usePolaroidTakeHome()
  const { muted, volume, setVolume, toggleMute } = useReelRadio()

  const hasPhotos = photos.length > 0

  useEffect(() => {
    setClarity(readClarity())
    setLight(readLightMode())
  }, [open])

  const onClarity = (level: ClarityLevel) => {
    setClarity(level)
    writeClarity(level)
  }

  const onLight = (mode: LightMode) => {
    setLight(mode)
    writeLightMode(mode)
  }

  const loadWallFrames = useCallback(async (): Promise<PolaroidWallFrame[]> => {
    const wall = photos.slice(0, 8)
    const frames: PolaroidWallFrame[] = []
    const urls: string[] = []
    try {
      for (let i = 0; i < wall.length; i++) {
        const p = wall[i]
        let bytes = await readBlob(p.full)
        if (!bytes?.length) bytes = await readBlob(p.thumb)
        if (!bytes?.length) continue
        const blob = new Blob([bytes], { type: 'image/jpeg' })
        const previewUrl = URL.createObjectURL(blob)
        urls.push(previewUrl)
        frames.push({
          previewUrl,
          caption: polaroidCaption(p),
          date: p.date || '',
          index: i,
        })
      }
      return frames
    } catch {
      urls.forEach((u) => URL.revokeObjectURL(u))
      return []
    }
  }, [photos, readBlob])

  const onPolaroid = async () => {
    if (!hasPhotos || loadingPolaroid) return
    setLoadingPolaroid(true)
    try {
      const frames = await loadWallFrames()
      if (frames.length) openPolaroid(frames)
    } finally {
      setLoadingPolaroid(false)
    }
  }

  return (
    <div className="pointer-events-none fixed left-4 top-14 z-[190]">
      <button
        type="button"
        className="pointer-events-auto rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-xs text-fg backdrop-blur-sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        光圈
      </button>
      {open ? (
        <div className="pointer-events-auto">
          <div data-testid="aperture-panel" className="mt-2 w-56 rounded-lg border border-white/15 bg-black/80 p-3 text-xs text-fg shadow-lg backdrop-blur-md">
            <Row label="音乐">
              <button
                type="button"
                className="rounded border border-accent-hi px-2 py-0.5"
                onClick={toggleMute}
              >
                音乐：{muted ? '关' : '开'}
              </button>
            </Row>
            <Row label="音量">
              <input
                aria-label="音量"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full"
              />
            </Row>
            <Row label="清晰">
              <div className="flex gap-1">
                <button
                  type="button"
                  className={btnCls(clarity === '1')}
                  onClick={() => onClarity('1')}
                >
                  清晰：标准
                </button>
                <button
                  type="button"
                  className={btnCls(clarity === '2')}
                  onClick={() => onClarity('2')}
                >
                  清晰：锐利
                </button>
              </div>
            </Row>
            <Row label="灯光">
              <div className="flex gap-1">
                <button type="button" className={btnCls(light === 'full')} onClick={() => onLight('full')}>
                  灯光：完整
                </button>
                <button type="button" className={btnCls(light === 'simple')} onClick={() => onLight('simple')}>
                  灯光：简洁
                </button>
              </div>
            </Row>
            {hasPhotos ? (
              <Row label="带走">
                <button
                  type="button"
                  className="w-full rounded border border-accent-hi px-2 py-1 disabled:opacity-40"
                  disabled={loadingPolaroid}
                  onClick={() => void onPolaroid()}
                >
                  拍立得带走
                </button>
              </Row>
            ) : null}
            <Row label="保险柜">
              <div className="flex flex-col gap-1">
                <button type="button" className="rounded border border-white/25 px-2 py-1" onClick={lock}>
                  锁上
                </button>
                {unsynced && !syncing ? (
                  <button
                    type="button"
                    className="rounded border border-accent-hi px-2 py-1 disabled:opacity-40"
                    disabled={!tokenSaved}
                    onClick={() => void retrySync()}
                  >
                    同步
                  </button>
                ) : null}
              </div>
            </Row>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function btnCls(active: boolean) {
  return `flex-1 rounded border px-1 py-0.5 ${active ? 'border-accent-hi text-fg' : 'border-white/20 text-muted'}`
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1 text-[10px] uppercase tracking-widest text-muted">{label}</p>
      {children}
    </div>
  )
}
