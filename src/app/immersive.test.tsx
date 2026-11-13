import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'
import { useImmersive } from './immersive'

vi.mock('../audio/sound', () => ({
  play: vi.fn(async () => undefined),
  stopAll: vi.fn(),
  unlockAudio: vi.fn(),
}))

const mounts = vi.fn()

function Page() {
  const [on, setOn] = useState(false)
  useImmersive(on)
  useEffect(() => {
    mounts()
  }, [])
  return (
    <button type="button" onClick={() => setOn((v) => !v)}>
      toggle
    </button>
  )
}

describe('immersive layout', () => {
  it('keeps darkroom home chrome without light header and does not remount on immersive toggle', () => {
    const router = createMemoryRouter([{ path: '/', element: <Layout />, children: [{ index: true, element: <Page /> }] }])
    render(<RouterProvider router={router} />)
    // Home is always darkroom shell — no glass header.
    expect(document.querySelector('header')).toBeNull()
    expect(document.querySelector('[data-shell="immersive"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: '静音' })).toBeNull()
    fireEvent.click(screen.getByText('toggle'))
    expect(document.querySelector('header')).toBeNull()
    expect(document.querySelector('[data-shell="immersive"]')).not.toBeNull()
    fireEvent.click(screen.getByText('toggle'))
    expect(mounts).toHaveBeenCalledTimes(1)
  })
})
