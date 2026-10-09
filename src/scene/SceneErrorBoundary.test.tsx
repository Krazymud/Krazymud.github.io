import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SceneErrorBoundary } from './SceneErrorBoundary'

function Boom(): never {
  throw new Error('boom')
}

describe('SceneErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders its children when nothing goes wrong', () => {
    render(
      <SceneErrorBoundary onError={() => {}}>
        <p>car</p>
      </SceneErrorBoundary>,
    )
    expect(screen.getByText('car')).toBeInTheDocument()
  })

  it('reports the error and renders nothing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    const { container } = render(
      <SceneErrorBoundary onError={onError}>
        <Boom />
      </SceneErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(container).toBeEmptyDOMElement()
  })
})
