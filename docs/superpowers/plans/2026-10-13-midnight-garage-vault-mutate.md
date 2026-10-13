# 网页改保险库与加照片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 两名持令牌用户通过 GitHub API 读写 `public/vault/`，在网页上编辑/删除已发布笔记与清单、添加（含 HEIC）与删除照片，对方刷新即可看到，不必等 Pages。

**Architecture:** 工作副本是带 `updatedAt` / 墓碑 / 脏 blob 的 `WorkingVault`；合并按 `source` 整条目替换。提交用 Git Data API 一次原子 commit。有令牌时读仓库最新 `vault.json`；`web.json` 在首次有令牌解锁时迁入 vault 后删除。UI 在 `useVaultMutate` 上统一同步锁定。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、`heic-decode`（浏览器 WASM）、`exifr`（EXIF 日期）、Canvas WebP、GitHub Git Data API、IndexedDB（沿用 `vault-web`）。

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-13-midnight-garage-vault-mutate-design.md`
- 只写 `public/vault/vault.json` 与 `blobs/`；不改 `vault-src/`；不换口令 / 不轮换 DEK。
- 令牌只发给 `api.github.com`；401/403 →「令牌不能写这个仓库」；其它失败 →「还没同步」。
- 网页新建 `source`：`web/notes/<uuid>`、`web/lists/<uuid>`、`web/photos/<uuid>`。
- 照片：JPEG/PNG/WebP/HEIC/HEIF；全图最长边 2000、缩略 400×400；WebP 质量约 82 / 70。
- 同步中显示「正在同步…」并禁用写入控件。
- 界面中文；假 `fetch` 单测，不打真 GitHub。
- `updatedAt` **不**写入加密 `VaultManifest`：只存在 `WorkingVault.updatedAt`（及 pending 封印里）。
- 在功能分支上实现（从含本 plan/spec 的分支继续或新建 `cursor/…-8bae`），不直接推破坏性改到 master 而不经 PR。

## 文件

| 文件 | 职责 |
|---|---|
| Create `src/vault/working.ts` | `WorkingVault`、按 source 合并、笔记/清单/照片的纯函数变更、封印 pending |
| Create `src/vault/working.test.ts` | 合并与变更测试 |
| Create `src/vault/gitVault.ts` | Git Data API：读 `vault.json`/blob、原子提交、删 `web.json`；复用 `TOKEN_DENIED` / `SYNC_PENDING` |
| Create `src/vault/gitVault.test.ts` | 假 fetch |
| Create `src/vault/photoProcess.ts` | 浏览器选图 → 全图/缩略 WebP + 日期 |
| Create `src/vault/photoProcess.test.ts` | mock 解码器 / canvas |
| Create `src/vault/useVaultMutate.ts` | 令牌、pending、同步队列、加载锁定、迁移触发 |
| Modify `src/vault/webStore.ts` | pending 键改为封印的 `WorkingVault`（或并行新键 `vaultPending`，迁移后弃用旧 `pending` web.json 文本） |
| Modify `src/vault/github.ts` | 导出共享 `headers` / 常量；`syncWebFile` 仅留给迁移读 `web.json`，或把读 web 挪到 `gitVault.ts` |
| Modify `src/vault/components/NotesTab.tsx` | 已发布笔记也可编辑/删除 |
| Modify `src/vault/components/ListsTab.tsx` | 已发布清单可编辑/删除；勾选走 mutate |
| Modify `src/vault/components/PhotoGrid.tsx` | 加照片、删除、同步禁用 |
| Modify `src/vault/components/VaultContent.tsx` | 改用 `useVaultMutate`；「正在同步…」 |
| Modify `src/vault/components/VaultContent.test.tsx` 等 | 覆盖新行为 |
| Modify `package.json` | `heic-decode`、`exifr` 移入 `dependencies`（浏览器要用） |
| Modify `scripts/lib/vaultCommand.ts` 或 vault 脚本提示 | 网页改过则以仓库 `public/vault/` 为准（短提示即可） |

---

### Task 1: WorkingVault 合并与笔记/清单变更

**Files:**
- Create: `src/vault/working.ts`
- Test: `src/vault/working.test.ts`

**Interfaces:**
- Consumes: `VaultManifest`, `NoteEntry`, `ListEntry`, `PhotoEntry`, `ListContent` from `types.ts`; `VaultKey`, `encryptBytes`, `encryptJson`, `decryptJson`, `toBase64`, `fromBase64` from `crypto.ts`
- Produces:
  - `type Tombstone = { source: string; updatedAt: number }`
  - `interface WorkingVault { manifest: VaultManifest; updatedAt: Record<string, number>; tombstones: { notes: Tombstone[]; lists: Tombstone[]; photos: Tombstone[] }; dirtyBlobs: Record<string, Uint8Array> }`
  - `function emptyWorking(manifest: VaultManifest): WorkingVault`
  - `function mergeWorking(base: WorkingVault, incoming: WorkingVault): WorkingVault`
  - `function saveNote(working, input: { source?: string; title; date; body }, clock: { now(); uuid() }, dek): Promise<WorkingVault>`
  - `function deleteNote(working, source, now): WorkingVault`
  - `function saveList(working, input: { source?; title; items }, clock, dek): Promise<WorkingVault>`
  - `function deleteList(working, source, now): WorkingVault`
  - `function toggleListItem(working, source, index, done, now, dek): Promise<WorkingVault>`
  - `function webNoteSource(uuid: string): string` → `web/notes/${uuid}`
  - `function webListSource(uuid: string): string` → `web/lists/${uuid}`
  - `async function sealWorking(dek, working): Promise<string>` / `async function openWorking(dek, text): Promise<WorkingVault>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { generateDek } from './crypto'
import { emptyWorking, mergeWorking, saveNote, deleteNote, webNoteSource } from './working'
import type { VaultManifest } from './types'

const baseManifest = (): VaultManifest => ({
  photos: [],
  notes: [{ title: '晚安', date: '2024-05-21', blob: 'note-a', source: 'notes/a.md', hash: 'n' }],
  lists: [],
})

describe('mergeWorking', () => {
  it('lets a newer edit replace a published note by source', async () => {
    const dek = await generateDek()
    const clock = { now: () => 10, uuid: () => 'u1' }
    const base = emptyWorking(baseManifest())
    const edited = await saveNote(
      emptyWorking(baseManifest()),
      { source: 'notes/a.md', title: '改过', date: '2024-05-21', body: '新正文' },
      clock,
      dek,
    )
    const merged = mergeWorking(base, edited)
    expect(merged.manifest.notes).toHaveLength(1)
    expect(merged.manifest.notes[0].title).toBe('改过')
    expect(merged.dirtyBlobs[merged.manifest.notes[0].blob]).toBeInstanceOf(Uint8Array)
  })

  it('hides a published note when the tombstone is newer', () => {
    const base = emptyWorking(baseManifest())
    const incoming = deleteNote(emptyWorking(baseManifest()), 'notes/a.md', 20)
    expect(mergeWorking(base, incoming).manifest.notes).toEqual([])
  })

  it('assigns web/notes/<uuid> for a new note', async () => {
    const dek = await generateDek()
    const next = await saveNote(
      emptyWorking({ photos: [], notes: [], lists: [] }),
      { title: '网页', date: '2026-10-13', body: '' },
      { now: () => 1, uuid: () => 'abc' },
      dek,
    )
    expect(next.manifest.notes[0].source).toBe(webNoteSource('abc'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/vault/working.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

Implement `working.ts`:
- `saveNote` / `saveList`: trim title；校验日期（复用 `isRealDate` from `web.ts` 或挪到小工具文件）；加密正文/清单 JSON 为新随机 blob 名（`crypto.getRandomValues` → 32 hex）；`hash` = hex SHA-256 of plaintext bytes；更新 `updatedAt[source]`；清掉该 source 的 tombstone。
- `delete*`：从 manifest 移除，写入 tombstone。
- `mergeWorking`：对 notes/lists/photos 各自按 source 比较 `updatedAt`（缺省 0）与 tombstone；胜者带上对应 `dirtyBlobs` 条目。
- `sealWorking` / `openWorking`：JSON + `encryptJson`/`decryptJson`（`dirtyBlobs` 值先 `toBase64`）。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/vault/working.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/vault/working.ts src/vault/working.test.ts
git commit -m "feat(vault): merge working vault edits by source"
```

---

### Task 2: Git Data API 读提交

**Files:**
- Create: `src/vault/gitVault.ts`
- Test: `src/vault/gitVault.test.ts`
- Modify: `src/vault/github.ts`（导出 `TOKEN_DENIED`、`SYNC_PENDING`、`GitHubWriteError`、`GITHUB_WEB` 供复用；避免重复常量）

**Interfaces:**
- Consumes: `VaultFile` from `types.ts`; errors/constants from `github.ts`
- Produces:
  - `const VAULT_JSON_PATH = 'public/vault/vault.json'`
  - `const WEB_JSON_PATH = 'public/vault/web.json'`
  - `async function readVaultFile(fetch, token): Promise<VaultFile>`
  - `async function readBlobFile(fetch, token, blobName: string): Promise<Uint8Array>`
  - `async function commitVaultUpdate(options: { fetch; token; message: string; vaultFile: VaultFile; blobs: Record<string, Uint8Array>; deleteWebJson?: boolean }): Promise<void>`
  - 内部：`getRef` → `getCommit` → `createBlob` (base64) → `createTree` → `createCommit` → `patchRef`；patch 非快进抛可识别错误供上层重试

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { TOKEN_DENIED } from './github'
import { commitVaultUpdate, readVaultFile } from './gitVault'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('commitVaultUpdate', () => {
  it('creates blobs, a tree, a commit, and fast-forwards master', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname
      calls.push(`${init?.method ?? 'GET'} ${path}`)
      if (path.endsWith('/git/ref/heads/master')) return json(200, { object: { sha: 'commit0' } })
      if (path.endsWith('/git/commits/commit0')) return json(200, { tree: { sha: 'tree0' }, sha: 'commit0' })
      if (path.endsWith('/git/blobs')) return json(201, { sha: `blob-${calls.length}` })
      if (path.endsWith('/git/trees')) return json(201, { sha: 'tree1' })
      if (path.endsWith('/git/commits') && init?.method === 'POST') return json(201, { sha: 'commit1' })
      if (path.endsWith('/git/refs/heads/master')) return json(200, { object: { sha: 'commit1' } })
      return json(500, {})
    })
    await commitVaultUpdate({
      fetch: fetchImpl as typeof fetch,
      token: 't',
      message: 'content(vault): update notes',
      vaultFile: { version: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 1, salt: 'aa' }, wrappedKey: 'w', manifest: 'm' },
      blobs: { abc: new Uint8Array([1, 2, 3]) },
      deleteWebJson: true,
    })
    expect(calls.some((c) => c.startsWith('POST') && c.endsWith('/git/blobs'))).toBe(true)
    expect(calls.some((c) => c.includes('/git/refs/heads/master'))).toBe(true)
  })

  it('maps 401 on ref read to TOKEN_DENIED', async () => {
    const fetchImpl = vi.fn(async () => json(401, {}))
    await expect(
      readVaultFile(fetchImpl as typeof fetch, 't'),
    ).rejects.toThrow(TOKEN_DENIED)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/vault/gitVault.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`gitVault.ts`：
- Base URL：`https://api.github.com/repos/Krazymud/Krazymud.github.io`
- `readVaultFile`：Contents GET `public/vault/vault.json?ref=master`（`cache: 'no-store'`），解码 content。
- `readBlobFile`：Contents GET `public/vault/blobs/<name>.bin` 或 Git blob API；统一返回 `Uint8Array`。
- `commitVaultUpdate`：对每个 dirty blob + vault.json 建 git blob；`createTree` 时 `base_tree` 为当前 tree，path 用完整 `public/vault/...`；`deleteWebJson` 时对该 path 设 `sha: null` / mode 删除（GitHub trees API：`sha: null` 删除）。
- 所有请求带与 `github.ts` 相同的 headers。

- [ ] **Step 4: Run tests**

Run: `npm test -- src/vault/gitVault.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/vault/gitVault.ts src/vault/gitVault.test.ts src/vault/github.ts
git commit -m "feat(vault): commit vault files through the Git Data API"
```

---

### Task 3: 浏览器照片处理

**Files:**
- Create: `src/vault/photoProcess.ts`
- Test: `src/vault/photoProcess.test.ts`
- Modify: `package.json`（`heic-decode`、`exifr` → `dependencies`）

**Interfaces:**
- Produces:
  - `export const PHOTO_FULL_MAX_EDGE = 2000`
  - `export const PHOTO_THUMB_EDGE = 400`
  - `export class PhotoProcessError extends Error`（message: `这张照片打不开`）
  - `type HeicDecoder = (input: { buffer: Uint8Array }) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>`
  - `async function processVaultPhoto(file: File, options?: { decodeHeic?: HeicDecoder; now?: Date }): Promise<{ full: Uint8Array; thumb: Uint8Array; width: number; height: number; date: string }>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { PhotoProcessError, processVaultPhoto } from './photoProcess'

describe('processVaultPhoto', () => {
  it('rejects when heic decoding fails', async () => {
    const file = new File([new Uint8Array([0, 0, 0])], 'IMG.HEIC', { type: 'image/heic' })
    await expect(
      processVaultPhoto(file, {
        decodeHeic: async () => {
          throw new Error('boom')
        },
      }),
    ).rejects.toBeInstanceOf(PhotoProcessError)
  })

  it('builds webp full and thumb from a decoded bitmap path', async () => {
    // Use a tiny PNG file fixture or mock createImageBitmap + canvas in the test environment.
    // Assert width/height ≤ 2000 and both outputs are non-empty Uint8Arrays; date matches options.now calendar day when EXIF missing.
  })
})
```

（第二个用例在实现时用 1×1 PNG bytes 或 vi.mock canvas；计划要求断言输出非空且 `date` 为 `YYYY-MM-DD`。）

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/vault/photoProcess.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement**

- HEIC/HEIF：扩展名或 MIME → `decodeHeic`（默认动态 `import('heic-decode')`）→ ImageData → canvas。
- 其它：`createImageBitmap` 或 HTMLImageElement；能转正则转正。
- 绘制全图（inside 2000）与缩略（cover 400）；`canvas.toBlob('image/webp', q)` → `Uint8Array`。
- 日期：`exifr.parse` 的 `DateTimeOriginal` / `CreateDate`，否则 `localCalendarToday(now)`。
- `npm install` 后保证依赖在 `dependencies`。

- [ ] **Step 4: Run tests**

Run: `npm test -- src/vault/photoProcess.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/vault/photoProcess.ts src/vault/photoProcess.test.ts package.json package-lock.json
git commit -m "feat(vault): process phone photos to encrypted webp sizes"
```

---

### Task 4: WorkingVault 照片增删 + seal 清单

**Files:**
- Modify: `src/vault/working.ts`
- Modify: `src/vault/working.test.ts`

**Interfaces:**
- Produces:
  - `function webPhotoSource(uuid: string): string`
  - `async function addPhoto(working, input: { caption; date; full; thumb; width; height }, clock, dek): Promise<WorkingVault>`
  - `function deletePhoto(working, source, now): WorkingVault`
  - `async function sealVaultFile(dek, working, previous: VaultFile): Promise<VaultFile>` — 保持 `kdf`/`wrappedKey`，重加密 `manifest`

- [ ] **Step 1: Failing tests** for add/delete photo and `sealVaultFile` round-trip with `unlockWithKey`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** add/delete + `sealVaultFile`（`encryptJson(dek, manifest)`）。

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** `feat(vault): add and remove photos in the working vault`

---

### Task 5: `useVaultMutate` 同步与锁定

**Files:**
- Create: `src/vault/useVaultMutate.ts`
- Modify: `src/vault/webStore.ts` — 增加 `loadVaultPending` / `saveVaultPending` / `clearVaultPending`（字符串封印）；保留 token API
- Test: extend `src/vault/webStore.test.ts`；另建 `src/vault/useVaultMutate.test.tsx` 或扩 `VaultContent.test.tsx`

**Interfaces:**
- Consumes: `WorkingVault` ops, `gitVault`, `openWebFile`/`mergeWebDocs` for migration, `WebStore`
- Produces hook API:
  - `sessionManifest` / `working` 驱动 UI
  - `syncing: boolean`
  - `unsynced: boolean`
  - `tokenError: string | null`
  - `tokenSaved` / `saveToken` / `forgetToken`
  - `canEdit`（ready && token && !syncing）
  - `saveNote` / `deleteNote` / `saveList` / `deleteList` / `toggleListItem` / `addPhoto` / `deletePhoto`
  - 内部：`enqueue` 在操作后 `sealVaultFile` → `commitVaultUpdate`；冲突则 `readVaultFile` + 拉需要的远程 blob 编成 base `WorkingVault` → `mergeWorking` → 再 commit 一次

- [ ] **Step 1: Write failing component/hook test**

覆盖：保存笔记时出现「正在同步…」且按钮 disabled；commit mock resolve 后解除；401 显示令牌错误且 `unsynced`。

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement hook + store keys**

解锁效果：
1. 站点 `fetchBytes('vault.json')` 解锁（现有 session）。
2. 若有 token：`readVaultFile` 换最新 file+manifest 进 working。
3. 加载 vault pending 并 merge。
4. 若存在远程 `web.json`（Contents GET）：迁入 working（Task 6 可先留 TODO 函数 `migrateWebDoc`），再提交。

读 blob：有 token 时 `readBlobFile`，否则 `fetchBytes`。

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** `feat(vault): sync vault mutations with a locking queue`

---

### Task 6: `web.json` 迁移

**Files:**
- Modify: `src/vault/working.ts` — `async function absorbWebDoc(working, webDoc, dek, clock): Promise<WorkingVault>`
- Modify: `src/vault/gitVault.ts` — 确保 `deleteWebJson` 在迁移提交中为 true
- Test: `src/vault/working.test.ts` + git/hook 测试一条端到端假 fetch

**行为：**
- 每个 web note → `saveNote` 风格条目，`source` 可用 `web/notes/<原 id>`。
- web list 同理；`checks`：若 manifest 仍有该 `source` 的 list，解密 blob，按下标写 `done`，写回 dirtyBlobs。
- 迁移成功提交后仓库删除 `web.json`；本机清除旧 web pending 键。

- [ ] Steps: failing test → implement → pass → commit `feat(vault): migrate web.json into the published vault`

---

### Task 7: 笔记/清单 UI

**Files:**
- Modify: `src/vault/components/NotesTab.tsx`
- Modify: `src/vault/components/ListsTab.tsx`
- Modify: `src/vault/components/VaultContent.tsx`
- Modify: `src/vault/components/VaultContent.test.tsx`, `tabs.test.tsx`

**行为：**
- 已发布 `NoteCard` 在 `canEdit` 时显示编辑/删除；编辑需先 `readBlob` 正文填入表单；保存走 `saveNote({ source: note.source, ... })`。
- 清单同理；打勾走 `toggleListItem`，不再 `togglePublishedCheck`。
- `VaultContent` 改用 `useVaultMutate`；`vault.syncing` 时渲染「正在同步…」。
- 无令牌时已发布仍只读（无编辑按钮）。

- [ ] Steps: update tests first (published note shows 编辑) → implement → `npm test -- src/vault/components` → commit `feat(vault): edit and delete published notes and lists`

---

### Task 8: 照片 UI

**Files:**
- Modify: `src/vault/components/PhotoGrid.tsx`
- Modify: `src/vault/components/VaultContent.tsx`
- Modify tests

**行为：**
- 「加照片」→隐藏 file input `accept="image/*"` → `processVaultPhoto` → 可选说明/日期小表单 → `addPhoto`。
- 照片卡片删除两步确认 → `deletePhoto`。
- `canEdit` / `syncing` 控制禁用；`PhotoProcessError` 显示「这张照片打不开」。

- [ ] Steps: failing UI test → implement → pass → commit `feat(vault): add and delete photos in the grid`

---

### Task 9: 收尾与脚本提示

**Files:**
- Modify: `scripts/lib/vaultCommand.ts`（publish 结束打印一行警告：网页改过的仓库以 `public/vault/` 为准，过时 `vault-src` 重跑可能覆盖）
- Modify: `docs/superpowers/specs/2026-10-13-midnight-garage-vault-web-design.md` 顶部加「部分已被 mutate 设计取代」一行（或仅依赖 mutate spec 的上级链接，已有则可跳过）
- Run full `npm test` && `npm run build`

- [ ] **Step 1: Add warning string + tiny test if script tests assert stdout**
- [ ] **Step 2: `npm test` — 全绿**
- [ ] **Step 3: `npm run build` — 成功**
- [ ] **Step 4: Commit** `chore(vault): warn that web edits own public/vault`

---

## Spec coverage（自检）

| Spec | Task |
|---|---|
| 编辑/删除已发布笔记清单 | 1, 5, 7 |
| 加/删照片含 HEIC | 3, 4, 8 |
| 勾选写 list blob | 1 (`toggleListItem`), 7 |
| Git API 读/原子写 | 2, 5 |
| 冲突重试 / 令牌错误 | 2, 5 |
| 同步锁定文案 | 5, 7, 8 |
| web.json 迁移并删除 | 6 |
| 不改 vault-src；脚本提示 | 9 |
| updatedAt 仅 WorkingVault | 1 |
| 假 fetch 测试 | 1–8 |

## Placeholder scan

无 TBD；`useVaultMutate.test.tsx` 与 PhotoGrid 细则在 Task 5/8 的 Step 1 必须写出完整测试代码后再实现（执行时按 TDD 补全，不得空步）。
