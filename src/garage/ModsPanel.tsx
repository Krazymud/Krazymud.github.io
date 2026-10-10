import { useEffect, useRef } from 'react'
import { DEFAULT_PREFS, setPrefs, usePrefs } from '../prefs/prefs'
import { modsFor, PALETTES, type ModPart } from './mods'

const ROWS: { part: ModPart; label: string }[] = [
  { part: 'paint', label: '车漆' },
  { part: 'rim', label: '轮毂' },
  { part: 'caliper', label: '卡钳' },
]

export function ModsPanel({ onClose }: { onClose: () => void }) {
  const prefs = usePrefs()
  const current = modsFor(prefs)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => panel.current?.focus(), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="改装"
      tabIndex={-1}
      className="fixed inset-x-0 bottom-0 z-30 max-h-[40dvh] overflow-y-auto border-t border-accent/60 bg-panel px-5 pb-6 pt-4 outline-none"
    >
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <p className="font-display text-xs tracking-[0.35em] text-accent-hi">改装</p>
          <button type="button" onClick={onClose} className="px-2 py-1 text-xs text-muted hover:text-fg">
            关闭
          </button>
        </div>
        {ROWS.map(({ part, label }) => (
          <div key={part} className="mt-3">
            <p className="text-xs text-muted">
              {label} · <span className="text-fg">{current[part].name}</span>
            </p>
            <div role="group" aria-label={label} className="mt-2 flex flex-wrap gap-2">
              {PALETTES[part].map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  aria-label={swatch.name}
                  aria-pressed={current[part].id === swatch.id}
                  onClick={() => setPrefs({ [part]: swatch.id } as Partial<Record<ModPart, string>>)}
                  className={`h-9 w-9 rounded-full border-2 ${current[part].id === swatch.id ? 'border-accent-hi' : 'border-line'}`}
                  style={{ backgroundColor: swatch.chip ?? swatch.hex }}
                />
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPrefs({ paint: DEFAULT_PREFS.paint, rim: DEFAULT_PREFS.rim, caliper: DEFAULT_PREFS.caliper })}
          className="mt-4 border border-line px-4 py-2 text-xs text-muted hover:text-fg"
        >
          恢复原厂
        </button>
      </div>
    </div>
  )
}
