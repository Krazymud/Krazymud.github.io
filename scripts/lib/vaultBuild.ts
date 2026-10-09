import { randomBytes } from 'node:crypto'
import { encryptBytes, type VaultKey } from '../../src/vault/crypto.ts'
import type { ListContent, ListItem, VaultManifest } from '../../src/vault/types.ts'
import type { ProcessedPhoto } from './photo.ts'

export type SourceItem =
  | { kind: 'photo'; source: string; hash: string; caption: string; date: string; load: () => Promise<ProcessedPhoto> }
  | { kind: 'note'; source: string; hash: string; title: string; date: string; body: string }
  | { kind: 'list'; source: string; hash: string; title: string; items: ListItem[] }

export interface BuildResult {
  manifest: VaultManifest
  writes: Map<string, Uint8Array>
}

export function emptyManifest(): VaultManifest {
  return { photos: [], notes: [], lists: [] }
}

export function referencedBlobs(manifest: VaultManifest): Set<string> {
  return new Set([
    ...manifest.photos.flatMap((p) => [p.thumb, p.full]),
    ...manifest.notes.map((n) => n.blob),
    ...manifest.lists.map((l) => l.blob),
  ])
}

function byDateDesc(a: { date: string; source: string }, b: { date: string; source: string }): number {
  if (a.date === b.date) return a.source.localeCompare(b.source)
  return a.date < b.date ? 1 : -1
}

export async function buildVault(
  items: SourceItem[],
  previous: VaultManifest | null,
  dek: VaultKey,
  onItem?: (source: string, reused: boolean) => void,
): Promise<BuildResult> {
  const prev = previous ?? emptyManifest()
  const manifest = emptyManifest()
  const writes = new Map<string, Uint8Array>()
  const encoder = new TextEncoder()

  async function seal(bytes: Uint8Array): Promise<string> {
    const name = randomBytes(16).toString('hex')
    writes.set(name, await encryptBytes(dek, bytes))
    return name
  }

  for (const item of items) {
    const same = (entry: { source: string; hash: string }) => entry.source === item.source && entry.hash === item.hash
    if (item.kind === 'photo') {
      const old = prev.photos.find(same)
      if (old) {
        manifest.photos.push({ ...old, caption: item.caption, date: item.date })
      } else {
        const photo = await item.load()
        manifest.photos.push({
          caption: item.caption,
          date: item.date,
          width: photo.width,
          height: photo.height,
          thumb: await seal(photo.thumb),
          full: await seal(photo.full),
          source: item.source,
          hash: item.hash,
        })
      }
      onItem?.(item.source, old !== undefined)
    } else if (item.kind === 'note') {
      const old = prev.notes.find(same)
      const blob = old ? old.blob : await seal(encoder.encode(item.body))
      manifest.notes.push({ title: item.title, date: item.date, blob, source: item.source, hash: item.hash })
      onItem?.(item.source, old !== undefined)
    } else {
      const old = prev.lists.find(same)
      const content: ListContent = { items: item.items }
      const blob = old ? old.blob : await seal(encoder.encode(JSON.stringify(content)))
      manifest.lists.push({ title: item.title, blob, source: item.source, hash: item.hash })
      onItem?.(item.source, old !== undefined)
    }
  }

  manifest.photos.sort(byDateDesc)
  manifest.notes.sort(byDateDesc)
  return { manifest, writes }
}
