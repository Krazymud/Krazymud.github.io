import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { PREFS_KEY, resetPrefsCache } from '../prefs/prefs'
import { ProgressProvider } from '../progress/ProgressProvider'
import { emptyProgress, STORAGE_KEY } from '../progress/store'
import { SettingsPage } from './SettingsPage'

function renderSettings() {
  render(
    <ProgressProvider>
      <SettingsPage />
    </ProgressProvider>,
  )
  return screen.getByLabelText('导入进度文件')
}

function upload(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { files: [new File([text], 'progress.json', { type: 'application/json' })] } })
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPrefsCache()
  })

  it('explains why an invalid file is rejected', async () => {
    upload(renderSettings(), 'not json')
    expect(await screen.findByText('文件不是有效的 JSON')).toBeInTheDocument()
  })

  it('previews and imports a valid progress file', async () => {
    const data = {
      ...emptyProgress(),
      words: { alpha: { interval: 7, due: '2026-10-16', lastResult: 'good', seenCount: 1 } },
    }
    upload(renderSettings(), JSON.stringify(data))
    expect(await screen.findByText('文件里有 1 个已学单词，导入会覆盖当前进度。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))
    expect(await screen.findByText('进度已导入')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).words.alpha.interval).toBe(7)
  })

  it('reports a file that cannot be read', async () => {
    const input = renderSettings()
    upload(input, JSON.stringify(emptyProgress()))
    await screen.findByRole('button', { name: '确认导入' })
    const file = new File([''], 'progress.json', { type: 'application/json' })
    file.text = () => Promise.reject(new Error('x'))
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('无法读取文件')
    expect(screen.queryByRole('button', { name: '确认导入' })).not.toBeInTheDocument()
  })

  it('turns the 3D garage off and on', () => {
    renderSettings()
    const toggle = screen.getByRole('switch', { name: /3D 车库/ })
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    expect(toggle).not.toBeChecked()
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ scene3d: false, muted: false, introSeen: false })
    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
  })

  it('credits the car model and other third-party assets', () => {
    renderSettings()
    const credits = within(screen.getByRole('region', { name: '鸣谢' }))
    expect(credits.getByRole('link', { name: 'Fictional supercar - V12 Goblin' })).toHaveAttribute(
      'href',
      'https://sketchfab.com/3d-models/fictional-supercar-v12-goblin-0a20e49ad5774d778567cb5c3f345786',
    )
    expect(credits.getByText(/ollitei/)).toBeInTheDocument()
    expect(credits.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/')
    expect(credits.getByText(/已修改：材质、配色和压缩/)).toBeInTheDocument()
    expect(credits.getByRole('link', { name: 'ECDICT' })).toBeInTheDocument()
    expect(credits.getByText(/Rajdhani/)).toBeInTheDocument()
    expect(credits.getByRole('link', { name: 'Ferrari start up and drive off' })).toHaveAttribute(
      'href',
      'https://freesound.org/people/EwanPenman11/sounds/659560/',
    )
    expect(credits.getByRole('link', { name: 'Supercar rev' })).toHaveAttribute('href', 'https://freesound.org/people/richwise/sounds/478756/')
    expect(credits.getByRole('link', { name: 'Car Lock' })).toHaveAttribute('href', 'https://freesound.org/people/hz37/sounds/396448/')
  })
})
