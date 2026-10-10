import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPrefs, setPrefs } from '../prefs/prefs'
import { ModsPanel } from './ModsPanel'

const group = (name: string) => within(screen.getByRole('group', { name }))

describe('ModsPanel', () => {
  beforeEach(() => localStorage.clear())

  it('shows the three parts with the factory colours picked', () => {
    render(<ModsPanel onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: '改装' })).toHaveFocus()
    expect(group('车漆').getByRole('button', { name: '午夜黑' })).toHaveAttribute('aria-pressed', 'true')
    expect(group('轮毂').getByRole('button', { name: '枪灰' })).toHaveAttribute('aria-pressed', 'true')
    expect(group('卡钳').getByRole('button', { name: '赛道红' })).toHaveAttribute('aria-pressed', 'true')
    expect(group('车漆').getAllByRole('button')).toHaveLength(8)
  })

  it('saves a picked colour and marks it', () => {
    render(<ModsPanel onClose={() => {}} />)
    fireEvent.click(group('车漆').getByRole('button', { name: '宝石蓝' }))
    expect(getPrefs().paint).toBe('blue')
    expect(group('车漆').getByRole('button', { name: '宝石蓝' })).toHaveAttribute('aria-pressed', 'true')
    expect(group('车漆').getByRole('button', { name: '午夜黑' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('宝石蓝', { selector: 'span' })).toBeInTheDocument()
  })

  it('shows rims in their visible colour, not the texture factor', () => {
    render(<ModsPanel onClose={() => {}} />)
    expect(group('轮毂').getByRole('button', { name: '亮银' })).toHaveStyle({ backgroundColor: '#c4c6ca' })
    expect(group('车漆').getByRole('button', { name: '珍珠白' })).toHaveStyle({ backgroundColor: '#cfcfca' })
  })

  it('goes back to the factory colours', () => {
    setPrefs({ paint: 'red', rim: 'bronze', caliper: 'gold' })
    render(<ModsPanel onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '恢复原厂' }))
    expect(getPrefs()).toMatchObject({ paint: 'midnight', rim: 'gunmetal', caliper: 'red' })
  })

  it('closes with the button or Escape', () => {
    const onClose = vi.fn()
    render(<ModsPanel onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
