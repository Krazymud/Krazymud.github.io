import { Component, type ErrorInfo, type ReactNode } from 'react'
import { copy } from '../../config/copy'

export function SceneUnavailable() {
  return (
    <div role="alert" data-testid="scene-unavailable" className="absolute inset-0 flex items-center justify-center p-6">
      <div className="dr-panel max-w-sm p-6 text-center">
        <p className="font-display text-base">{copy.darkroom.webglTitle}</p>
        <p className="dr-muted mt-3 text-sm leading-relaxed">{copy.darkroom.webglBody}</p>
        <button type="button" onClick={() => window.location.reload()} className="dr-btn mt-5 px-5 py-2 text-sm">
          {copy.darkroom.reload}
        </button>
      </div>
    </div>
  )
}

interface Props {
  children: ReactNode
  lost?: boolean
}

export class SceneErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('darkroom scene failed', error, info.componentStack)
  }

  render() {
    if (this.state.failed || this.props.lost) return <SceneUnavailable />
    return this.props.children
  }
}
