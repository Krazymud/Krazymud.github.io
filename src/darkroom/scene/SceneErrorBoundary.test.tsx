import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../../config/copy'
import { SceneErrorBoundary } from './SceneErrorBoundary'

function Boom(): never {
  throw new Error('Error creating WebGL context.')
}

describe('SceneErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows a Chinese error page when the scene throws', () => {
    render(
      <SceneErrorBoundary>
        <Boom />
      </SceneErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(copy.darkroom.webglTitle)
    expect(screen.getByText(copy.darkroom.reload)).toBeTruthy()
  })

  it('shows the error page when the context was lost', () => {
    render(
      <SceneErrorBoundary lost>
        <p>scene</p>
      </SceneErrorBoundary>,
    )
    expect(screen.getByTestId('scene-unavailable')).toBeTruthy()
    expect(screen.queryByText('scene')).toBeNull()
  })

  it('renders children when nothing fails', () => {
    render(
      <SceneErrorBoundary>
        <p>scene</p>
      </SceneErrorBoundary>,
    )
    expect(screen.getByText('scene')).toBeTruthy()
  })
})
