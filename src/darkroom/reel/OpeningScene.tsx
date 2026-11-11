import { copy } from '../../config/copy'
import { DR_COLORS, DR_FONTS } from '../theme'

export interface OpeningSceneProps {
  onContinue: () => void
  beltUrls: string[]
}

const PLACEHOLDER_TONES = ['#2a2420', '#1c1a18', '#32302c', '#242220']

export function OpeningScene({ onContinue, beltUrls }: OpeningSceneProps) {
  const frames =
    beltUrls.length > 0
      ? beltUrls.map((url) => ({ type: 'img' as const, url }))
      : PLACEHOLDER_TONES.map((bg) => ({ type: 'tone' as const, bg }))

  return (
    <section data-testid="opening-scene" className="dr-stage relative min-h-dvh overflow-hidden" style={{ background: DR_COLORS.ink, color: DR_COLORS.cream }}>
      <div className="dr-proj">
        <div className="dr-proj-spill" aria-hidden />
        <div className="dr-proj-frame">
          <div className="dr-opening-beam" aria-hidden />
          <div className="dr-opening-shadow" aria-hidden />
          <div className="dr-opening-zap z1" aria-hidden />
          <div className="dr-opening-zap z2" aria-hidden />
          <div className="dr-opening-weave" aria-hidden />
          <div className="dr-opening-mottle" aria-hidden />
          <div className="dr-opening-specks" aria-hidden />
          <div className="dr-opening-grain" aria-hidden />
          <div className="dr-opening-vig" aria-hidden />

          <aside className="dr-opening-log mono" aria-hidden>
            <p>
              DARKROOM V.01 — {copy.siteName.toUpperCase()}
              <br />
              400 · 24 EXP · REEL 1
              <br />
              <br />
              THREADING FILM ........... OK
              <br />
              WARMING THE LAMP .......... OK
              <br />
              FRAMES READY .............. OK
            </p>
          </aside>

          <div className="dr-opening-title">
            <h1 style={{ fontFamily: DR_FONTS.display }}>{copy.siteName}</h1>
            <p className="sub" style={{ fontFamily: DR_FONTS.display }}>
              {copy.darkroom.tagline}
            </p>
          </div>

          <button type="button" className="dr-opening-mark" onClick={onContinue} style={{ fontFamily: DR_FONTS.hand, color: DR_COLORS.accent }}>
            {copy.darkroom.openingCtaHand}
          </button>

          <aside data-testid="opening-belt" className="dr-opening-strip" aria-hidden={beltUrls.length === 0}>
            <div className="dr-opening-belt">
              {[...frames, ...frames].map((frame, i) =>
                frame.type === 'img' ? (
                  <div key={`${frame.url}-${i}`} className="dr-opening-fr">
                    <img src={frame.url} alt="" className="img" />
                  </div>
                ) : (
                  <div key={`tone-${i}`} className="dr-opening-fr">
                    <div className="img" style={{ background: frame.bg }} />
                  </div>
                ),
              )}
            </div>
          </aside>

          <p className="dr-opening-corner bl mono">
            SINCE
            <br />
            DARKROOM
          </p>
          <p className="dr-opening-corner br mono">
            RUNNING TIME
            <br />
            35MM REEL
          </p>
        </div>
      </div>
    </section>
  )
}
