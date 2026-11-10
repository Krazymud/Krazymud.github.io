import { expect, it } from 'vitest'
import { classifyPhotosIntoRolls } from './rolls'
import type { PhotoEntry } from '../vault/types'

function photo(partial: Partial<PhotoEntry> & Pick<PhotoEntry, 'source' | 'caption' | 'date'>): PhotoEntry {
  return {
    width: 1,
    height: 1,
    thumb: 't',
    full: 'f',
    hash: 'h',
    ...partial,
  }
}

it('groups by caption keywords into multiple rolls and parks unknowns', () => {
  const rolls = classifyPhotosIntoRolls([
    photo({ source: 'a', caption: '海边日落', date: '2024-06-01' }),
    photo({ source: 'b', caption: '沙滩脚印', date: '2024-06-02' }),
    photo({ source: 'c', caption: '厨房早餐', date: '2024-07-01' }),
    photo({ source: 'd', caption: '', date: '2024-08-01' }),
  ])
  expect(rolls.length).toBeGreaterThanOrEqual(2)
  expect(rolls.some((r) => r.photoSources.includes('d'))).toBe(true)
  const untitled = rolls.find((r) => r.id === 'unfiled' || /未分类/.test(r.title))
  expect(untitled?.photoSources).toContain('d')
})
