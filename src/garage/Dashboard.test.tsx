import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Dashboard } from './Dashboard'
import type { GarageStats } from './stats'

const base: GarageStats = { streak: 9, week: [true, true, false, true, true, true, false], todayDone: false, mastered: 128, due: 4 }

describe('Dashboard', () => {
  it('reads out the streak, the week and the mastered words', () => {
    render(<Dashboard stats={base} />)
    const panel = within(screen.getByRole('group', { name: '车库仪表' }))
    expect(panel.getByRole('meter', { name: '连续打卡 9 天' })).toHaveAttribute('aria-valuenow', '9')
    expect(panel.getByRole('meter', { name: '已掌握 128 个词' })).toHaveAttribute('aria-valuenow', '128')
    expect(panel.getByRole('img', { name: '最近 7 天打卡 5 天' })).toBeInTheDocument()
  })

  it('fills the streak ring a week at a time', () => {
    const { rerender } = render(<Dashboard stats={{ ...base, streak: 9 }} />)
    expect(screen.getByTestId('ring-streak')).toHaveAttribute('data-fill', String(2 / 7))
    rerender(<Dashboard stats={{ ...base, streak: 14 }} />)
    expect(screen.getByTestId('ring-streak')).toHaveAttribute('data-fill', '1')
    rerender(<Dashboard stats={{ ...base, streak: 0 }} />)
    expect(screen.getByTestId('ring-streak')).toHaveAttribute('data-fill', '0')
  })

  it('fills the mastered ring towards the next hundred', () => {
    render(<Dashboard stats={base} />)
    expect(screen.getByTestId('ring-mastered')).toHaveAttribute('data-fill', '0.28')
  })

  it('breathes on today until the lap is done', () => {
    const { rerender } = render(<Dashboard stats={base} />)
    expect(screen.getByTestId('day-6')).toHaveClass('animate-breathe')
    rerender(<Dashboard stats={{ ...base, todayDone: true, week: [...base.week.slice(0, 6), true] }} />)
    expect(screen.getByTestId('day-6')).not.toHaveClass('animate-breathe')
  })
})
