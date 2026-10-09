import { act, fireEvent, render, screen } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HOLD_MS } from './components/UnlockPanel'
import { createKeyStore, type KeyStore } from './keyStore'
import type { FetchBytes } from './repo'
import { makeTestVault, TEST_PASSPHRASE } from './testVault'
import { VaultScreen } from './VaultScreen'

function renderVault(fetchBytes: FetchBytes, keyStore: KeyStore | null, path = '/vault') {
  const router = createMemoryRouter([{ path: '/vault', element: <VaultScreen fetchBytes={fetchBytes} keyStore={keyStore} /> }], {
    initialEntries: [path],
  })
  return render(<RouterProvider router={router} />)
}

async function type(passphrase: string) {
  fireEvent.change(await screen.findByLabelText('口令'), { target: { value: passphrase } })
}

async function enter(passphrase: string) {
  await type(passphrase)
  fireEvent.submit(screen.getByLabelText('口令').closest('form')!)
}

describe('VaultScreen', () => {
  afterEach(() => vi.useRealTimers())

  it('shows an empty vault when vault.json is missing', async () => {
    renderVault(async () => null, null)
    expect(await screen.findByText('保险库还是空的。')).toBeInTheDocument()
  })

  it('offers a retry when vault.json cannot be loaded', async () => {
    const vault = await makeTestVault()
    let offline = true
    renderVault(async (path) => {
      if (offline) throw new Error('offline')
      return vault.fetchBytes(path)
    }, null)
    expect(await screen.findByText('保险库暂时打不开')).toBeInTheDocument()
    offline = false
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByLabelText('口令')).toBeInTheDocument()
  })

  it('says 口令不对 for a wrong passphrase', async () => {
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await enter('iceland aurora penguin goodbye')
    expect(await screen.findByRole('alert')).toHaveTextContent('口令不对')
  })

  it('opens the photos tab with the right passphrase', async () => {
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await enter(TEST_PASSPHRASE)
    expect(await screen.findByRole('tab', { name: '照片', selected: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看照片 第一次去海边' })).toBeInTheDocument()
  })

  it('starts after holding the start button', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await type(TEST_PASSPHRASE)
    fireEvent.pointerDown(screen.getByRole('button', { name: '一键启动' }))
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })
    expect(await screen.findByRole('tab', { name: '照片' })).toBeInTheDocument()
  })

  it('does not start when the button is released early', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await type(TEST_PASSPHRASE)
    const button = screen.getByRole('button', { name: '一键启动' })
    fireEvent.pointerDown(button)
    act(() => {
      vi.advanceTimersByTime(HOLD_MS / 2)
    })
    fireEvent.pointerUp(button)
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByLabelText('口令')).toBeInTheDocument()
  })

  it('remembers the key on this device until locked', async () => {
    const vault = await makeTestVault()
    const store = createKeyStore(new IDBFactory())!
    const first = renderVault(vault.fetchBytes, store)
    expect(await screen.findByLabelText('在这台设备上记住')).toBeChecked()
    await enter(TEST_PASSPHRASE)
    await screen.findByRole('tab', { name: '照片' })
    first.unmount()

    renderVault(vault.fetchBytes, store)
    expect(await screen.findByRole('tab', { name: '照片' })).toBeInTheDocument()
    expect(screen.queryByLabelText('口令')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '锁上' }))
    expect(await screen.findByLabelText('口令')).toBeInTheDocument()
    expect(await store.load()).toBeNull()
  })

  it('forgets a remembered key that no longer opens the vault', async () => {
    const store = createKeyStore(new IDBFactory())!
    const stale = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ])
    await store.save(stale)
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, store)
    expect(await screen.findByLabelText('口令')).toBeInTheDocument()
    expect(await store.load()).toBeNull()
  })

  it('hides the remember option without IndexedDB', async () => {
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await screen.findByLabelText('口令')
    expect(screen.queryByLabelText('在这台设备上记住')).not.toBeInTheDocument()
  })

  it('opens the tab named in the address', async () => {
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null, '/vault?tab=lists')
    await enter(TEST_PASSPHRASE)
    expect(await screen.findByText('已完成 1 / 2')).toBeInTheDocument()
  })
})
