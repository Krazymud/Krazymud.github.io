import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useDarkroomVault } from '../VaultBridge'
import { DR_COLORS, DR_FONTS } from '../theme'
import { useReel } from './ReelStage'

export interface TorchComicSceneProps {
  noteLine: string
  date: string
  onContinue: () => void
}

const DEFAULT_MX = 320
const DEFAULT_MY = 240

function DeskClutterSvg() {
  return (
      <svg
      viewBox="0 0 640 470"
      className="h-full w-full"
      aria-hidden
      data-testid="torch-desk-svg"
    >
      <defs>
        <pattern id="torch-wood" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="5" cy="5" r="1.3" fill="#3a1a08" opacity="0.5" />
        </pattern>
        <linearGradient id="torch-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="640" height="470" fill="#8f4a25" />
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={`plank-${i}`}
          x1={i * 130}
          y1={0}
          x2={i * 130}
          y2={470}
          stroke="#16100b"
          strokeWidth={2.4}
        />
      ))}
      <rect width="640" height="470" fill="url(#torch-wood)" opacity={0.35} />
      <path
        d="M-30 40 C140 90 230 160 300 250 S420 420 520 400 S700 300 760 430 S900 560 1080 690"
        fill="none"
        stroke="#16100b"
        strokeWidth={6}
        strokeLinecap="round"
        transform="scale(0.55) translate(30 20)"
      />
      <path
        d="M-30 40 C140 90 230 160 300 250 S420 420 520 400 S700 300 760 430 S900 560 1080 690"
        fill="none"
        stroke="#d42a1e"
        strokeWidth={3.4}
        strokeLinecap="round"
        transform="scale(0.55) translate(30 20)"
      />
      <g transform="translate(420 180) rotate(-8)">
        <rect x={0} y={0} width={70} height={55} rx={12} fill="#efe6d0" stroke="#1a120c" strokeWidth={2} />
        <ellipse cx={20} cy={-8} rx={16} ry={6} fill="#5a3a22" />
      </g>
      <g transform="translate(180 280) rotate(32)">
        <polygon points="0,-5 140,-5 165,0 140,5 0,5" fill="#f0b81f" stroke="#1a120c" strokeWidth={2} />
      </g>
      <g transform="translate(260 120)">
        <rect width={120} height={76} rx={4} fill="#1d6b8f" stroke="#1a120c" strokeWidth={2} />
        <circle cx={60} cy={38} r={14} fill="#d42a1e" stroke="#1a120c" strokeWidth={1.5} />
      </g>
      <g transform="translate(480 320) rotate(18)">
        <rect width={100} height={70} rx={8} fill="#f0b81f" stroke="#1a120c" strokeWidth={2.2} />
        <circle cx={40} cy={38} r={22} fill="#222" stroke="#1a120c" strokeWidth={1.8} />
        <circle cx={40} cy={38} r={11} fill="#2a5fa8" />
      </g>
      <circle cx={120} cy={200} r={36} fill="#f2e8cc" stroke="#1a120c" strokeWidth={2} />
      <g transform="translate(520 90)">
        <circle r={26} fill="none" stroke="#111" strokeWidth={5} />
        <circle cx={40} cy={8} r={14} fill="#d9a12a" stroke="#1a120c" strokeWidth={1.5} />
      </g>
      <rect width="640" height="470" fill="url(#torch-shine)" opacity={0.15} pointerEvents="none" />
    </svg>
  )
}

export function TorchComicScene({ noteLine, date, onContinue }: TorchComicSceneProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mx, setMx] = useState(DEFAULT_MX)
  const [my, setMy] = useState(DEFAULT_MY)

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = panelRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMx(e.clientX - r.left)
    setMy(e.clientY - r.top)
  }, [])

  return (
    <section
      data-testid="torch-stage"
      className="relative flex min-h-[72vh] flex-col items-center justify-center gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-center sm:gap-10"
      style={{ background: DR_COLORS.bg, color: DR_COLORS.cream }}
      aria-label="火把漫画"
    >
      <aside className="max-w-[220px] shrink-0 text-left sm:pt-12" style={{ fontFamily: DR_FONTS.mono }}>
        <p className="text-[10px] uppercase tracking-[0.2em] opacity-55">Scene · 火把</p>
        <p className="mt-3 text-base italic opacity-90" style={{ fontFamily: DR_FONTS.display }}>
          灯灭了。
        </p>
        <p className="mt-2 text-sm opacity-80" style={{ fontFamily: DR_FONTS.display }}>
          用手电扫过桌面，找到属于我们的那几样。
        </p>
      </aside>

      <div
        className="relative overflow-hidden rounded-[22px] border-[3px] border-[#16100b] shadow-[0_12px_40px_rgba(0,0,0,.55)]"
        style={{ background: '#c9b386', width: 'min(100%, 640px)' }}
      >
        <div
          ref={panelRef}
          data-testid="torch-panel"
          className="relative aspect-[640/470] w-full touch-none"
          style={{ cursor: 'none' }}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerMove}
        >
          <div className="absolute inset-0">
            <DeskClutterSvg />
          </div>

          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-8 text-center"
            data-testid="torch-reveal"
            aria-hidden
          >
            <p className="text-3xl sm:text-4xl" style={{ fontFamily: DR_FONTS.hand, color: DR_COLORS.accent }}>
              {noteLine}
            </p>
            <p className="text-xs tracking-[0.15em] opacity-75" style={{ fontFamily: DR_FONTS.mono }}>
              {date}
            </p>
          </div>

          <div
            data-testid="torch-mask"
            className="pointer-events-none absolute inset-0"
            style={
              {
                '--mx': `${mx}px`,
                '--my': `${my}px`,
                background: `radial-gradient(circle at var(--mx) var(--my), transparent 0, transparent 95px, rgba(14,9,6,.55) 130px, rgba(14,9,6,.92) 170px)`,
              } as CSSProperties
            }
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={
              {
                '--mx': `${mx}px`,
                '--my': `${my}px`,
                WebkitMask: 'radial-gradient(circle at var(--mx) var(--my), transparent 105px, #000 155px)',
                mask: 'radial-gradient(circle at var(--mx) var(--my), transparent 105px, #000 155px)',
                background:
                  'repeating-linear-gradient(-38deg,rgba(0,0,0,.85) 0 1.3px,transparent 1.3px 5px)',
              } as CSSProperties
            }
            aria-hidden
          />
          <p
            className="pointer-events-none absolute left-3 top-3 border-2 border-[#16100b] bg-[#f0b81f] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#16100b]"
            style={{ fontFamily: DR_FONTS.letter }}
          >
            Lights are out.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="fixed bottom-6 right-6 z-20 border px-6 py-2 text-lg sm:static sm:self-end sm:pb-4"
        style={{
          fontFamily: DR_FONTS.hand,
          borderColor: DR_COLORS.accent,
          color: DR_COLORS.accent,
          transform: 'rotate(-4deg)',
        }}
      >
        下一卷 →
      </button>
    </section>
  )
}

export function TorchComicBeat() {
  const { next } = useReel()
  const { notes } = useDarkroomVault()
  const note = notes[0]
  const noteLine = note?.title?.trim() || '还在数日子。'
  const date = note?.date?.trim() || ''

  return <TorchComicScene noteLine={noteLine} date={date} onContinue={next} />
}
