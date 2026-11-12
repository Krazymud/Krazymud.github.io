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

function urlKeys(urls: ReelPhotoUrls): string[] {
  return Object.keys(urls)
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
  const keys = urlKeys(urls)
  if (keys.length) {
    const u = urls[keys[i % keys.length]]!
    return { photo: u.photo, thumb: u.thumb, full: u.full, date: '01.01', line }
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

function buildLetter(notes: ReelContentInput['notes']): string {
  const blocks = notes
    .map(({ entry, text }) => {
      const body = text.trim()
      if (!body && !entry.title.trim()) return ''
      if (!entry.title.trim()) return body
      if (!body) return entry.title.trim()
      return `${entry.title.trim()}\n\n${body}`
    })
    .filter(Boolean)
  if (blocks.length) return blocks.join('\n\n——\n\n')
  return `${copy.siteName}\n\n匣中回忆 · 一卷胶片。`
}

/** Build blackpeng-compatible window.CONTENT from vault-only media and text. */
export function vaultToReelContent(input: ReelContentInput) {
  const photos = sortedPhotos(input.photos)
  const since = input.since ?? earliestSince(photos, '2026-01-01')
  const noteBodies = input.notes.map((n) => n.text.trim()).filter(Boolean)
  const noteTitles = input.notes.map((n) => n.entry.title.trim()).filter(Boolean)
  const letter = buildLetter(input.notes)

  const listLines = input.lists.flatMap(({ entry, content }) => {
    const items = content.items?.map((it) => (it.done ? `✓ ${it.text}` : it.text)) ?? []
    return [entry.title, ...items].filter(Boolean)
  })
  const listTitles = input.lists.map((l) => l.entry.title.trim()).filter(Boolean)

  const rolls = ROLL_NAMES.map((fallbackName, ri) => {
    const slice = photos.slice(ri * 8, ri * 8 + 8)
    const name = listTitles[ri] || noteTitles[ri] || fallbackName
    const frames = Array.from({ length: 8 }, (_, j) => {
      const photo = slice[j] ?? (photos.length ? photos[j % photos.length] : undefined)
      const line =
        ri === 2
          ? noteBodies[j % Math.max(1, noteBodies.length)] || photo?.caption || ''
          : ri === 3
            ? listLines[j] || noteBodies[j % Math.max(1, noteBodies.length)] || photo?.caption || ''
            : photo?.caption || listLines[j] || ''
      return frameFromPhoto(photo, input.urls, ri * 8 + j, line)
    })
    const place = slice[0]?.caption?.slice(0, 24) || noteTitles[0] || copy.siteName
    return { name, dates: `Vol ${ri + 1}`, place, frames }
  })

  const pick = (n: number, offset = 0) =>
    Array.from({ length: n }, (_, i) =>
      frameFromPhoto(photos.length ? photos[(i + offset) % photos.length] : undefined, input.urls, i + offset),
    )

  const cover = frameFromPhoto(photos[0], input.urls, 0)
  const torchPhoto = frameFromPhoto(photos[photos.length - 1] ?? photos[0], input.urls, photos.length || 0)

  return {
    __vault: true,
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
      song: listTitles[0] || noteTitles[0] || '匣中回忆',
    },
    letter,
    note: {
      mode: 'days' as const,
      date: fmtShort(since),
      line: noteBodies[1] || noteTitles[0] || '',
    },
    torch: {
      photo: torchPhoto.photo,
      thumb: torchPhoto.thumb,
      caption: photos[photos.length - 1]?.caption || noteTitles[0] || 'last frame on the roll',
      date: fmtLong(photos[photos.length - 1]?.date || since),
    },
    ticket: {
      place: `${copy.siteName} Cinema`,
      admit: 'Admit two',
      seat: 'Row G · 7 & 8',
      date: fmtShort(since),
      back: listLines.slice(0, 4).length
        ? listLines.slice(0, 4)
        : noteBodies.slice(0, 2).length
          ? noteBodies.slice(0, 2)
          : ['keep every frame', 'see you on the next roll'],
    },
    book: {
      cover,
      byline: `a film by ${copy.siteName}`,
      title: noteTitles[0] || copy.siteName,
      collage: pick(2, 0),
      theater: cover,
      compass: frameFromPhoto(photos[1] ?? photos[0], input.urls, 1),
      map: pick(Math.min(8, Math.max(1, photos.length || 1)), 0).map((f, i) => ({
        name: photos[i]?.caption?.slice(0, 12) || listTitles[i] || noteTitles[i] || `Frame ${i + 1}`,
        lat: 30 + i,
        lon: 110 + i,
        en: photos[i]?.caption?.slice(0, 12) || listTitles[i] || `Frame ${i + 1}`,
        photo: f.photo,
        thumb: f.thumb,
      })),
      endWords: {
        days: noteBodies[1] || noteBodies[0] || 'Our frames have no due date.',
        birthday: noteBodies[2] || noteBodies[0] || 'Glad you were here.',
      },
      collageTitle: listTitles[0] || '',
      collageNotes: listLines.slice(0, 2).length
        ? listLines.slice(0, 2)
        : noteTitles.slice(0, 2).length
          ? noteTitles.slice(0, 2)
          : ['the first one', 'our first roll'],
      cardBack: listLines[2] || noteBodies[0]?.slice(0, 40) || 'you can keep this one.',
      burnt: {
        title: noteTitles[0] || copy.siteName,
        lines: letter.split('\n').filter(Boolean).slice(0, 4),
        source: copy.siteName,
        pencil: [copy.siteName, noteTitles[0] || 'next roll'],
      },
    },
    creditsBy: {
      director: copy.siteName,
      starring: 'you and me',
      camera: 'a film camera',
      thanks: noteTitles[0] || 'every blurry frame',
      last: listTitles[0] || 'see you on the next roll',
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
