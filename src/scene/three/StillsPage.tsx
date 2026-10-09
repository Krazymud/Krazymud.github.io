import { useSearchParams } from 'react-router'
import { SceneErrorBoundary } from '../SceneErrorBoundary'
import type { Scene } from '../types'
import { Stage } from './Stage'

const SCENES: Scene[] = ['garage', 'track', 'vault', 'settings']

function reportFailure(reason: string) {
  document.body.dataset.stillError = reason
}

export function StillsPage() {
  const [params] = useSearchParams()
  const requested = params.get('scene')
  const scene = SCENES.find((candidate) => candidate === requested) ?? 'garage'
  return (
    <div className="fixed inset-0 bg-ink">
      <SceneErrorBoundary onError={(error) => reportFailure(error instanceof Error ? error.message : String(error))}>
        <Stage
          scene={scene}
          deterministic={!params.has('live')}
          onReady={() => {
            document.body.dataset.stillReady = 'true'
          }}
          onFail={reportFailure}
        />
      </SceneErrorBoundary>
    </div>
  )
}
