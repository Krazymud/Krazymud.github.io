import type { PhotoEntry } from '../vault/types'

export type FilmRoll = { id: string; title: string; photoSources: string[] }

type RollBucket = { id: string; title: string; keywords: string[] }

const ROLL_BUCKETS: RollBucket[] = [
  { id: 'sea', title: '海滨', keywords: ['海', '沙滩', 'beach', 'sea', 'ocean', 'coast', 'wave'] },
  { id: 'mountain', title: '山野', keywords: ['山', 'mountain', 'hill', 'peak', 'trail', 'hike'] },
  { id: 'city', title: '城市', keywords: ['城', 'city', 'urban', 'street', 'downtown', '建筑', '霓虹'] },
  { id: 'home', title: '居家', keywords: ['家', '厨房', 'home', 'house', '室内', 'room', 'bedroom'] },
  { id: 'food', title: '食味', keywords: ['食', '餐', '早餐', '午餐', '晚餐', 'food', 'eat', 'dining', '料理', '咖啡'] },
  { id: 'travel', title: '旅途', keywords: ['旅', 'travel', 'trip', 'journey', '出发', '机场', 'flight'] },
  {
    id: 'nature',
    title: '自然',
    keywords: ['nature', 'forest', '树', '林', '花', '草', 'sky', '云', 'park', 'garden'],
  },
]

const UNFILED_ROLL: Pick<FilmRoll, 'id' | 'title'> = { id: 'unfiled', title: '未分类' }

const TARGET_MAX_ROLLS = 5

function bucketForCaption(caption: string): string {
  const trimmed = caption.trim()
  if (!trimmed) return UNFILED_ROLL.id
  const lower = trimmed.toLowerCase()
  for (const bucket of ROLL_BUCKETS) {
    if (bucket.keywords.some((kw) => trimmed.includes(kw) || lower.includes(kw.toLowerCase()))) {
      return bucket.id
    }
  }
  return UNFILED_ROLL.id
}

function bucketMeta(id: string): Pick<FilmRoll, 'id' | 'title'> {
  if (id === UNFILED_ROLL.id) return UNFILED_ROLL
  const found = ROLL_BUCKETS.find((b) => b.id === id)
  return found ?? UNFILED_ROLL
}

function dateMs(date: string): number {
  const ms = Date.parse(date)
  return Number.isFinite(ms) ? ms : 0
}

type Grouped = { bucketId: string; photoSources: string[]; dates: number[] }

function medianDate(dates: number[]): number {
  if (dates.length === 0) return 0
  const sorted = [...dates].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Merge smallest non-unfiled rolls by date proximity until at most TARGET_MAX_ROLLS. */
function mergeByDateProximity(groups: Grouped[]): Grouped[] {
  const unfiled = groups.filter((g) => g.bucketId === UNFILED_ROLL.id)
  let themed = groups.filter((g) => g.bucketId !== UNFILED_ROLL.id)
  if (themed.length <= TARGET_MAX_ROLLS) return [...themed, ...unfiled]

  while (themed.length > TARGET_MAX_ROLLS) {
    let bestI = 0
    let bestJ = 1
    let bestDist = Number.POSITIVE_INFINITY
    const meds = themed.map((g) => medianDate(g.dates))
    for (let i = 0; i < themed.length; i++) {
      for (let j = i + 1; j < themed.length; j++) {
        const dist = Math.abs(meds[i] - meds[j])
        if (dist < bestDist) {
          bestDist = dist
          bestI = i
          bestJ = j
        }
      }
    }
    const a = themed[bestI]
    const b = themed[bestJ]
    const merged: Grouped = {
      bucketId: a.photoSources.length >= b.photoSources.length ? a.bucketId : b.bucketId,
      photoSources: [...a.photoSources, ...b.photoSources],
      dates: [...a.dates, ...b.dates],
    }
    themed = themed.filter((_, idx) => idx !== bestI && idx !== bestJ)
    themed.push(merged)
  }
  return [...themed, ...unfiled]
}

export function classifyPhotosIntoRolls(photos: PhotoEntry[]): FilmRoll[] {
  const byBucket = new Map<string, Grouped>()

  for (const p of photos) {
    const bucketId = bucketForCaption(p.caption)
    let group = byBucket.get(bucketId)
    if (!group) {
      group = { bucketId, photoSources: [], dates: [] }
      byBucket.set(bucketId, group)
    }
    group.photoSources.push(p.source)
    group.dates.push(dateMs(p.date))
  }

  let groups = [...byBucket.values()]
  if (groups.length > TARGET_MAX_ROLLS) {
    groups = mergeByDateProximity(groups)
  }

  const rolls: FilmRoll[] = groups.map((g) => {
    const meta = bucketMeta(g.bucketId)
    return { id: meta.id, title: meta.title, photoSources: g.photoSources }
  })

  rolls.sort((a, b) => {
    if (a.id === UNFILED_ROLL.id) return 1
    if (b.id === UNFILED_ROLL.id) return -1
    return a.id.localeCompare(b.id)
  })

  return rolls
}
