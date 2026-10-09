import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
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
  beforeEach(() => localStorage.clear())

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
})
