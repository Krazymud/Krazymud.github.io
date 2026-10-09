export interface Word {
  w: string
  p: string
  pos: string
  m: string
}

export interface WordIndex {
  version: number
  chunkSize: number
  words: string[]
}

export type ItemKind = 'new' | 'review'

export interface SessionItem {
  word: string
  kind: ItemKind
}
