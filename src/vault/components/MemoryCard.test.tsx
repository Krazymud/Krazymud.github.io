import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Memory } from '../memory'
import type { NoteEntry, PhotoEntry } from '../types'
import type { ReadBlob } from '../useBlob'
import { MemoryCard } from './MemoryCard'

function reader(blobs: Record<string, string>): ReadBlob {
  return async (name) => {
    if (!(name in blobs)) throw new Error('broken')
    return new TextEncoder().encode(blobs[name])
  }
}

const photos: PhotoEntry[] = [
  { caption: '', date: '2024-03-02', width: 1500, height: 2000, thumb: 't1', full: 'f1', source: 'photos/a.jpg', hash: 'a' },
  { caption: '第一次去海边', date: '2024-05-20', width: 2000, height: 1500, thumb: 't2', full: 'f2', source: 'photos/b.jpg', hash: 'b' },
]
const goodnight: NoteEntry = { title: '晚安', date: '2025-05-21', blob: 'n1', source: 'notes/a.md', hash: 'n' }

describe('MemoryCard', () => {
  it('labels an anniversary photo and opens it in the viewer', () => {
    const memory: Memory = { kind: 'anniversary', years: 2, item: { type: 'photo', photo: photos[1], index: 1 } }
    render(<MemoryCard memory={memory} photos={photos} read={reader({ t2: '2', f2: 'F2' })} />)
    expect(screen.getByRole('region', { name: '今日回忆' })).toHaveTextContent('2 年前的今天 · 2024-05-20')
    fireEvent.click(screen.getByRole('button', { name: '打开回忆 第一次去海边' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('2 / 2')
  })

  it('labels a daily photo', () => {
    const memory: Memory = { kind: 'daily', item: { type: 'photo', photo: photos[0], index: 0 } }
    render(<MemoryCard memory={memory} photos={photos} read={reader({ t1: '1' })} />)
    expect(screen.getByRole('region', { name: '今日回忆' })).toHaveTextContent('今日一张 · 2024-03-02')
    expect(screen.getByRole('button', { name: '打开回忆 2024-03-02' })).toBeInTheDocument()
  })

  it('shows a note anniversary that expands in place', async () => {
    const memory: Memory = { kind: 'anniversary', years: 1, item: { type: 'note', note: goodnight } }
    render(<MemoryCard memory={memory} photos={photos} read={reader({ n1: '今天的风很**温柔**。' })} />)
    expect(screen.getByRole('region', { name: '今日回忆' })).toHaveTextContent('1 年前的今天 · 2025-05-21')
    await screen.findByText('今天的风很温柔。')
    fireEvent.click(screen.getByRole('button', { name: /晚安/ }))
    expect(screen.getByText('温柔').tagName).toBe('STRONG')
  })
})
