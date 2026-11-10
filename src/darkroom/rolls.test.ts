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
    photo({ source: 'e', caption: '完全无关的随机备注', date: '2024-08-02' }),
  ])
  expect(rolls.length).toBeGreaterThanOrEqual(2)
  expect(rolls.some((r) => r.photoSources.includes('d'))).toBe(true)
  const untitled = rolls.find((r) => r.id === 'unfiled' || /未分类/.test(r.title))
  expect(untitled?.photoSources).toContain('d')
  expect(untitled?.photoSources).toContain('e')
})

it('merges themed rolls when more than five buckets have photos', () => {
  const rolls = classifyPhotosIntoRolls([
    photo({ source: 'sea', caption: '海边', date: '2024-01-01' }),
    photo({ source: 'mountain', caption: '山野徒步', date: '2024-02-01' }),
    photo({ source: 'city', caption: '城市霓虹', date: '2024-03-01' }),
    photo({ source: 'home', caption: '居家厨房', date: '2024-04-01' }),
    photo({ source: 'food', caption: '早餐料理', date: '2024-05-01' }),
    photo({ source: 'travel', caption: '旅途出发', date: '2024-06-01' }),
    photo({ source: 'nature', caption: '自然森林', date: '2024-07-01' }),
  ])
  const themed = rolls.filter((r) => r.id !== 'unfiled')
  expect(themed.length).toBeLessThanOrEqual(5)
})
