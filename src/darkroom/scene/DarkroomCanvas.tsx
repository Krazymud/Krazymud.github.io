import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { CameraRig } from './CameraRig'
import type { FocusId } from './cameraFocus'
import { FilmOverlay } from '../overlays/FilmStrip'
import { LetterOverlay } from '../overlays/LetterOverlay'
import { SyncDrawer } from '../overlays/SyncDrawer'
import { TrayOverlay } from '../overlays/TrayOverlay'
import { DeskScene } from './DeskScene'

export function DarkroomCanvas() {
  const [focus, setFocus] = useState<FocusId>('desk')
  return (
    <div className="fixed inset-0" data-focus={focus}>
      <Canvas camera={{ position: [0, 3.2, 4.6], fov: 50 }} dpr={[1, 2]} shadows gl={{ antialias: true }}>
        <color attach="background" args={['#050403']} />
        <DeskScene onFocus={setFocus} />
        <CameraRig focus={focus} />
      </Canvas>
      {(focus === 'rolls' || focus === 'lightbox') && <FilmOverlay key={focus} mode={focus} onClose={() => setFocus('desk')} />}
      {focus === 'tray' && <TrayOverlay onClose={() => setFocus('desk')} />}
      <SyncDrawer />
      {focus === 'envelope' && <LetterOverlay onClose={() => setFocus('desk')} />}
    </div>
  )
}
