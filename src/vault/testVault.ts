import { deriveKek, encryptBytes, encryptJson, generateDek, newKdfParams, wrapDek, type VaultKey } from './crypto'
import type { FetchBytes } from './repo'
import type { ListContent, VaultFile, VaultManifest } from './types'

export const TEST_PASSPHRASE = 'iceland aurora penguin goodnight'

export interface TestVault {
  file: VaultFile
  dek: VaultKey
  fetchBytes: FetchBytes
}

export async function makeTestVault(options: { brokenBlobs?: string[] } = {}): Promise<TestVault> {
  const dek = await generateDek()
  const kdf = newKdfParams(1000)
  const files = new Map<string, Uint8Array>()
  const text = (s: string) => new TextEncoder().encode(s)
  async function put(name: string, bytes: Uint8Array) {
    const broken = options.brokenBlobs?.includes(name)
    files.set(`blobs/${name}.bin`, broken ? new Uint8Array([1, 2, 3]) : await encryptBytes(dek, bytes))
  }

  const manifest: VaultManifest = {
    photos: [
      { caption: '第一次去海边', date: '2024-05-20', width: 2000, height: 1500, thumb: 'thumb-a', full: 'full-a', source: 'photos/a.jpg', hash: 'a' },
      { caption: '', date: '2024-03-02', width: 1500, height: 2000, thumb: 'thumb-b', full: 'full-b', source: 'photos/b.jpg', hash: 'b' },
    ],
    notes: [{ title: '晚安', date: '2024-05-21', blob: 'note-a', source: 'notes/a.md', hash: 'n' }],
    lists: [{ title: '一起去的地方', blob: 'list-a', source: 'lists/a.md', hash: 'l' }],
  }
  for (const name of ['thumb-a', 'full-a', 'thumb-b', 'full-b']) await put(name, text(name))
  await put('note-a', text('今天的风很**温柔**。\n\n第二段。'))
  const list: ListContent = {
    items: [
      { text: '去看海', done: true },
      { text: '去冰岛看极光', done: false },
    ],
  }
  await put('list-a', text(JSON.stringify(list)))

  const file: VaultFile = {
    version: 1,
    kdf,
    wrappedKey: await wrapDek(dek, await deriveKek(TEST_PASSPHRASE, kdf)),
    manifest: await encryptJson(dek, manifest),
  }
  files.set('vault.json', text(JSON.stringify(file)))
  return { file, dek, fetchBytes: async (path) => files.get(path) ?? null }
}
