import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { DaySession } from '../../progress/store'
import { ResultPanel } from './ResultPanel'

const session: DaySession = {
  day: '2026-10-09',
  items: [
    { word: 'alpha', kind: 'new' },
    { word: 'bravo', kind: 'new' },
  ],
  cursor: 2,
  correct: 2,
  combo: 2,
  bestCombo: 2,
  startedAt: 0,
  finishedAt: 7_000_000,
}

function renderPanel(value: DaySession) {
  render(
    <MemoryRouter>
      <ResultPanel session={value} dueTomorrow={0} mastered={0} />
    </MemoryRouter>,
  )
}

describe('ResultPanel', () => {
  it('shows the active answering time as the lap time', () => {
    renderPanel({ ...session, activeMs: 83_000 })
    expect(screen.getByText('1:23')).toBeInTheDocument()
  })

  it('shows a zero lap time when no active time was recorded', () => {
    renderPanel(session)
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })
})
