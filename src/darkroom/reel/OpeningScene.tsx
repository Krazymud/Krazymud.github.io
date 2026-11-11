import { copy } from '../../config/copy'
import { DR_COLORS, DR_FONTS } from '../theme'

export interface OpeningSceneProps {
  onContinue: () => void
  beltUrls: string[]
}

const PLACEHOLDER_FRAMES = [
  'linear-gradient(145deg,#2a221c,#15100c 55%,#3a2a22)',
  'linear-gradient(160deg,#1c2420,#0e1210 50%,#2a3228)',
  'linear-gradient(135deg,#242028,#100e14 60%,#32282e)',
]

export function OpeningScene({ onContinue, beltUrls }: OpeningSceneProps) {
  const frames = beltUrls.length > 0 ? beltUrls.map((url) => ({ type: 'img' as const, url })) : PLACEHOLDER_FRAMES.map((bg) => ({ type: 'tone' as const, bg }))

  return (
    <section
      data-testid="opening-scene"
      className="dr-opening relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: DR_COLORS.bg, color: DR_COLORS.cream }}
    >
      <div className="dr-opening-bokeh" aria-hidden />
      <div className="dr-opening-specks" aria-hidden />
      <div className="dr-vig absolute inset-0 z-[2]" aria-hidden />

      <aside
        className="pointer-events-none absolute left-4 top-6 z-10 hidden max-w-[14rem] text-left text-[10px] leading-relaxed tracking-[0.14em] opacity-70 sm:block"
        style={{ fontFamily: DR_FONTS.mono }}
        aria-hidden
      >
        <p>DARKROOM V.01 — {copy.siteName.toUpperCase()}</p>
        <p>400 · 24 EXP · REEL 1</p>
        <p className="mt-3">THREADING FILM ........... OK</p>
        <p>WARMING THE LAMP .......... OK</p>
        <p>FRAMES READY .............. OK</p>
      </aside>

      <div className="relative z-10 flex w-full max-w-4xl items-center justify-center gap-8 sm:gap-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <h1 className="text-5xl font-normal tracking-[0.08em] sm:text-6xl" style={{ fontFamily: DR_FONTS.display }}>
            {copy.siteName}
          </h1>
          <p className="text-sm italic tracking-[0.06em] opacity-80 sm:text-base" style={{ fontFamily: DR_FONTS.display }}>
            {copy.darkroom.tagline}
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="mt-2 px-2 py-1 text-3xl transition-opacity hover:opacity-90 sm:text-4xl"
            style={{
              fontFamily: DR_FONTS.hand,
              color: DR_COLORS.accent,
            }}
          >
            {copy.darkroom.openingCtaHand}
          </button>
        </div>

        <aside
          data-testid="opening-belt"
          className="dr-film-belt hidden shrink-0 sm:flex"
          aria-hidden={beltUrls.length === 0}
        >
          {frames.map((frame, i) =>
            frame.type === 'img' ? (
              <div key={`${frame.url}-${i}`} className="dr-film-frame">
                <img src={frame.url} alt="" className="dr-film-frame-inner object-cover" />
              </div>
            ) : (
              <div key={`tone-${i}`} className="dr-film-frame">
                <div className="dr-film-frame-inner" style={{ background: frame.bg }} />
              </div>
            ),
          )}
        </aside>
      </div>

      <p
        className="absolute bottom-5 left-5 z-10 text-[10px] tracking-[0.2em] opacity-50"
        style={{ fontFamily: DR_FONTS.mono }}
      >
        SINCE
        <br />
        DARKROOM
      </p>
      <p
        className="absolute bottom-5 right-5 z-10 text-right text-[10px] tracking-[0.2em] opacity-50"
        style={{ fontFamily: DR_FONTS.mono }}
      >
        RUNNING TIME
        <br />
        35MM REEL
      </p>
    </section>
  )
}
