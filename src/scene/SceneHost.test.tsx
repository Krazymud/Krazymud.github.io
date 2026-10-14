import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getLoading, resetLoading } from './loading'
import { SceneHost } from './SceneHost'

describe('SceneHost', () => {
  beforeEach(() => resetLoading())

  it('marks home route on garage for drive loop', () => {
    render(<SceneHost scene="garage" />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-route', 'home')
  })

  it.each(['garage', 'vault', 'track'] as const)('renders the sketch backdrop in the %s without 3D or dim overlay', async (scene) => {
    render(<SceneHost scene={scene} />)
    expect(screen.getByTestId('sketch-stage')).toBeInTheDocument()
    expect(document.querySelector('canvas')).toBeNull()
    expect(screen.queryByTestId('scene-dim')).toBeNull()
    await waitFor(() => expect(getLoading()).toEqual({ kind: 'still', fraction: 1 }))
  })
})
