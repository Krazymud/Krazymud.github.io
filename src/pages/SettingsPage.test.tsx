import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { progressFilename } from '../progress/export'
import { studyDay } from '../trial/day'
import { resetPrefsCache } from '../prefs/prefs'
import { ProgressProvider } from '../progress/ProgressProvider'
import { emptyProgress, STORAGE_KEY } from '../progress/store'
import { copy } from '../config/copy'
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

  it('exports progress with a qinglu filename', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'))
    const day = studyDay(new Date())
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:progress')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: '导出进度文件' }))
    expect(createObjectURL).toHaveBeenCalled()
    expect(click.mock.contexts[0]).toBeInstanceOf(HTMLAnchorElement)
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(progressFilename(day))
    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
    click.mockRestore()
    vi.useRealTimers()
  })

  it('uses the rebranded page title', () => {
    renderSettings()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.settings.title)
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

  it('credits ECDICT and notes drive night sketch stage', () => {
    renderSettings()
    const credits = within(screen.getByRole('region', { name: '鸣谢' }))
    expect(credits.getByRole('link', { name: 'ECDICT' })).toBeInTheDocument()
    expect(credits.getByText(/素描舞台为青庐蓝铅笔夜稿/)).toBeInTheDocument()
    expect(credits.queryByRole('link', { name: 'Fictional supercar - V12 Goblin' })).not.toBeInTheDocument()
    expect(credits.queryByRole('link', { name: 'Garage Floor' })).not.toBeInTheDocument()
  })
})
