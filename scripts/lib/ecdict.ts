import { CASE_OVERRIDES, PHONETIC_FIXES, type CaseOverride } from './caseOverrides.ts'

export interface EcdictRow {
  word: string
  phonetic: string
  translation: string
  tag: string
  frq: string
  bnc: string
}

export interface WordEntry {
  w: string
  p: string
  pos: string
  m: string
}

const POS_MAP: Record<string, string> = {
  'n.': 'n.',
  'v.': 'v.',
  'vt.': 'v.',
  'vi.': 'v.',
  'a.': 'adj.',
  'adj.': 'adj.',
  'ad.': 'adv.',
  'adv.': 'adv.',
  'prep.': 'prep.',
  'conj.': 'conj.',
  'pron.': 'pron.',
  'num.': 'num.',
  'int.': 'int.',
  'interj.': 'int.',
  'art.': 'art.',
  'aux.': 'aux.',
  'pl.': 'n.',
}

const MAX_SENSES = 2
const MAX_MEANINGS_PER_SENSE = 3
const LOWERCASE_WORD_RE = /^[a-z]+(?:[-'][a-z]+)*$/

export function isCetWord(tag: string): boolean {
  const tags = tag.split(' ')
  return tags.includes('cet4') || tags.includes('cet6')
}

export function isLowercaseWord(word: string): boolean {
  return LOWERCASE_WORD_RE.test(word)
}

export function parseTranslation(translation: string): { pos: string; meaning: string } | null {
  const lines = translation
    .split(/\\n|\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('['))

  let pos = ''
  const senses: string[] = []
  for (const line of lines) {
    const match = /^([a-z]+\.)\s*(.*)$/.exec(line)
    const label = match ? (POS_MAP[match[1]] ?? match[1]) : ''
    const body = match ? match[2] : line
    const meanings = body
      .split(/[,，;；]\s*/)
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, MAX_MEANINGS_PER_SENSE)
    if (meanings.length === 0) continue
    if (!pos && label) pos = label
    senses.push(label ? `${label} ${meanings.join('，')}` : meanings.join('，'))
    if (senses.length === MAX_SENSES) break
  }
  return senses.length ? { pos, meaning: senses.join('；') } : null
}

export function toEntry(row: EcdictRow): WordEntry | null {
  const parsed = parseTranslation(row.translation)
  if (!parsed) return null
  const phonetic = PHONETIC_FIXES[row.word] ?? row.phonetic.replace(/ә/g, 'ə').replace(/\^/g, 'g')
  return { w: row.word, p: phonetic, pos: parsed.pos, m: parsed.meaning }
}

export function toPackEntry(
  row: EcdictRow,
  overrides: Readonly<Record<string, CaseOverride>> = CASE_OVERRIDES,
): WordEntry | null {
  if (isLowercaseWord(row.word)) return toEntry(row)
  const override = overrides[row.word]
  if (!override) return null
  const entry = toEntry(row)
  if (!entry) return null
  return { ...entry, w: override.w, pos: override.pos ?? entry.pos, m: override.m ?? entry.m }
}

export function rankOf(row: EcdictRow): number {
  const frq = Number(row.frq)
  if (frq > 0) return frq
  const bnc = Number(row.bnc)
  if (bnc > 0) return bnc
  return Number.POSITIVE_INFINITY
}
