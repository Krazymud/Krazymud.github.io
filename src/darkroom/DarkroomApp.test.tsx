import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../config/copy'
import { makeTestVault, TEST_PASSPHRASE } from '../vault/testVault'
import { DarkroomApp } from './DarkroomApp'

vi.mock('../audio/sound', () => ({ play: vi.fn(async () => undefined) }))

async function enter(passphrase: string) {
  fireEvent.change(await screen.findByLabelText('口令'), { target: { value: passphrase } })
  fireEvent.submit(screen.getByLabelText('口令').closest('form')!)
}

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="r3f-canvas" />,
  useFrame: () => undefined,
  useThree: () => undefined,
}))

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
})

afterEach(() => vi.unstubAllGlobals())

describe('DarkroomApp', () => {
  afterEach(() => localStorage.clear())

  it('shows unlock then ready after successful passphrase', async () => {
    const vault = await makeTestVault()
    render(<DarkroomApp fetchBytes={vault.fetchBytes} keyStore={null} webStore={null} />)
    expect(await screen.findByLabelText('口令')).toBeTruthy()
    expect(screen.queryByTestId('darkroom-ready')).toBeNull()
    await enter(TEST_PASSPHRASE)
    expect(await screen.findByTestId('darkroom-ready')).toBeInTheDocument()
    expect(screen.getByTestId('note-count').textContent).toBe('1')
  })

  it('stays locked on a wrong passphrase', async () => {
    const vault = await makeTestVault()
    render(<DarkroomApp fetchBytes={vault.fetchBytes} keyStore={null} />)
    await enter('wrong wrong wrong wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent('口令不对')
    expect(screen.queryByTestId('darkroom-ready')).toBeNull()
  })

  it('shows empty notice when vault is missing', async () => {
    render(<DarkroomApp fetchBytes={async () => null} keyStore={null} />)
    expect(await screen.findByText(copy.darkroom.empty)).toBeInTheDocument()
  })
})

describe('DarkroomApp lock', () => {
  it('returns to unlock and clears the key store', async () => {
    const vault = await makeTestVault()
    const keyStore = { load: vi.fn(async () => null), save: vi.fn(async () => undefined), clear: vi.fn(async () => undefined) }
    render(<DarkroomApp fetchBytes={vault.fetchBytes} keyStore={keyStore as never} webStore={null} />)
    await enter(TEST_PASSPHRASE)
    await screen.findByTestId('darkroom-ready')
    fireEvent.click(screen.getByRole('button', { name: /启封卷轴|启卷|继续/i }))
    fireEvent.click(screen.getByRole('button', { name: /继续/i }))
    fireEvent.click(await screen.findByText('上锁'))
    expect(await screen.findByLabelText('口令')).toBeTruthy()
    expect(keyStore.clear).toHaveBeenCalled()
    expect(screen.queryByTestId('darkroom-ready')).toBeNull()
  })
})
