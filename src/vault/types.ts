import type { KdfParams } from './crypto.ts'

export interface VaultFile {
  version: 1
  kdf: KdfParams
  wrappedKey: string
  manifest: string
}

export interface PhotoEntry {
  caption: string
  date: string
  width: number
  height: number
  thumb: string
  full: string
  source: string
  hash: string
}

export interface NoteEntry {
  title: string
  date: string
  blob: string
  source: string
  hash: string
}

export interface ListEntry {
  title: string
  blob: string
  source: string
  hash: string
}

export interface VaultManifest {
  photos: PhotoEntry[]
  notes: NoteEntry[]
  lists: ListEntry[]
}

export interface ListItem {
  text: string
  done: boolean
}

export interface ListContent {
  items: ListItem[]
}
