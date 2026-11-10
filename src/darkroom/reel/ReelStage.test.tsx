import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReelStage, useReel } from './ReelStage'

vi.mock('../scene/DarkroomCanvas', () => ({
  DarkroomCanvas: () => <div data-testid="darkroom-canvas" />,
}))

vi.mock('../VaultBridge', () => ({
  useDarkroomVault: () => ({
    notes: [],
    photos: [],
    readBlob: vi.fn(),
    loading: false,
    lock: vi.fn(),
    unsynced: false,
    syncing: false,
    tokenSaved: false,
    retrySync: vi.fn(),
  }),
}))

const cta = /启封卷轴|启卷|继续|略过|roll/i

function stubReducedMotion(reduced: boolean) {
  const matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  vi.stubGlobal('matchMedia', matchMedia)
}

function GoDesk() {
  const { go } = useReel()
  return (
    <button type="button" onClick={() => go('desk')}>
      jump-desk
    </button>
  )
}

describe('ReelStage', () => {
  beforeEach(() => stubReducedMotion(true))

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts on opening and advances on CTA', () => {
    render(<ReelStage />)
    expect(screen.getByTestId('reel-scene')).toHaveAttribute('data-scene', 'opening')
    fireEvent.click(screen.getByRole('button', { name: cta }))
    expect(screen.getByTestId('reel-scene')).toHaveAttribute('data-scene', 'letters')
  })

  it('lazy-mounts heavy scenes only when active', () => {
    render(<ReelStage />)
    expect(screen.queryByTestId('darkroom-canvas')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: cta }))
    expect(screen.queryByTestId('darkroom-canvas')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: cta }))
    expect(screen.getByTestId('darkroom-canvas')).toBeInTheDocument()
  })

  it('renders LettersBeat after opening', () => {
    render(<ReelStage />)
    fireEvent.click(screen.getByRole('button', { name: /启封卷轴|启卷|roll/i }))
    expect(screen.getByTestId('letters-beat')).toBeInTheDocument()
  })

  it('shows 下一幕 on desk scene', () => {
    render(<ReelStage />)
    fireEvent.click(screen.getByRole('button', { name: /启封卷轴|启卷|roll/i }))
    fireEvent.click(screen.getByRole('button', { name: /略过/i }))
    expect(screen.getByRole('button', { name: '下一幕' })).toBeInTheDocument()
  })

  it('exposes go() via useReel', () => {
    render(
      <ReelStage>
        <GoDesk />
      </ReelStage>,
    )
    fireEvent.click(screen.getByRole('button', { name: /jump-desk/i }))
    expect(screen.getByTestId('reel-scene')).toHaveAttribute('data-scene', 'desk')
  })

  it('skips veil animation when prefers-reduced-motion', async () => {
    stubReducedMotion(true)
    render(<ReelStage />)
    fireEvent.click(screen.getByRole('button', { name: cta }))
    await waitFor(() => {
      expect(screen.getByTestId('reel-scene')).toHaveAttribute('data-scene', 'letters')
    })
    expect(screen.queryByTestId('reel-veil')).toBeNull()
  })

  it('shows veil between scenes when motion is allowed', async () => {
    vi.useFakeTimers()
    try {
      stubReducedMotion(false)
      render(<ReelStage />)
      fireEvent.click(screen.getByRole('button', { name: cta }))
      expect(screen.getByTestId('reel-veil')).toBeInTheDocument()
      await act(async () => {
        await vi.runAllTimersAsync()
      })
      expect(screen.getByTestId('reel-scene')).toHaveAttribute('data-scene', 'letters')
    } finally {
      vi.useRealTimers()
    }
  })
})
