import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
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

export function DarkroomCanvas() {
  const { rolls } = useDarkroomVault()
  const [focus, setFocus] = useState<FocusId>('desk')
  const [syncOpen, setSyncOpen] = useState(false)
  const [lost, setLost] = useState(false)
  const [camera] = useState(initialCamera)
  const close = () => setFocus('desk')
  const openSync = () => setSyncOpen(true)

  return (
    <div className="fixed inset-0 bg-[#050403]" data-focus={focus}>
      <SceneErrorBoundary lost={lost}>
        <Canvas
          camera={camera}
          dpr={[1, 2]}
          shadows
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (event) => {
              event.preventDefault()
              setLost(true)
            })
          }}
        >
          <color attach="background" args={['#050403']} />
          <DeskScene onFocus={setFocus} rolls={rolls} />
          <CameraRig focus={focus} />
        </Canvas>
      </SceneErrorBoundary>
      {(focus === 'rolls' || focus === 'lightbox') && <FilmOverlay key={focus} mode={focus} onClose={close} />}
      {focus === 'tray' && <TrayOverlay onClose={close} onNeedGate={openSync} />}
      {focus === 'viewer' && <ViewerOverlay onClose={close} />}
      <SyncDrawer open={syncOpen} onOpenChange={setSyncOpen} />
      {focus === 'envelope' && <LetterOverlay onClose={close} onNeedGate={openSync} />}
    </div>
  )
}
