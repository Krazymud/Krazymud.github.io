import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { clarityToDpr, onClarityChange, onLightModeChange, readClarity, readLightMode } from '../reel/reelPrefs'
import * as THREE from 'three'
import { CAMERA_FOV, anchorForFocus, type FocusId } from './cameraFocus'
import { CameraRig } from './CameraRig'
import { FilmOverlay } from '../overlays/FilmStrip'
import { LetterOverlay } from '../overlays/LetterOverlay'
import { SyncDrawer } from '../overlays/SyncDrawer'
import { TrayOverlay } from '../overlays/TrayOverlay'
import { ViewerOverlay } from '../overlays/ViewerOverlay'
import { useDarkroomVault } from '../VaultBridge'
import { DeskScene } from './DeskScene'
import { SceneErrorBoundary } from './SceneErrorBoundary'

function initialCamera() {
  const aspect = typeof window === 'undefined' ? undefined : window.innerWidth / Math.max(1, window.innerHeight)
  const { position } = anchorForFocus('desk', aspect)
  return { position, fov: CAMERA_FOV }
}

type FrameLoop = 'always' | 'demand' | 'never'

export function DarkroomCanvas({ frameloop = 'always' }: { frameloop?: FrameLoop }) {
  const { rolls } = useDarkroomVault()
  const [focus, setFocus] = useState<FocusId>('desk')
  const [activeRollId, setActiveRollId] = useState<string | null>(null)
  const [syncOpen, setSyncOpen] = useState(false)
  const [lost, setLost] = useState(false)
  const [camera] = useState(initialCamera)
  const [dpr, setDpr] = useState(() => clarityToDpr(readClarity()))
  const [shadows, setShadows] = useState(() => readLightMode() === 'full')

  useEffect(() => onClarityChange((level) => setDpr(clarityToDpr(level))), [])
  useEffect(() => onLightModeChange((mode) => setShadows(mode === 'full')), [])

  const close = () => {
    setFocus('desk')
    setActiveRollId(null)
  }
  const openSync = () => setSyncOpen(true)

  return (
    <div className="fixed inset-0 bg-[#0b0705]" data-focus={focus}>
      <SceneErrorBoundary lost={lost}>
        <Canvas
          frameloop={frameloop}
          camera={camera}
          dpr={dpr}
          shadows={shadows}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.05
            gl.outputColorSpace = THREE.SRGBColorSpace
            gl.domElement.addEventListener('webglcontextlost', (event) => {
              event.preventDefault()
              setLost(true)
            })
          }}
        >
          <color attach="background" args={['#0b0705']} />
          <DeskScene onFocus={setFocus} rolls={rolls} focus={focus} activeRollId={activeRollId} />
          <CameraRig focus={focus} />
        </Canvas>
        <div className="dr-vig" aria-hidden />
        <div className="dr-grain" aria-hidden />
      </SceneErrorBoundary>
      {(focus === 'rolls' || focus === 'lightbox') && (
        <FilmOverlay
          key={focus}
          mode={focus}
          onClose={close}
          activeRollId={activeRollId}
          onActiveRollIdChange={setActiveRollId}
        />
      )}
      {focus === 'tray' && <TrayOverlay onClose={close} onNeedGate={openSync} />}
      {focus === 'viewer' && <ViewerOverlay onClose={close} />}
      <SyncDrawer open={syncOpen} onOpenChange={setSyncOpen} />
      {focus === 'envelope' && <LetterOverlay onClose={close} onNeedGate={openSync} />}
    </div>
  )
}
