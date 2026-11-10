import { copy } from '../../config/copy'
import { DR_COLORS, DR_FONTS } from '../theme'

export interface OpeningSceneProps {
  onContinue: () => void
  beltUrls: string[]
}

export function OpeningScene({ onContinue, beltUrls }: OpeningSceneProps) {
  const meta = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <section
      data-testid="opening-scene"
      className="dr-opening relative flex min-h-[72vh] items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: DR_COLORS.bg, color: DR_COLORS.cream }}
    >
      <div className="dr-opening-bokeh" aria-hidden />
      <div className="dr-opening-specks" aria-hidden />
      <p
        className="absolute left-4 top-4 text-[10px] tracking-[0.2em] opacity-70"
        style={{ fontFamily: DR_FONTS.mono }}
      >
        ROLL 01
      </p>
      <p
        className="absolute right-4 top-4 text-[10px] tracking-[0.15em] opacity-70"
        style={{ fontFamily: DR_FONTS.mono }}
      >
        {meta}
      </p>
      <p
        className="absolute bottom-4 left-4 text-[10px] tracking-[0.2em] opacity-50"
        style={{ fontFamily: DR_FONTS.mono }}
      >
        DARKROOM
      </p>
      <p
        className="absolute bottom-4 right-4 text-[10px] tracking-[0.15em] opacity-50"
        style={{ fontFamily: DR_FONTS.mono }}
      >
        35MM
      </p>

      <div className="relative z-10 flex w-full max-w-3xl items-center justify-center gap-6 sm:gap-10">
        <aside
          data-testid="opening-belt"
          className="hidden max-h-[min(52vh,420px)] shrink-0 flex-col gap-2 overflow-y-auto sm:flex"
          aria-hidden={beltUrls.length === 0}
        >
          {beltUrls.map((url, i) => (
            <img key={`${url}-${i}`} src={url} alt="" className="dr-opening-frame h-24 w-16 object-cover" />
          ))}
        </aside>

        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-5xl font-normal tracking-[0.08em] sm:text-6xl" style={{ fontFamily: DR_FONTS.display }}>
            {copy.siteName}
          </h1>
          <button
            type="button"
            onClick={onContinue}
            className="border px-10 py-2 text-2xl transition-opacity hover:opacity-90"
            style={{
              fontFamily: DR_FONTS.hand,
              borderColor: DR_COLORS.accent,
              color: DR_COLORS.cream,
            }}
          >
            {copy.darkroom.openingCta}
          </button>
        </div>
      </div>
    </section>
  )
}
