import type { ListContent, ListEntry, NoteEntry, PhotoEntry } from '../../vault/types'
import { copy } from '../../config/copy'

export type ReelPhotoUrls = Record<string, { photo: string; thumb: string; full: string }>

export type ReelContentInput = {
  photos: PhotoEntry[]
  notes: Array<{ entry: NoteEntry; text: string }>
  lists: Array<{ entry: ListEntry; content: ListContent }>
  urls: ReelPhotoUrls
  /** ISO date used for since / torch day count; default earliest photo or today */
  since?: string
}

const FALLBACKS = ['img/p129.jpg', 'img/p1005.jpg', 'img/p1027.jpg', 'img/p1011.jpg', 'img/p1062.jpg'] as const
const ROLL_NAMES = ['for Two', 'slow days', 'far away', 'still us'] as const

function fmtShort(date: string): string {
  const ms = Date.parse(date)
  if (!Number.isFinite(ms)) return '01.01'
  const d = new Date(ms)
  return `${d.getMonth() + 1}.${d.getDate()}`
}

function fmtLong(date: string): string {
  const ms = Date.parse(date)
  if (!Number.isFinite(ms)) return '01.01.2026'
  const d = new Date(ms)
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.${d.getFullYear()}`
}

function frameFromPhoto(photo: PhotoEntry | undefined, urls: ReelPhotoUrls, i: number, line = '') {
  if (photo) {
    const u = urls[photo.hash] ?? urls[photo.source]
    if (u) {
      return {
        photo: u.photo,
        thumb: u.thumb,
        full: u.full,
        date: fmtShort(photo.date),
        line: line || photo.caption || '',
      }
    }
  }
  const fb = FALLBACKS[i % FALLBACKS.length]
  return { photo: fb, thumb: fb, full: fb, date: '01.01', line }
}

function sortedPhotos(photos: PhotoEntry[]): PhotoEntry[] {
  return [...photos].sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.hash.localeCompare(b.hash))
}

function earliestSince(photos: PhotoEntry[], fallback: string): string {
  const dates = photos.map((p) => Date.parse(p.date)).filter(Number.isFinite)
  if (!dates.length) return fallback
  const d = new Date(Math.min(...dates))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Build blackpeng-compatible window.CONTENT from vault-only media and text. */
export function vaultToReelContent(input: ReelContentInput) {
  const photos = sortedPhotos(input.photos)
  const since = input.since ?? earliestSince(photos, '2026-01-01')
  const noteBodies = input.notes.map((n) => n.text.trim()).filter(Boolean)
  const letter =
    noteBodies[0] ||
    `${copy.siteName}\n\n匣中回忆 · 一卷胶片。`

  const listLines = input.lists.flatMap(({ entry, content }) => {
    const items = content.items?.map((it) => (it.done ? `✓ ${it.text}` : it.text)) ?? []
    return [entry.title, ...items].filter(Boolean)
  })

  const rolls = ROLL_NAMES.map((name, ri) => {
    const slice = photos.slice(ri * 8, ri * 8 + 8)
    const frames = Array.from({ length: 8 }, (_, j) => {
      const line =
        ri === 2
          ? noteBodies[(j + 1) % Math.max(1, noteBodies.length)] || ''
          : ri === 3
            ? listLines[j] || noteBodies[j % Math.max(1, noteBodies.length)] || ''
            : slice[j]?.caption || ''
      return frameFromPhoto(slice[j] ?? photos[j % Math.max(1, photos.length)], input.urls, ri * 8 + j, line)
    })
    const place = slice[0]?.caption?.slice(0, 24) || copy.siteName
    return { name, dates: `Vol ${ri + 1}`, place, frames }
  })

  const pick = (n: number, offset = 0) =>
    Array.from({ length: n }, (_, i) => frameFromPhoto(photos[(i + offset) % Math.max(1, photos.length)], input.urls, i + offset))

  const cover = frameFromPhoto(photos[0], input.urls, 0)
  const torchPhoto = frameFromPhoto(photos[photos.length - 1] ?? photos[0], input.urls, photos.length || 0)

  return {
    names: { to: '', from: '', both: copy.siteName, sign: '·' },
    since,
    rolls,
    picks: {
      opening: pick(8, 0),
      radio: pick(7, 1),
      credits: pick(8, 2),
      creditsStills: pick(4, 3),
    },
    radio: {
      dj: `Good evening. Brought to you by ${copy.siteName}.`,
      song: input.lists[0]?.entry.title || '匣中回忆',
    },
    letter,
    note: { mode: 'days' as const, date: fmtShort(since), line: noteBodies[1] || '' },
    torch: {
      photo: torchPhoto.photo,
      thumb: torchPhoto.thumb,
      caption: torchPhoto.line || 'last frame on the roll',
      date: fmtLong(photos[photos.length - 1]?.date || since),
    },
    ticket: {
      place: `${copy.siteName} Cinema`,
      admit: 'Admit two',
      seat: 'Row G · 7 & 8',
      date: fmtShort(since),
      back: listLines.slice(0, 4).length ? listLines.slice(0, 4) : ['keep every frame', 'see you on the next roll'],
    },
    book: {
      cover,
      byline: `a film by ${copy.siteName}`,
      title: copy.siteName,
      collage: pick(2, 0),
      theater: cover,
      compass: frameFromPhoto(photos[1] ?? photos[0], input.urls, 1),
      map: pick(Math.min(8, Math.max(1, photos.length)), 0).map((f, i) => ({
        name: photos[i]?.caption?.slice(0, 12) || `Frame ${i + 1}`,
        lat: 30 + i,
        lon: 110 + i,
        en: photos[i]?.caption?.slice(0, 12) || `Frame ${i + 1}`,
        photo: f.photo,
        thumb: f.thumb,
      })),
      endWords: {
        days: noteBodies[1] || 'Our frames have no due date.',
        birthday: noteBodies[2] || noteBodies[0] || 'Glad you were here.',
      },
      collageTitle: '',
      collageNotes: listLines.slice(0, 2).length ? listLines.slice(0, 2) : ['the first one', 'our first roll'],
      cardBack: listLines[2] || 'you can keep this one.',
      burnt: {
        title: copy.siteName,
        lines: (noteBodies[0] || letter).split('\n').filter(Boolean).slice(0, 4),
        source: copy.siteName,
        pencil: [copy.siteName, 'next roll'],
      },
    },
    creditsBy: {
      director: copy.siteName,
      starring: 'you and me',
      camera: 'a film camera',
      thanks: 'every blurry frame',
      last: 'see you on the next roll',
    },
    credits: [
      ['big', 'A Roll <em>for Two</em>'],
      ['role', 'Directed by'],
      ['name', copy.siteName],
      ['role', 'Starring'],
      ['name', 'you <em>and</em> me'],
      ['ph', -3],
      ['ph', 4],
      ['role', 'Shot on'],
      ['name', 'a film camera'],
      ['role', 'Developed at'],
      ['name', copy.siteName],
      ['role', 'Music'],
      ['name', '<em>{song}</em>'],
      ['ph', 2],
      ['ph', -4],
      ['role', 'Brought to you by'],
      ['name', copy.siteName],
      ['role', 'Special thanks to'],
      ['name', 'every blurry frame'],
      ['red', 'see you on the next roll'],
    ],
    __lang: 'zh',
  }
}
