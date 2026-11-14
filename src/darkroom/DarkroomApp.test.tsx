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
    const opening = screen.getByTestId('film-opening')
    expect(opening.querySelector('iframe')?.getAttribute('src')).toContain('/reel-shell/index.html')
    expect(screen.getByRole('dialog', { name: '请输入口令' })).toBeInTheDocument()
    await enter(TEST_PASSPHRASE)
    expect(await screen.findByTestId('darkroom-ready')).toBeInTheDocument()
    expect(await screen.findByTestId('reel-shell')).toBeInTheDocument()
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

  it('saves the key after unlock and shows no remember checkbox', async () => {
    const vault = await makeTestVault()
    const keyStore = {
      load: vi.fn(async () => null),
      save: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    }
    render(<DarkroomApp fetchBytes={vault.fetchBytes} keyStore={keyStore} webStore={null} />)
    await screen.findByLabelText('口令')
    expect(screen.queryByText('在这台设备上记住')).toBeNull()
    await enter(TEST_PASSPHRASE)
    expect(await screen.findByTestId('darkroom-ready')).toBeInTheDocument()
    expect(keyStore.save).toHaveBeenCalledTimes(1)
    expect(keyStore.save).toHaveBeenCalledWith(vault.dek)
  })

  it('opens the film when the saved key still unwraps the vault', async () => {
    const vault = await makeTestVault()
    const keyStore = {
      load: vi.fn(async () => vault.dek),
      save: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    }
    render(<DarkroomApp fetchBytes={vault.fetchBytes} keyStore={keyStore} webStore={null} />)
    expect(await screen.findByTestId('darkroom-ready')).toBeInTheDocument()
    expect(screen.queryByLabelText('口令')).toBeNull()
  })
})

describe('DarkroomApp chrome', () => {
  it('does not float a lock button over the reel', async () => {
    const vault = await makeTestVault()
    render(<DarkroomApp fetchBytes={vault.fetchBytes} keyStore={null} webStore={null} />)
    await enter(TEST_PASSPHRASE)
    await screen.findByTestId('reel-shell')
    expect(screen.queryByRole('button', { name: '锁上' })).toBeNull()
  })
})
