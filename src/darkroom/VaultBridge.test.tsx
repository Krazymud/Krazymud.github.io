import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { unlockWithKey } from '../vault/repo'
import { makeTestVault } from '../vault/testVault'
import { classifyPhotosIntoRolls } from './rolls'
import { DeskCounts, useDarkroomVault, VaultBridge } from './VaultBridge'

function Probe() {
  const v = useDarkroomVault()
  return (
    <button onClick={v.lock}>
      lock:{v.rolls.length}:{v.notes.length}:{v.lists.length}:{String(v.tokenSaved)}
    </button>
  )
}

describe('VaultBridge', () => {
  it('exposes rolls, notes, lists from the manifest and lock', async () => {
    const vault = await makeTestVault()
    const session = await unlockWithKey(vault.file, vault.dek)
    const onLock = vi.fn()
    const expected = classifyPhotosIntoRolls(session.manifest.photos).length
    render(
      <VaultBridge session={session} file={vault.file} fetchBytes={vault.fetchBytes} onLock={onLock} webStore={null}>
        <Probe />
        <DeskCounts />
      </VaultBridge>,
    )
    expect(expected).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe(`lock:${expected}:1:1:false`))
    expect(screen.getByTestId('roll-count').textContent).toBe(String(expected))
    expect(screen.getByTestId('note-count').textContent).toBe('1')
    screen.getByRole('button').click()
    expect(onLock).toHaveBeenCalled()
  })

  it('exposes the edit gate: no token means canEdit is false', async () => {
    const vault = await makeTestVault()
    const session = await unlockWithKey(vault.file, vault.dek)
    function Gate() {
      const v = useDarkroomVault()
      return (
        <p data-testid="gate">
          {String(v.loading)}:{String(v.canEdit)}:{String(v.tokenSaved)}:{String(v.syncing)}:{String(v.tokenError)}:{typeof v.retrySync}
        </p>
      )
    }
    render(
      <VaultBridge session={session} file={vault.file} fetchBytes={vault.fetchBytes} onLock={() => undefined} webStore={null}>
        <Gate />
      </VaultBridge>,
    )
    await waitFor(() => expect(screen.getByTestId('gate').textContent).toBe('false:false:false:false:null:function'))
  })
})
