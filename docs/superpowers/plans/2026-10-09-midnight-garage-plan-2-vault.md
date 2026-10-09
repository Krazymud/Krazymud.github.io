# Midnight Garage · 计划 2：加密保险库 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/vault` 上线一个用口令加密的只读保险库：本地脚本把 `vault-src/` 里的照片（含 HEIC）、笔记、清单增量加密到 `public/vault/`，浏览器输入口令后解密展示，可在设备上记住。

**Architecture:** 一份只依赖 WebCrypto 的 `src/vault/crypto.ts` 同时被 Node 脚本和浏览器使用。脚本侧拆成纯解析（`vaultSource`）、照片处理（`photo`）、增量构建（`vaultBuild`）和文件读写（`vaultCommand`）四层，命令行入口只负责读口令。浏览器侧 `repo` 负责下载和解密，`keyStore` 负责 IndexedDB，React 组件只做展示。

**Tech Stack:** 现有 Vite 8 / React 19 / TypeScript 6 / React Router 8 / Tailwind 4 / Motion 14 / Vitest 5；新增 `sharp` 0.35、`heic-decode` 2.1、`exifr` 7.1、`yaml` 2.9、`fake-indexeddb` 6.2（均为开发依赖），`react-markdown` 10.1（运行时依赖）。

**规格文档：** `docs/superpowers/specs/2026-10-09-midnight-garage-vault-design.md`

## Global Constraints

- 运行环境 Windows + PowerShell；所有命令在仓库根目录 `D:\CODE\Krazymud.github.io` 执行。若终端找不到 `node`/`npm`，先执行 `$env:Path = "C:\Program Files\nodejs;$env:Path"`。
- 界面文案一律中文；`PRIVATE VAULT`、`START` 等品牌/装饰字样为英文。
- 保险库配色：大面积 `#A8894F`（`--accent`），关键元素 `#BF9F62`（`--accent-hi`）；`/vault` 路由已自动切换到 `data-theme="vault"`，组件里只用 `accent` / `accent-hi` 类，不写死颜色（`GoldSweep` 的渐变除外）。
- 加密参数：PBKDF2-SHA256，600,000 次迭代，16 字节随机盐；AES-GCM 256；每个密文独立的 12 字节随机 IV，存放格式为 `IV + 密文`。
- 口令规范化：`normalizePassphrase` = `trim()` → `normalize('NFC')` → 内部连续空白合并成一个空格；派生密钥和强度检查都只用它。
- 口令要求：规范化后至少 16 个字符（按码点计），没有「4 个词」的例外。
- `vault:rekey` 轮换数据密钥：新 DEK、所有 blob 重新加密并换新随机名、新盐新 `wrappedKey`；顺序为新 blob → 原子写 `vault.json` → 删旧 blob。旧口令和记住过的设备随之失效；已推送到 git 历史的旧版本仍可用旧口令解开。
- 口令只能在终端隐藏回显输入，不能来自命令行参数、环境变量或文件。
- 照片：最长边 ≤ 2000 像素（不放大），WebP 质量 82；缩略图 400×400 居中裁切，WebP 质量 70；输出不含任何元数据。支持 `jpg/jpeg/png/webp/heic/heif`（不区分大小写）。
- `public/vault/` 总大小超过 300 MB 时打印警告。
- IndexedDB：库 `midnight-garage`，存储区 `vault`，键 `dek`。
- 长按启动时长 1000 ms。
- `vault-src/` 必须在 `.gitignore` 里，绝不提交。
- TypeScript 开启了 `verbatimModuleSyntax`：只作类型使用的导入必须写 `import type` 或 `type` 修饰。
- `src/vault/crypto.ts` 和 `src/vault/types.ts` 会被 `scripts/` 引用并按 Node 配置（`module: nodenext`）类型检查：这两个文件之间的相互引用必须带 `.ts` 后缀，且只能使用浏览器和 Node 都有的全局对象（`crypto`、`TextEncoder`、`btoa`、`atob`）。`CryptoKey` 在 Node 类型里不是类型名，统一使用 `VaultKey`。`src/` 其他文件按现有风格不带后缀；`scripts/` 引用任何文件都带 `.ts` 后缀。
- 用到 `sharp` 或 Node 文件系统的测试文件第一行写 `// @vitest-environment node`。

---

## 文件结构

```
.gitignore                              加入 vault-src/
package.json                            新依赖、vault / vault:rekey 脚本
src/index.css                           笔记 Markdown 样式、抖动动画
src/vault/crypto.ts + crypto.test.ts    共用加密（浏览器和 Node）
src/vault/types.ts                      VaultFile / VaultManifest / ListContent 等
src/vault/repo.ts + repo.test.ts        浏览器下载、解锁、读 blob
src/vault/keyStore.ts + keyStore.test.ts  IndexedDB 记住 DEK
src/vault/testVault.ts                  测试用的内存保险库
src/vault/useBlob.ts                    解密 blob 为图片地址 / 文本的 hooks
src/vault/components/PhotoGrid.tsx      按月分组的缩略图网格
src/vault/components/PhotoViewer.tsx    全屏查看
src/vault/components/NotesTab.tsx       笔记卡片
src/vault/components/ListsTab.tsx       清单卡片
src/vault/components/tabs.test.tsx      上面四个组件的测试
src/vault/components/GoldSweep.tsx      解锁后的香槟金扫光
src/vault/components/UnlockPanel.tsx    口令 + 长按启动
src/vault/components/VaultContent.tsx   标签页 + 锁上
src/vault/VaultScreen.tsx + VaultScreen.test.tsx   状态机：加载/空/出错/锁定/打开
src/pages/VaultPage.tsx                 改为渲染 VaultScreen
src/app/App.test.tsx                    更新保险库路由断言
scripts/types/heic-decode.d.ts          heic-decode 的类型声明
scripts/lib/vaultSource.ts + test       front matter、清单、manifest.yaml 解析
scripts/lib/photo.ts + test             sharp / heic-decode / exifr
scripts/lib/vaultBuild.ts + test        增量加密
scripts/lib/vaultCommand.ts + test      扫描目录、读写 public/vault、换口令
scripts/lib/prompt.ts                   隐藏回显的口令输入
scripts/vault.ts                        npm run vault
scripts/vault-rekey.ts                  npm run vault:rekey
```

---

### Task 1: 共用加密模块

**Files:**
- Create: `src/vault/crypto.ts`、`src/vault/types.ts`、`src/vault/crypto.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type VaultKey`（即 WebCrypto 的 `CryptoKey`）
  - `interface KdfParams { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }`
  - `PBKDF2_ITERATIONS = 600_000`
  - `class DecryptError extends Error`
  - `toBase64(bytes: Uint8Array): string`、`fromBase64(text: string): Uint8Array<ArrayBuffer>`
  - `checkPassphrase(passphrase: string): string | null`（返回拒绝原因，合格返回 `null`）
  - `newKdfParams(iterations?: number): KdfParams`
  - `deriveKek(passphrase: string, kdf: KdfParams): Promise<VaultKey>`
  - `generateDek(): Promise<VaultKey>`（可导出，供脚本包装）
  - `wrapDek(dek: VaultKey, kek: VaultKey): Promise<string>`、`unwrapDek(wrapped: string, kek: VaultKey, extractable: boolean): Promise<VaultKey>`
  - `encryptBytes(key: VaultKey, plain: Uint8Array): Promise<Uint8Array<ArrayBuffer>>`、`decryptBytes(key: VaultKey, sealed: Uint8Array): Promise<Uint8Array<ArrayBuffer>>`
  - `encryptJson(key: VaultKey, value: unknown): Promise<string>`、`decryptJson<T>(key: VaultKey, sealed: string): Promise<T>`
  - 类型（`types.ts`）：`VaultFile`、`PhotoEntry`、`NoteEntry`、`ListEntry`、`VaultManifest`、`ListItem`、`ListContent`

- [ ] **Step 1: 写失败的测试 `src/vault/crypto.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import {
  checkPassphrase,
  decryptBytes,
  DecryptError,
  decryptJson,
  deriveKek,
  encryptBytes,
  encryptJson,
  fromBase64,
  generateDek,
  newKdfParams,
  PBKDF2_ITERATIONS,
  toBase64,
  unwrapDek,
  wrapDek,
} from './crypto'

const PASS = 'iceland aurora penguin goodnight'
const text = (s: string) => new TextEncoder().encode(s)
const read = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('base64', () => {
  it('round-trips every byte value', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i)
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })
})

describe('checkPassphrase', () => {
  it('accepts 16 characters or 4 words', () => {
    expect(checkPassphrase('abcdefghijklmnop')).toBeNull()
    expect(checkPassphrase('冰岛 极光 企鹅 晚安')).toBeNull()
  })

  it('rejects shorter passphrases with a reason', () => {
    expect(checkPassphrase('abcdefghijklmno')).toBe('口令至少要 16 个字符，或至少 4 个用空格分开的词')
    expect(checkPassphrase('冰岛 极光 企鹅')).not.toBeNull()
  })

  it('counts Chinese characters one by one', () => {
    expect(checkPassphrase('一二三四五六七八九十一二三四五六')).toBeNull()
  })
})

describe('encryptBytes / decryptBytes', () => {
  it('round-trips and uses a fresh IV every time', async () => {
    const key = await generateDek()
    const a = await encryptBytes(key, text('secret'))
    const b = await encryptBytes(key, text('secret'))
    expect(a.slice(0, 12)).not.toEqual(b.slice(0, 12))
    expect(read(await decryptBytes(key, a))).toBe('secret')
  })

  it('rejects tampered data, wrong keys and truncated input', async () => {
    const key = await generateDek()
    const sealed = await encryptBytes(key, text('secret'))
    const tampered = sealed.slice()
    tampered[20] ^= 1
    await expect(decryptBytes(key, tampered)).rejects.toBeInstanceOf(DecryptError)
    await expect(decryptBytes(await generateDek(), sealed)).rejects.toBeInstanceOf(DecryptError)
    await expect(decryptBytes(key, new Uint8Array(5))).rejects.toBeInstanceOf(DecryptError)
  })

  it('round-trips JSON', async () => {
    const key = await generateDek()
    expect(await decryptJson(key, await encryptJson(key, { a: [1, '二'] }))).toEqual({ a: [1, '二'] })
  })
})

describe('passphrase key wrapping', () => {
  it('uses 600,000 iterations by default with a random 16-byte salt', () => {
    const a = newKdfParams()
    const b = newKdfParams()
    expect(PBKDF2_ITERATIONS).toBe(600_000)
    expect(a).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS })
    expect(fromBase64(a.salt)).toHaveLength(16)
    expect(a.salt).not.toBe(b.salt)
  })

  it('unwraps the content key with the right passphrase only', async () => {
    const kdf = newKdfParams(1000)
    const dek = await generateDek()
    const wrapped = await wrapDek(dek, await deriveKek(PASS, kdf))
    const sealed = await encryptBytes(dek, text('photo'))
    const unwrapped = await unwrapDek(wrapped, await deriveKek(PASS, kdf), false)
    expect(read(await decryptBytes(unwrapped, sealed))).toBe('photo')
    await expect(unwrapDek(wrapped, await deriveKek('iceland aurora penguin goodbye', kdf), false)).rejects.toBeInstanceOf(
      DecryptError,
    )
  })

  it('ignores spaces around the passphrase', async () => {
    const kdf = newKdfParams(1000)
    const dek = await generateDek()
    const wrapped = await wrapDek(dek, await deriveKek(PASS, kdf))
    await expect(unwrapDek(wrapped, await deriveKek(`  ${PASS}  `, kdf), false)).resolves.toBeDefined()
  })

  it('can make the unwrapped key non-extractable', async () => {
    const kdf = newKdfParams(1000)
    const kek = await deriveKek(PASS, kdf)
    const key = await unwrapDek(await wrapDek(await generateDek(), kek), kek, false)
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/vault/crypto.test.ts`
Expected: FAIL，提示无法解析 `./crypto`。

- [ ] **Step 3: 实现 `src/vault/crypto.ts`**

```ts
// Shared by the browser and the Node scripts: only use globals both provide.
export type VaultKey = Parameters<typeof crypto.subtle.encrypt>[1]

export interface KdfParams {
  name: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  salt: string
}

export const PBKDF2_ITERATIONS = 600_000

const IV_BYTES = 12
const SALT_BYTES = 16
const MIN_CHARS = 16
const MIN_WORDS = 4

export class DecryptError extends Error {
  constructor() {
    super('解密失败')
    this.name = 'DecryptError'
  }
}

function own(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes)
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function checkPassphrase(passphrase: string): string | null {
  const trimmed = passphrase.trim()
  const chars = [...trimmed].length
  const words = trimmed.split(/\s+/).filter(Boolean).length
  if (chars >= MIN_CHARS || words >= MIN_WORDS) return null
  return `口令至少要 ${MIN_CHARS} 个字符，或至少 ${MIN_WORDS} 个用空格分开的词`
}

export function newKdfParams(iterations = PBKDF2_ITERATIONS): KdfParams {
  return {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    salt: toBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES))),
  }
}

export async function deriveKek(passphrase: string, kdf: KdfParams): Promise<VaultKey> {
  const secret = new TextEncoder().encode(passphrase.trim().normalize('NFC'))
  const base = await crypto.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: kdf.hash, salt: fromBase64(kdf.salt), iterations: kdf.iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function generateDek(): Promise<VaultKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function encryptBytes(key: VaultKey, plain: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, own(plain)))
  const sealed = new Uint8Array(IV_BYTES + cipher.length)
  sealed.set(iv)
  sealed.set(cipher, IV_BYTES)
  return sealed
}

export async function decryptBytes(key: VaultKey, sealed: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = own(sealed)
  if (bytes.length <= IV_BYTES) throw new DecryptError()
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.subarray(0, IV_BYTES) },
      key,
      bytes.subarray(IV_BYTES),
    )
    return new Uint8Array(plain)
  } catch {
    throw new DecryptError()
  }
}

export async function encryptJson(key: VaultKey, value: unknown): Promise<string> {
  return toBase64(await encryptBytes(key, new TextEncoder().encode(JSON.stringify(value))))
}

export async function decryptJson<T>(key: VaultKey, sealed: string): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await decryptBytes(key, fromBase64(sealed)))) as T
}

export async function wrapDek(dek: VaultKey, kek: VaultKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dek))
  return toBase64(await encryptBytes(kek, raw))
}

export async function unwrapDek(wrapped: string, kek: VaultKey, extractable: boolean): Promise<VaultKey> {
  const raw = await decryptBytes(kek, fromBase64(wrapped))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt'])
}
```

- [ ] **Step 4: 创建 `src/vault/types.ts`**

```ts
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
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/vault/crypto.test.ts`
Expected: PASS（11 个测试）。

- [ ] **Step 6: 类型检查并提交**

```powershell
npx tsc -b
git add src/vault/crypto.ts src/vault/crypto.test.ts src/vault/types.ts
git commit -m "feat(vault): shared WebCrypto envelope encryption"
```

Expected: `tsc` 无输出。

---

### Task 2: 内容源解析

**Files:**
- Modify: `package.json`（新增开发依赖 `yaml`）
- Create: `scripts/lib/vaultSource.ts`、`scripts/lib/vaultSource.test.ts`

**Interfaces:**
- Consumes: `ListItem`（Task 1）
- Produces:
  - `class VaultError extends Error`（所有给用户看的脚本错误）
  - `isPhotoFile(name: string): boolean`、`isHeicFile(name: string): boolean`
  - `sha256Hex(data: Uint8Array | string): string`
  - `interface ParsedNote { title: string; date: string; body: string }`、`parseNote(file: string, text: string): ParsedNote`
  - `interface ParsedList { title: string; items: ListItem[] }`、`parseList(file: string, text: string): ParsedList`
  - `interface PhotoOverride { caption?: string; date?: string }`、`interface SourceConfig { photos: Record<string, PhotoOverride>; listOrder: string[] }`
  - `parseConfig(text: string | null): SourceConfig`
  - `checkConfigRefs(config: SourceConfig, photoNames: string[], listNames: string[]): void`
  - `sortLists(names: string[], order: string[]): string[]`

- [ ] **Step 1: 安装依赖**

```powershell
npm install -D yaml@^2.9.1
```

- [ ] **Step 2: 写失败的测试 `scripts/lib/vaultSource.test.ts`**

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  checkConfigRefs,
  isHeicFile,
  isPhotoFile,
  parseConfig,
  parseList,
  parseNote,
  sha256Hex,
  sortLists,
  VaultError,
} from './vaultSource.ts'

describe('photo file names', () => {
  it('accepts common formats case-insensitively', () => {
    expect(['a.jpg', 'b.JPEG', 'c.png', 'd.webp', 'e.HEIC', 'f.heif'].every(isPhotoFile)).toBe(true)
    expect(isPhotoFile('g.gif')).toBe(false)
    expect(isHeicFile('IMG_1.HEIC')).toBe(true)
    expect(isHeicFile('a.jpg')).toBe(false)
  })
})

describe('parseNote', () => {
  it('reads title, date and body, tolerating Windows line endings', () => {
    const text = '---\r\ntitle: 晚安\r\ndate: 2024-05-21\r\n---\r\n\r\n今天的风很温柔。\r\n'
    expect(parseNote('notes/a.md', text)).toEqual({ title: '晚安', date: '2024-05-21', body: '今天的风很温柔。' })
  })

  it('explains what is missing', () => {
    expect(() => parseNote('notes/a.md', '---\ndate: 2024-05-21\n---\nhi')).toThrow(new VaultError('notes/a.md：缺少 title'))
    expect(() => parseNote('notes/a.md', '---\ntitle: hi\ndate: 5月21日\n---\nhi')).toThrow(
      'notes/a.md：date 必须是 YYYY-MM-DD 格式',
    )
    expect(() => parseNote('notes/a.md', 'no front matter')).toThrow('notes/a.md：缺少 title')
  })
})

describe('parseList', () => {
  it('reads checked and unchecked items and ignores other lines', () => {
    const text = '---\ntitle: 一起去的地方\n---\n- [x] 去看海\n- [ ] 去冰岛看极光\n* [X] 吃火锅\n随便写的一行\n'
    expect(parseList('lists/a.md', text)).toEqual({
      title: '一起去的地方',
      items: [
        { text: '去看海', done: true },
        { text: '去冰岛看极光', done: false },
        { text: '吃火锅', done: true },
      ],
    })
  })

  it('rejects a list without items', () => {
    expect(() => parseList('lists/a.md', '---\ntitle: 空\n---\n')).toThrow('lists/a.md：没有找到「- [ ] 事项」这样的清单行')
  })
})

describe('parseConfig', () => {
  it('returns defaults without a manifest', () => {
    expect(parseConfig(null)).toEqual({ photos: {}, listOrder: [] })
  })

  it('reads photo captions, dates and the list order', () => {
    const text = 'photos:\n  IMG_0001.jpg:\n    caption: 第一次去海边\n    date: 2024-05-20\nlists:\n  order: [b.md, a.md]\n'
    expect(parseConfig(text)).toEqual({
      photos: { 'IMG_0001.jpg': { caption: '第一次去海边', date: '2024-05-20' } },
      listOrder: ['b.md', 'a.md'],
    })
  })

  it('rejects invalid YAML and bad dates', () => {
    expect(() => parseConfig('photos: [')).toThrow('manifest.yaml 不是有效的 YAML')
    expect(() => parseConfig('photos:\n  a.jpg:\n    date: yesterday\n')).toThrow(
      'manifest.yaml 里的 a.jpg：date 必须是 YYYY-MM-DD 格式',
    )
  })
})

describe('checkConfigRefs', () => {
  it('rejects references to files that do not exist', () => {
    const config = parseConfig('photos:\n  gone.jpg:\n    caption: x\n')
    expect(() => checkConfigRefs(config, ['a.jpg'], [])).toThrow('manifest.yaml 提到了不存在的照片：gone.jpg')
    expect(() => checkConfigRefs({ photos: {}, listOrder: ['x.md'] }, [], ['a.md'])).toThrow(
      'manifest.yaml 提到了不存在的清单：x.md',
    )
  })
})

describe('sortLists', () => {
  it('puts ordered lists first, then the rest by name', () => {
    expect(sortLists(['c.md', 'a.md', 'b.md'], ['b.md'])).toEqual(['b.md', 'a.md', 'c.md'])
  })
})

describe('sha256Hex', () => {
  it('hashes text and bytes the same way', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(sha256Hex('abc'))
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/vaultSource.test.ts`
Expected: FAIL，提示无法解析 `./vaultSource.ts`。

- [ ] **Step 4: 实现 `scripts/lib/vaultSource.ts`**

```ts
import { createHash } from 'node:crypto'
import { parse as parseYaml } from 'yaml'
import type { ListItem } from '../../src/vault/types.ts'

export class VaultError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultError'
  }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const PHOTO_RE = /\.(jpe?g|png|webp|heic|heif)$/i
const HEIC_RE = /\.(heic|heif)$/i
const ITEM_RE = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/
const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/

export function isPhotoFile(name: string): boolean {
  return PHOTO_RE.test(name)
}

export function isHeicFile(name: string): boolean {
  return HEIC_RE.test(name)
}

export function sha256Hex(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function splitFrontMatter(file: string, text: string): { data: Record<string, unknown>; body: string } {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const match = FRONT_MATTER_RE.exec(normalized)
  if (!match) return { data: {}, body: normalized }
  let data: unknown
  try {
    data = parseYaml(match[1])
  } catch {
    throw new VaultError(`${file}：开头的 title/date 部分格式不对`)
  }
  if (data !== null && !isRecord(data)) throw new VaultError(`${file}：开头的 title/date 部分格式不对`)
  return { data: data ?? {}, body: match[2] }
}

function requireTitle(file: string, data: Record<string, unknown>): string {
  const title = data.title
  if ((typeof title !== 'string' && typeof title !== 'number') || String(title).trim() === '') {
    throw new VaultError(`${file}：缺少 title`)
  }
  return String(title).trim()
}

function requireDate(label: string, value: unknown): string {
  if (typeof value !== 'string' || !DAY_RE.test(value)) throw new VaultError(`${label}：date 必须是 YYYY-MM-DD 格式`)
  return value
}

export interface ParsedNote {
  title: string
  date: string
  body: string
}

export function parseNote(file: string, text: string): ParsedNote {
  const { data, body } = splitFrontMatter(file, text)
  return { title: requireTitle(file, data), date: requireDate(file, data.date), body: body.trim() }
}

export interface ParsedList {
  title: string
  items: ListItem[]
}

export function parseList(file: string, text: string): ParsedList {
  const { data, body } = splitFrontMatter(file, text)
  const title = requireTitle(file, data)
  const items = body.split('\n').flatMap((line): ListItem[] => {
    const match = ITEM_RE.exec(line)
    return match ? [{ text: match[2], done: match[1] !== ' ' }] : []
  })
  if (items.length === 0) throw new VaultError(`${file}：没有找到「- [ ] 事项」这样的清单行`)
  return { title, items }
}

export interface PhotoOverride {
  caption?: string
  date?: string
}

export interface SourceConfig {
  photos: Record<string, PhotoOverride>
  listOrder: string[]
}

export function parseConfig(text: string | null): SourceConfig {
  if (text === null) return { photos: {}, listOrder: [] }
  let raw: unknown
  try {
    raw = parseYaml(text)
  } catch {
    throw new VaultError('manifest.yaml 不是有效的 YAML')
  }
  if (raw !== null && !isRecord(raw)) throw new VaultError('manifest.yaml 顶层必须是 photos: 和 lists: 两部分')
  const root = raw ?? {}

  const photos: Record<string, PhotoOverride> = {}
  if (root.photos !== undefined && root.photos !== null) {
    if (!isRecord(root.photos)) throw new VaultError('manifest.yaml：photos 下面要写成「文件名: 设置」')
    for (const [name, value] of Object.entries(root.photos)) {
      if (!isRecord(value)) throw new VaultError(`manifest.yaml 里的 ${name}：要写 caption 或 date`)
      const override: PhotoOverride = {}
      if (value.caption !== undefined && value.caption !== null) override.caption = String(value.caption)
      if (value.date !== undefined && value.date !== null) override.date = requireDate(`manifest.yaml 里的 ${name}`, value.date)
      photos[name] = override
    }
  }

  let listOrder: string[] = []
  if (root.lists !== undefined && root.lists !== null) {
    const order = isRecord(root.lists) ? root.lists.order : undefined
    if (!isRecord(root.lists) || (order !== undefined && order !== null && !Array.isArray(order))) {
      throw new VaultError('manifest.yaml：lists.order 必须是文件名列表')
    }
    listOrder = Array.isArray(order) ? order.map(String) : []
  }
  return { photos, listOrder }
}

export function checkConfigRefs(config: SourceConfig, photoNames: string[], listNames: string[]): void {
  for (const name of Object.keys(config.photos)) {
    if (!photoNames.includes(name)) throw new VaultError(`manifest.yaml 提到了不存在的照片：${name}`)
  }
  for (const name of config.listOrder) {
    if (!listNames.includes(name)) throw new VaultError(`manifest.yaml 提到了不存在的清单：${name}`)
  }
}

export function sortLists(names: string[], order: string[]): string[] {
  const ranked = order.filter((name) => names.includes(name))
  const rest = names.filter((name) => !order.includes(name)).sort((a, b) => a.localeCompare(b))
  return [...ranked, ...rest]
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/vaultSource.test.ts`
Expected: PASS（11 个测试）。

- [ ] **Step 6: 类型检查并提交**

```powershell
npx tsc -b
git add package.json package-lock.json scripts/lib/vaultSource.ts scripts/lib/vaultSource.test.ts
git commit -m "feat(vault): parse notes, lists and manifest.yaml"
```

Expected: `tsc` 无输出。

---

### Task 3: 照片处理（含 HEIC）

**Files:**
- Modify: `package.json`（新增开发依赖 `sharp`、`heic-decode`、`exifr`）
- Create: `scripts/types/heic-decode.d.ts`、`scripts/lib/photo.ts`、`scripts/lib/photo.test.ts`

**Interfaces:**
- Consumes: `isHeicFile`（Task 2）
- Produces:
  - `FULL_MAX_EDGE = 2000`、`THUMB_EDGE = 400`
  - `interface ProcessedPhoto { full: Uint8Array; thumb: Uint8Array; width: number; height: number }`
  - `type HeicDecoder = (input: { buffer: Uint8Array }) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>`
  - `processPhoto(name: string, bytes: Uint8Array, decodeHeic?: HeicDecoder): Promise<ProcessedPhoto>`
  - `photoDate(bytes: Uint8Array, fallback: Date): Promise<string>`（`YYYY-MM-DD`，按本地时间）

已验证的事实：`sharp` 的 `.withExif()` 能写入 GPS（`IFD3`）和拍摄时间（`IFD2`），`exifr.gps()` 能读回；`sharp` 输出 WebP 时默认不带 EXIF（`metadata().exif` 为 `undefined`）；`.jpeg().withMetadata({ orientation: 6 })` 生成的 64×32 图经 `.rotate()` 后变成 32×64；`exifr` 把拍摄时间按本地时间解析成 `Date`。`heic-decode` 是 CommonJS、没有类型声明，默认导出 `({ buffer }) => Promise<{ width, height, data }>`，`data` 为 RGBA。

- [ ] **Step 1: 安装依赖**

```powershell
npm install -D sharp@^0.35.5 heic-decode@^2.1.0 exifr@^7.1.3
```

- [ ] **Step 2: 创建 `scripts/types/heic-decode.d.ts`**

```ts
declare module 'heic-decode' {
  interface DecodedImage {
    width: number
    height: number
    data: Uint8ClampedArray
  }

  function decode(input: { buffer: Uint8Array | ArrayBuffer }): Promise<DecodedImage>
  export default decode
}
```

- [ ] **Step 3: 写失败的测试 `scripts/lib/photo.test.ts`**

```ts
// @vitest-environment node
import exifr from 'exifr'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import { photoDate, processPhoto, type HeicDecoder } from './photo.ts'

function canvas(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#c1272d' } })
}

const GPS_EXIF = {
  IFD0: { Make: 'Test' },
  IFD2: { DateTimeOriginal: '2024:05:20 18:30:00' },
  IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '31/1 14/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '121/1 28/1 0/1' },
}

describe('processPhoto', () => {
  it('shrinks to 2000px, makes a 400px square thumbnail and strips all metadata', async () => {
    const source = await canvas(3000, 1500).withExif(GPS_EXIF).jpeg().toBuffer()
    expect(await exifr.gps(source)).toMatchObject({ latitude: expect.any(Number) })

    const result = await processPhoto('IMG_0001.JPG', source)
    expect(result).toMatchObject({ width: 2000, height: 1000 })
    const full = await sharp(result.full).metadata()
    expect(full).toMatchObject({ format: 'webp', width: 2000, height: 1000 })
    expect(full.exif).toBeUndefined()
    expect(await sharp(result.thumb).metadata()).toMatchObject({ format: 'webp', width: 400, height: 400 })
  })

  it('never enlarges small photos', async () => {
    const source = await canvas(300, 200).png().toBuffer()
    expect(await processPhoto('small.png', source)).toMatchObject({ width: 300, height: 200 })
  })

  it('turns photos upright using the EXIF orientation', async () => {
    const source = await canvas(64, 32).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    expect(await processPhoto('turned.jpg', source)).toMatchObject({ width: 32, height: 64 })
  })

  it('decodes HEIC through the injected decoder', async () => {
    const decode = vi.fn<HeicDecoder>(async () => ({ width: 6, height: 4, data: new Uint8ClampedArray(6 * 4 * 4).fill(128) }))
    const bytes = new Uint8Array([1, 2, 3])
    const result = await processPhoto('IMG_0002.HEIC', bytes, decode)
    expect(decode).toHaveBeenCalledWith({ buffer: bytes })
    expect(result).toMatchObject({ width: 6, height: 4 })
    expect(await sharp(result.full).metadata()).toMatchObject({ format: 'webp' })
    expect(await sharp(result.thumb).metadata()).toMatchObject({ width: 400, height: 400 })
  })
})

describe('photoDate', () => {
  it('uses the EXIF capture date', async () => {
    const source = await canvas(8, 8).withExif(GPS_EXIF).jpeg().toBuffer()
    expect(await photoDate(source, new Date(2000, 0, 1))).toBe('2024-05-20')
  })

  it('falls back to the given date when there is no EXIF date', async () => {
    const source = await canvas(8, 8).png().toBuffer()
    expect(await photoDate(source, new Date(2023, 0, 2, 12))).toBe('2023-01-02')
  })
})
```

- [ ] **Step 4: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/photo.test.ts`
Expected: FAIL，提示无法解析 `./photo.ts`。

- [ ] **Step 5: 实现 `scripts/lib/photo.ts`**

```ts
import exifr from 'exifr'
import decodeHeic from 'heic-decode'
import sharp from 'sharp'
import { isHeicFile } from './vaultSource.ts'

export const FULL_MAX_EDGE = 2000
export const THUMB_EDGE = 400

export interface ProcessedPhoto {
  full: Uint8Array
  thumb: Uint8Array
  width: number
  height: number
}

export type HeicDecoder = (input: {
  buffer: Uint8Array
}) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>

type Pipeline = ReturnType<typeof sharp>

export async function processPhoto(
  name: string,
  bytes: Uint8Array,
  decode: HeicDecoder = decodeHeic,
): Promise<ProcessedPhoto> {
  let open: () => Pipeline
  if (isHeicFile(name)) {
    // libheif already applies the container's rotation, and raw pixels carry no EXIF.
    const image = await decode({ buffer: bytes })
    const pixels = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength)
    open = () => sharp(pixels, { raw: { width: image.width, height: image.height, channels: 4 } })
  } else {
    open = () => sharp(bytes).rotate()
  }

  const full = await open()
    .resize({ width: FULL_MAX_EDGE, height: FULL_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })
  const thumb = await open().resize(THUMB_EDGE, THUMB_EDGE, { fit: 'cover' }).webp({ quality: 70 }).toBuffer()
  return { full: full.data, thumb, width: full.info.width, height: full.info.height }
}

function formatDay(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function photoDate(bytes: Uint8Array, fallback: Date): Promise<string> {
  const tags: { DateTimeOriginal?: unknown; CreateDate?: unknown } | undefined = await exifr
    .parse(bytes, { pick: ['DateTimeOriginal', 'CreateDate'] })
    .catch(() => undefined)
  const taken = tags?.DateTimeOriginal ?? tags?.CreateDate
  return formatDay(taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken : fallback)
}
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/photo.test.ts`
Expected: PASS（6 个测试）。

- [ ] **Step 7: 类型检查并提交**

```powershell
npx tsc -b
git add package.json package-lock.json scripts/types/heic-decode.d.ts scripts/lib/photo.ts scripts/lib/photo.test.ts
git commit -m "feat(vault): resize photos to WebP, strip metadata, decode HEIC"
```

Expected: `tsc` 无输出。

---

### Task 4: 增量构建

**Files:**
- Create: `scripts/lib/vaultBuild.ts`、`scripts/lib/vaultBuild.test.ts`

**Interfaces:**
- Consumes: `encryptBytes`、`VaultKey`（Task 1）；`VaultManifest`、`ListContent`、`ListItem`（Task 1）；`ProcessedPhoto`（Task 3）
- Produces:
  - `type SourceItem =`
    - `| { kind: 'photo'; source: string; hash: string; caption: string; date: string; load: () => Promise<ProcessedPhoto> }`
    - `| { kind: 'note'; source: string; hash: string; title: string; date: string; body: string }`
    - `| { kind: 'list'; source: string; hash: string; title: string; items: ListItem[] }`
  - `interface BuildResult { manifest: VaultManifest; writes: Map<string, Uint8Array> }`（键是 blob 名，不含 `.bin`）
  - `emptyManifest(): VaultManifest`
  - `referencedBlobs(manifest: VaultManifest): Set<string>`
  - `buildVault(items: SourceItem[], previous: VaultManifest | null, dek: VaultKey, onItem?: (source: string, reused: boolean) => void): Promise<BuildResult>`：同 `source` 同 `hash` 的项沿用旧 blob 名（照片的 `caption`、`date` 用新值）；照片和笔记按日期从新到旧排序（同日按 `source`），清单保持传入顺序。

- [ ] **Step 1: 写失败的测试 `scripts/lib/vaultBuild.test.ts`**

```ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { decryptBytes, generateDek, type VaultKey } from '../../src/vault/crypto.ts'
import { buildVault, referencedBlobs, type SourceItem } from './vaultBuild.ts'

const text = (s: string) => new TextEncoder().encode(s)

function photo(source: string, hash: string, date: string, caption = '') {
  const load = vi.fn(async () => ({ full: text(`full ${source}`), thumb: text(`thumb ${source}`), width: 2000, height: 1500 }))
  return { kind: 'photo', source, hash, caption, date, load } satisfies SourceItem
}

const note = {
  kind: 'note',
  source: 'notes/a.md',
  hash: 'n1',
  title: '晚安',
  date: '2024-05-21',
  body: '今天的风很温柔。',
} satisfies SourceItem

const list = {
  kind: 'list',
  source: 'lists/a.md',
  hash: 'l1',
  title: '一起去的地方',
  items: [{ text: '去看海', done: true }],
} satisfies SourceItem

async function open(dek: VaultKey, writes: Map<string, Uint8Array>, name: string) {
  return new TextDecoder().decode(await decryptBytes(dek, writes.get(name)!))
}

describe('buildVault', () => {
  it('encrypts every item on the first build and sorts by date', async () => {
    const dek = await generateDek()
    const items = [photo('photos/old.jpg', 'p1', '2023-01-01'), photo('photos/new.jpg', 'p2', '2024-05-20', '海边'), note, list]
    const { manifest, writes } = await buildVault(items, null, dek)

    expect(writes.size).toBe(6)
    expect(manifest.photos.map((p) => p.source)).toEqual(['photos/new.jpg', 'photos/old.jpg'])
    expect(manifest.photos[0]).toMatchObject({ caption: '海边', date: '2024-05-20', width: 2000, height: 1500, hash: 'p2' })
    expect(await open(dek, writes, manifest.photos[0].thumb)).toBe('thumb photos/new.jpg')
    expect(await open(dek, writes, manifest.photos[0].full)).toBe('full photos/new.jpg')
    expect(manifest.notes[0]).toMatchObject({ title: '晚安', date: '2024-05-21', source: 'notes/a.md', hash: 'n1' })
    expect(await open(dek, writes, manifest.notes[0].blob)).toBe('今天的风很温柔。')
    expect(JSON.parse(await open(dek, writes, manifest.lists[0].blob))).toEqual({ items: [{ text: '去看海', done: true }] })
    expect(referencedBlobs(manifest)).toEqual(new Set(writes.keys()))
  })

  it('reuses unchanged items without reprocessing photos', async () => {
    const dek = await generateDek()
    const first = await buildVault([photo('photos/a.jpg', 'p1', '2024-05-20'), note, list], null, dek)
    const again = photo('photos/a.jpg', 'p1', '2024-05-20', '新说明')
    const second = await buildVault([again, note, list], first.manifest, dek)

    expect(second.writes.size).toBe(0)
    expect(again.load).not.toHaveBeenCalled()
    expect(second.manifest.photos[0]).toMatchObject({
      caption: '新说明',
      thumb: first.manifest.photos[0].thumb,
      full: first.manifest.photos[0].full,
    })
    expect(second.manifest.notes[0].blob).toBe(first.manifest.notes[0].blob)
    expect(second.manifest.lists[0].blob).toBe(first.manifest.lists[0].blob)
  })

  it('re-encrypts changed items and drops removed ones', async () => {
    const dek = await generateDek()
    const first = await buildVault([note, list], null, dek)
    const second = await buildVault([{ ...note, hash: 'n2', body: '改过了' }], first.manifest, dek)

    expect(second.writes.size).toBe(1)
    expect(second.manifest.notes[0].blob).not.toBe(first.manifest.notes[0].blob)
    expect(await open(dek, second.writes, second.manifest.notes[0].blob)).toBe('改过了')
    expect(second.manifest.lists).toEqual([])
    expect(referencedBlobs(second.manifest).has(first.manifest.lists[0].blob)).toBe(false)
  })

  it('reports whether each item was reused', async () => {
    const dek = await generateDek()
    const onItem = vi.fn()
    const first = await buildVault([note], null, dek, onItem)
    await buildVault([note], first.manifest, dek, onItem)
    expect(onItem.mock.calls).toEqual([
      ['notes/a.md', false],
      ['notes/a.md', true],
    ])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/vaultBuild.test.ts`
Expected: FAIL，提示无法解析 `./vaultBuild.ts`。

- [ ] **Step 3: 实现 `scripts/lib/vaultBuild.ts`**

```ts
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/vaultBuild.test.ts`
Expected: PASS（4 个测试）。

- [ ] **Step 5: 类型检查并提交**

```powershell
npx tsc -b
git add scripts/lib/vaultBuild.ts scripts/lib/vaultBuild.test.ts
git commit -m "feat(vault): incremental build that reuses unchanged blobs"
```

Expected: `tsc` 无输出。

---

### Task 5: 命令行：npm run vault 和 npm run vault:rekey

**Files:**
- Modify: `.gitignore`、`package.json`（`scripts` 加 `vault`、`vault:rekey`）
- Create: `scripts/lib/vaultCommand.ts`、`scripts/lib/vaultCommand.test.ts`、`scripts/lib/prompt.ts`、`scripts/vault.ts`、`scripts/vault-rekey.ts`

**Interfaces:**
- Consumes: Task 1 的 `checkPassphrase`、`decryptJson`、`DecryptError`、`deriveKek`、`encryptJson`、`generateDek`、`newKdfParams`、`unwrapDek`、`wrapDek`、`KdfParams`、`VaultKey`、`VaultFile`、`VaultManifest`；Task 2 的 `VaultError`、`isPhotoFile`、`parseConfig`、`parseNote`、`parseList`、`checkConfigRefs`、`sortLists`、`sha256Hex`；Task 3 的 `processPhoto`、`photoDate`；Task 4 的 `buildVault`、`referencedBlobs`、`SourceItem`
- Produces:
  - `VAULT_FILE = 'vault.json'`、`BLOB_DIR = 'blobs'`、`SIZE_WARNING_BYTES = 300 * 1024 * 1024`
  - `class WrongPassphraseError extends VaultError`（消息「口令不对」）
  - `vaultExists(outDir: string): boolean`
  - `scanSource(sourceDir: string): Promise<SourceItem[]>`
  - `runVault(options: { sourceDir: string; outDir: string; passphrase: string; iterations?: number; log?: (line: string) => void }): Promise<{ photos: number; notes: number; lists: number; written: number; removed: number; totalBytes: number }>`
  - `runRekey(options: { outDir: string; oldPassphrase: string; newPassphrase: string; iterations?: number }): Promise<void>`
  - `askHidden(question: string): Promise<string>`
  - 输出文件：`<outDir>/vault.json`、`<outDir>/blobs/<blob名>.bin`

- [ ] **Step 1: 写失败的测试 `scripts/lib/vaultCommand.test.ts`**

```ts
// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decryptJson, deriveKek, unwrapDek } from '../../src/vault/crypto.ts'
import type { VaultFile, VaultManifest } from '../../src/vault/types.ts'
import { runRekey, runVault, WrongPassphraseError } from './vaultCommand.ts'

const PASS = 'iceland aurora penguin goodnight'
let root = ''
let src = ''
let out = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vault-test-'))
  src = join(root, 'vault-src')
  out = join(root, 'public', 'vault')
  for (const dir of ['photos', 'notes', 'lists']) await mkdir(join(src, dir), { recursive: true })
  const jpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#bf9f62' } }).jpeg().toBuffer()
  await writeFile(join(src, 'photos', 'a.jpg'), jpeg)
  await writeFile(join(src, 'notes', 'a.md'), '---\ntitle: 晚安\ndate: 2024-05-21\n---\n今天的风很温柔。\n')
  await writeFile(join(src, 'lists', 'a.md'), '---\ntitle: 一起去的地方\n---\n- [x] 去看海\n')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const run = (passphrase = PASS) => runVault({ sourceDir: src, outDir: out, passphrase, iterations: 1000 })
const blobs = async () => (await readdir(join(out, 'blobs'))).sort()
const vaultText = () => readFile(join(out, 'vault.json'), 'utf8')

async function openAsBrowser(passphrase: string): Promise<VaultManifest> {
  const file = JSON.parse(await vaultText()) as VaultFile
  const dek = await unwrapDek(file.wrappedKey, await deriveKek(passphrase, file.kdf), false)
  return decryptJson<VaultManifest>(dek, file.manifest)
}

describe('runVault', () => {
  it('creates a vault the browser code can open', async () => {
    expect(await run()).toMatchObject({ photos: 1, notes: 1, lists: 1, written: 4, removed: 0 })
    const manifest = await openAsBrowser(PASS)
    expect(manifest.notes[0]).toMatchObject({ title: '晚安', source: 'notes/a.md' })
    expect(manifest.photos[0]).toMatchObject({ source: 'photos/a.jpg', width: 40, height: 30 })
    expect(await blobs()).toHaveLength(4)
    expect(JSON.parse(await vaultText()).kdf.iterations).toBe(1000)
  })

  it('only writes what changed on later runs', async () => {
    await run()
    const before = await blobs()
    expect(await run()).toMatchObject({ written: 0, removed: 0 })
    expect(await blobs()).toEqual(before)

    await writeFile(join(src, 'notes', 'b.md'), '---\ntitle: 早安\ndate: 2024-05-22\n---\n早。\n')
    await rm(join(src, 'lists', 'a.md'))
    expect(await run()).toMatchObject({ notes: 2, lists: 0, written: 1, removed: 1 })
  })

  it('refuses a wrong passphrase without touching anything', async () => {
    await run()
    const before = await vaultText()
    await expect(run('iceland aurora penguin goodbye')).rejects.toBeInstanceOf(WrongPassphraseError)
    expect(await vaultText()).toBe(before)
  })

  it('refuses a weak passphrase for a new vault', async () => {
    await expect(run('short')).rejects.toThrow('口令至少要 16 个字符')
    await expect(readdir(out)).rejects.toThrow()
  })

  it('refuses unsupported photos before writing anything', async () => {
    await writeFile(join(src, 'photos', 'b.gif'), 'gif')
    await expect(run()).rejects.toThrow('不支持的图片格式：photos/b.gif')
    await expect(readFile(join(out, 'vault.json'))).rejects.toThrow()
  })
})

describe('runRekey', () => {
  const NEW_PASS = '新的 口令 也要 够长'

  it('switches the passphrase without touching the content', async () => {
    await run()
    const before = JSON.parse(await vaultText()) as VaultFile
    const files = await blobs()
    await runRekey({ outDir: out, oldPassphrase: PASS, newPassphrase: NEW_PASS, iterations: 1000 })
    const after = JSON.parse(await vaultText()) as VaultFile

    expect(after.manifest).toBe(before.manifest)
    expect(after.kdf.salt).not.toBe(before.kdf.salt)
    expect(await blobs()).toEqual(files)
    expect((await openAsBrowser(NEW_PASS)).notes).toHaveLength(1)
    await expect(openAsBrowser(PASS)).rejects.toThrow()
  })

  it('requires the current passphrase', async () => {
    await run()
    await expect(
      runRekey({ outDir: out, oldPassphrase: 'iceland aurora penguin goodbye', newPassphrase: NEW_PASS, iterations: 1000 }),
    ).rejects.toBeInstanceOf(WrongPassphraseError)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/vaultCommand.test.ts`
Expected: FAIL，提示无法解析 `./vaultCommand.ts`。

- [ ] **Step 3: 实现 `scripts/lib/vaultCommand.ts`**

```ts
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  checkPassphrase,
  DecryptError,
  decryptJson,
  deriveKek,
  encryptJson,
  generateDek,
  newKdfParams,
  unwrapDek,
  wrapDek,
  type VaultKey,
} from '../../src/vault/crypto.ts'
import type { VaultFile, VaultManifest } from '../../src/vault/types.ts'
import { photoDate, processPhoto } from './photo.ts'
import { buildVault, referencedBlobs, type SourceItem } from './vaultBuild.ts'
import {
  checkConfigRefs,
  isPhotoFile,
  parseConfig,
  parseList,
  parseNote,
  sha256Hex,
  sortLists,
  VaultError,
} from './vaultSource.ts'

export const VAULT_FILE = 'vault.json'
export const BLOB_DIR = 'blobs'
export const SIZE_WARNING_BYTES = 300 * 1024 * 1024

const IGNORED_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])

export class WrongPassphraseError extends VaultError {
  constructor() {
    super('口令不对')
    this.name = 'WrongPassphraseError'
  }
}

async function listFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && !IGNORED_FILES.has(entry.name.toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

const isMarkdown = (name: string) => name.toLowerCase().endsWith('.md')

export async function scanSource(sourceDir: string): Promise<SourceItem[]> {
  if (!existsSync(sourceDir)) throw new VaultError(`找不到内容文件夹 ${sourceDir}`)
  const configPath = join(sourceDir, 'manifest.yaml')
  const config = parseConfig(existsSync(configPath) ? await readFile(configPath, 'utf8') : null)

  const photoFiles = await listFiles(join(sourceDir, 'photos'))
  const unsupported = photoFiles.find((name) => !isPhotoFile(name))
  if (unsupported) throw new VaultError(`不支持的图片格式：photos/${unsupported}（支持 jpg、png、webp、heic）`)
  const noteFiles = (await listFiles(join(sourceDir, 'notes'))).filter(isMarkdown)
  const listFilesSorted = sortLists((await listFiles(join(sourceDir, 'lists'))).filter(isMarkdown), config.listOrder)
  checkConfigRefs(config, photoFiles, listFilesSorted)

  const items: SourceItem[] = []
  for (const name of photoFiles) {
    const path = join(sourceDir, 'photos', name)
    const bytes = await readFile(path)
    const override = config.photos[name] ?? {}
    items.push({
      kind: 'photo',
      source: `photos/${name}`,
      hash: sha256Hex(bytes),
      caption: override.caption ?? '',
      date: override.date ?? (await photoDate(bytes, (await stat(path)).mtime)),
      load: async () => {
        try {
          return await processPhoto(name, await readFile(path))
        } catch (error) {
          throw new VaultError(`photos/${name} 处理失败：${error instanceof Error ? error.message : String(error)}`)
        }
      },
    })
  }
  for (const name of noteFiles) {
    const text = await readFile(join(sourceDir, 'notes', name), 'utf8')
    items.push({ kind: 'note', source: `notes/${name}`, hash: sha256Hex(text), ...parseNote(`notes/${name}`, text) })
  }
  for (const name of listFilesSorted) {
    const text = await readFile(join(sourceDir, 'lists', name), 'utf8')
    items.push({ kind: 'list', source: `lists/${name}`, hash: sha256Hex(text), ...parseList(`lists/${name}`, text) })
  }
  return items
}

export function vaultExists(outDir: string): boolean {
  return existsSync(join(outDir, VAULT_FILE))
}

async function readVaultFile(outDir: string): Promise<VaultFile | null> {
  if (!vaultExists(outDir)) return null
  return JSON.parse(await readFile(join(outDir, VAULT_FILE), 'utf8')) as VaultFile
}

async function writeVaultFile(outDir: string, file: VaultFile): Promise<void> {
  await writeFile(join(outDir, VAULT_FILE), `${JSON.stringify(file, null, 2)}\n`)
}

async function openVault(file: VaultFile, passphrase: string): Promise<{ dek: VaultKey; manifest: VaultManifest }> {
  const kek = await deriveKek(passphrase, file.kdf)
  try {
    const dek = await unwrapDek(file.wrappedKey, kek, true)
    return { dek, manifest: await decryptJson<VaultManifest>(dek, file.manifest) }
  } catch (error) {
    if (error instanceof DecryptError) throw new WrongPassphraseError()
    throw error
  }
}

export interface RunVaultOptions {
  sourceDir: string
  outDir: string
  passphrase: string
  iterations?: number
  log?: (line: string) => void
}

export interface RunVaultResult {
  photos: number
  notes: number
  lists: number
  written: number
  removed: number
  totalBytes: number
}

export async function runVault(options: RunVaultOptions): Promise<RunVaultResult> {
  const { sourceDir, outDir, passphrase } = options
  const log = options.log ?? (() => undefined)

  const existing = await readVaultFile(outDir)
  let dek: VaultKey
  let previous: VaultManifest | null
  let kdf = existing?.kdf
  let wrappedKey = existing?.wrappedKey
  if (existing) {
    ;({ dek, manifest: previous } = await openVault(existing, passphrase))
  } else {
    const weak = checkPassphrase(passphrase)
    if (weak) throw new VaultError(weak)
    kdf = newKdfParams(options.iterations)
    dek = await generateDek()
    wrappedKey = await wrapDek(dek, await deriveKek(passphrase, kdf))
    previous = null
  }

  const items = await scanSource(sourceDir)
  const { manifest, writes } = await buildVault(items, previous, dek, (source, reused) =>
    log(`${reused ? '沿用' : '加密'} ${source}`),
  )

  const blobDir = join(outDir, BLOB_DIR)
  await mkdir(blobDir, { recursive: true })
  for (const [name, bytes] of writes) await writeFile(join(blobDir, `${name}.bin`), bytes)
  const keep = referencedBlobs(manifest)
  let removed = 0
  for (const file of await readdir(blobDir)) {
    if (file.endsWith('.bin') && !keep.has(file.slice(0, -'.bin'.length))) {
      await rm(join(blobDir, file))
      removed++
    }
  }
  await writeVaultFile(outDir, { version: 1, kdf: kdf!, wrappedKey: wrappedKey!, manifest: await encryptJson(dek, manifest) })

  let totalBytes = (await stat(join(outDir, VAULT_FILE))).size
  for (const file of await readdir(blobDir)) totalBytes += (await stat(join(blobDir, file))).size
  return {
    photos: manifest.photos.length,
    notes: manifest.notes.length,
    lists: manifest.lists.length,
    written: writes.size,
    removed,
    totalBytes,
  }
}

export interface RunRekeyOptions {
  outDir: string
  oldPassphrase: string
  newPassphrase: string
  iterations?: number
}

export async function runRekey(options: RunRekeyOptions): Promise<void> {
  const existing = await readVaultFile(options.outDir)
  if (!existing) throw new VaultError('还没有保险库，先运行 npm run vault')
  const weak = checkPassphrase(options.newPassphrase)
  if (weak) throw new VaultError(weak)
  const { dek } = await openVault(existing, options.oldPassphrase)
  const kdf = newKdfParams(options.iterations)
  const wrappedKey = await wrapDek(dek, await deriveKek(options.newPassphrase, kdf))
  await writeVaultFile(options.outDir, { ...existing, kdf, wrappedKey })
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/vaultCommand.test.ts`
Expected: PASS（7 个测试）。

- [ ] **Step 5: 实现 `scripts/lib/prompt.ts`**

```ts
export function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process
  if (!stdin.isTTY) {
    return Promise.reject(new Error('请在交互式终端里直接运行，口令不能通过管道或参数传入'))
  }
  stdout.write(question)
  stdin.setRawMode(true)
  stdin.setEncoding('utf8')
  stdin.resume()

  return new Promise((resolve, reject) => {
    let value = ''
    const finish = () => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\n')
    }
    function onData(chunk: string) {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          finish()
          resolve(value)
          return
        }
        if (ch === '\u0003') {
          finish()
          reject(new Error('已取消'))
          return
        }
        if (ch === '\u007f' || ch === '\b') {
          value = [...value].slice(0, -1).join('')
          continue
        }
        value += ch
      }
    }
    stdin.on('data', onData)
  })
}
```

- [ ] **Step 6: 创建 `scripts/vault.ts`**

```ts
import { askHidden } from './lib/prompt.ts'
import { runVault, SIZE_WARNING_BYTES, vaultExists } from './lib/vaultCommand.ts'
import { VaultError } from './lib/vaultSource.ts'

const SOURCE_DIR = 'vault-src'
const OUT_DIR = 'public/vault'

try {
  let passphrase: string
  if (vaultExists(OUT_DIR)) {
    passphrase = await askHidden('保险库口令：')
  } else {
    console.log('第一次创建保险库。口令至少 16 个字符，或至少 4 个用空格分开的词。')
    passphrase = await askHidden('设置口令：')
    if ((await askHidden('再输入一遍：')) !== passphrase) throw new VaultError('两次输入的口令不一样')
  }

  const result = await runVault({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, passphrase, log: (line) => console.log(line) })
  console.log(`照片 ${result.photos} 张，笔记 ${result.notes} 篇，清单 ${result.lists} 个`)
  console.log(
    `新写入 ${result.written} 个密文文件，删除 ${result.removed} 个；${OUT_DIR} 共 ${(result.totalBytes / 1024 / 1024).toFixed(1)} MB`,
  )
  if (result.totalBytes > SIZE_WARNING_BYTES) {
    console.warn('警告：保险库超过 300 MB。GitHub Pages 站点上限约 1 GB，考虑删减照片。')
  }
} catch (error) {
  if (!(error instanceof VaultError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
```

- [ ] **Step 7: 创建 `scripts/vault-rekey.ts`**

```ts
import { askHidden } from './lib/prompt.ts'
import { runRekey } from './lib/vaultCommand.ts'
import { VaultError } from './lib/vaultSource.ts'

const OUT_DIR = 'public/vault'

try {
  const oldPassphrase = await askHidden('现在的口令：')
  const newPassphrase = await askHidden('新口令：')
  if ((await askHidden('再输入一遍新口令：')) !== newPassphrase) throw new VaultError('两次输入的新口令不一样')
  await runRekey({ outDir: OUT_DIR, oldPassphrase, newPassphrase })
  console.log('口令已更换。提交并推送 public/vault/vault.json 后生效。')
} catch (error) {
  if (!(error instanceof VaultError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
```

- [ ] **Step 8: 修改 `package.json` 的 `scripts` 和 `.gitignore`**

`package.json` 的 `scripts` 改为：

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build && node -e \"require('node:fs').copyFileSync('dist/index.html','dist/404.html')\"",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "words": "tsx scripts/build-words.ts",
    "vault": "tsx scripts/vault.ts",
    "vault:rekey": "tsx scripts/vault-rekey.ts"
  },
```

`.gitignore` 末尾加一行：

```gitignore
vault-src/
```

- [ ] **Step 9: 确认非交互终端会拒绝运行**

Run: `echo x | npm run vault`
Expected: 报错 `请在交互式终端里直接运行，口令不能通过管道或参数传入`，没有生成 `public/vault/`（`Test-Path public/vault` 输出 `False`）。

- [ ] **Step 10: 类型检查、全量测试并提交**

```powershell
npx tsc -b
npm test
git add .gitignore package.json scripts/lib/vaultCommand.ts scripts/lib/vaultCommand.test.ts scripts/lib/prompt.ts scripts/vault.ts scripts/vault-rekey.ts
git commit -m "feat(vault): vault and vault:rekey commands"
```

Expected: `tsc` 无输出；全部测试通过。

---

### Task 6: 浏览器端读取和记住设备

**Files:**
- Modify: `package.json`（新增开发依赖 `fake-indexeddb`）
- Create: `src/vault/repo.ts`、`src/vault/repo.test.ts`、`src/vault/keyStore.ts`、`src/vault/keyStore.test.ts`、`src/vault/testVault.ts`

**Interfaces:**
- Consumes: Task 1 的全部加密函数和类型
- Produces:
  - `type FetchBytes = (path: string) => Promise<Uint8Array | null>`（路径相对 `vault/`，404 返回 `null`）
  - `fetchVaultBytes: FetchBytes`（真实网络实现；`vault.json` 不走缓存；返回 HTML 时当作不存在）
  - `interface VaultSession { dek: VaultKey; manifest: VaultManifest }`
  - `loadVaultFile(fetchBytes: FetchBytes): Promise<VaultFile | null>`
  - `unlockWithPassphrase(file: VaultFile, passphrase: string): Promise<VaultSession>`（口令错误抛 `DecryptError`；DEK 不可导出）
  - `unlockWithKey(file: VaultFile, dek: VaultKey): Promise<VaultSession>`
  - `readBlob(fetchBytes: FetchBytes, dek: VaultKey, name: string): Promise<Uint8Array<ArrayBuffer>>`
  - `interface KeyStore { load(): Promise<VaultKey | null>; save(key: VaultKey): Promise<void>; clear(): Promise<void> }`
  - `createKeyStore(factory: IDBFactory | null): KeyStore | null`、`defaultKeyStore(): KeyStore | null`
  - 测试工具 `TEST_PASSPHRASE`、`makeTestVault(options?: { brokenBlobs?: string[] }): Promise<{ file: VaultFile; dek: VaultKey; fetchBytes: FetchBytes }>`。内含 2 张照片（`thumb-a`/`full-a` 说明「第一次去海边」日期 2024-05-20；`thumb-b`/`full-b` 无说明日期 2024-03-02）、1 篇笔记（`note-a`「晚安」，正文含 `**温柔**`）、1 个清单（`list-a`「一起去的地方」，1/2 完成）。

已验证的事实：在本项目的 jsdom 测试环境里，`crypto.subtle` 的 PBKDF2 和 AES-GCM 可用；`fake-indexeddb` 能保存并取回不可导出的 `CryptoKey`；`URL.createObjectURL(new Blob(...))` 可用；jsdom 本身没有 `indexedDB`。`fake-indexeddb` 导出的 `IDBFactory` 类型就是 DOM 的 `IDBFactory`。

- [ ] **Step 1: 安装依赖**

```powershell
npm install -D fake-indexeddb@^6.2.5
```

- [ ] **Step 2: 创建测试工具 `src/vault/testVault.ts`**

```ts
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
```

- [ ] **Step 3: 写失败的测试 `src/vault/repo.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DecryptError } from './crypto'
import { fetchVaultBytes, loadVaultFile, readBlob, unlockWithKey, unlockWithPassphrase } from './repo'
import { makeTestVault, TEST_PASSPHRASE } from './testVault'

const read = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('fetchVaultBytes', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps 404 and the HTML fallback page to null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    expect(await fetchVaultBytes('vault.json')).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })))
    expect(await fetchVaultBytes('vault.json')).toBeNull()
  })

  it('returns the bytes and throws on server errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2]))))
    expect(await fetchVaultBytes('blobs/a.bin')).toEqual(new Uint8Array([1, 2]))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    await expect(fetchVaultBytes('vault.json')).rejects.toThrow('HTTP 500')
  })
})

describe('vault repo', () => {
  it('treats a missing vault.json as an empty vault', async () => {
    expect(await loadVaultFile(async () => null)).toBeNull()
  })

  it('unlocks with the passphrase and reads blobs', async () => {
    const vault = await makeTestVault()
    const file = (await loadVaultFile(vault.fetchBytes))!
    const session = await unlockWithPassphrase(file, TEST_PASSPHRASE)
    expect(session.manifest.notes[0].title).toBe('晚安')
    expect(read(await readBlob(vault.fetchBytes, session.dek, 'note-a'))).toContain('温柔')
    await expect(crypto.subtle.exportKey('raw', session.dek)).rejects.toThrow()
  })

  it('rejects a wrong passphrase', async () => {
    const vault = await makeTestVault()
    await expect(unlockWithPassphrase(vault.file, 'iceland aurora penguin goodbye')).rejects.toBeInstanceOf(DecryptError)
  })

  it('unlocks with a remembered key', async () => {
    const vault = await makeTestVault()
    expect((await unlockWithKey(vault.file, vault.dek)).manifest.photos).toHaveLength(2)
  })

  it('fails to read a broken or missing blob', async () => {
    const vault = await makeTestVault({ brokenBlobs: ['note-a'] })
    await expect(readBlob(vault.fetchBytes, vault.dek, 'note-a')).rejects.toBeInstanceOf(DecryptError)
    await expect(readBlob(vault.fetchBytes, vault.dek, 'nope')).rejects.toThrow('missing blob nope')
  })
})
```

- [ ] **Step 4: 写失败的测试 `src/vault/keyStore.test.ts`**

```ts
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { decryptBytes, encryptBytes } from './crypto'
import { createKeyStore } from './keyStore'

describe('createKeyStore', () => {
  it('is unavailable without IndexedDB', () => {
    expect(createKeyStore(null)).toBeNull()
  })

  it('saves, loads and clears a non-extractable key', async () => {
    const store = createKeyStore(new IDBFactory())!
    expect(await store.load()).toBeNull()

    const key = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ])
    await store.save(key)
    const loaded = await store.load()
    const sealed = await encryptBytes(key, new Uint8Array([7]))
    expect(await decryptBytes(loaded!, sealed)).toEqual(new Uint8Array([7]))

    await store.clear()
    expect(await store.load()).toBeNull()
  })
})
```

- [ ] **Step 5: 运行测试，确认失败**

Run: `npx vitest run src/vault/repo.test.ts src/vault/keyStore.test.ts`
Expected: FAIL，提示无法解析 `./repo` 和 `./keyStore`。

- [ ] **Step 6: 实现 `src/vault/repo.ts`**

```ts
import { decryptBytes, decryptJson, deriveKek, unwrapDek, type VaultKey } from './crypto'
import type { VaultFile, VaultManifest } from './types'

export type FetchBytes = (path: string) => Promise<Uint8Array | null>

export interface VaultSession {
  dek: VaultKey
  manifest: VaultManifest
}

const BASE = `${import.meta.env.BASE_URL}vault/`

export const fetchVaultBytes: FetchBytes = async (path) => {
  const response = await fetch(`${BASE}${path}`, { cache: path === 'vault.json' ? 'no-cache' : 'default' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`)
  // The dev server answers unknown paths with index.html.
  if (response.headers.get('content-type')?.includes('text/html')) return null
  return new Uint8Array(await response.arrayBuffer())
}

export async function loadVaultFile(fetchBytes: FetchBytes): Promise<VaultFile | null> {
  const bytes = await fetchBytes('vault.json')
  return bytes === null ? null : (JSON.parse(new TextDecoder().decode(bytes)) as VaultFile)
}

export async function unlockWithKey(file: VaultFile, dek: VaultKey): Promise<VaultSession> {
  return { dek, manifest: await decryptJson<VaultManifest>(dek, file.manifest) }
}

export async function unlockWithPassphrase(file: VaultFile, passphrase: string): Promise<VaultSession> {
  const kek = await deriveKek(passphrase, file.kdf)
  return unlockWithKey(file, await unwrapDek(file.wrappedKey, kek, false))
}

export async function readBlob(fetchBytes: FetchBytes, dek: VaultKey, name: string): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = await fetchBytes(`blobs/${name}.bin`)
  if (bytes === null) throw new Error(`missing blob ${name}`)
  return decryptBytes(dek, bytes)
}
```

- [ ] **Step 7: 实现 `src/vault/keyStore.ts`**

```ts
import type { VaultKey } from './crypto'

export interface KeyStore {
  load(): Promise<VaultKey | null>
  save(key: VaultKey): Promise<void>
  clear(): Promise<void>
}

const DB_NAME = 'midnight-garage'
const STORE = 'vault'
const KEY = 'dek'

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function createKeyStore(factory: IDBFactory | null): KeyStore | null {
  if (!factory) return null
  let database: Promise<IDBDatabase> | null = null

  function open(): Promise<IDBDatabase> {
    database ??= new Promise((resolve, reject) => {
      const request = factory.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return database
  }

  async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open()
    return settle(action(db.transaction(STORE, mode).objectStore(STORE)))
  }

  return {
    async load() {
      const value = (await run('readonly', (store) => store.get(KEY))) as VaultKey | undefined
      return value ?? null
    },
    async save(key) {
      await run('readwrite', (store) => store.put(key, KEY))
    },
    async clear() {
      await run('readwrite', (store) => store.delete(KEY))
    },
  }
}

export function defaultKeyStore(): KeyStore | null {
  return createKeyStore(typeof indexedDB === 'undefined' ? null : indexedDB)
}
```

- [ ] **Step 8: 运行测试，确认通过**

Run: `npx vitest run src/vault/repo.test.ts src/vault/keyStore.test.ts`
Expected: PASS（9 个测试）。

- [ ] **Step 9: 类型检查并提交**

```powershell
npx tsc -b
git add package.json package-lock.json src/vault/repo.ts src/vault/repo.test.ts src/vault/keyStore.ts src/vault/keyStore.test.ts src/vault/testVault.ts
git commit -m "feat(vault): browser unlock, blob reading and remembered key"
```

Expected: `tsc` 无输出。

---

### Task 7: 照片、笔记、清单的展示组件

**Files:**
- Modify: `package.json`（新增运行时依赖 `react-markdown`）、`src/index.css`（笔记 Markdown 样式）
- Create: `src/vault/useBlob.ts`、`src/vault/components/PhotoGrid.tsx`、`src/vault/components/PhotoViewer.tsx`、`src/vault/components/NotesTab.tsx`、`src/vault/components/ListsTab.tsx`、`src/vault/components/tabs.test.tsx`

**Interfaces:**
- Consumes: `PhotoEntry`、`NoteEntry`、`ListEntry`、`ListContent`（Task 1）
- Produces:
  - `type ReadBlob = (name: string) => Promise<Uint8Array<ArrayBuffer>>`
  - `useBlobUrl(name: string, read: ReadBlob, type: string): BlobUrl`、`useBlobText(name: string, read: ReadBlob): BlobText`（`loading` / `ready` / `failed`；卸载或换名时释放图片地址）
  - `PhotoGrid({ photos, read }: { photos: PhotoEntry[]; read: ReadBlob })`、`monthLabel(date: string): string`
  - `PhotoViewer({ photos, index, read, onIndex, onClose })`
  - `NotesTab({ notes, read }: { notes: NoteEntry[]; read: ReadBlob })`
  - `ListsTab({ lists, read }: { lists: ListEntry[]; read: ReadBlob })`
  - 界面文案：缩略图按钮 `查看照片 <说明或日期>`；缩略图失败「打不开」；原图失败「这张照片打不开」；笔记失败「这篇笔记打不开」；清单失败「这个清单打不开」；空状态「还没有照片」「还没有笔记」「还没有清单」；清单进度「已完成 N / M」。

- [ ] **Step 1: 安装依赖**

```powershell
npm install react-markdown@^10.1.0
```

- [ ] **Step 2: 写失败的测试 `src/vault/components/tabs.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ListEntry, NoteEntry, PhotoEntry } from '../types'
import type { ReadBlob } from '../useBlob'
import { ListsTab } from './ListsTab'
import { NotesTab } from './NotesTab'
import { monthLabel, PhotoGrid } from './PhotoGrid'

function reader(blobs: Record<string, string>): ReadBlob {
  return async (name) => {
    if (!(name in blobs)) throw new Error('broken')
    return new TextEncoder().encode(blobs[name])
  }
}

const decryptedImages = () => document.querySelectorAll('img[src^="blob:"]')

const photos: PhotoEntry[] = [
  { caption: '第一次去海边', date: '2024-05-20', width: 2000, height: 1500, thumb: 't1', full: 'f1', source: 'photos/a.jpg', hash: 'a' },
  { caption: '', date: '2024-05-02', width: 1500, height: 2000, thumb: 't2', full: 'f2', source: 'photos/b.jpg', hash: 'b' },
  { caption: '', date: '2024-03-02', width: 1500, height: 2000, thumb: 't3', full: 'f3', source: 'photos/c.jpg', hash: 'c' },
]

describe('PhotoGrid', () => {
  it('labels months in Chinese', () => {
    expect(monthLabel('2024-05-20')).toBe('2024 年 5 月')
  })

  it('groups decrypted thumbnails by month', async () => {
    render(<PhotoGrid photos={photos} read={reader({ t1: '1', t2: '2', t3: '3' })} />)
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['2024 年 5 月', '2024 年 3 月'])
    await waitFor(() => expect(decryptedImages()).toHaveLength(3))
  })

  it('shows a placeholder only for a thumbnail that cannot be decrypted', async () => {
    render(<PhotoGrid photos={photos} read={reader({ t1: '1', t3: '3' })} />)
    expect(await screen.findByText('打不开')).toBeInTheDocument()
    await waitFor(() => expect(decryptedImages()).toHaveLength(2))
  })

  it('says so when there are no photos', () => {
    render(<PhotoGrid photos={[]} read={reader({})} />)
    expect(screen.getByText('还没有照片')).toBeInTheDocument()
  })

  it('opens the viewer, moves with the arrow keys and closes with Escape', async () => {
    render(<PhotoGrid photos={photos} read={reader({ t1: '1', t2: '2', t3: '3', f1: 'F1', f2: 'F2' })} />)
    fireEvent.click(screen.getByRole('button', { name: '查看照片 第一次去海边' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument()
    expect(await within(dialog).findByRole('img', { name: '第一次去海边' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(within(dialog).getByText('2 / 3')).toBeInTheDocument()
    expect(await within(dialog).findByRole('img', { name: '2024-05-02' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(await within(dialog).findByText('这张照片打不开')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

const notes: NoteEntry[] = [
  { title: '晚安', date: '2024-05-21', blob: 'n1', source: 'notes/a.md', hash: 'a' },
  { title: '坏掉的', date: '2024-05-01', blob: 'n2', source: 'notes/b.md', hash: 'b' },
]

describe('NotesTab', () => {
  it('previews notes and expands one into rendered Markdown', async () => {
    render(<NotesTab notes={notes} read={reader({ n1: '今天的风很**温柔**。\n\n第二段。' })} />)
    expect(await screen.findByText('今天的风很温柔。 第二段。')).toBeInTheDocument()
    expect(await screen.findByText('这篇笔记打不开')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /晚安/ }))
    expect(screen.getByText('温柔').tagName).toBe('STRONG')
  })

  it('says so when there are no notes', () => {
    render(<NotesTab notes={[]} read={reader({})} />)
    expect(screen.getByText('还没有笔记')).toBeInTheDocument()
  })
})

const lists: ListEntry[] = [{ title: '一起去的地方', blob: 'l1', source: 'lists/a.md', hash: 'a' }]
const listJson = JSON.stringify({
  items: [
    { text: '去看海', done: true },
    { text: '去冰岛看极光', done: false },
  ],
})

describe('ListsTab', () => {
  it('shows progress and the items', async () => {
    render(<ListsTab lists={lists} read={reader({ l1: listJson })} />)
    expect(await screen.findByText('已完成 1 / 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /一起去的地方/ }))
    expect(screen.getByText('去看海')).toHaveClass('line-through')
    expect(screen.getByText('去冰岛看极光')).not.toHaveClass('line-through')
  })

  it('marks a list that cannot be decrypted', async () => {
    render(<ListsTab lists={lists} read={reader({})} />)
    expect(await screen.findByText('这个清单打不开')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/vault/components/tabs.test.tsx`
Expected: FAIL，提示无法解析 `./ListsTab` 等模块。

- [ ] **Step 4: 实现 `src/vault/useBlob.ts`**

```ts
import { useEffect, useState } from 'react'

export type ReadBlob = (name: string) => Promise<Uint8Array<ArrayBuffer>>

export type BlobUrl = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'failed' }
export type BlobText = { status: 'loading' } | { status: 'ready'; text: string } | { status: 'failed' }

const LOADING = { status: 'loading' } as const

export function useBlobUrl(name: string, read: ReadBlob, type: string): BlobUrl {
  const [result, setResult] = useState<{ name: string; value: BlobUrl }>({ name, value: LOADING })

  useEffect(() => {
    let alive = true
    let url: string | null = null
    read(name).then(
      (bytes) => {
        if (!alive) return
        url = URL.createObjectURL(new Blob([bytes], { type }))
        setResult({ name, value: { status: 'ready', url } })
      },
      () => alive && setResult({ name, value: { status: 'failed' } }),
    )
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [name, read, type])

  return result.name === name ? result.value : LOADING
}

export function useBlobText(name: string, read: ReadBlob): BlobText {
  const [result, setResult] = useState<{ name: string; value: BlobText }>({ name, value: LOADING })

  useEffect(() => {
    let alive = true
    read(name).then(
      (bytes) => alive && setResult({ name, value: { status: 'ready', text: new TextDecoder().decode(bytes) } }),
      () => alive && setResult({ name, value: { status: 'failed' } }),
    )
    return () => {
      alive = false
    }
  }, [name, read])

  return result.name === name ? result.value : LOADING
}
```

- [ ] **Step 5: 实现 `src/vault/components/PhotoViewer.tsx`**

```tsx
import { useCallback, useEffect, useRef } from 'react'
import type { PhotoEntry } from '../types'
import { useBlobUrl, type ReadBlob } from '../useBlob'

const SWIPE_PX = 50

interface PhotoViewerProps {
  photos: PhotoEntry[]
  index: number
  read: ReadBlob
  onIndex: (index: number) => void
  onClose: () => void
}

export function PhotoViewer({ photos, index, read, onIndex, onClose }: PhotoViewerProps) {
  const photo = photos[index]
  const full = useBlobUrl(photo.full, read, 'image/webp')
  const touchX = useRef<number | null>(null)

  const go = useCallback(
    (delta: number) => {
      const next = index + delta
      if (next >= 0 && next < photos.length) onIndex(next)
    },
    [index, photos.length, onIndex],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') go(-1)
      else if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="照片"
      className="fixed inset-0 z-30 flex flex-col bg-ink/95"
      onTouchStart={(event) => {
        touchX.current = event.touches[0].clientX
      }}
      onTouchEnd={(event) => {
        if (touchX.current === null) return
        const dx = event.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1)
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
        <span>
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={onClose} className="px-2 py-1 hover:text-fg">
          关闭
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        {full.status === 'ready' && (
          <img src={full.url} alt={photo.caption || photo.date} className="max-h-full max-w-full object-contain" />
        )}
        {full.status === 'loading' && <p className="text-sm text-muted">正在解密…</p>}
        {full.status === 'failed' && <p className="text-sm text-muted">这张照片打不开</p>}
      </div>
      <div className="px-4 py-4 text-center">
        {photo.caption && <p className="text-sm">{photo.caption}</p>}
        <p className="mt-1 text-xs text-muted">{photo.date}</p>
        <div className="mt-3 flex justify-center gap-6 text-sm">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} className="disabled:opacity-30">
            上一张
          </button>
          <button type="button" onClick={() => go(1)} disabled={index === photos.length - 1} className="disabled:opacity-30">
            下一张
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 实现 `src/vault/components/PhotoGrid.tsx`**

```tsx
import { useState } from 'react'
import type { PhotoEntry } from '../types'
import { useBlobUrl, type ReadBlob } from '../useBlob'
import { PhotoViewer } from './PhotoViewer'

interface MonthGroup {
  label: string
  items: { photo: PhotoEntry; index: number }[]
}

export function monthLabel(date: string): string {
  const [year, month] = date.split('-')
  return `${year} 年 ${Number(month)} 月`
}

function groupByMonth(photos: PhotoEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  photos.forEach((photo, index) => {
    const label = monthLabel(photo.date)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push({ photo, index })
    else groups.push({ label, items: [{ photo, index }] })
  })
  return groups
}

function PhotoTile({ photo, read, onOpen }: { photo: PhotoEntry; read: ReadBlob; onOpen: () => void }) {
  const thumb = useBlobUrl(photo.thumb, read, 'image/webp')
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`查看照片 ${photo.caption || photo.date}`}
      className="block aspect-square w-full overflow-hidden border border-line bg-panel hover:border-accent-hi"
    >
      {thumb.status === 'ready' && <img src={thumb.url} alt="" className="h-full w-full object-cover" />}
      {thumb.status === 'failed' && <span className="flex h-full items-center justify-center text-xs text-muted">打不开</span>}
    </button>
  )
}

export function PhotoGrid({ photos, read }: { photos: PhotoEntry[]; read: ReadBlob }) {
  const [viewing, setViewing] = useState<number | null>(null)
  if (photos.length === 0) return <p className="py-10 text-center text-sm text-muted">还没有照片</p>

  return (
    <>
      {groupByMonth(photos).map((group) => (
        <section key={group.label} className="mb-5">
          <h3 className="mb-2 text-xs text-muted">{group.label}</h3>
          <ul className="grid grid-cols-3 gap-1">
            {group.items.map(({ photo, index }) => (
              <li key={photo.thumb}>
                <PhotoTile photo={photo} read={read} onOpen={() => setViewing(index)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {viewing !== null && (
        <PhotoViewer photos={photos} index={viewing} read={read} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </>
  )
}
```

- [ ] **Step 7: 实现 `src/vault/components/NotesTab.tsx`**

```tsx
import { useState } from 'react'
import Markdown from 'react-markdown'
import type { NoteEntry } from '../types'
import { useBlobText, type ReadBlob } from '../useBlob'

function preview(markdown: string): string {
  return markdown.replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim()
}

function NoteCard({ note, read }: { note: NoteEntry; read: ReadBlob }) {
  const [open, setOpen] = useState(false)
  const body = useBlobText(note.blob, read)

  return (
    <li className="border border-line bg-panel/90">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="w-full px-4 py-3 text-left">
        <span className="block text-xs text-muted">{note.date}</span>
        <span className="mt-1 block font-bold">{note.title}</span>
        {!open && body.status === 'ready' && <span className="mt-1 line-clamp-2 block text-sm text-muted">{preview(body.text)}</span>}
        {body.status === 'failed' && <span className="mt-1 block text-sm text-muted">这篇笔记打不开</span>}
      </button>
      {open && body.status === 'ready' && (
        <div className="vault-markdown border-t border-line px-4 py-3 text-sm leading-relaxed">
          <Markdown>{body.text}</Markdown>
        </div>
      )}
    </li>
  )
}

export function NotesTab({ notes, read }: { notes: NoteEntry[]; read: ReadBlob }) {
  if (notes.length === 0) return <p className="py-10 text-center text-sm text-muted">还没有笔记</p>
  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <NoteCard key={note.blob} note={note} read={read} />
      ))}
    </ul>
  )
}
```

- [ ] **Step 8: 实现 `src/vault/components/ListsTab.tsx`**

```tsx
import { useState } from 'react'
import type { ListContent, ListEntry } from '../types'
import { useBlobText, type ReadBlob } from '../useBlob'

function parseContent(text: string): ListContent | null {
  try {
    const value = JSON.parse(text) as ListContent
    return Array.isArray(value.items) ? value : null
  } catch {
    return null
  }
}

function ListCard({ list, read }: { list: ListEntry; read: ReadBlob }) {
  const [open, setOpen] = useState(false)
  const body = useBlobText(list.blob, read)
  const content = body.status === 'ready' ? parseContent(body.text) : null
  const broken = body.status === 'failed' || (body.status === 'ready' && content === null)
  const done = content?.items.filter((item) => item.done).length ?? 0

  return (
    <li className="border border-line bg-panel/90">
      <button
        type="button"
        aria-expanded={open}
        disabled={content === null}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-bold">{list.title}</span>
        <span className="shrink-0 text-xs text-muted">
          {content ? `已完成 ${done} / ${content.items.length}` : broken ? '这个清单打不开' : '…'}
        </span>
      </button>
      {open && content && (
        <ul className="space-y-2 border-t border-line px-4 py-3 text-sm">
          {content.items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className={item.done ? 'text-accent-hi' : 'text-muted'}>
                {item.done ? '✓' : '○'}
              </span>
              <span className="sr-only">{item.done ? '已完成：' : '未完成：'}</span>
              <span className={item.done ? 'text-muted line-through' : ''}>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function ListsTab({ lists, read }: { lists: ListEntry[]; read: ReadBlob }) {
  if (lists.length === 0) return <p className="py-10 text-center text-sm text-muted">还没有清单</p>
  return (
    <ul className="space-y-3">
      {lists.map((list) => (
        <ListCard key={list.blob} list={list} read={read} />
      ))}
    </ul>
  )
}
```

- [ ] **Step 9: 在 `src/index.css` 末尾加笔记 Markdown 样式**

```css
.vault-markdown p + p,
.vault-markdown ul,
.vault-markdown ol,
.vault-markdown blockquote {
  margin-top: 0.75em;
}

.vault-markdown h1,
.vault-markdown h2,
.vault-markdown h3 {
  margin-top: 1em;
  font-weight: 700;
}

.vault-markdown strong {
  font-weight: 700;
  color: var(--accent-hi);
}

.vault-markdown em {
  font-style: italic;
}

.vault-markdown ul {
  list-style: disc;
  padding-left: 1.25em;
}

.vault-markdown ol {
  list-style: decimal;
  padding-left: 1.25em;
}

.vault-markdown blockquote {
  border-left: 2px solid var(--accent);
  padding-left: 0.75em;
  color: var(--color-muted);
}

.vault-markdown a {
  text-decoration: underline;
}
```

- [ ] **Step 10: 运行测试，确认通过**

Run: `npx vitest run src/vault/components/tabs.test.tsx`
Expected: PASS（9 个测试）。

- [ ] **Step 11: 类型检查并提交**

```powershell
npx tsc -b
git add package.json package-lock.json src/index.css src/vault/useBlob.ts src/vault/components
git commit -m "feat(vault): photo grid, viewer, notes and lists"
```

Expected: `tsc` 无输出。

---

### Task 8: 解锁界面和保险库页面

**Files:**
- Modify: `src/index.css`（抖动动画）、`src/pages/VaultPage.tsx`、`src/app/App.test.tsx`
- Create: `src/vault/components/GoldSweep.tsx`、`src/vault/components/UnlockPanel.tsx`、`src/vault/components/VaultContent.tsx`、`src/vault/VaultScreen.tsx`、`src/vault/VaultScreen.test.tsx`

**Interfaces:**
- Consumes: Task 6 的 `FetchBytes`、`fetchVaultBytes`、`loadVaultFile`、`unlockWithKey`、`unlockWithPassphrase`、`readBlob`、`VaultSession`、`KeyStore`、`createKeyStore`、`defaultKeyStore`、`makeTestVault`、`TEST_PASSPHRASE`；Task 7 的 `PhotoGrid`、`NotesTab`、`ListsTab`、`ReadBlob`；Task 1 的 `DecryptError`、`VaultFile`
- Produces:
  - `HOLD_MS = 1000`
  - `UnlockPanel({ canRemember, onUnlock }: { canRemember: boolean; onUnlock: (passphrase: string, remember: boolean) => Promise<boolean> })`（`onUnlock` 返回 `false` 表示口令不对）
  - `VaultContent({ session, fetchBytes, onLock }: { session: VaultSession; fetchBytes: FetchBytes; onLock: () => void })`
  - `VaultScreen({ fetchBytes?, keyStore? }: { fetchBytes?: FetchBytes; keyStore?: KeyStore | null })`（`keyStore` 不传时用 `defaultKeyStore()`，传 `null` 表示没有 IndexedDB）
  - 界面文案：「正在打开保险库…」「保险库还是空的。」「保险库暂时打不开」「重试」「口令」「在这台设备上记住」按钮无障碍名「一键启动」「点火中…」「按住启动」/「点一下启动」「口令不对」「先输入口令」「出了点问题，请再试一次」「锁上」；标签「照片 / 笔记 / 清单」，`?tab=notes|lists`。

- [ ] **Step 1: 写失败的测试 `src/vault/VaultScreen.test.tsx`**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HOLD_MS } from './components/UnlockPanel'
import { createKeyStore, type KeyStore } from './keyStore'
import type { FetchBytes } from './repo'
import { makeTestVault, TEST_PASSPHRASE } from './testVault'
import { VaultScreen } from './VaultScreen'

function renderVault(fetchBytes: FetchBytes, keyStore: KeyStore | null, path = '/vault') {
  const router = createMemoryRouter([{ path: '/vault', element: <VaultScreen fetchBytes={fetchBytes} keyStore={keyStore} /> }], {
    initialEntries: [path],
  })
  return render(<RouterProvider router={router} />)
}

async function type(passphrase: string) {
  fireEvent.change(await screen.findByLabelText('口令'), { target: { value: passphrase } })
}

async function enter(passphrase: string) {
  await type(passphrase)
  fireEvent.submit(screen.getByLabelText('口令').closest('form')!)
}

describe('VaultScreen', () => {
  afterEach(() => vi.useRealTimers())

  it('shows an empty vault when vault.json is missing', async () => {
    renderVault(async () => null, null)
    expect(await screen.findByText('保险库还是空的。')).toBeInTheDocument()
  })

  it('offers a retry when vault.json cannot be loaded', async () => {
    const vault = await makeTestVault()
    let offline = true
    renderVault(async (path) => {
      if (offline) throw new Error('offline')
      return vault.fetchBytes(path)
    }, null)
    expect(await screen.findByText('保险库暂时打不开')).toBeInTheDocument()
    offline = false
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByLabelText('口令')).toBeInTheDocument()
  })

  it('says 口令不对 for a wrong passphrase', async () => {
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await enter('iceland aurora penguin goodbye')
    expect(await screen.findByRole('alert')).toHaveTextContent('口令不对')
  })

  it('opens the photos tab with the right passphrase', async () => {
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await enter(TEST_PASSPHRASE)
    expect(await screen.findByRole('tab', { name: '照片', selected: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看照片 第一次去海边' })).toBeInTheDocument()
  })

  it('starts after holding the start button', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await type(TEST_PASSPHRASE)
    fireEvent.pointerDown(screen.getByRole('button', { name: '一键启动' }))
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })
    expect(await screen.findByRole('tab', { name: '照片' })).toBeInTheDocument()
  })

  it('does not start when the button is released early', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await type(TEST_PASSPHRASE)
    const button = screen.getByRole('button', { name: '一键启动' })
    fireEvent.pointerDown(button)
    act(() => {
      vi.advanceTimersByTime(HOLD_MS / 2)
    })
    fireEvent.pointerUp(button)
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByLabelText('口令')).toBeInTheDocument()
  })

  it('remembers the key on this device until locked', async () => {
    const vault = await makeTestVault()
    const store = createKeyStore(new IDBFactory())!
    const first = renderVault(vault.fetchBytes, store)
    expect(await screen.findByLabelText('在这台设备上记住')).toBeChecked()
    await enter(TEST_PASSPHRASE)
    await screen.findByRole('tab', { name: '照片' })
    first.unmount()

    renderVault(vault.fetchBytes, store)
    expect(await screen.findByRole('tab', { name: '照片' })).toBeInTheDocument()
    expect(screen.queryByLabelText('口令')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '锁上' }))
    expect(await screen.findByLabelText('口令')).toBeInTheDocument()
    expect(await store.load()).toBeNull()
  })

  it('forgets a remembered key that no longer opens the vault', async () => {
    const store = createKeyStore(new IDBFactory())!
    const stale = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ])
    await store.save(stale)
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, store)
    expect(await screen.findByLabelText('口令')).toBeInTheDocument()
    expect(await store.load()).toBeNull()
  })

  it('hides the remember option without IndexedDB', async () => {
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await screen.findByLabelText('口令')
    expect(screen.queryByLabelText('在这台设备上记住')).not.toBeInTheDocument()
  })

  it('opens the tab named in the address', async () => {
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null, '/vault?tab=lists')
    await enter(TEST_PASSPHRASE)
    expect(await screen.findByText('已完成 1 / 2')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/vault/VaultScreen.test.tsx`
Expected: FAIL，提示无法解析 `./components/UnlockPanel`、`./VaultScreen`。

- [ ] **Step 3: 在 `src/index.css` 末尾加抖动动画**

```css
@theme {
  --animate-vault-shake: vault-shake 0.4s ease-in-out;

  @keyframes vault-shake {
    0%,
    100% {
      transform: translateX(0);
    }
    20% {
      transform: translateX(-12px);
    }
    40% {
      transform: translateX(12px);
    }
    60% {
      transform: translateX(-8px);
    }
    80% {
      transform: translateX(8px);
    }
  }
}
```

- [ ] **Step 4: 实现 `src/vault/components/GoldSweep.tsx`**

```tsx
import { motion, useReducedMotion } from 'motion/react'

export function GoldSweep() {
  const reduced = useReducedMotion()
  if (reduced) return null
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-20"
      style={{ background: 'linear-gradient(100deg, transparent 30%, rgba(191, 159, 98, 0.35) 50%, transparent 70%)' }}
      initial={{ x: '-100%', opacity: 1 }}
      animate={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
    />
  )
}
```

- [ ] **Step 5: 实现 `src/vault/components/UnlockPanel.tsx`**

```tsx
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

export const HOLD_MS = 1000

interface UnlockPanelProps {
  canRemember: boolean
  onUnlock: (passphrase: string, remember: boolean) => Promise<boolean>
}

export function UnlockPanel({ canRemember, onUnlock }: UnlockPanelProps) {
  const reduced = useReducedMotion() ?? false
  const [passphrase, setPassphrase] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [holding, setHolding] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current)
    },
    [],
  )

  async function submit() {
    if (busy) return
    if (passphrase.trim() === '') {
      setMessage('先输入口令')
      return
    }
    setBusy(true)
    setMessage(null)
    let ok: boolean
    try {
      ok = await onUnlock(passphrase, remember && canRemember)
    } catch {
      setBusy(false)
      setMessage('出了点问题，请再试一次')
      return
    }
    if (ok) return
    setBusy(false)
    setMessage('口令不对')
    setShaking(true)
  }

  function startHold() {
    if (busy || reduced) return
    setHolding(true)
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null
      setHolding(false)
      void submit()
    }, HOLD_MS)
  }

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
    setHolding(false)
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      onAnimationEnd={() => setShaking(false)}
      className={`mt-6 border border-accent/60 bg-panel/80 px-5 py-8 text-center ${shaking ? 'motion-safe:animate-vault-shake' : ''}`}
    >
      <p className="font-display text-xs tracking-[0.35em] text-accent-hi">PRIVATE VAULT</p>
      <p className="mt-4 font-serif text-2xl italic">
        Only <span className="text-accent-hi">us</span>.
      </p>

      <label className="mt-8 block text-left text-xs text-muted">
        口令
        <input
          type="password"
          autoComplete="current-password"
          value={passphrase}
          disabled={busy}
          onChange={(event) => {
            setPassphrase(event.target.value)
            setMessage(null)
          }}
          className="mt-2 block w-full border border-line bg-ink px-3 py-3 text-base text-fg outline-none focus:border-accent-hi"
        />
      </label>
      {canRemember && (
        <label className="mt-3 flex items-center gap-2 text-left text-xs text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="accent-[var(--accent-hi)]"
          />
          在这台设备上记住
        </label>
      )}

      <button
        type="button"
        aria-label="一键启动"
        disabled={busy}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onClick={reduced ? () => void submit() : undefined}
        onContextMenu={(event) => event.preventDefault()}
        className="relative mx-auto mt-8 flex h-32 w-32 touch-none select-none items-center justify-center rounded-full border border-line bg-ink disabled:opacity-70"
      >
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-line)" strokeWidth="3" />
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="var(--accent-hi)"
            strokeWidth="3"
            initial={false}
            animate={{ pathLength: holding ? 1 : 0 }}
            transition={{ duration: holding ? HOLD_MS / 1000 : 0.2, ease: 'linear' }}
          />
        </svg>
        <span className="font-display text-sm tracking-[0.2em]">{busy ? '点火中…' : 'START'}</span>
      </button>
      <p className="mt-3 text-xs text-muted">{reduced ? '点一下启动' : '按住启动'}</p>

      {message && (
        <p role="alert" className="mt-4 text-sm text-accent-hi">
          {message}
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 6: 实现 `src/vault/components/VaultContent.tsx`**

```tsx
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { readBlob, type FetchBytes, type VaultSession } from '../repo'
import type { ReadBlob } from '../useBlob'
import { GoldSweep } from './GoldSweep'
import { ListsTab } from './ListsTab'
import { NotesTab } from './NotesTab'
import { PhotoGrid } from './PhotoGrid'

type Tab = 'photos' | 'notes' | 'lists'

const TABS: { id: Tab; label: string }[] = [
  { id: 'photos', label: '照片' },
  { id: 'notes', label: '笔记' },
  { id: 'lists', label: '清单' },
]

interface VaultContentProps {
  session: VaultSession
  fetchBytes: FetchBytes
  onLock: () => void
}

export function VaultContent({ session, fetchBytes, onLock }: VaultContentProps) {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = raw === 'notes' || raw === 'lists' ? raw : 'photos'
  const read = useCallback<ReadBlob>((name) => readBlob(fetchBytes, session.dek, name), [fetchBytes, session])
  const { manifest } = session

  return (
    <section>
      <GoldSweep />
      <div className="flex items-center justify-between">
        <p className="font-display text-xs tracking-[0.35em] text-accent-hi">PRIVATE VAULT</p>
        <button type="button" onClick={onLock} className="border border-line px-3 py-1 text-xs text-muted hover:text-fg">
          锁上
        </button>
      </div>
      <div role="tablist" className="mt-4 grid grid-cols-3 border-b border-line">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setParams(item.id === 'photos' ? {} : { tab: item.id }, { replace: true })}
            className={`py-2 text-sm ${tab === item.id ? 'border-b-2 border-accent-hi text-fg' : 'text-muted hover:text-fg'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4">
        {tab === 'photos' && <PhotoGrid photos={manifest.photos} read={read} />}
        {tab === 'notes' && <NotesTab notes={manifest.notes} read={read} />}
        {tab === 'lists' && <ListsTab lists={manifest.lists} read={read} />}
      </div>
    </section>
  )
}
```

- [ ] **Step 7: 实现 `src/vault/VaultScreen.tsx`**

```tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { DecryptError } from './crypto'
import { defaultKeyStore, type KeyStore } from './keyStore'
import { fetchVaultBytes, loadVaultFile, unlockWithKey, unlockWithPassphrase, type FetchBytes, type VaultSession } from './repo'
import type { VaultFile } from './types'
import { UnlockPanel } from './components/UnlockPanel'
import { VaultContent } from './components/VaultContent'

type VaultState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'locked'; file: VaultFile }
  | { status: 'open'; file: VaultFile; session: VaultSession }

interface VaultScreenProps {
  fetchBytes?: FetchBytes
  keyStore?: KeyStore | null
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <section className="mt-10 border border-accent/60 bg-panel/80 px-5 py-8 text-center">
      <p className="font-display text-xs tracking-[0.35em] text-accent-hi">PRIVATE VAULT</p>
      <div className="mt-4 text-sm text-muted">{children}</div>
    </section>
  )
}

export function VaultScreen({ fetchBytes = fetchVaultBytes, keyStore }: VaultScreenProps) {
  const [store] = useState(() => (keyStore === undefined ? defaultKeyStore() : keyStore))
  const [state, setState] = useState<VaultState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    async function open(): Promise<VaultState> {
      const file = await loadVaultFile(fetchBytes)
      if (!file) return { status: 'empty' }
      const saved = store ? await store.load().catch(() => null) : null
      if (saved) {
        try {
          return { status: 'open', file, session: await unlockWithKey(file, saved) }
        } catch {
          await store?.clear().catch(() => undefined)
        }
      }
      return { status: 'locked', file }
    }
    open().then(
      (next) => alive && setState(next),
      () => alive && setState({ status: 'error' }),
    )
    return () => {
      alive = false
    }
  }, [fetchBytes, store, attempt])

  const unlock = useCallback(
    async (file: VaultFile, passphrase: string, remember: boolean) => {
      let session: VaultSession
      try {
        session = await unlockWithPassphrase(file, passphrase)
      } catch (error) {
        if (error instanceof DecryptError) return false
        throw error
      }
      if (remember && store) await store.save(session.dek).catch(() => undefined)
      setState({ status: 'open', file, session })
      return true
    },
    [store],
  )

  const lock = useCallback(
    async (file: VaultFile) => {
      await store?.clear().catch(() => undefined)
      setState({ status: 'locked', file })
    },
    [store],
  )

  switch (state.status) {
    case 'loading':
      return <p className="mt-10 text-center text-sm text-muted">正在打开保险库…</p>
    case 'empty':
      return <Notice>保险库还是空的。</Notice>
    case 'error':
      return (
        <Notice>
          <p>保险库暂时打不开</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: 'loading' })
              setAttempt((n) => n + 1)
            }}
            className="mt-4 border border-accent-hi px-6 py-2 text-sm text-fg"
          >
            重试
          </button>
        </Notice>
      )
    case 'locked':
      return <UnlockPanel canRemember={store !== null} onUnlock={(passphrase, remember) => unlock(state.file, passphrase, remember)} />
    case 'open':
      return <VaultContent session={state.session} fetchBytes={fetchBytes} onLock={() => void lock(state.file)} />
  }
}
```

- [ ] **Step 8: 运行测试，确认通过**

Run: `npx vitest run src/vault/VaultScreen.test.tsx`
Expected: PASS（10 个测试）。

- [ ] **Step 9: 替换 `src/pages/VaultPage.tsx`**

```tsx
import { VaultScreen } from '../vault/VaultScreen'

export function VaultPage() {
  return <VaultScreen />
}
```

- [ ] **Step 10: 更新 `src/app/App.test.tsx` 的保险库用例**

把 import 行改为：

```tsx
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

在 `beforeEach(() => localStorage.clear())` 下面加一行：

```tsx
  afterEach(() => vi.unstubAllGlobals())
```

把 `switches to the gold theme inside the vault` 用例替换为：

```tsx
  it('switches to the gold theme inside the vault', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    renderAt('/vault')
    expect(document.querySelector('[data-theme="vault"]')).not.toBeNull()
    expect(await screen.findByText('保险库还是空的。')).toBeInTheDocument()
  })
```

- [ ] **Step 11: 全量测试和构建**

```powershell
npm test
npm run build
```

Expected: 全部测试通过；构建成功。

- [ ] **Step 12: Commit**

```powershell
git add src/index.css src/pages/VaultPage.tsx src/app/App.test.tsx src/vault/components/GoldSweep.tsx src/vault/components/UnlockPanel.tsx src/vault/components/VaultContent.tsx src/vault/VaultScreen.tsx src/vault/VaultScreen.test.tsx
git commit -m "feat(vault): hold-to-start unlock, remembered device and vault tabs"
```

---

### Task 9: 手动验收和发布

**Files:**
- 无代码改动。`vault-src/` 和用于验收的 `public/vault/` 都不提交。

**Interfaces:**
- Consumes: `npm run vault`（Task 5）、`/vault` 页面（Task 8）
- Produces: 推送到 `master` 后线上 `/vault` 显示「保险库还是空的。」，直到用户放入真实内容

`npm run vault` 只能在真实终端里交互输入口令；如果执行者是没有 TTY 的自动化代理，Step 2 和 Step 4 请交给用户在自己的终端里运行，并等用户回报结果。

- [ ] **Step 1: 准备验收内容**

```powershell
New-Item -ItemType Directory -Force vault-src/photos, vault-src/notes, vault-src/lists | Out-Null
Set-Content -Encoding utf8 vault-src/notes/first.md "---`ntitle: 晚安`ndate: 2024-05-21`n---`n`n今天的风很**温柔**。`n`n- 想你`n- 想吃火锅"
Set-Content -Encoding utf8 vault-src/lists/places.md "---`ntitle: 一起去的地方`n---`n- [x] 去看海`n- [ ] 去冰岛看极光"
Set-Content -Encoding utf8 vault-src/manifest.yaml "photos: {}`nlists:`n  order: [places.md]"
git status --short
```

再往 `vault-src/photos/` 放 3–5 张照片，其中至少一张是 iPhone 竖拍的 HEIC，至少一张是 JPG。

Expected: `git status --short` 不显示 `vault-src/`。

- [ ] **Step 2: 生成保险库（用户在终端执行）**

Run: `npm run vault`
Expected: 提示「第一次创建保险库」，两次输入测试口令后逐行打印 `加密 photos/...`（HEIC 每张需数秒）、`加密 notes/first.md`、`加密 lists/places.md`，最后打印照片/笔记/清单数量和大小。

- [ ] **Step 3: 浏览器验收**

Run: `npm run dev`，用手机尺寸（390×844）打开 `/vault`。
Expected:
- 香槟金主题；按住「一键启动」约 1 秒后进入，输错口令时面板抖动并显示「口令不对」。
- 照片按月分组；HEIC 竖拍照片方向正确、日期是拍摄日期；点开后可左右切换，Esc 关闭。
- 笔记卡片能展开，`温柔` 加粗；清单显示「已完成 1 / 2」。
- 刷新页面后直接进入（记住设备）；点「锁上」后回到口令页，再刷新仍需口令。
- 在开发者工具里打开 `public/vault/blobs/` 任意文件，内容是乱码；`vault.json` 里看不到任何标题或文件名。
- HEIC 照片：方向正确，颜色没有发灰或褪色（iPhone 照片是 Display-P3 色域，转换出错时会显得发白）。
- 在 iPhone 上输入口令时故意在某个词后面多打一个空格（两个空格），仍能解锁。

看完按 `Ctrl+C` 停止。推送上线后（Step 6），再在线上 GitHub Pages 站点直接刷新 `/vault`：可能会被重定向到 `/vault/`，页面必须仍然正常打开保险库。

- [ ] **Step 4: 增量和换口令验收（用户在终端执行）**

```powershell
npm run vault
npm run vault:rekey
npm run vault
```

Expected: 第一次 `npm run vault` 全部显示「沿用」，`新写入 0 个`；`vault:rekey` 输入旧口令和两次新口令后提示「口令已更换」，`public/vault/blobs/` 下的文件名全部变了；之后用旧口令运行 `npm run vault` 提示「口令不对」并退出，用新口令则全部「沿用」。浏览器里之前「记住」的设备刷新后回到口令页。

- [ ] **Step 5: 清理验收产物**

```powershell
Remove-Item -Recurse -Force public/vault
git status --short
```

Expected: `git status --short` 没有输出（`vault-src/` 已忽略，`public/vault/` 已删除）。用户放入真实内容后再按 `vault-src` → `npm run vault` → 提交 `public/vault/` 的流程发布。

- [ ] **Step 6: 推送**

```powershell
npm test
git push origin master
```

Expected: 测试全部通过；推送成功。Deploy 工作流变绿后，线上 `https://krazymud.github.io/vault` 显示「保险库还是空的。」。

---

## 规格覆盖对照

| 规格章节 | 本计划任务 | 备注 |
|---|---|---|
| 1 完成标准 1、3 | Task 8、9 | |
| 1 完成标准 2 | Task 1、4、5、9 Step 3 | 文件名随机、清单加密 |
| 1 完成标准 4 | Task 4、5 | |
| 1 完成标准 5 | Task 8（`useReducedMotion`、`motion-safe:`） | |
| 2 内容来源、manifest.yaml、报错 | Task 2、5 | |
| 3 发布格式 | Task 1、4、5 | |
| 4 加密 | Task 1 | |
| 5.1 npm run vault | Task 3、4、5 | |
| 5.2 npm run vault:rekey | Task 5 | |
| 6.1 解锁页 | Task 8 | |
| 6.2 记住设备 | Task 6、8 | |
| 6.3 内容界面 | Task 7、8 | |
| 6.4 错误处理 | Task 6、7、8 | |
| 7 代码模块 | 全部 | `VaultScreen` 下拆出 `useBlob`、`GoldSweep`、`VaultContent` |
| 8 测试 | 各任务测试 + Task 9 | |
| 9 发布流程 | Task 9 | |
