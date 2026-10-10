import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { play } from '../audio/sound'
import { ProgressProvider } from '../progress/ProgressProvider'
import { emptyProgress, serializeProgress, STORAGE_KEY } from '../progress/store'
import { studyDay } from '../trial/day'
import { HomePage } from './HomePage'

vi.mock('../audio/sound', () => ({ play: vi.fn(async () => undefined) }))

function renderHome() {
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
}

describe('HomePage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(play).mockClear()
  })

  it('blips the throttle when she sets off', () => {
    renderHome()
    fireEvent.click(screen.getByRole('link', { name: /出发/ }))
    expect(play).toHaveBeenCalledWith('blip')
  })

  it('stays quiet when she only looks at a finished lap', async () => {
    const session = {
      day: studyDay(new Date()),
      items: [{ word: 'alpha', kind: 'new' as const }],
      cursor: 1,
      correct: 1,
      combo: 1,
      bestCombo: 1,
      startedAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, serializeProgress({ ...emptyProgress(), session }))
    renderHome()
    fireEvent.click(screen.getByRole('link', { name: /看结算/ }))
    expect(await screen.findByText('赛道')).toBeInTheDocument()
    expect(play).not.toHaveBeenCalled()
  })
})
