import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DarkroomCanvas } from '../scene/DarkroomCanvas'
import { CreditsScene } from './CreditsScene'
import { LettersBeat } from './LettersBeat'
import { OpeningScene } from './OpeningScene'
import { BookCoverBeat } from './BookCoverScene'
import { TorchComicBeat } from './TorchComicScene'
import { ApertureMenu } from './ApertureMenu'
import { PolaroidTakeHomeProvider } from './PolaroidTakeHome'
import { ReelRadioHud, ReelRadioProvider } from './ReelRadio'
import { TrayWallBeat } from './TrayWallBeat'
import { REEL_ORDER, type ReelSceneId } from './types'

const HEAVY_SCENES = new Set<ReelSceneId>(['desk', 'trayWall', 'book'])

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

interface ReelContextValue {
  scene: ReelSceneId
  go: (id: ReelSceneId) => void
  next: () => void
}

const ReelContext = createContext<ReelContextValue | null>(null)

export function useReel(): ReelContextValue {
  const ctx = useContext(ReelContext)
  if (!ctx) throw new Error('useReel must be used within ReelStage')
  return ctx
}

interface ReelStageProps {
  children?: ReactNode
}

function HeavySceneShell({ id, mounted, children }: { id: ReelSceneId; mounted: boolean; children: ReactNode }) {
  if (!mounted) return null
  return (
    <div data-testid={`reel-heavy-${id}`}>
      {children}
    </div>
  )
}

export function ReelStage({ children }: ReelStageProps) {
  const [scene, setScene] = useState<ReelSceneId>('opening')
  const [mountedHeavy, setMountedHeavy] = useState<Set<ReelSceneId>>(() => new Set())
  const [veil, setVeil] = useState<{ visible: boolean; tone: 'black' | 'white' } | null>(null)
  const pendingScene = useRef<ReelSceneId | null>(null)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    if (!HEAVY_SCENES.has(scene)) return
    setMountedHeavy((prev) => {
      if (prev.has(scene)) return prev
      const next = new Set(prev)
      next.add(scene)
      return next
    })
  }, [scene])

  const applyScene = useCallback((id: ReelSceneId) => {
    setScene(id)
    if (HEAVY_SCENES.has(id)) {
      setMountedHeavy((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    }
  }, [])

  const transitionTo = useCallback(
    (id: ReelSceneId) => {
      if (id === scene) return
      if (reduced) {
        applyScene(id)
        return
      }
      pendingScene.current = id
      setVeil({ visible: true, tone: 'black' })
    },
    [applyScene, reduced, scene],
  )

  const go = useCallback(
    (id: ReelSceneId) => {
      transitionTo(id)
    },
    [transitionTo],
  )

  const next = useCallback(() => {
    const idx = REEL_ORDER.indexOf(scene)
    const target = REEL_ORDER[Math.min(idx + 1, REEL_ORDER.length - 1)]
    if (target !== scene) transitionTo(target)
  }, [scene, transitionTo])

  useEffect(() => {
    if (!veil?.visible || !pendingScene.current) return
    const target = pendingScene.current
    const holdMs = 220
    const t1 = window.setTimeout(() => {
      applyScene(target)
      pendingScene.current = null
    }, holdMs)
    const t2 = window.setTimeout(() => setVeil(null), holdMs * 2)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [veil, applyScene])

  const value = useMemo(() => ({ scene, go, next }), [scene, go, next])

  const deskMounted = mountedHeavy.has('desk')
  const trayMounted = mountedHeavy.has('trayWall')
  const bookMounted = mountedHeavy.has('book')

  return (
    <PolaroidTakeHomeProvider>
      <ReelRadioProvider>
      <ReelContext.Provider value={value}>
      <div data-testid="reel-scene" data-scene={scene} className="relative">
        {scene === 'opening' && <OpeningScene onContinue={next} beltUrls={[]} />}
        {scene === 'letters' && <LettersBeat />}
        {scene === 'torch' && <TorchComicBeat />}
        {scene === 'credits' && <CreditsScene onContinue={() => go('desk')} stillUrls={[]} />}

        <HeavySceneShell id="desk" mounted={deskMounted}>
          <div
            className={
              scene === 'desk'
                ? 'fixed inset-0 z-0'
                : 'pointer-events-none fixed inset-0 z-0 invisible'
            }
            aria-hidden={scene !== 'desk'}
          >
            <DarkroomCanvas frameloop={scene === 'desk' ? 'always' : 'never'} />
            {scene === 'desk' && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
                <button
                  type="button"
                  className="pointer-events-auto border border-accent-hi bg-black/60 px-4 py-2 text-sm text-fg"
                  onClick={next}
                >
                  下一幕
                </button>
              </div>
            )}
          </div>
        </HeavySceneShell>

        <HeavySceneShell id="trayWall" mounted={trayMounted}>
          {scene === 'trayWall' ? <TrayWallBeat /> : null}
        </HeavySceneShell>

        <HeavySceneShell id="book" mounted={bookMounted}>
          {scene === 'book' ? <BookCoverBeat /> : null}
        </HeavySceneShell>

        {children}

        <ApertureMenu />
        <ReelRadioHud />

        {veil && !reduced ? (
          <div
            data-testid="reel-veil"
            data-tone={veil.tone}
            className="pointer-events-none fixed inset-0 z-[200] transition-opacity duration-[220ms]"
            style={{
              backgroundColor: veil.tone === 'white' ? '#fff' : '#000',
              opacity: veil.visible ? 1 : 0,
            }}
            aria-hidden
          />
        ) : null}
      </div>
    </ReelContext.Provider>
      </ReelRadioProvider>
    </PolaroidTakeHomeProvider>
  )
}
