# 1.1 保险库开门动画与今日回忆 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保险库打开后在标签栏上方显示「那年今天 / 今日一张」回忆卡，并在每个学习日第一次进入时播放全屏金库开门动画。

**Architecture:** 选取规则是纯函数 `todaysMemory`（`src/vault/memory.ts`），由 `VaultContent` 渲染成 `MemoryCard`。开门动画是独立的 `VaultDoor` 覆盖层（SVG + Motion，靠定时器结束），由 `VaultScreen` 在进入打开状态时决定是否播放并负责解锁音效；已播放的学习日存在 `localStorage`（`doorDay.ts`）。

**Tech Stack:** React 19、TypeScript、Motion（`motion/react`）、Tailwind 4、Vitest + Testing Library（jsdom）。

## Global Constraints

- 只在功能分支 `feature/vault-upgrade` 上实现，不在 master 上写代码。
- 不提交 `assets-src/`、`dist/`、`node_modules/`、`.superpowers/`。
- 不改加密格式、manifest 结构和 `npm run vault` 构建脚本；保险库不加 3D。
- `src/scene/three/` 以外不得引入 three / R3F。
- 主包 ≤ 200 KB gzip（当前约 154.3 KB）。
- 学习日一律用 `studyDay(new Date())`（`src/trial/day.ts`，凌晨 4 点换日）。
- 界面文字为中文；代码注释只写代码本身表达不了的约束。
- 运行 node 前先：`$env:Path = "C:\Program Files\nodejs;$env:Path"`（PowerShell）。

## 文件

- Create `src/vault/memory.ts`：`todaysMemory`、`dayHash`、`Memory` 类型。
- Create `src/vault/memory.test.ts`
- Create `src/vault/components/MemoryCard.tsx`：回忆卡。
- Create `src/vault/components/MemoryCard.test.tsx`
- Modify `src/vault/components/NotesTab.tsx`：导出 `NoteCard`。
- Modify `src/vault/components/VaultContent.tsx`：回忆卡、`sweep` 属性。
- Create `src/vault/doorDay.ts`、`src/vault/doorDay.test.ts`
- Create `src/vault/components/VaultDoor.tsx`、`src/vault/components/VaultDoor.test.tsx`
- Modify `src/scene/hooks.ts`：导出 `prefersReducedMotion`。
- Modify `src/vault/VaultScreen.tsx`、`src/vault/VaultScreen.test.tsx`

---

### Task 1: 今日回忆选取规则

**Files:**
- Create: `src/vault/memory.ts`
- Test: `src/vault/memory.test.ts`

**Interfaces:**
- Consumes: `PhotoEntry`、`NoteEntry`、`VaultManifest`（`src/vault/types.ts`，日期为 `YYYY-MM-DD`）。
- Produces:
  - `type MemoryPhoto = { type: 'photo'; photo: PhotoEntry; index: number }`（`index` 是在 `manifest.photos` 中的下标）
  - `type MemoryItem = MemoryPhoto | { type: 'note'; note: NoteEntry }`
  - `type Memory = { kind: 'anniversary'; years: number; item: MemoryItem } | { kind: 'daily'; item: MemoryPhoto }`
  - `function dayHash(day: string): number`（32 位无符号 FNV-1a）
  - `function todaysMemory(manifest: VaultManifest, today: string): Memory | null`

- [ ] **Step 1: Write the failing test**

`src/vault/memory.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { addDays } from '../trial/day'
import { dayHash, todaysMemory } from './memory'
import type { NoteEntry, PhotoEntry, VaultManifest } from './types'

const photo = (date: string, caption = date): PhotoEntry => ({
  caption,
  date,
  width: 1,
  height: 1,
  thumb: `t-${caption}`,
  full: `f-${caption}`,
  source: `photos/${caption}.jpg`,
  hash: caption,
})
const note = (date: string, title = date): NoteEntry => ({ title, date, blob: `n-${title}`, source: `notes/${title}.md`, hash: title })
const vault = (photos: PhotoEntry[], notes: NoteEntry[] = []): VaultManifest => ({ photos, notes, lists: [] })

describe('todaysMemory', () => {
  it('finds a photo from the same day in an earlier year', () => {
    const manifest = vault([photo('2025-03-01'), photo('2024-05-20')])
    expect(todaysMemory(manifest, '2026-05-20')).toEqual({
      kind: 'anniversary',
      years: 2,
      item: { type: 'photo', photo: manifest.photos[1], index: 1 },
    })
  })

  it('prefers the most recent year', () => {
    const manifest = vault([photo('2022-05-20'), photo('2025-05-20'), photo('2023-05-20')])
    expect(todaysMemory(manifest, '2026-05-20')).toMatchObject({ years: 1, item: { index: 1 } })
  })

  it('picks the same one of several from one year all day', () => {
    const manifest = vault([photo('2025-05-20', 'a'), photo('2025-05-20', 'b'), photo('2025-05-20', 'c')])
    const first = todaysMemory(manifest, '2026-05-20')
    expect(todaysMemory(manifest, '2026-05-20')).toEqual(first)
    expect(first).toMatchObject({ years: 1, item: { index: dayHash('2026-05-20') % 3 } })
  })

  it('ignores entries from this year', () => {
    const manifest = vault([photo('2026-05-20')], [note('2026-05-20')])
    expect(todaysMemory(manifest, '2026-05-20')).toMatchObject({ kind: 'daily' })
  })

  it('remembers 29 February on 28 February in common years', () => {
    const manifest = vault([photo('2024-02-29')])
    expect(todaysMemory(manifest, '2025-02-28')).toMatchObject({ kind: 'anniversary', years: 1 })
    expect(todaysMemory(manifest, '2028-02-28')).toMatchObject({ kind: 'daily' })
    expect(todaysMemory(manifest, '2028-02-29')).toMatchObject({ kind: 'anniversary', years: 4 })
  })

  it('prefers a photo over a note', () => {
    const manifest = vault([photo('2020-05-20')], [note('2025-05-20')])
    expect(todaysMemory(manifest, '2026-05-20')).toMatchObject({ years: 6, item: { type: 'photo' } })
  })

  it('falls back to a note anniversary', () => {
    const goodnight = note('2025-05-20', '晚安')
    expect(todaysMemory(vault([photo('2025-01-01')], [goodnight]), '2026-05-20')).toEqual({
      kind: 'anniversary',
      years: 1,
      item: { type: 'note', note: goodnight },
    })
  })

  it('shows a daily photo that holds all day and changes across days', () => {
    const manifest = vault(Array.from({ length: 10 }, (_, i) => photo(`2025-01-${String(i + 1).padStart(2, '0')}`)))
    const day = '2026-05-20'
    expect(todaysMemory(manifest, day)).toEqual(todaysMemory(manifest, day))
    const picks = new Set(
      Array.from({ length: 7 }, (_, i) => {
        const memory = todaysMemory(manifest, addDays(day, i))
        return memory?.kind === 'daily' ? memory.item.index : -1
      }),
    )
    expect(picks.has(-1)).toBe(false)
    expect(picks.size).toBeGreaterThan(1)
  })

  it('shows nothing without photos or an anniversary', () => {
    expect(todaysMemory(vault([]), '2026-05-20')).toBeNull()
    expect(todaysMemory(vault([], [note('2025-01-01')]), '2026-05-20')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/vault/memory.test.ts`
Expected: FAIL，找不到 `./memory`。

- [ ] **Step 3: Write minimal implementation**

`src/vault/memory.ts`：

```ts
import type { NoteEntry, PhotoEntry, VaultManifest } from './types'

export type MemoryPhoto = { type: 'photo'; photo: PhotoEntry; index: number }
export type MemoryItem = MemoryPhoto | { type: 'note'; note: NoteEntry }
export type Memory = { kind: 'anniversary'; years: number; item: MemoryItem } | { kind: 'daily'; item: MemoryPhoto }

export function dayHash(day: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < day.length; i++) {
    hash ^= day.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const yearOf = (date: string) => Number(date.slice(0, 4))

function isLeap(year: number): boolean {
  return new Date(year, 1, 29).getMonth() === 1
}

function sameMonthDay(date: string, today: string): boolean {
  const monthDay = date.slice(5)
  const todayMonthDay = today.slice(5)
  if (monthDay === todayMonthDay) return true
  return monthDay === '02-29' && todayMonthDay === '02-28' && !isLeap(yearOf(today))
}

function pickAnniversary<T extends { date: string }>(items: T[], today: string): T | null {
  const hits = items.filter((item) => yearOf(item.date) < yearOf(today) && sameMonthDay(item.date, today))
  if (hits.length === 0) return null
  const latest = Math.max(...hits.map((item) => yearOf(item.date)))
  const top = hits.filter((item) => yearOf(item.date) === latest)
  return top[dayHash(today) % top.length]
}

export function todaysMemory(manifest: VaultManifest, today: string): Memory | null {
  const years = (date: string) => yearOf(today) - yearOf(date)
  const photo = pickAnniversary(manifest.photos, today)
  if (photo) {
    return { kind: 'anniversary', years: years(photo.date), item: { type: 'photo', photo, index: manifest.photos.indexOf(photo) } }
  }
  const note = pickAnniversary(manifest.notes, today)
  if (note) return { kind: 'anniversary', years: years(note.date), item: { type: 'note', note } }
  if (manifest.photos.length === 0) return null
  const index = dayHash(today) % manifest.photos.length
  return { kind: 'daily', item: { type: 'photo', photo: manifest.photos[index], index } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/vault/memory.test.ts`
Expected: PASS（9 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/vault/memory.ts src/vault/memory.test.ts
git commit -m "feat(vault): pick today's memory"
```

---

### Task 2: 回忆卡

**Files:**
- Create: `src/vault/components/MemoryCard.tsx`
- Modify: `src/vault/components/NotesTab.tsx`（`function NoteCard` 前加 `export`）
- Modify: `src/vault/components/VaultContent.tsx`
- Test: `src/vault/components/MemoryCard.test.tsx`、`src/vault/VaultScreen.test.tsx`（加一个用例）

**Interfaces:**
- Consumes: Task 1 的 `Memory`、`todaysMemory`；`studyDay`（`src/trial/day.ts`）；`useBlobUrl`、`ReadBlob`（`src/vault/useBlob.ts`）；`PhotoViewer`（props：`photos, index, read, onIndex, onClose`）。
- Produces:
  - `export function NoteCard({ note, read }: { note: NoteEntry; read: ReadBlob })`（渲染一个 `<li>`）
  - `export function MemoryCard({ memory, photos, read }: { memory: Memory; photos: PhotoEntry[]; read: ReadBlob })`，根元素 `<section aria-label="今日回忆">`；照片按钮可访问名为 `打开回忆 ${caption || date}`（不能与照片网格的「查看照片 …」重名）。

- [ ] **Step 1: Write the failing tests**

`src/vault/components/MemoryCard.test.tsx`：

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Memory } from '../memory'
import type { NoteEntry, PhotoEntry } from '../types'
import type { ReadBlob } from '../useBlob'
import { MemoryCard } from './MemoryCard'

function reader(blobs: Record<string, string>): ReadBlob {
  return async (name) => {
    if (!(name in blobs)) throw new Error('broken')
    return new TextEncoder().encode(blobs[name])
  }
}

const photos: PhotoEntry[] = [
  { caption: '', date: '2024-03-02', width: 1500, height: 2000, thumb: 't1', full: 'f1', source: 'photos/a.jpg', hash: 'a' },
  { caption: '第一次去海边', date: '2024-05-20', width: 2000, height: 1500, thumb: 't2', full: 'f2', source: 'photos/b.jpg', hash: 'b' },
]
const goodnight: NoteEntry = { title: '晚安', date: '2025-05-21', blob: 'n1', source: 'notes/a.md', hash: 'n' }

describe('MemoryCard', () => {
  it('labels an anniversary photo and opens it in the viewer', () => {
    const memory: Memory = { kind: 'anniversary', years: 2, item: { type: 'photo', photo: photos[1], index: 1 } }
    render(<MemoryCard memory={memory} photos={photos} read={reader({ t2: '2', f2: 'F2' })} />)
    expect(screen.getByRole('region', { name: '今日回忆' })).toHaveTextContent('2 年前的今天 · 2024-05-20')
    fireEvent.click(screen.getByRole('button', { name: '打开回忆 第一次去海边' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('2 / 2')
  })

  it('labels a daily photo', () => {
    const memory: Memory = { kind: 'daily', item: { type: 'photo', photo: photos[0], index: 0 } }
    render(<MemoryCard memory={memory} photos={photos} read={reader({ t1: '1' })} />)
    expect(screen.getByRole('region', { name: '今日回忆' })).toHaveTextContent('今日一张 · 2024-03-02')
    expect(screen.getByRole('button', { name: '打开回忆 2024-03-02' })).toBeInTheDocument()
  })

  it('shows a note anniversary that expands in place', async () => {
    const memory: Memory = { kind: 'anniversary', years: 1, item: { type: 'note', note: goodnight } }
    render(<MemoryCard memory={memory} photos={photos} read={reader({ n1: '今天的风很**温柔**。' })} />)
    expect(screen.getByRole('region', { name: '今日回忆' })).toHaveTextContent('1 年前的今天 · 2025-05-21')
    await screen.findByText('今天的风很温柔。')
    fireEvent.click(screen.getByRole('button', { name: /晚安/ }))
    expect(screen.getByText('温柔').tagName).toBe('STRONG')
  })
})
```

在 `src/vault/VaultScreen.test.tsx` 的 `describe('VaultScreen', …)` 末尾加：

```tsx
  it("shows today's memory above the tabs", async () => {
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await enter(TEST_PASSPHRASE)
    const memory = await screen.findByRole('region', { name: '今日回忆' })
    const tablist = screen.getByRole('tablist')
    expect(memory.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
```

（测试保险库有两张照片，任何日期都至少有「今日一张」。）

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/vault/components/MemoryCard.test.tsx src/vault/VaultScreen.test.tsx`
Expected: FAIL，找不到 `./MemoryCard`；VaultScreen 新用例找不到「今日回忆」。

- [ ] **Step 3: Implement**

`src/vault/components/NotesTab.tsx`：把 `function NoteCard(` 改成 `export function NoteCard(`，其余不动。

`src/vault/components/MemoryCard.tsx`：

```tsx
import { useState } from 'react'
import type { Memory } from '../memory'
import type { PhotoEntry } from '../types'
import { useBlobUrl, type ReadBlob } from '../useBlob'
import { NoteCard } from './NotesTab'
import { PhotoViewer } from './PhotoViewer'

function heading(memory: Memory): string {
  return memory.kind === 'anniversary' ? `${memory.years} 年前的今天` : '今日一张'
}

function MemoryPhoto({ photo, read, onOpen }: { photo: PhotoEntry; read: ReadBlob; onOpen: () => void }) {
  const thumb = useBlobUrl(photo.thumb, read, 'image/webp')
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开回忆 ${photo.caption || photo.date}`}
      className="flex w-full items-center gap-3 text-left"
    >
      <span className="block h-20 w-20 shrink-0 overflow-hidden border border-line bg-ink">
        {thumb.status === 'ready' && <img src={thumb.url} alt="" className="h-full w-full object-cover" />}
        {thumb.status === 'failed' && <span className="flex h-full items-center justify-center text-xs text-muted">打不开</span>}
      </span>
      {photo.caption && <span className="text-sm">{photo.caption}</span>}
    </button>
  )
}

export function MemoryCard({ memory, photos, read }: { memory: Memory; photos: PhotoEntry[]; read: ReadBlob }) {
  const [viewing, setViewing] = useState<number | null>(null)
  const { item } = memory
  const date = item.type === 'photo' ? item.photo.date : item.note.date

  return (
    <section aria-label="今日回忆" className="mt-4 border border-accent/60 bg-panel/80 p-3">
      <p className="mb-2 text-xs text-accent-hi">{`${heading(memory)} · ${date}`}</p>
      {item.type === 'photo' ? (
        <MemoryPhoto photo={item.photo} read={read} onOpen={() => setViewing(item.index)} />
      ) : (
        <ul>
          <NoteCard note={item.note} read={read} />
        </ul>
      )}
      {viewing !== null && (
        <PhotoViewer photos={photos} index={viewing} read={read} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </section>
  )
}
```

`src/vault/components/VaultContent.tsx`：

1. 第一行改为 `import { useCallback, useMemo } from 'react'`，并加入：

```tsx
import { studyDay } from '../../trial/day'
import { todaysMemory } from '../memory'
import { MemoryCard } from './MemoryCard'
```

2. 在 `const { manifest } = session` 之后加：

```tsx
  const memory = useMemo(() => todaysMemory(manifest, studyDay(new Date())), [manifest])
```

3. 在标题行 `</div>`（包含「锁上」按钮的那个 div）之后、`<div role="tablist"` 之前插入：

```tsx
      {memory && <MemoryCard memory={memory} photos={manifest.photos} read={read} />}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/vault`
Expected: PASS（含原有用例，「查看照片 第一次去海边」不与回忆卡重名）。

- [ ] **Step 5: Commit**

```bash
git add src/vault/components/MemoryCard.tsx src/vault/components/MemoryCard.test.tsx src/vault/components/NotesTab.tsx src/vault/components/VaultContent.tsx src/vault/VaultScreen.test.tsx
git commit -m "feat(vault): today's memory card above the tabs"
```

---

### Task 3: 开门动画组件与播放记录

**Files:**
- Create: `src/vault/doorDay.ts`、`src/vault/doorDay.test.ts`
- Create: `src/vault/components/VaultDoor.tsx`、`src/vault/components/VaultDoor.test.tsx`

**Interfaces:**
- Produces:
  - `export const DOOR_DAY_KEY = 'midnight-garage/vault-door-day'`
  - `export function doorPlayedOn(day: string): boolean`（读失败或值不等于 `day` 时为 `false`）
  - `export function markDoorPlayed(day: string): void`（写失败忽略）
  - `export const DOOR_MS = 1600`
  - `export function VaultDoor({ onDone }: { onDone: () => void })`：根元素 `data-testid="vault-door"`、`aria-hidden`；挂载 `DOOR_MS` 毫秒后调用 `onDone`，点击时立即调用 `onDone`。组件本身不播放声音、不读写存储。调用方必须传稳定的 `onDone`（定时器依赖它）。

- [ ] **Step 1: Write the failing tests**

`src/vault/doorDay.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOOR_DAY_KEY, doorPlayedOn, markDoorPlayed } from './doorDay'

describe('doorDay', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('has not played before anything is saved', () => {
    expect(doorPlayedOn('2026-10-10')).toBe(false)
  })

  it('remembers only the day it played', () => {
    markDoorPlayed('2026-10-10')
    expect(localStorage.getItem(DOOR_DAY_KEY)).toBe('2026-10-10')
    expect(doorPlayedOn('2026-10-10')).toBe(true)
    expect(doorPlayedOn('2026-10-11')).toBe(false)
  })

  it('treats a damaged value as not played', () => {
    localStorage.setItem(DOOR_DAY_KEY, '{oops')
    expect(doorPlayedOn('2026-10-10')).toBe(false)
  })

  it('carries on when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => markDoorPlayed('2026-10-10')).not.toThrow()
    expect(doorPlayedOn('2026-10-10')).toBe(false)
  })
})
```

`src/vault/components/VaultDoor.test.tsx`：

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOOR_MS, VaultDoor } from './VaultDoor'

describe('VaultDoor', () => {
  afterEach(() => vi.useRealTimers())

  it('finishes on its own after the animation', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<VaultDoor onDone={onDone} />)
    act(() => {
      vi.advanceTimersByTime(DOOR_MS - 1)
    })
    expect(onDone).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('skips on a tap and stays out of the accessibility tree', () => {
    const onDone = vi.fn()
    render(<VaultDoor onDone={onDone} />)
    const door = screen.getByTestId('vault-door')
    expect(door).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(door)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/vault/doorDay.test.ts src/vault/components/VaultDoor.test.tsx`
Expected: FAIL，找不到 `./doorDay` 和 `./VaultDoor`。

- [ ] **Step 3: Implement**

`src/vault/doorDay.ts`：

```ts
export const DOOR_DAY_KEY = 'midnight-garage/vault-door-day'

export function doorPlayedOn(day: string): boolean {
  try {
    return window.localStorage.getItem(DOOR_DAY_KEY) === day
  } catch {
    return false
  }
}

export function markDoorPlayed(day: string): void {
  try {
    window.localStorage.setItem(DOOR_DAY_KEY, day)
  } catch {
    // 存不下时下次进入会再播一次
  }
}
```

`src/vault/components/VaultDoor.tsx`。时间线：0–0.5 s 转盘转 270°；0.5–0.8 s 8 根锁栓缩回（被门面圆盖住）；0.8–1.6 s 门绕左边缘转开、背景同时淡出。SVG 里锁栓的位移用 `attrY`（Motion 的 `y` 在 SVG 上是 transform，不是属性）。转盘外加一圈轮缘，让转盘包围盒以原点为中心，Motion 默认绕包围盒中心旋转。

```tsx
import { motion } from 'motion/react'
import { useEffect } from 'react'

export const DOOR_MS = 1600

const BOLTS = [0, 45, 90, 135, 180, 225, 270, 315]
const SPOKES = [0, 120, 240]

export function VaultDoor({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, DOOR_MS)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div
      data-testid="vault-door"
      aria-hidden
      onClick={onDone}
      className="fixed inset-0 z-40 flex cursor-pointer items-center justify-center [perspective:1200px]"
    >
      <motion.div
        className="absolute inset-0 bg-ink"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
      />
      <motion.svg
        viewBox="-100 -100 200 200"
        className="relative w-[min(80vw,80vh)] text-accent-hi"
        style={{ transformOrigin: 'left center' }}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: -100 }}
        transition={{ delay: 0.8, duration: 0.8, ease: 'easeIn' }}
      >
        <circle r={96} fill="none" stroke="currentColor" strokeWidth={4} />
        {BOLTS.map((angle) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <motion.rect
              x={-5}
              width={10}
              height={16}
              fill="currentColor"
              initial={{ attrY: -94 }}
              animate={{ attrY: -80 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            />
          </g>
        ))}
        <circle r={82} fill="var(--color-panel)" stroke="currentColor" strokeWidth={2} />
        <circle r={70} fill="none" stroke="var(--color-line)" strokeWidth={1.5} />
        <motion.g initial={{ rotate: 0 }} animate={{ rotate: 270 }} transition={{ duration: 0.5, ease: 'easeInOut' }}>
          <circle r={44} fill="none" stroke="currentColor" strokeWidth={3} />
          {SPOKES.map((angle) => (
            <line
              key={angle}
              x2={0}
              y2={-44}
              stroke="currentColor"
              strokeWidth={6}
              strokeLinecap="round"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle r={12} fill="currentColor" />
        </motion.g>
      </motion.svg>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/vault/doorDay.test.ts src/vault/components/VaultDoor.test.tsx`
Expected: PASS（6 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/vault/doorDay.ts src/vault/doorDay.test.ts src/vault/components/VaultDoor.tsx src/vault/components/VaultDoor.test.tsx
git commit -m "feat(vault): vault door overlay and played-day record"
```

---

### Task 4: 在 VaultScreen 接上开门动画

**Files:**
- Modify: `src/scene/hooks.ts`（`function prefersReducedMotion` 前加 `export`）
- Modify: `src/vault/VaultScreen.tsx`
- Modify: `src/vault/components/VaultContent.tsx`（`sweep` 属性）
- Test: `src/vault/VaultScreen.test.tsx`

**Interfaces:**
- Consumes: Task 3 的 `doorPlayedOn`、`markDoorPlayed`、`DOOR_DAY_KEY`、`VaultDoor`；`prefersReducedMotion(): boolean`（`src/scene/hooks.ts`，无 `matchMedia` 时为 `false`）；`studyDay`；`play('unlock')`（`src/audio/sound.ts`）。
- Produces: `VaultContent` 新增必填属性 `sweep: boolean`（为真时才挂载 `GoldSweep`）。

规则（来自规格 3.2、3.3）：

- 进入打开状态时：`door = !prefersReducedMotion() && !doorPlayedOn(today)`；`door` 为真就立即 `markDoorPlayed(today)`。
- 解锁音效：`door || 手动解锁` 时播放一次 `play('unlock')`；自动解锁且不播门时不播。
- 门播放期间：内容外层 `inert`，`VaultContent` 的 `sweep` 为 `false`；门结束（定时或点击）后移除门，`sweep` 变 `true`。

- [ ] **Step 1: Write the failing tests**

`src/vault/VaultScreen.test.tsx`：

1. 加入 import：

```tsx
import { studyDay } from '../trial/day'
import { DOOR_DAY_KEY } from './doorDay'
```

2. 把 `afterEach(() => vi.useRealTimers())` 换成：

```tsx
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
  })
```

3. 在 `renderVault` 函数之后加：

```tsx
function reduceMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }))
}

const sounds = () => vi.mocked(play).mock.calls.map(([name]) => name)
```

4. 在 `describe('VaultScreen', …)` 末尾加：

```tsx
  it('swings the door open on the first visit of the day only', async () => {
    const vault = await makeTestVault()
    const first = renderVault(vault.fetchBytes, null)
    await enter(TEST_PASSPHRASE)
    await screen.findByRole('tab', { name: '照片' })
    expect(screen.getByTestId('vault-door')).toBeInTheDocument()
    expect(localStorage.getItem(DOOR_DAY_KEY)).toBe(studyDay(new Date()))
    first.unmount()

    renderVault(vault.fetchBytes, null)
    await enter(TEST_PASSPHRASE)
    await screen.findByRole('tab', { name: '照片' })
    expect(screen.queryByTestId('vault-door')).not.toBeInTheDocument()
  })

  it('keeps the vault inert until the door is skipped', async () => {
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await enter(TEST_PASSPHRASE)
    const tab = await screen.findByRole('tab', { name: '照片' })
    expect(tab.closest('[inert]')).not.toBeNull()
    fireEvent.click(screen.getByTestId('vault-door'))
    expect(screen.queryByTestId('vault-door')).not.toBeInTheDocument()
    expect(tab.closest('[inert]')).toBeNull()
  })

  it('opens without the door when motion is reduced', async () => {
    reduceMotion()
    vi.mocked(play).mockClear()
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await enter(TEST_PASSPHRASE)
    await screen.findByRole('tab', { name: '照片' })
    expect(screen.queryByTestId('vault-door')).not.toBeInTheDocument()
    expect(localStorage.getItem(DOOR_DAY_KEY)).toBeNull()
    expect(sounds()).toEqual(['ignition', 'unlock'])
  })

  it('opens a remembered vault with the door and its sound', async () => {
    vi.mocked(play).mockClear()
    const vault = await makeTestVault()
    const store = createKeyStore(new IDBFactory())!
    await store.save(vault.dek)
    renderVault(vault.fetchBytes, store)
    await screen.findByRole('tab', { name: '照片' })
    expect(screen.getByTestId('vault-door')).toBeInTheDocument()
    expect(sounds()).toEqual(['unlock'])
  })

  it('still plays the unlock sound once for a manual unlock after the door', async () => {
    localStorage.setItem(DOOR_DAY_KEY, studyDay(new Date()))
    vi.mocked(play).mockClear()
    const vault = await makeTestVault()
    renderVault(vault.fetchBytes, null)
    await enter(TEST_PASSPHRASE)
    await screen.findByRole('tab', { name: '照片' })
    expect(screen.queryByTestId('vault-door')).not.toBeInTheDocument()
    expect(sounds()).toEqual(['ignition', 'unlock'])
  })

  it('stays quiet when a remembered vault opens after the door', async () => {
    localStorage.setItem(DOOR_DAY_KEY, studyDay(new Date()))
    vi.mocked(play).mockClear()
    const vault = await makeTestVault()
    const store = createKeyStore(new IDBFactory())!
    await store.save(vault.dek)
    renderVault(vault.fetchBytes, store)
    await screen.findByRole('tab', { name: '照片' })
    expect(screen.queryByTestId('vault-door')).not.toBeInTheDocument()
    expect(sounds()).toEqual([])
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/vault/VaultScreen.test.tsx`
Expected: 新增用例 FAIL（找不到 `vault-door`、自动解锁未播音效等）；原有用例仍 PASS。

- [ ] **Step 3: Implement**

`src/scene/hooks.ts`：`function prefersReducedMotion(): boolean` 改为 `export function prefersReducedMotion(): boolean`。

`src/vault/components/VaultContent.tsx`：

- `VaultContentProps` 加 `sweep: boolean`；函数签名改为 `export function VaultContent({ session, fetchBytes, sweep, onLock }: VaultContentProps)`。
- `<GoldSweep />` 改为 `{sweep && <GoldSweep />}`。

`src/vault/VaultScreen.tsx` 整个文件替换为：

```tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { play } from '../audio/sound'
import { prefersReducedMotion } from '../scene/hooks'
import { studyDay } from '../trial/day'
import { DecryptError } from './crypto'
import { doorPlayedOn, markDoorPlayed } from './doorDay'
import { defaultKeyStore, type KeyStore } from './keyStore'
import { fetchVaultBytes, loadVaultFile, unlockWithKey, unlockWithPassphrase, type FetchBytes, type VaultSession } from './repo'
import type { VaultFile } from './types'
import { UnlockPanel } from './components/UnlockPanel'
import { VaultContent } from './components/VaultContent'
import { VaultDoor } from './components/VaultDoor'

type VaultState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'locked'; file: VaultFile }
  | { status: 'open'; file: VaultFile; session: VaultSession; door: boolean }

type Loaded = Exclude<VaultState, { status: 'open' }> | { status: 'remembered'; file: VaultFile; session: VaultSession }

interface VaultScreenProps {
  fetchBytes?: FetchBytes
  keyStore?: KeyStore | null
}

function opened(file: VaultFile, session: VaultSession, manual: boolean): VaultState {
  const today = studyDay(new Date())
  const door = !prefersReducedMotion() && !doorPlayedOn(today)
  if (door) markDoorPlayed(today)
  if (door || manual) void play('unlock')
  return { status: 'open', file, session, door }
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
    async function open(): Promise<Loaded> {
      const file = await loadVaultFile(fetchBytes)
      if (!file) return { status: 'empty' }
      const saved = store ? await store.load().catch(() => null) : null
      if (saved) {
        try {
          return { status: 'remembered', file, session: await unlockWithKey(file, saved) }
        } catch {
          await store?.clear().catch(() => undefined)
        }
      }
      return { status: 'locked', file }
    }
    open().then(
      (next) => {
        if (alive) setState(next.status === 'remembered' ? opened(next.file, next.session, false) : next)
      },
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
      setState(opened(file, session, true))
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

  const doorDone = useCallback(() => setState((s) => (s.status === 'open' ? { ...s, door: false } : s)), [])

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
      return (
        <>
          <div inert={state.door}>
            <VaultContent session={state.session} fetchBytes={fetchBytes} sweep={!state.door} onLock={() => void lock(state.file)} />
          </div>
          {state.door && <VaultDoor onDone={doorDone} />}
        </>
      )
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/vault`
Expected: PASS（含原有的 `['ignition', 'unlock']` 用例：手动解锁且播门时音效只有一次）。

- [ ] **Step 5: Full verification**

Run（依次）：
- `npm test` → 全部 PASS
- `npx tsc -b` → 无错误
- `npx eslint .` → 无错误
- `npm run build` → 成功；输出中主入口 JS 的 gzip 大小 ≤ 200 KB

- [ ] **Step 6: Commit**

```bash
git add src/scene/hooks.ts src/vault/VaultScreen.tsx src/vault/VaultScreen.test.tsx src/vault/components/VaultContent.tsx
git commit -m "feat(vault): play the vault door on the first visit of the day"
```

---

## 控制器收尾（不派给实现子代理）

- 浏览器检查（`npm run dev -- --port 5173 --strictPort`，打开 `/vault`）：开门动画观感、点击跳过、门后金色扫光、回忆卡样式；390×844 竖屏再看一次。检查前在控制台执行 `localStorage.removeItem('midnight-garage/vault-door-day')` 以重新看到门。
- 整分支终审、合并 master、询问用户后再推送。
