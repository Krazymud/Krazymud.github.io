import { copy } from '../../config/copy'
import { DR_COLORS, DR_FONTS } from '../theme'

export interface CreditsSceneProps {
  onContinue: () => void
  stillUrls?: string[]
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function CreditsScene({ onContinue, stillUrls = [] }: CreditsSceneProps) {
  const reduced = prefersReducedMotion()

  return (
    <section
      data-testid="credits-scene"
      data-rollup={reduced ? 'static' : 'scroll'}
      aria-label="片尾"
      className="dr-credits relative flex min-h-[60vh] flex-col items-center justify-center px-6 py-16"
      style={{ background: DR_COLORS.bg, color: DR_COLORS.cream }}
    >
      <div className="dr-opening-specks pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div
        className={`relative z-10 flex max-h-[50vh] w-full max-w-md flex-col items-center gap-4 ${reduced ? '' : 'dr-credits-scroll'}`}
        role="list"
      >
        {copy.darkroom.creditsLines.map((line) => (
          <p
            key={line}
            role="listitem"
            className="text-center text-sm tracking-[0.12em] sm:text-base"
            style={{ fontFamily: DR_FONTS.display }}
          >
            {line}
          </p>
        ))}
        <p className="mt-4 text-lg" style={{ fontFamily: DR_FONTS.hand, color: DR_COLORS.accent }}>
          {copy.darkroom.creditsSignoff}
        </p>
      </div>

      {stillUrls.length > 0 ? (
        <div data-testid="credits-stills" className="relative z-10 mt-8 flex flex-wrap justify-center gap-2">
          {stillUrls.map((url, i) => (
            <img key={`${url}-${i}`} src={url} alt="" className="dr-opening-frame h-20 w-16 object-cover opacity-80" />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onContinue}
        className="relative z-10 mt-10 border px-8 py-2 text-sm"
        style={{ fontFamily: DR_FONTS.mono, borderColor: DR_COLORS.cream, color: DR_COLORS.cream }}
      >
        {copy.darkroom.reelContinue}
      </button>
    </section>
  )
}
