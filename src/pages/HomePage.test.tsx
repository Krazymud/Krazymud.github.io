import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { play } from '../audio/sound'
import { copy } from '../config/copy'
import { site } from '../config/site'
import { ProgressProvider } from '../progress/ProgressProvider'
import { emptyProgress, serializeProgress, STORAGE_KEY } from '../progress/store'
import { resetLoading } from '../scene/loading'
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
    resetLoading()
  })

  it('greets in qinglu copy without garage mods entry', () => {
    renderHome()
    expect(screen.getByText(copy.home.eyebrow)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.home.hello(site.nickname))
    expect(screen.getByRole('link', { name: copy.home.vaultLink })).toBeInTheDocument()
    expect(screen.getByText(copy.home.trialToday)).toBeInTheDocument()
    expect(screen.queryByText('WELCOME BACK')).toBeNull()
    expect(screen.queryByText(/HELLO/)).toBeNull()
    expect(screen.queryByText('今日试炼')).toBeNull()
    expect(screen.queryByRole('button', { name: '改装' })).not.toBeInTheDocument()
  })

  it('taps when she sets off', () => {
    renderHome()
    fireEvent.click(screen.getByRole('link', { name: /出发/ }))
    expect(play).toHaveBeenCalledWith('tap')
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

  it('shows the garage dashboard', () => {
    renderHome()
    expect(screen.getByRole('group', { name: '车库仪表' })).toBeInTheDocument()
  })

  it('folds due reviews into the trial card', () => {
    const today = studyDay(new Date())
    localStorage.setItem(
      STORAGE_KEY,
      serializeProgress({ ...emptyProgress(), words: { alpha: { interval: 1, due: today, lastResult: 'ok', seenCount: 1 } } }),
    )
    renderHome()
    expect(screen.getByRole('link', { name: /今日日课 · 到期 1/ })).toBeInTheDocument()
    expect(screen.queryByText(/到期复习/)).toBeNull()
  })
})
