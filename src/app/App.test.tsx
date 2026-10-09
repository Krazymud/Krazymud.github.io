import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { ProgressProvider } from '../progress/ProgressProvider'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>,
  )
}

describe('app shell', () => {
  beforeEach(() => localStorage.clear())

  it('greets her in the garage with today\'s trial status', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('HELLO, YOU')
    expect(screen.getByText('0 / 20')).toBeInTheDocument()
    expect(screen.getByText('到期复习 0 个')).toBeInTheDocument()
  })

  it('switches to the gold theme inside the vault', () => {
    renderAt('/vault')
    expect(document.querySelector('[data-theme="vault"]')).not.toBeNull()
    expect(screen.getByText('保险库将在下一阶段开放。')).toBeInTheDocument()
  })

  it('redirects unknown paths to the garage', async () => {
    renderAt('/2018/09/05/leetcode05/')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('HELLO, YOU')
  })
})
