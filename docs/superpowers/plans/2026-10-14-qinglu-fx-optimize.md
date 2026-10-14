# 青庐视效优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在回退版青庐 polish 基线上，落地品牌第一屏开敞壳、清锦匣/仪表车库残留、素描仅做 object-position 轻触。

**Architecture:** `Layout` 按路由切换「开敞首页」与「内页玻璃主栏」；`HomePage` 把英雄「青庐」+ 单日课 CTA 放进第一屏，仪表与锦匣入口下移；用短淡入 `UnsealFade` 替换 `VaultDoor` 并删除 `GoldSweep`；`Dashboard`/`SketchStage` 做克制样式调整。不重绘、不换色板、不上视频。

**Tech Stack:** React 19、Vite、Tailwind v4（`src/index.css`）、Vitest + Testing Library、现有 `motion/react`（仅保留必要短淡入）。

**Spec:** `docs/superpowers/specs/2026-10-14-qinglu-fx-optimize-design.md`

## Global Constraints

- 基线资产：`public/sketch/fc-still.webp`、`fc-loop.webp`；禁止新增素描视频/漫画重绘。
- 色板与字体：保持现有 `--color-ink` / `--color-fg` / `--font-display` / `.glass-panel*`；不做夜色罩、贴纸、第二主题。
- 首页第一屏：英雄文案仅为「青庐」；不显示「又见」；一个主 CTA（日课）；仪表与锦匣入口在下方区块。
- 仅 `/` 开敞壳；`/trial` `/vault` `/settings` 保持实色主栏。
- 锦匣：删除全屏金库门与 `GoldSweep`；启封演出 ≤400ms 淡入；reduced-motion 跳过。
- 不改日课算法、锦匣加密同步、进度语义；`emitNitro` 可不消费、不新增视觉。
- 每任务：相关 vitest 绿后 commit；全量门禁 `npx vitest run` 与 `npx tsc -b`。

## File map

| 路径 | 职责 |
|------|------|
| `src/index.css` | 首页渐变/开敞壳辅助类；顶栏略透可选 |
| `src/app/Layout.tsx` | `data-shell="home"\|"inner"`；首页无实色 main 盒 |
| `src/pages/HomePage.tsx` | `home-hero` / `home-below` 分区 |
| `src/pages/HomePage.test.tsx`、`src/app/App.test.tsx` | 英雄品牌与分区断言 |
| `src/scene/SketchStage.tsx` | `object-position`（手机偏车头） |
| `src/vault/components/UnsealFade.tsx`（新建） | ≤400ms 淡入，替换 VaultDoor |
| `src/vault/components/VaultDoor.tsx` + 测试 | 删除或改导到 UnsealFade 后删除 |
| `src/vault/VaultScreen.tsx` + `VaultScreen.test.tsx` | 挂 UnsealFade；断言无 `vault-door` |
| `src/vault/components/VaultContent.tsx` | 去掉 sweep/GoldSweep |
| `src/vault/components/GoldSweep.tsx` | 删除 |
| `src/garage/Dashboard.tsx` + 测试 | 去 glow / 夸张 tracking |
| `src/vault/components/UnlockPanel.tsx`、`VaultContent.tsx`、`Notice`、`ResultPanel`、`Gauge` | 收窄 `tracking-[0.35em]` 等车库字距（可选同任务） |

---

### Task 1: Layout 开敞首页壳

**Files:**
- Modify: `src/app/Layout.tsx`
- Modify: `src/index.css`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Produces: 根或 main 带 `data-shell="home"`（pathname === `/`）或 `data-shell="inner"`（其他路由）
- Consumes: `useLocation().pathname`

- [ ] **Step 1: 写失败测试**

在 `src/app/App.test.tsx` 增加：

```ts
it('uses an open shell on home and a solid main on inner routes', () => {
  renderAt('/')
  expect(document.querySelector('[data-shell="home"]')).toBeTruthy()
  expect(document.querySelector('main')?.className ?? '').not.toMatch(/glass-panel-solid/)

  renderAt('/settings')
  expect(document.querySelector('[data-shell="inner"]')).toBeTruthy()
  expect(document.querySelector('main')).toHaveClass('glass-panel-solid')
})
```

（若同文件多次 `renderAt` 需各自 `cleanup`：从 `@testing-library/react` 引入 `cleanup`，两条用例拆成两个 `it` 亦可。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/app/App.test.tsx`  
Expected: FAIL — 无 `data-shell`

- [ ] **Step 3: 实现 Layout + CSS**

`Layout.tsx` 要点：

```tsx
const isHome = pathname === '/'
// outer wrapper:
<div data-shell={isHome ? 'home' : 'inner'} className="relative min-h-dvh bg-ink text-fg ...">
  <SceneHost scene={scene} />
  <header className="glass-panel glass-panel-nav relative z-10 mx-5 mt-4 ...">...</header>
  {isHome ? (
    <main className="relative z-10 mx-auto w-full max-w-md px-5 pt-6 pb-10">
      <Outlet />
    </main>
  ) : (
    <main className="glass-panel glass-panel-solid relative z-10 mx-auto mt-4 flex w-full max-w-md flex-col rounded-lg px-5 pt-6 pb-10">
      <Outlet />
    </main>
  )}
</div>
```

`index.css` 增加：

```css
.glass-panel-nav {
  background: rgba(255, 255, 255, 0.4);
}

.home-hero-fade {
  background: linear-gradient(
    180deg,
    rgba(241, 235, 221, 0.12) 0%,
    rgba(241, 235, 221, 0.35) 45%,
    rgba(241, 235, 221, 0.82) 100%
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/app/App.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/Layout.tsx src/index.css src/app/App.test.tsx
git commit -m "feat(qinglu): open home shell vs solid inner main"
```

---

### Task 2: HomePage 品牌第一屏

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomePage.test.tsx`
- Modify: `src/app/App.test.tsx`（h1 断言改为品牌）
- Modify: `src/config/copy.ts`（可选：增加 `home.brand` 或 CTA 合成文案；英雄「青庐」可用 `copy.siteName`）

**Interfaces:**
- Produces: `data-testid="home-hero"` 内含英雄品牌与单 CTA；`data-testid="home-below"` 内含 Dashboard + 锦匣链接
- Consumes: `copy.siteName`, `copy.home.hello`, `copy.home.together`, `Dashboard`, progress

- [ ] **Step 1: 写失败测试**

更新 `HomePage.test.tsx`：

```ts
it('puts brand-first hero above the dashboard', () => {
  renderHome()
  const hero = screen.getByTestId('home-hero')
  const below = screen.getByTestId('home-below')
  expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent(copy.siteName)
  expect(within(hero).getByText(copy.home.hello(site.nickname))).toBeInTheDocument()
  expect(within(hero).queryByText(copy.home.eyebrow)).toBeNull()
  expect(within(hero).getByRole('link', { name: /出发|看结算/ })).toBeInTheDocument()
  expect(within(hero).queryByRole('group', { name: '青庐仪表' })).toBeNull()
  expect(within(below).getByRole('group', { name: '青庐仪表' })).toBeInTheDocument()
  expect(within(below).getByRole('link', { name: copy.home.vaultLink })).toBeInTheDocument()
  expect(hero.compareDocumentPosition(below) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
```

删除或改写仍断言 `copy.home.eyebrow` 在文档中、以及 `getByRole('heading')` 为 hello 的旧用例。  
`App.test.tsx` 中所有 `getByRole('heading', { level: 1 })` 期望改为 `copy.siteName`（「青庐」）；问候用 `getByText(copy.home.hello(...))`。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/pages/HomePage.test.tsx src/app/App.test.tsx`  
Expected: FAIL — 无 `home-hero` / h1 仍是问候

- [ ] **Step 3: 实现 HomePage**

```tsx
export function HomePage() {
  // ...existing progress/stats...
  return (
    <section className="relative">
      <div data-testid="home-hero" className="relative flex min-h-[70dvh] flex-col justify-end pb-8">
        <div className="pointer-events-none absolute inset-0 -mx-5 home-hero-fade" aria-hidden />
        <div className="relative">
          <h1 className="font-display text-5xl font-bold tracking-[0.18em] text-fg">{copy.siteName}</h1>
          <p className="mt-3 text-lg text-fg">{copy.home.hello(site.nickname)}</p>
          {together !== null && (
            <p className="mt-2 text-sm text-muted">{copy.home.together(together)}</p>
          )}
          <Link
            to="/trial"
            onClick={() => { if (!finished) void play('confirm') }}
            className="glass-panel mt-6 inline-flex items-center gap-3 rounded-lg border border-fg/25 px-5 py-3"
          >
            <span className="text-sm">
              {stats.due > 0 ? copy.home.trialTodayDue(stats.due) : copy.home.trialToday}
              {' · '}
              {finished ? '看结算' : '出发'}
            </span>
            <span className="font-display text-lg font-bold tabular-nums">{done} / {total}</span>
          </Link>
        </div>
      </div>
      <div data-testid="home-below" className="space-y-3 pt-2">
        <Dashboard stats={stats} />
        <Link to="/vault" className="block border border-line px-5 py-3 text-sm text-muted hover:text-fg">
          {copy.home.vaultLink}
        </Link>
      </div>
    </section>
  )
}
```

保留「出发」点击播 `confirm`、已完成不播的逻辑；accessible name 需仍匹配 `/出发|看结算/` 与到期文案测试。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/pages/HomePage.test.tsx src/app/App.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.tsx src/pages/HomePage.test.tsx src/app/App.test.tsx src/config/copy.ts
git commit -m "feat(qinglu): brand-first home hero with dashboard below fold"
```

---

### Task 3: SketchStage object-position

**Files:**
- Modify: `src/scene/SketchStage.tsx`
- Modify: `src/scene/SketchStage.test.tsx`

**Interfaces:**
- Produces: loop/still `img` 带 `object-cover` + `object-[55%_60%]`（或等价 class）；行为不变

- [ ] **Step 1: 写失败测试**

```ts
it('anchors the crop toward the car nose', () => {
  media(false)
  render(<SketchStage />)
  const img = document.querySelector('img')!
  expect(img.className).toMatch(/object-\[55%_60%\]|object-\[center_60%\]/)
})
```

（实现选定一个固定 class，测试与之对齐。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/scene/SketchStage.test.tsx`  
Expected: FAIL

- [ ] **Step 3: 最小实现**

```tsx
<img
  src={reduced ? SKETCH_STILL : SKETCH_LOOP}
  alt=""
  aria-hidden
  className="h-full w-full object-cover object-[55%_60%]"
/>
```

不做 still↔up 交叉淡化（spec 默认跳过）。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/scene/SketchStage.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scene/SketchStage.tsx src/scene/SketchStage.test.tsx
git commit -m "fix(qinglu): bias sketch crop toward headlights"
```

---

### Task 4: UnsealFade 替换 VaultDoor

**Files:**
- Create: `src/vault/components/UnsealFade.tsx`
- Create: `src/vault/components/UnsealFade.test.tsx`
- Modify: `src/vault/VaultScreen.tsx`
- Modify: `src/vault/VaultScreen.test.tsx`
- Delete: `src/vault/components/VaultDoor.tsx`
- Delete: `src/vault/components/VaultDoor.test.tsx`

**Interfaces:**
- Produces: `export const UNSEAL_MS = 400`；`export function UnsealFade({ onDone }: { onDone: () => void })`；`data-testid="unseal-fade"`；点击可跳过；定时 `onDone`
- Consumes: VaultScreen 的 `state.door` / `doorDone` / `doorPlayedOn` 逻辑不变（字段名可仍叫 `door`）

- [ ] **Step 1: 写失败测试（组件）**

```ts
// src/vault/components/UnsealFade.test.tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UNSEAL_MS, UnsealFade } from './UnsealFade'

describe('UnsealFade', () => {
  afterEach(() => vi.useRealTimers())

  it('finishes within 400ms', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<UnsealFade onDone={onDone} />)
    act(() => { vi.advanceTimersByTime(UNSEAL_MS - 1) })
    expect(onDone).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('skips on tap and stays aria-hidden', () => {
    const onDone = vi.fn()
    render(<UnsealFade onDone={onDone} />)
    const el = screen.getByTestId('unseal-fade')
    expect(el).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(el)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/vault/components/UnsealFade.test.tsx`  
Expected: FAIL cannot find module

- [ ] **Step 3: 实现 UnsealFade**

```tsx
import { motion } from 'motion/react'
import { useEffect } from 'react'

export const UNSEAL_MS = 400

export function UnsealFade({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, UNSEAL_MS)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div
      data-testid="unseal-fade"
      aria-hidden
      onClick={onDone}
      className="fixed inset-0 z-40 cursor-pointer bg-ink/40"
    >
      <motion.div
        className="absolute inset-0 bg-ink"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: UNSEAL_MS / 1000, ease: 'easeOut' }}
      />
    </div>
  )
}
```

- [ ] **Step 4: 接线 VaultScreen + 更新测试**

`VaultScreen.tsx`：`import { UnsealFade } from './components/UnsealFade'`；`{state.door && <UnsealFade onDone={doorDone} />}`。

`VaultScreen.test.tsx`：所有 `vault-door` → `unseal-fade`；用例名可改为 `plays unseal fade…`。删除 `VaultDoor*` 文件。

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/vault/components/UnsealFade.test.tsx src/vault/VaultScreen.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/vault/components/UnsealFade.tsx src/vault/components/UnsealFade.test.tsx \
  src/vault/VaultScreen.tsx src/vault/VaultScreen.test.tsx
git rm src/vault/components/VaultDoor.tsx src/vault/components/VaultDoor.test.tsx
git commit -m "feat(qinglu): replace vault door with short unseal fade"
```

---

### Task 5: 删除 GoldSweep

**Files:**
- Modify: `src/vault/components/VaultContent.tsx`
- Modify: `src/vault/components/VaultContent.test.tsx`（去掉 `sweep` prop 若有）
- Modify: `src/vault/VaultScreen.tsx`（`VaultContent` 不再传 `sweep`）
- Delete: `src/vault/components/GoldSweep.tsx`

**Interfaces:**
- Produces: `VaultContent` props 无 `sweep`
- Consumes: 无

- [ ] **Step 1: 去掉 sweep 并删除组件（类型会逼改调用点）**

`VaultContent.tsx`：删除 `import { GoldSweep } …`、`sweep: boolean`、参数解构中的 `sweep`、以及 `{sweep && <GoldSweep />}`。  
`VaultScreen.tsx`：改为 `<VaultContent session={…} file={…} fetchBytes={…} onLock={…} />`。  
所有 `VaultContent.test.tsx` 里的 `sweep={false}` 属性删除。  
`git rm src/vault/components/GoldSweep.tsx`。

- [ ] **Step 2: 跑测试确认通过**

Run: `npx vitest run src/vault`  
Expected: PASS（无 `GoldSweep` / `sweep` 引用错误）

- [ ] **Step 3: 确认仓库内无残留**

Run: `rg -n "GoldSweep|sweep=" src/vault`  
Expected: 无匹配

- [ ] **Step 4: Commit**

```bash
git add src/vault/components/VaultContent.tsx src/vault/components/VaultContent.test.tsx src/vault/VaultScreen.tsx
git rm src/vault/components/GoldSweep.tsx
git commit -m "refactor(qinglu): remove vault gold sweep"
```

---

### Task 6: 平静 Dashboard + 字距收束

**Files:**
- Modify: `src/garage/Dashboard.tsx`
- Modify: `src/garage/Dashboard.test.tsx`
- Modify: `src/vault/components/UnlockPanel.tsx`（`tracking-[0.35em]` → `tracking-wide` 或去掉）
- Modify: `src/vault/VaultScreen.tsx`（Notice 内 title 字距）
- Modify: `src/vault/components/VaultContent.tsx`（title 字距）
- Modify: `src/trial/components/ResultPanel.tsx`
- Modify: `src/trial/components/Gauge.tsx`

**Interfaces:**
- Produces: Dashboard 本周已打卡点无 `shadow-[0_0_6px_…]`；caption 无 `tracking-[0.3em]`
- Consumes: stats 逻辑不变

- [ ] **Step 1: 写失败测试**

```ts
it('does not glow completed week dots', () => {
  render(<Dashboard stats={base} />)
  const lit = screen.getByTestId('day-0')
  expect(lit.className).not.toMatch(/shadow-\[/)
  expect(screen.getByText('连续').className).not.toMatch(/tracking-\[0\.3em\]/)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/garage/Dashboard.test.tsx`  
Expected: FAIL

- [ ] **Step 3: 实现**

Dashboard 已打卡点：`className="h-2.5 w-2.5 rounded-full bg-accent-hi"`（无 shadow）。  
caption：`className="text-[10px] text-muted"`。  
UnlockPanel / Notice / VaultContent title / ResultPanel eyebrow / Gauge combo：`tracking-[0.35em]` 或 `0.2em` → `tracking-wide`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/garage/Dashboard.test.tsx src/vault src/trial`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/garage/Dashboard.tsx src/garage/Dashboard.test.tsx \
  src/vault/components/UnlockPanel.tsx src/vault/VaultScreen.tsx \
  src/vault/components/VaultContent.tsx \
  src/trial/components/ResultPanel.tsx src/trial/components/Gauge.tsx
git commit -m "style(qinglu): calm dashboard glow and wide tracking"
```

---

### Task 7: 全量门禁 + 手动核对清单

**Files:** 无新代码（修任何全量失败）

- [ ] **Step 1: 类型检查**

Run: `npx tsc -b`  
Expected: exit 0

- [ ] **Step 2: 全量测试**

Run: `npx vitest run`  
Expected: 全部 PASS（当前基线约 457；允许因删改用例略有增减）

- [ ] **Step 3: 手动核对（实现者在浏览器）**

- 桌面 `/`：第一屏大号「青庐」+ 车可见；无「又见」；仪表需滚动
- 手机窄屏：车头/翻灯裁切可接受
- `/trial` `/vault` `/settings`：实色主栏可读
- 锦匣首次启封：短淡入，无金库门/金属扫；无 mp4 请求

- [ ] **Step 4: Commit（仅当有修复时）**

```bash
git add -A
git commit -m "test(qinglu): fix regressions from fx optimize"
```

---

## Self-review (plan vs spec)

| Spec 要求 | Task |
|-----------|------|
| P0 品牌第一屏 / 仪表下移 | Task 2 |
| P0 开敞壳 vs 内页实色主栏 | Task 1 |
| 暖纸渐变、不换色板 | Task 1 CSS |
| P1 去 VaultDoor | Task 4 |
| P1 去 GoldSweep | Task 5 |
| P1 Dashboard glow/字距 | Task 6 |
| P2 object-position；默认不做交叉淡化 | Task 3 |
| 测试 §8 | Tasks 1–7 |
| 不重绘 / 无视频 | Global Constraints |
| nitro 不新消费 | 无任务（刻意不做） |
