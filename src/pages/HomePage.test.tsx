import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { play } from '../audio/sound'
import { ProgressProvider } from '../progress/ProgressProvider'
import { HomePage } from './HomePage'

vi.mock('../audio/sound', () => ({ play: vi.fn(async () => undefined) }))

describe('HomePage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(play).mockClear()
  })

  it('blips the throttle when she sets off', () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <HomePage /> },
        { path: '/trial', element: <p>赛道</p> },
      ],
      { initialEntries: ['/'] },
    )
    render(
      <ProgressProvider>
        <RouterProvider router={router} />
      </ProgressProvider>,
    )
    fireEvent.click(screen.getByRole('link', { name: /出发/ }))
    expect(play).toHaveBeenCalledWith('blip')
  })
})
