import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgressProvider } from '../progress/ProgressProvider'
import { STORAGE_KEY } from '../progress/store'
import { TrialScreen } from './TrialScreen'
import type { Word } from './types'
import type { WordSource } from './wordsRepo'

const WORDS: Word[] = [
  { w: 'alpha', p: 'ˈælfə', pos: 'n.', m: 'n. 阿尔法' },
  { w: 'bravo', p: 'ˈbrɑːvəʊ', pos: 'n.', m: 'n. 喝彩' },
  { w: 'charlie', p: 'ˈtʃɑːli', pos: 'n.', m: 'n. 查理' },
  { w: 'delta', p: 'ˈdeltə', pos: 'n.', m: 'n. 三角洲' },
  { w: 'echo', p: 'ˈekəʊ', pos: 'n.', m: 'n. 回声' },
]

const source: WordSource = {
  order: WORDS.map((w) => w.w),
  lookup: async (words) => new Map(WORDS.filter((w) => words.includes(w.w)).map((w) => [w.w, { word: w, pool: WORDS }])),
}

function renderTrial() {
  const router = createMemoryRouter(
    [{ path: '/', element: <TrialScreen source={source} now={() => new Date(2026, 9, 9, 12)} /> }],
    { initialEntries: ['/'] },
  )
  render(
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>,
  )
}

function options() {
  return within(screen.getByRole('list')).getAllByRole('button')
}

function saved() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!)
}

describe('TrialScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('grades a correct answer as good when 会了 is pressed', async () => {
    renderTrial()
    await screen.findByRole('heading', { name: 'alpha' })
    fireEvent.click(options().find((b) => b.textContent?.includes('阿尔法'))!)
    fireEvent.click(await screen.findByRole('button', { name: '会了' }))
    await screen.findByRole('heading', { name: 'bravo' })
    expect(saved().words.alpha).toMatchObject({ interval: 7, due: '2026-10-16', lastResult: 'good' })
  })

  it('defaults a correct answer to ok after 4 seconds', async () => {
    renderTrial()
    await screen.findByRole('heading', { name: 'alpha' })
    fireEvent.click(options().find((b) => b.textContent?.includes('阿尔法'))!)
    await screen.findByRole('button', { name: '还行' })
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    await screen.findByRole('heading', { name: 'bravo' })
    expect(saved().words.alpha).toMatchObject({ interval: 3, lastResult: 'ok' })
  })

  it('grades a wrong answer as again and moves on after 1.5 seconds', async () => {
    renderTrial()
    await screen.findByRole('heading', { name: 'alpha' })
    fireEvent.click(options().find((b) => !b.textContent?.includes('阿尔法'))!)
    expect(screen.queryByRole('button', { name: '会了' })).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    await screen.findByRole('heading', { name: 'bravo' })
    expect(saved().words.alpha).toMatchObject({ interval: 1, lastResult: 'again' })
  })

  it('answers with number keys', async () => {
    renderTrial()
    await screen.findByRole('heading', { name: 'alpha' })
    const index = options().findIndex((b) => b.textContent?.includes('阿尔法'))
    fireEvent.keyDown(window, { key: String(index + 1) })
    expect(await screen.findByRole('button', { name: '会了' })).toBeInTheDocument()
  })

  it('shows the lap summary after the last word', async () => {
    renderTrial()
    for (const word of WORDS) {
      await screen.findByRole('heading', { name: word.w })
      fireEvent.click(options().find((b) => b.textContent?.includes(word.m.slice(3)))!)
      fireEvent.click(await screen.findByRole('button', { name: '会了' }))
    }
    expect(await screen.findByText('圈速')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(saved().history).toHaveLength(1)
  })
})
