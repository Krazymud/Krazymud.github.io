# Midnight Garage 1.2 车库升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 车库加仪表盘条、随本地时间变化的氛围光、以及有材质的地面、旋转展台、后墙灯带、霓虹灯牌、道具剪影、光柱和尘埃。

**Architecture:** 数据与时间计算都是 `src/garage/`、`src/scene/` 下不依赖 three 的纯函数；3D 元素全部放在 `src/scene/three/`，随 Stage 块按需加载。`Pose` 新增 `room`（车库房间显隐），`Studio` 按 `room` 混合时间氛围。贴图由新的 `npm run textures` 从 `assets-src/textures/` 生成 WebP。

**Tech Stack:** React 19、TypeScript 6、Vitest 5（jsdom）、Tailwind 4、three 0.186.1、@react-three/fiber 9.8.1、@react-three/drei 10.7.9、sharp。

**Spec:** `docs/superpowers/specs/2026-10-10-midnight-garage-garage-upgrade-design.md`

## Global Constraints

- Windows + PowerShell，仓库根目录 `E:\CODE\Krazymud.github.io`；终端找不到 node 时先执行 `$env:Path = "C:\Program Files\nodejs;$env:Path"`。
- 依赖版本精确固定（`npm i -E`）；本计划不新增依赖。
- 界面文案中文；`MIDNIGHT GARAGE` 等品牌字样英文。
- 主色：牛血红 `#9E1C22`、亮红 `#C1272D`、暗金 `#A8894F`。
- 主包 `dist/assets/index-*.js` gzip ≤ 200 KB；`src/scene/three/` 以外的 `src/` 文件**不得**在运行时导入 `three`、`@react-three/*`、`postprocessing`。
- 静帧 WebP 每张 ≤ 120 KB，构图不变。
- 贴图：`public/textures/*.webp`，单张 ≤ 150 KB，合计 ≤ 500 KB；`public/textures/**` 在 `.gitattributes` 标 `-text`。
- `assets-src/` 在 `.gitignore` 里，永不提交。
- 过渡阻尼统一用 `TRANSITION_LAMBDA = 4`（约 1.2 秒）。
- TypeScript 开 `verbatimModuleSyntax`、`erasableSyntaxOnly`：类型导入写 `import type`，不用 `enum`、参数属性。`src/` 内导入不带后缀，`scripts/` 内导入带 `.ts` 后缀。
- 用到 sharp 或 Node 文件系统的测试文件第一行写 `// @vitest-environment node`。
- 每个任务结束前跑：`npx vitest run`、`npx tsc -b`、`npx tsc -p tsconfig.node.json --noEmit`；动到构建或 `scripts/` 的任务再跑 `npm run build`。

## File Structure

| 文件 | 职责 |
|---|---|
| `src/garage/stats.ts` | `garageStats`：从进度算连续天数、本周打卡、掌握数、到期数 |
| `src/garage/Dashboard.tsx` | 仪表盘条显示（两个圆表 + 七盏灯） |
| `src/pages/HomePage.tsx` | 接入仪表盘条，到期数并入试炼卡 |
| `src/scene/ambience.ts` | `ambienceAt`：四个关键时刻插值 |
| `src/scene/useAmbience.ts` | 每分钟刷新的氛围 hook，开发环境 `?hour=` 覆盖 |
| `src/scene/poses.ts` | `Pose.room` |
| `src/scene/SceneHost.tsx` | 静帧叠色层 |
| `src/scene/types.ts` | `StageProps` 不变（氛围在 Stage 内部取） |
| `scripts/lib/textures.ts`、`scripts/textures.config.ts`、`scripts/textures.ts` | 贴图生成 |
| `src/scene/three/textures.ts` | 贴图 URL 与加载 hook |
| `src/scene/three/Studio.tsx` | 主灯/环境光跟随氛围 |
| `src/scene/three/Floor.tsx` | 水泥地面材质 |
| `src/scene/three/Turntable.tsx` | 旋转展台 |
| `src/scene/three/Car.tsx` | 车抬高到展台上，展台随车转 |
| `src/scene/three/useRoomLevel.ts` | 房间显隐等级（room × 点火 × 氛围） |
| `src/scene/three/Room.tsx` | 后墙、LED 灯带、道具剪影 |
| `src/scene/three/NeonSign.tsx` | 霓虹灯牌 |
| `src/scene/three/Atmosphere.tsx` | 光柱与尘埃 |
| `src/scene/three/Stage.tsx` | 组装、传画质 |
| `src/pages/SettingsPage.tsx` | 鸣谢 |

---

### Task 1: 车库数据 `garageStats`

**Files:**
- Create: `src/garage/stats.ts`
- Test: `src/garage/stats.test.ts`

**Interfaces:**
- Consumes: `ProgressData`（`src/progress/store.ts`）、`addDays`（`src/trial/day.ts`）、`dueOn`、`masteredCount`（`src/trial/engine.ts`）。
- Produces:
  ```ts
  export interface GarageStats { streak: number; week: boolean[]; todayDone: boolean; mastered: number; due: number }
  export function garageStats(data: ProgressData, today: string): GarageStats
  ```

- [ ] **Step 1: Write the failing test**

`src/garage/stats.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { emptyProgress, type DayStat, type ProgressData } from '../progress/store'
import { garageStats } from './stats'

function stat(day: string): DayStat {
  return { day, total: 20, correct: 18, newCount: 10, reviewCount: 10, bestCombo: 6, durationMs: 60_000 }
}

function withDays(...days: string[]): ProgressData {
  return { ...emptyProgress(), history: days.map(stat) }
}

describe('garageStats', () => {
  it('is all zeros for a fresh garage', () => {
    expect(garageStats(emptyProgress(), '2026-10-10')).toEqual({
      streak: 0,
      week: [false, false, false, false, false, false, false],
      todayDone: false,
      mastered: 0,
      due: 0,
    })
  })

  it('counts today when the lap is done', () => {
    const stats = garageStats(withDays('2026-10-08', '2026-10-09', '2026-10-10'), '2026-10-10')
    expect(stats.streak).toBe(3)
    expect(stats.todayDone).toBe(true)
  })

  it('keeps the streak alive while today is still open', () => {
    const stats = garageStats(withDays('2026-10-08', '2026-10-09'), '2026-10-10')
    expect(stats.streak).toBe(2)
    expect(stats.todayDone).toBe(false)
  })

  it('drops to zero after a missed day', () => {
    expect(garageStats(withDays('2026-10-07', '2026-10-08'), '2026-10-10').streak).toBe(0)
  })

  it('stops at the first gap', () => {
    expect(garageStats(withDays('2026-10-05', '2026-10-07', '2026-10-08', '2026-10-09'), '2026-10-09').streak).toBe(3)
  })

  it('runs across a month boundary', () => {
    expect(garageStats(withDays('2026-09-29', '2026-09-30', '2026-10-01'), '2026-10-01').streak).toBe(3)
  })

  it('lights the last seven days oldest first', () => {
    const stats = garageStats(withDays('2026-10-04', '2026-10-06', '2026-10-10', '2026-10-01'), '2026-10-10')
    expect(stats.week).toEqual([true, false, true, false, false, false, true])
  })

  it('counts mastered and due words', () => {
    const data: ProgressData = {
      ...emptyProgress(),
      words: {
        a: { interval: 30, due: '2026-11-09', lastResult: 'good', seenCount: 6 },
        b: { interval: 3, due: '2026-10-10', lastResult: 'ok', seenCount: 2 },
        c: { interval: 1, due: '2026-10-09', lastResult: 'again', seenCount: 3 },
      },
    }
    expect(garageStats(data, '2026-10-10')).toMatchObject({ mastered: 1, due: 2 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/garage/stats.test.ts`
Expected: FAIL，`Failed to resolve import "./stats"`。

- [ ] **Step 3: Write minimal implementation**

`src/garage/stats.ts`：

```ts
import type { ProgressData } from '../progress/store'
import { addDays } from '../trial/day'
import { dueOn, masteredCount } from '../trial/engine'

export interface GarageStats {
  streak: number
  week: boolean[]
  todayDone: boolean
  mastered: number
  due: number
}

export function garageStats(data: ProgressData, today: string): GarageStats {
  const done = new Set(data.history.map((stat) => stat.day))
  const todayDone = done.has(today)
  let streak = 0
  for (let day = todayDone ? today : addDays(today, -1); done.has(day); day = addDays(day, -1)) streak++
  const week = Array.from({ length: 7 }, (_, i) => done.has(addDays(today, i - 6)))
  return { streak, week, todayDone, mastered: masteredCount(data.words), due: dueOn(data.words, today) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/garage/stats.test.ts`
Expected: PASS（8 tests）。

- [ ] **Step 5: Full checks and commit**

```bash
npx vitest run
npx tsc -b
npx tsc -p tsconfig.node.json --noEmit
git add src/garage/stats.ts src/garage/stats.test.ts
git commit -m "feat(garage): streak, week, mastered and due stats"
```

---

### Task 2: 仪表盘条与车库首页

**Files:**
- Create: `src/garage/Dashboard.tsx`
- Test: `src/garage/Dashboard.test.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomePage.test.tsx`
- Modify: `src/index.css`（呼吸动画）

**Interfaces:**
- Consumes: `GarageStats`、`garageStats`（Task 1）。
- Produces: `export function Dashboard({ stats }: { stats: GarageStats })`。

- [ ] **Step 1: Write the failing tests**

`src/garage/Dashboard.test.tsx`：

```tsx
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Dashboard } from './Dashboard'
import type { GarageStats } from './stats'

const base: GarageStats = { streak: 9, week: [true, true, false, true, true, true, false], todayDone: false, mastered: 128, due: 4 }

describe('Dashboard', () => {
  it('reads out the streak, the week and the mastered words', () => {
    render(<Dashboard stats={base} />)
    const panel = within(screen.getByRole('group', { name: '车库仪表' }))
    expect(panel.getByRole('meter', { name: '连续打卡 9 天' })).toHaveAttribute('aria-valuenow', '9')
    expect(panel.getByRole('meter', { name: '已掌握 128 个词' })).toHaveAttribute('aria-valuenow', '128')
    expect(panel.getByRole('img', { name: '最近 7 天打卡 5 天' })).toBeInTheDocument()
  })

  it('fills the streak ring a week at a time', () => {
    const { rerender } = render(<Dashboard stats={{ ...base, streak: 9 }} />)
    expect(screen.getByTestId('ring-streak')).toHaveAttribute('data-fill', String(2 / 7))
    rerender(<Dashboard stats={{ ...base, streak: 14 }} />)
    expect(screen.getByTestId('ring-streak')).toHaveAttribute('data-fill', '1')
    rerender(<Dashboard stats={{ ...base, streak: 0 }} />)
    expect(screen.getByTestId('ring-streak')).toHaveAttribute('data-fill', '0')
  })

  it('fills the mastered ring towards the next hundred', () => {
    render(<Dashboard stats={base} />)
    expect(screen.getByTestId('ring-mastered')).toHaveAttribute('data-fill', '0.28')
  })

  it('breathes on today until the lap is done', () => {
    const { rerender } = render(<Dashboard stats={base} />)
    expect(screen.getByTestId('day-6')).toHaveClass('animate-breathe')
    rerender(<Dashboard stats={{ ...base, todayDone: true, week: [...base.week.slice(0, 6), true] }} />)
    expect(screen.getByTestId('day-6')).not.toHaveClass('animate-breathe')
  })
})
```

`src/pages/HomePage.test.tsx`：在 `describe('HomePage', ...)` 末尾加两个用例：

```tsx
  it('shows the garage dashboard', () => {
    renderHome()
    expect(screen.getByRole('group', { name: '车库仪表' })).toBeInTheDocument()
  })

  it('folds due reviews into the trial card', () => {
    const today = studyDay(new Date())
    localStorage.setItem(
      STORAGE_KEY,
      serializeProgress({ ...emptyProgress(), words: { alpha: { interval: 1, due: today, lastResult: 'ok', seenCount: 1 } } }),
    )
    renderHome()
    expect(screen.getByRole('link', { name: /今日试炼 · 到期 1/ })).toBeInTheDocument()
    expect(screen.queryByText(/到期复习/)).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/garage/Dashboard.test.tsx src/pages/HomePage.test.tsx`
Expected: FAIL，`./Dashboard` 不存在；HomePage 两个新用例找不到「车库仪表」与「今日试炼 · 到期 1」。

- [ ] **Step 3: Implement**

`src/index.css` 末尾追加（Tailwind 4 自定义动画工具类）：

```css
@keyframes breathe {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

@utility animate-breathe {
  animation: breathe 2.4s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
```

`src/garage/Dashboard.tsx`：

```tsx
import type { GarageStats } from './stats'

const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function Ring({ id, fill, value, caption, label }: { id: string; fill: number; value: number; caption: string; label: string }) {
  return (
    <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="3" />
          <circle
            data-testid={`ring-${id}`}
            data-fill={String(fill)}
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            stroke="var(--color-accent-hi)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fill)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold tabular-nums">{value}</span>
      </div>
      <span className="text-[10px] tracking-[0.3em] text-muted">{caption}</span>
    </div>
  )
}

export function Dashboard({ stats }: { stats: GarageStats }) {
  const streakFill = stats.streak === 0 ? 0 : stats.streak % 7 === 0 ? 1 : (stats.streak % 7) / 7
  const masteredFill = (stats.mastered % 100) / 100
  const lit = stats.week.filter(Boolean).length
  return (
    <div role="group" aria-label="车库仪表" className="flex items-center justify-between border border-line bg-panel/60 px-4 py-3">
      <Ring id="streak" fill={streakFill} value={stats.streak} caption="连续" label={`连续打卡 ${stats.streak} 天`} />
      <div className="flex flex-col items-center gap-2">
        <div role="img" aria-label={`最近 7 天打卡 ${lit} 天`} className="flex gap-2">
          {stats.week.map((done, i) => (
            <span
              key={i}
              data-testid={`day-${i}`}
              className={
                done
                  ? 'h-2.5 w-2.5 rounded-full bg-accent-hi shadow-[0_0_6px_var(--color-accent-hi)]'
                  : i === 6
                    ? 'h-2.5 w-2.5 rounded-full border border-accent-hi animate-breathe'
                    : 'h-2.5 w-2.5 rounded-full border border-line'
              }
            />
          ))}
        </div>
        <span className="text-[10px] tracking-[0.3em] text-muted">本周</span>
      </div>
      <Ring id="mastered" fill={masteredFill} value={stats.mastered} caption="掌握" label={`已掌握 ${stats.mastered} 个词`} />
    </div>
  )
}
```

`src/pages/HomePage.tsx`：

1. 导入改为（删掉 `dueOn` 的导入，加两行）：
```tsx
import { Dashboard } from '../garage/Dashboard'
import { garageStats } from '../garage/stats'
import { isFinished } from '../trial/engine'
```
2. 在 `const together = ...` 下一行加：
```tsx
  const stats = garageStats(data, today)
```
3. 把 `<div className="space-y-3">` 整块替换为：
```tsx
      <div className="space-y-3">
        <Dashboard stats={stats} />
        <Link
          to="/trial"
          onClick={() => {
            if (!finished) void play('blip')
          }}
          className="flex items-center justify-between border border-accent-hi bg-accent/20 px-5 py-4"
        >
          <span>
            <span className="block text-xs text-muted">{stats.due > 0 ? `今日试炼 · 到期 ${stats.due}` : '今日试炼'}</span>
            <span className="font-display text-2xl font-bold">
              {done} / {total}
            </span>
          </span>
          <span className="text-sm">{finished ? '已完成 · 看结算' : '出发'}</span>
        </Link>
        <Link to="/vault" className="block border border-line px-5 py-3 text-sm text-muted hover:text-fg">
          保险库
        </Link>
      </div>
```

确认 `--color-line`、`--color-accent-hi`、`bg-panel` 在 `src/index.css` 中存在（`Notice` 已用 `bg-panel/80`；保险库主题会切换 accent 变量，SVG 里要用会随主题切换的那个变量名）；若变量名不同，按实际名称替换并在报告中说明。若测试环境的 `getByRole('meter')` 不识别 `meter` 角色，改用 `role="img"` 加同样的 `aria-label`，测试相应改为 `getByRole('img', { name: ... })` 并去掉 `aria-valuenow` 断言，在报告中说明。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/garage src/pages/HomePage.test.tsx`
Expected: PASS。

- [ ] **Step 5: Full checks and commit**

```bash
npx vitest run
npx tsc -b
npx tsc -p tsconfig.node.json --noEmit
git add src/garage/Dashboard.tsx src/garage/Dashboard.test.tsx src/pages/HomePage.tsx src/pages/HomePage.test.tsx src/index.css
git commit -m "feat(garage): dashboard with streak, week lights and mastered words"
```

---

### Task 3: 时间氛围 `ambienceAt` 与 `useAmbience`

**Files:**
- Create: `src/scene/ambience.ts`
- Create: `src/scene/useAmbience.ts`
- Test: `src/scene/ambience.test.ts`
- Test: `src/scene/useAmbience.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface Ambience { key: string; keyScale: number; env: number; strips: number; tint: string; tintAlpha: number }
  export const NIGHT: Ambience
  export function ambienceAt(date: Date): Ambience
  export const AMBIENCE_REFRESH_MS = 60_000
  export function useAmbience(): Ambience   // src/scene/useAmbience.ts
  ```
  `key`、`tint` 为小写 `#rrggbb`。

- [ ] **Step 1: Write the failing tests**

`src/scene/ambience.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { ambienceAt, NIGHT } from './ambience'

const at = (hour: number, minute = 0) => ambienceAt(new Date(2026, 9, 10, hour, minute))

describe('ambienceAt', () => {
  it('is the current look at 2 am', () => {
    expect(at(2)).toEqual(NIGHT)
    expect(NIGHT).toEqual({ key: '#9e1c22', keyScale: 1, env: 1, strips: 1, tint: '#000000', tintAlpha: 0 })
  })

  it('hits each key moment exactly', () => {
    expect(at(7)).toMatchObject({ key: '#b4442a', keyScale: 1.1, env: 1.15, strips: 0.7, tintAlpha: 0.1 })
    expect(at(13)).toMatchObject({ key: '#b85a4e', keyScale: 1.3, env: 1.4, strips: 0.45, tintAlpha: 0.12 })
    expect(at(19)).toMatchObject({ key: '#a8361f', keyScale: 1.1, env: 1.1, strips: 0.85, tintAlpha: 0.1 })
  })

  it('blends halfway between key moments', () => {
    const mid = at(10)
    expect(mid.keyScale).toBeCloseTo(1.2)
    expect(mid.env).toBeCloseTo(1.275)
    expect(mid.strips).toBeCloseTo(0.575)
  })

  it('wraps from dusk through midnight to deep night', () => {
    expect(at(22, 30).strips).toBeCloseTo(0.85 + (1 - 0.85) * 0.5)
    expect(at(0, 45).strips).toBeCloseTo(0.85 + (1 - 0.85) * (5.75 / 7))
  })

  it('blends colours smoothly', () => {
    const colours = [at(2, 30), at(4), at(5, 30)].map((a) => a.key)
    expect(new Set(colours).size).toBe(3)
    for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('stays finite all day', () => {
    for (let minute = 0; minute < 24 * 60; minute += 17) {
      const a = at(0, minute)
      expect([a.keyScale, a.env, a.strips, a.tintAlpha].every(Number.isFinite)).toBe(true)
    }
  })
})
```

`src/scene/useAmbience.test.tsx`：

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AMBIENCE_REFRESH_MS, ambienceAt } from './ambience'
import { useAmbience } from './useAmbience'

describe('useAmbience', () => {
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('follows the clock minute by minute', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 10, 12, 59, 30))
    const { result } = renderHook(() => useAmbience())
    expect(result.current).toEqual(ambienceAt(new Date(2026, 9, 10, 12, 59, 30)))
    act(() => {
      vi.setSystemTime(new Date(2026, 9, 10, 13, 0, 30))
      vi.advanceTimersByTime(AMBIENCE_REFRESH_MS)
    })
    expect(result.current).toEqual(ambienceAt(new Date(2026, 9, 10, 13, 0, 30)))
  })

  it('lets the dev build pin the hour with ?hour=', () => {
    window.history.replaceState(null, '', '/?hour=13')
    const { result } = renderHook(() => useAmbience())
    const pinned = new Date()
    pinned.setHours(13, 0, 0, 0)
    expect(result.current).toEqual(ambienceAt(pinned))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/scene/ambience.test.ts src/scene/useAmbience.test.tsx`
Expected: FAIL，模块不存在。

- [ ] **Step 3: Implement**

`src/scene/ambience.ts`：

```ts
export interface Ambience {
  key: string
  keyScale: number
  env: number
  strips: number
  tint: string
  tintAlpha: number
}

export const AMBIENCE_REFRESH_MS = 60_000

export const NIGHT: Ambience = { key: '#9e1c22', keyScale: 1, env: 1, strips: 1, tint: '#000000', tintAlpha: 0 }

const KEYS: readonly { hour: number; value: Ambience }[] = [
  { hour: 2, value: NIGHT },
  { hour: 7, value: { key: '#b4442a', keyScale: 1.1, env: 1.15, strips: 0.7, tint: '#ff9a55', tintAlpha: 0.1 } },
  { hour: 13, value: { key: '#b85a4e', keyScale: 1.3, env: 1.4, strips: 0.45, tint: '#fff2e0', tintAlpha: 0.12 } },
  { hour: 19, value: { key: '#a8361f', keyScale: 1.1, env: 1.1, strips: 0.85, tint: '#ffb347', tintAlpha: 0.1 } },
]

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
}

function mixHex(a: string, b: string, t: number): string {
  const ca = channels(a)
  const cb = channels(b)
  return `#${ca
    .map((v, i) => Math.round(toSrgb(v + (cb[i] - v) * t) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t

export function ambienceAt(date: Date): Ambience {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const index = KEYS.findIndex((k, i) => {
    const next = KEYS[(i + 1) % KEYS.length].hour + (i === KEYS.length - 1 ? 24 : 0)
    const h = hour < KEYS[0].hour ? hour + 24 : hour
    return h >= k.hour && h < next
  })
  const from = KEYS[index]
  const to = KEYS[(index + 1) % KEYS.length]
  const span = (to.hour - from.hour + 24) % 24
  const h = hour < KEYS[0].hour ? hour + 24 : hour
  const t = (h - from.hour) / span
  if (t === 0) return from.value
  const a = from.value
  const b = to.value
  return {
    key: mixHex(a.key, b.key, t),
    keyScale: mix(a.keyScale, b.keyScale, t),
    env: mix(a.env, b.env, t),
    strips: mix(a.strips, b.strips, t),
    tint: mixHex(a.tint, b.tint, t),
    tintAlpha: mix(a.tintAlpha, b.tintAlpha, t),
  }
}
```

`src/scene/useAmbience.ts`：

```ts
import { useEffect, useState } from 'react'
import { AMBIENCE_REFRESH_MS, ambienceAt, type Ambience } from './ambience'

function now(): Date {
  const date = new Date()
  if (import.meta.env.DEV) {
    const hour = Number(new URLSearchParams(window.location.search).get('hour'))
    if (new URLSearchParams(window.location.search).has('hour') && hour >= 0 && hour < 24) date.setHours(hour, 0, 0, 0)
  }
  return date
}

export function useAmbience(): Ambience {
  const [ambience, setAmbience] = useState(() => ambienceAt(now()))
  useEffect(() => {
    const id = window.setInterval(() => setAmbience(ambienceAt(now())), AMBIENCE_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])
  return ambience
}
```

注意：`setAmbience` 每分钟都会传入新对象。为避免无意义重渲染，若新旧值各字段相等则返回旧值：把 `setAmbience(ambienceAt(now()))` 写成

```ts
      setAmbience((prev) => {
        const next = ambienceAt(now())
        return (Object.keys(next) as (keyof Ambience)[]).every((k) => next[k] === prev[k]) ? prev : next
      })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/scene/ambience.test.ts src/scene/useAmbience.test.tsx`
Expected: PASS。

- [ ] **Step 5: Full checks and commit**

```bash
npx vitest run
npx tsc -b
npx tsc -p tsconfig.node.json --noEmit
git add src/scene/ambience.ts src/scene/useAmbience.ts src/scene/ambience.test.ts src/scene/useAmbience.test.tsx
git commit -m "feat(scene): local-time ambience with four key moments"
```

---

### Task 4: `Pose.room` 与静帧叠色

**Files:**
- Modify: `src/scene/poses.ts`
- Modify: `src/scene/poses.test.ts`
- Modify: `src/scene/SceneHost.tsx`
- Modify: `src/scene/SceneHost.test.tsx`

**Interfaces:**
- Consumes: `useAmbience`（Task 3）。
- Produces: `Pose.room: number`（`garage`、`settings` 为 1，`track`、`vault` 为 0）。SceneHost 渲染 `data-testid="scene-tint"` 叠色层。

- [ ] **Step 1: Write the failing tests**

`src/scene/poses.test.ts` 加：

```ts
  it('keeps the garage room for the garage camera only', () => {
    expect(POSES.garage.room).toBe(1)
    expect(POSES.settings.room).toBe(1)
    expect(POSES.track.room).toBe(0)
    expect(POSES.vault.room).toBe(0)
  })
```

`src/scene/SceneHost.test.tsx` 加（沿用文件里现有的渲染辅助函数和 `webgl2` 注入方式；以下假设现有辅助叫 `renderHost(scene, options)`，若名称不同按实际改）：

```tsx
  it('tints the still with the time of day in the garage only', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 10, 13, 0))
    const { rerender } = render(<SceneHost scene="garage" webgl2={() => false} />)
    const tint = screen.getByTestId('scene-tint')
    expect(tint).toHaveStyle({ backgroundColor: '#fff2e0', opacity: '0.12' })
    rerender(<SceneHost scene="vault" webgl2={() => false} />)
    expect(screen.getByTestId('scene-tint')).toHaveStyle({ opacity: '0' })
    vi.useRealTimers()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/scene/poses.test.ts src/scene/SceneHost.test.tsx`
Expected: FAIL，`room` 为 undefined、找不到 `scene-tint`。

- [ ] **Step 3: Implement**

`src/scene/poses.ts`：`Pose` 接口在 `rim: number` 后加 `room: number`；`garage` 与 `settings` 姿态加 `room: 1,`，`track` 与 `vault` 加 `room: 0,`（都放在 `rim` 下一行）。

`src/scene/SceneHost.tsx`：
1. 导入 `import { useAmbience } from './useAmbience'`。
2. 组件体内 `const pose = POSES[scene]` 下加 `const ambience = useAmbience()`。
3. 在 `{showStage && (...)}` 块之后、`scene-dim` 之前插入（只在静帧可见时有意义；3D 时被 Stage 盖住也无害，但为了不给 3D 画面叠色，3D 就绪后隐藏）：

```tsx
      <div
        data-testid="scene-tint"
        className="absolute inset-0 mix-blend-soft-light transition-opacity duration-[1200ms] ease-out"
        style={{ backgroundColor: ambience.tint, opacity: showStage && stillGone ? 0 : ambience.tintAlpha * pose.room }}
      />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/scene`
Expected: PASS。

- [ ] **Step 5: Full checks and commit**

```bash
npx vitest run
npx tsc -b
npx tsc -p tsconfig.node.json --noEmit
git add src/scene/poses.ts src/scene/poses.test.ts src/scene/SceneHost.tsx src/scene/SceneHost.test.tsx
git commit -m "feat(scene): garage room flag and time-of-day tint on stills"
```

---

### Task 5: 贴图生成 `npm run textures`

**Files:**
- Create: `scripts/lib/textures.ts`
- Create: `scripts/lib/textures.test.ts`
- Create: `scripts/textures.config.ts`
- Create: `scripts/textures.ts`
- Modify: `package.json`（`scripts.textures`）
- Modify: `.gitattributes`
- Create (generated, committed): `public/textures/garage_floor_{diff,rough,nor}.webp`、`public/textures/wall_metal_{diff,rough,nor}.webp`

源文件已在 `assets-src/textures/`（gitignored，Poly Haven CC0，1k JPG）：
`garage_floor_diff_1k.jpg`、`garage_floor_rough_1k.jpg`、`garage_floor_nor_gl_1k.jpg`（作者 Jenelle van Heerden，https://polyhaven.com/a/garage_floor）；
`box_profile_metal_sheet_diff_1k.jpg`、`box_profile_metal_sheet_rough_1k.jpg`、`box_profile_metal_sheet_nor_gl_1k.jpg`（作者 Amal Kumar，https://polyhaven.com/a/box_profile_metal_sheet）。

**Interfaces:**
- Produces:
  ```ts
  export interface TextureJob { name: string; source: string; size: number; quality: number }
  export const MAX_TEXTURE_BYTES = 150 * 1024
  export const MAX_TEXTURES_TOTAL = 500 * 1024
  export class TextureError extends Error {}
  export async function runTextures(opts: { sourceDir: string; outDir: string; jobs: readonly TextureJob[]; log: (line: string) => void }): Promise<{ name: string; bytes: number }[]>
  ```
  输出文件名 `${name}.webp`。

- [ ] **Step 1: Write the failing test**

`scripts/lib/textures.test.ts`：

```ts
// @vitest-environment node
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { MAX_TEXTURE_BYTES, runTextures, TextureError, type TextureJob } from './textures.ts'

async function sandbox() {
  const root = await mkdtemp(path.join(tmpdir(), 'textures-'))
  const sourceDir = path.join(root, 'src')
  const outDir = path.join(root, 'out')
  await Promise.all([mkdir(sourceDir), mkdir(outDir)])
  return { sourceDir, outDir }
}

async function noise(file: string, size: number) {
  const raw = Buffer.alloc(size * size * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24
  await sharp(raw, { raw: { width: size, height: size, channels: 3 } }).jpeg().toFile(file)
}

const job = (name: string, source: string): TextureJob => ({ name, source, size: 64, quality: 80 })

describe('runTextures', () => {
  it('writes square webp files at the asked size', async () => {
    const { sourceDir, outDir } = await sandbox()
    await noise(path.join(sourceDir, 'a.jpg'), 128)
    const results = await runTextures({ sourceDir, outDir, jobs: [job('floor_diff', 'a.jpg')], log: () => {} })
    expect(results.map((r) => r.name)).toEqual(['floor_diff'])
    const meta = await sharp(path.join(outDir, 'floor_diff.webp')).metadata()
    expect(meta).toMatchObject({ format: 'webp', width: 64, height: 64 })
  })

  it('names the missing source file', async () => {
    const { sourceDir, outDir } = await sandbox()
    await expect(runTextures({ sourceDir, outDir, jobs: [job('x', 'nope.jpg')], log: () => {} })).rejects.toThrow(TextureError)
    await expect(runTextures({ sourceDir, outDir, jobs: [job('x', 'nope.jpg')], log: () => {} })).rejects.toThrow(/nope\.jpg/)
  })

  it('rejects a texture over the size limit and writes nothing', async () => {
    const { sourceDir, outDir } = await sandbox()
    await noise(path.join(sourceDir, 'a.jpg'), 64)
    await noise(path.join(sourceDir, 'big.jpg'), 1024)
    const jobs = [job('ok', 'a.jpg'), { name: 'big', source: 'big.jpg', size: 1024, quality: 100 }]
    await expect(runTextures({ sourceDir, outDir, jobs, log: () => {} })).rejects.toThrow(new RegExp(`${MAX_TEXTURE_BYTES / 1024} KB`))
    expect(await readdir(outDir)).toEqual([])
  })

  it('rejects duplicate names', async () => {
    const { sourceDir, outDir } = await sandbox()
    await noise(path.join(sourceDir, 'a.jpg'), 64)
    await expect(runTextures({ sourceDir, outDir, jobs: [job('a', 'a.jpg'), job('a', 'a.jpg')], log: () => {} })).rejects.toThrow(TextureError)
  })

  it('removes textures that are no longer configured', async () => {
    const { sourceDir, outDir } = await sandbox()
    await noise(path.join(sourceDir, 'a.jpg'), 64)
    await writeFile(path.join(outDir, 'old.webp'), 'x')
    await runTextures({ sourceDir, outDir, jobs: [job('a', 'a.jpg')], log: () => {} })
    expect(await readdir(outDir)).toEqual(['a.webp'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/textures.test.ts`
Expected: FAIL，`./textures.ts` 不存在。

- [ ] **Step 3: Implement**

`scripts/lib/textures.ts`：

```ts
import { access, readdir, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export interface TextureJob {
  name: string
  source: string
  size: number
  quality: number
}

export const MAX_TEXTURE_BYTES = 150 * 1024
export const MAX_TEXTURES_TOTAL = 500 * 1024

export class TextureError extends Error {
  name = 'TextureError'
}

export interface RunTexturesOptions {
  sourceDir: string
  outDir: string
  jobs: readonly TextureJob[]
  log: (line: string) => void
}

export async function runTextures({ sourceDir, outDir, jobs, log }: RunTexturesOptions): Promise<{ name: string; bytes: number }[]> {
  const names = new Set<string>()
  for (const job of jobs) {
    if (names.has(job.name)) throw new TextureError(`贴图名重复：${job.name}`)
    names.add(job.name)
    const input = path.join(sourceDir, job.source)
    try {
      await access(input)
    } catch {
      throw new TextureError(`找不到 ${input}：请把贴图源文件放到 ${sourceDir} 下，文件名见 scripts/textures.config.ts`)
    }
  }
  const work = jobs.map((job) => {
    const out = path.join(outDir, `${job.name}.webp`)
    return { job, out, tmp: `${out}.tmp`, bytes: 0 }
  })
  try {
    for (const item of work) {
      await sharp(path.join(sourceDir, item.job.source))
        .resize(item.job.size, item.job.size)
        .webp({ quality: item.job.quality })
        .toFile(item.tmp)
      item.bytes = (await stat(item.tmp)).size
      if (item.bytes > MAX_TEXTURE_BYTES) {
        throw new TextureError(`${item.job.name}：${(item.bytes / 1024).toFixed(0)} KB，超过 ${MAX_TEXTURE_BYTES / 1024} KB`)
      }
      log(`已处理 ${item.job.name}（${(item.bytes / 1024).toFixed(1)} KB）`)
    }
    const total = work.reduce((sum, item) => sum + item.bytes, 0)
    if (total > MAX_TEXTURES_TOTAL) throw new TextureError(`贴图合计 ${(total / 1024).toFixed(0)} KB，超过 ${MAX_TEXTURES_TOTAL / 1024} KB`)
    for (const item of work) await rename(item.tmp, item.out)
  } catch (error) {
    await Promise.all(work.map((item) => unlink(item.tmp).catch(() => undefined)))
    throw error
  }
  const configured = new Set(work.map((item) => path.basename(item.out)))
  for (const name of await readdir(outDir)) {
    if (!name.endsWith('.webp') || configured.has(name)) continue
    await unlink(path.join(outDir, name))
    log(`已删除不再使用的 ${name}`)
  }
  return work.map((item) => ({ name: item.job.name, bytes: item.bytes }))
}
```

`scripts/textures.config.ts`：

```ts
import type { TextureJob } from './lib/textures.ts'

export const texturesConfig: TextureJob[] = [
  { name: 'garage_floor_diff', source: 'garage_floor_diff_1k.jpg', size: 1024, quality: 80 },
  { name: 'garage_floor_rough', source: 'garage_floor_rough_1k.jpg', size: 1024, quality: 80 },
  { name: 'garage_floor_nor', source: 'garage_floor_nor_gl_1k.jpg', size: 1024, quality: 80 },
  { name: 'wall_metal_diff', source: 'box_profile_metal_sheet_diff_1k.jpg', size: 1024, quality: 80 },
  { name: 'wall_metal_rough', source: 'box_profile_metal_sheet_rough_1k.jpg', size: 1024, quality: 80 },
  { name: 'wall_metal_nor', source: 'box_profile_metal_sheet_nor_gl_1k.jpg', size: 1024, quality: 80 },
]
```

`scripts/textures.ts`：

```ts
import { mkdir } from 'node:fs/promises'
import { runTextures, TextureError } from './lib/textures.ts'
import { texturesConfig } from './textures.config.ts'

const SOURCE_DIR = 'assets-src/textures'
const OUT_DIR = 'public/textures'

try {
  await mkdir(OUT_DIR, { recursive: true })
  const results = await runTextures({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, jobs: texturesConfig, log: (line) => console.log(line) })
  const total = results.reduce((sum, result) => sum + result.bytes, 0)
  console.log(`已写入 ${OUT_DIR}（${results.length} 张，共 ${(total / 1024).toFixed(1)} KB）`)
} catch (error) {
  if (!(error instanceof TextureError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
```

`package.json` 的 `scripts` 在 `"audio"` 后加 `"textures": "tsx scripts/textures.ts"`。
`.gitattributes` 末尾加一行 `public/textures/** -text`。

- [ ] **Step 4: Run tests, generate, verify**

```bash
npx vitest run scripts/lib/textures.test.ts
npm run textures
```
Expected: 测试 PASS；`npm run textures` 输出 6 张，合计约 270 KB（每张 ≤ 150 KB）。

- [ ] **Step 5: Full checks and commit**

```bash
npx vitest run
npx tsc -b
npx tsc -p tsconfig.node.json --noEmit
git add scripts/lib/textures.ts scripts/lib/textures.test.ts scripts/textures.config.ts scripts/textures.ts package.json .gitattributes public/textures
git commit -m "feat(textures): npm run textures turns CC0 maps into webp"
```

---

### Task 6: 氛围接入 3D，水泥地面与旋转展台

**Files:**
- Create: `src/scene/three/textures.ts`
- Create: `src/scene/three/Turntable.tsx`
- Modify: `src/scene/three/Studio.tsx`
- Modify: `src/scene/three/Floor.tsx`
- Modify: `src/scene/three/Car.tsx`
- Modify: `src/scene/three/Stage.tsx`

**Interfaces:**
- Consumes: `Ambience`、`NIGHT`（Task 3）、`useAmbience`（Task 3）、`Pose.room`（Task 4）、`public/textures/*.webp`（Task 5）。
- Produces:
  ```ts
  // src/scene/three/textures.ts
  export const TEXTURE_URLS: { floor: [string, string, string]; wall: [string, string, string] }  // [diff, rough, nor]
  export function useTiledTextures(urls: [string, string, string], repeat: [number, number]): { map: Texture; roughnessMap: Texture; normalMap: Texture }
  // Studio / Floor / Car / Turntable props
  StudioProps { pose: Pose; ambience: Ambience; deterministic: boolean }
  export const TURNTABLE_HEIGHT = 0.04   // src/scene/three/Turntable.tsx
  ```

3D 组件无单元测试；本任务靠类型检查、全量测试不回归和 Task 9 的浏览器检查。

- [ ] **Step 1: 贴图加载 hook**

`src/scene/three/textures.ts`：

```ts
import { useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import { RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

const url = (name: string) => `${import.meta.env.BASE_URL}textures/${name}.webp`

export const TEXTURE_URLS = {
  floor: [url('garage_floor_diff'), url('garage_floor_rough'), url('garage_floor_nor')],
  wall: [url('wall_metal_diff'), url('wall_metal_rough'), url('wall_metal_nor')],
} satisfies Record<string, [string, string, string]>

export function useTiledTextures(urls: [string, string, string], repeat: [number, number]) {
  const [base, rough, normal] = useTexture(urls) as Texture[]
  return useMemo(() => {
    const [map, roughnessMap, normalMap] = [base, rough, normal].map((texture) => {
      const tiled = texture.clone()
      tiled.wrapS = tiled.wrapT = RepeatWrapping
      tiled.repeat.set(repeat[0], repeat[1])
      tiled.anisotropy = 4
      tiled.needsUpdate = true
      return tiled
    })
    map.colorSpace = SRGBColorSpace
    return { map, roughnessMap, normalMap }
  }, [base, rough, normal, repeat[0], repeat[1]])
}
```

- [ ] **Step 2: Studio 跟随氛围**

`src/scene/three/Studio.tsx`：
1. 导入加 `import type { Ambience } from '../ambience'`。
2. `StudioProps` 加 `ambience: Ambience`；函数签名解构 `{ pose, ambience, deterministic }`。
3. 在 `const goal = useMemo(() => new Color(), [])` 后加：
```ts
  const keyScale = useRef(1)
  const envScale = useRef(1)
```
4. `useFrame` 内，把 `goal.set(pose.light)` 和 `scene.environmentIntensity = lights.current` 两行替换为：
```ts
    goal.set(pose.room > 0 ? ambience.key : pose.light)
    const keyGoal = 1 + (ambience.keyScale - 1) * pose.room
    const envGoal = 1 + (ambience.env - 1) * pose.room
    keyScale.current = deterministic ? keyGoal : keyScale.current + (keyGoal - keyScale.current) * k
    envScale.current = deterministic ? envGoal : envScale.current + (envGoal - envScale.current) * k
    scene.environmentIntensity = lights.current * envScale.current
```
5. 把 `key.current.intensity = KEY_INTENSITY * lights.current` 改为 `key.current.intensity = KEY_INTENSITY * keyScale.current * lights.current`。

- [ ] **Step 3: 水泥地面**

`src/scene/three/Floor.tsx`：
1. 导入加 `import { TEXTURE_URLS, useTiledTextures } from './textures'`。
2. 组件体开头加 `const concrete = useTiledTextures(TEXTURE_URLS.floor, [50, 50])`（200 m 平面，4 m 一格）。
3. `MeshReflectorMaterial` 加三个属性并调整颜色与粗糙度（颜色调暗以维持现有暗调）：
```tsx
          map={concrete.map}
          roughnessMap={concrete.roughnessMap}
          normalMap={concrete.normalMap}
          normalScale={[0.4, 0.4]}
          color="#2a2a2e"
          roughness={1}
```
（删除原来的 `color="#08080a"` 和 `roughness={0.9}`。）

- [ ] **Step 4: 旋转展台**

`src/scene/three/Turntable.tsx`：

```tsx
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type MeshBasicMaterial } from 'three'
import { dampFactor, TRANSITION_LAMBDA } from '../motion'
import type { Pose } from '../poses'
import { useIgnitionLevel } from './useIgnitionLevel'

export const TURNTABLE_HEIGHT = 0.04
const RADIUS = 2.5
const EDGE_GLOW = 2.2

export function Turntable({ pose, deterministic }: { pose: Pose; deterministic: boolean }) {
  const edge = useRef<MeshBasicMaterial>(null)
  const lights = useIgnitionLevel()
  const goal = useMemo(() => new Color(), [])
  const current = useMemo(() => new Color(pose.light), [])

  useFrame((_, delta) => {
    goal.set(pose.light)
    if (deterministic) current.copy(goal)
    else current.lerp(goal, dampFactor(TRANSITION_LAMBDA, Math.min(delta, 0.1)))
    edge.current?.color.copy(current).multiplyScalar(EDGE_GLOW * lights.current)
  })

  return (
    <group>
      <mesh position={[0, TURNTABLE_HEIGHT / 2, 0]} receiveShadow>
        <cylinderGeometry args={[RADIUS, RADIUS, TURNTABLE_HEIGHT, 96]} />
        <meshStandardMaterial color="#141417" metalness={0.85} roughness={0.38} />
      </mesh>
      <mesh position={[0, TURNTABLE_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[RADIUS - 0.035, RADIUS, 128]} />
        <meshBasicMaterial ref={edge} toneMapped={false} />
      </mesh>
    </group>
  )
}
```

`src/scene/three/Car.tsx`：
1. 导入加 `import { Turntable, TURNTABLE_HEIGHT } from './Turntable'`。
2. 返回值改为：
```tsx
    <group ref={group}>
      <Turntable pose={pose} deterministic={deterministic} />
      <primitive object={scene} position-y={TURNTABLE_HEIGHT} />
    </group>
```

- [ ] **Step 5: Stage 组装**

`src/scene/three/Stage.tsx`：
1. 导入加 `import { NIGHT } from '../ambience'` 与 `import { useAmbience } from '../useAmbience'`。
2. 组件体内 `const pose = POSES[scene]` 下加：
```ts
  const liveAmbience = useAmbience()
  const ambience = deterministic ? NIGHT : liveAmbience
```
3. `<Studio pose={pose} deterministic={deterministic} />` 改为 `<Studio pose={pose} ambience={ambience} deterministic={deterministic} />`。
4. 把 `<Floor ... />` 移进 `<Suspense fallback={null}>` 内（放在 `<Car>` 之前），让贴图加载计入首帧与进度。

- [ ] **Step 6: Checks and commit**

```bash
npx vitest run
npx tsc -b
npx tsc -p tsconfig.node.json --noEmit
npm run build
```
Expected: 全部通过；`dist/assets/index-*.js` gzip 仍 ≤ 200 KB 且不含 `WebGLRenderer`（`Select-String -Path dist/assets/index-*.js -Pattern WebGLRenderer -Quiet` 为 False）。

```bash
git add src/scene/three/textures.ts src/scene/three/Turntable.tsx src/scene/three/Studio.tsx src/scene/three/Floor.tsx src/scene/three/Car.tsx src/scene/three/Stage.tsx
git commit -m "feat(scene): concrete floor, turntable and time-of-day studio light"
```

---

### Task 7: 车库房间：后墙、LED 灯带、霓虹灯牌、道具剪影

**Files:**
- Create: `src/scene/three/useRoomLevel.ts`
- Create: `src/scene/three/Room.tsx`
- Create: `src/scene/three/NeonSign.tsx`
- Modify: `src/scene/three/Stage.tsx`

**Interfaces:**
- Consumes: `Pose.room`、`Ambience.strips`、`useIgnitionLevel`、`TEXTURE_URLS.wall`、`useTiledTextures`。
- Produces:
  ```ts
  // useRoomLevel.ts
  export interface RoomLevel { presence: number; glow: number }   // presence: 0..1 显隐；glow: presence × strips × 点火
  export function useRoomLevel(pose: Pose, ambience: Ambience, deterministic: boolean): MutableRefObject<RoomLevel>
  export const ROOM_ANCHOR: { position: [number, number, number]; rotationY: number }
  export function Room(props: { pose: Pose; ambience: Ambience; deterministic: boolean })
  export function NeonSign(props: { level: MutableRefObject<RoomLevel> })
  ```

房间锚点：车库镜头 `[-4.6, 2.3, 6.4]` 看向原点，水平视线方向 `(0.584, -0.812)`；后墙中心放在车后方 9 m：`[5.26, 0, -7.31]`，朝向镜头 `rotationY = Math.atan2(-0.584, 0.812)`（约 −0.624）。

- [ ] **Step 1: 房间等级 hook**

`src/scene/three/useRoomLevel.ts`：

```ts
import { useFrame } from '@react-three/fiber'
import { useRef, type MutableRefObject } from 'react'
import type { Ambience } from '../ambience'
import { damp, TRANSITION_LAMBDA } from '../motion'
import type { Pose } from '../poses'
import { useIgnitionLevel } from './useIgnitionLevel'

export interface RoomLevel {
  presence: number
  glow: number
}

export const ROOM_ANCHOR = { position: [5.26, 0, -7.31] as [number, number, number], rotationY: Math.atan2(-0.584, 0.812) }

export function useRoomLevel(pose: Pose, ambience: Ambience, deterministic: boolean): MutableRefObject<RoomLevel> {
  const lights = useIgnitionLevel()
  const level = useRef<RoomLevel>({ presence: pose.room, glow: pose.room * ambience.strips })
  useFrame((_, delta) => {
    const presence = deterministic ? pose.room : damp(level.current.presence, pose.room, TRANSITION_LAMBDA, Math.min(delta, 0.1))
    level.current = { presence, glow: presence * ambience.strips * lights.current }
  }, -1)
  return level
}
```

（`useFrame` 优先级 −1 保证先于使用它的组件更新。）

- [ ] **Step 2: 霓虹灯牌**

`src/scene/three/NeonSign.tsx`：

```tsx
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { CanvasTexture, Color, SRGBColorSpace, type Mesh, type MeshBasicMaterial } from 'three'
import type { RoomLevel } from './useRoomLevel'

const NEON = new Color('#C1272D')
const GLOW = 3

function drawSign(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 160
  const context = canvas.getContext('2d')
  if (context) {
    context.font = '600 104px Rajdhani, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineWidth = 6
    context.strokeStyle = '#ffffff'
    context.letterSpacing = '18px'
    context.strokeText('MIDNIGHT GARAGE', 512, 84)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function NeonSign({ level }: { level: MutableRefObject<RoomLevel> }) {
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    let alive = true
    document.fonts.ready.then(() => alive && setFontsReady(true), () => alive && setFontsReady(true))
    return () => {
      alive = false
    }
  }, [])
  const texture = useMemo(() => (fontsReady ? drawSign() : null), [fontsReady])
  useEffect(() => () => texture?.dispose(), [texture])
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const { presence, glow } = level.current
    if (mesh.current) mesh.current.visible = presence > 0.01 && texture !== null
    material.current?.color.copy(NEON).multiplyScalar(GLOW * glow)
    if (material.current) material.current.opacity = presence
  })

  if (!texture) return null
  return (
    <mesh ref={mesh} position={[0, 4.6, 0.06]}>
      <planeGeometry args={[6.4, 1]} />
      <meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
```

- [ ] **Step 3: 房间**

`src/scene/three/Room.tsx`：

```tsx
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, MeshBasicMaterial, type Group, type Material } from 'three'
import type { Ambience } from '../ambience'
import type { Pose } from '../poses'
import { NeonSign } from './NeonSign'
import { TEXTURE_URLS, useTiledTextures } from './textures'
import { ROOM_ANCHOR, useRoomLevel } from './useRoomLevel'

const WALL_WIDTH = 16
const WALL_HEIGHT = 6
const STRIP_X = [-5.4, -1.8, 1.8, 5.4]
const STRIP_COLOR = new Color('#dfe8ff')
const STRIP_GLOW = 2.4

function ToolCabinet() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.4, 1.1, 0.6]} />
        <meshStandardMaterial color="#121215" metalness={0.6} roughness={0.5} transparent />
      </mesh>
      <mesh position={[0, 1.45, -0.1]}>
        <boxGeometry args={[1.4, 0.7, 0.4]} />
        <meshStandardMaterial color="#0f0f12" metalness={0.6} roughness={0.5} transparent />
      </mesh>
    </group>
  )
}

function TireRack() {
  return (
    <group>
      {[0.36, 0.86, 1.36].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.34, 0.14, 12, 32]} />
          <meshStandardMaterial color="#09090b" roughness={0.9} transparent />
        </mesh>
      ))}
    </group>
  )
}

export function Room({ pose, ambience, deterministic }: { pose: Pose; ambience: Ambience; deterministic: boolean }) {
  const level = useRoomLevel(pose, ambience, deterministic)
  const metal = useTiledTextures(TEXTURE_URLS.wall, [4, 1.5])
  const group = useRef<Group>(null)
  const strips = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), [])
  useEffect(() => () => strips.dispose(), [strips])
  const fading = useMemo<Material[]>(() => [], [])

  useFrame(() => {
    const { presence, glow } = level.current
    const root = group.current
    if (!root) return
    root.visible = presence > 0.01
    if (fading.length === 0) {
      root.traverse((object) => {
        const material = (object as { material?: Material }).material
        if (material && material.transparent) fading.push(material)
      })
    }
    for (const material of fading) material.opacity = presence
    strips.color.copy(STRIP_COLOR).multiplyScalar(STRIP_GLOW * glow)
  })

  return (
    <group ref={group} position={ROOM_ANCHOR.position} rotation={[0, ROOM_ANCHOR.rotationY, 0]}>
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <planeGeometry args={[WALL_WIDTH, WALL_HEIGHT]} />
        <meshStandardMaterial {...metal} color="#3a3a40" metalness={0.7} roughness={1} transparent />
      </mesh>
      {STRIP_X.map((x) => (
        <mesh key={x} position={[x, 2.6, 0.04]} material={strips}>
          <boxGeometry args={[0.06, 4.2, 0.04]} />
        </mesh>
      ))}
      <NeonSign level={level} />
      <group position={[-6.4, 0, 1.2]}>
        <ToolCabinet />
      </group>
      <group position={[6.6, 0, 1.4]}>
        <TireRack />
      </group>
    </group>
  )
}
```

四条灯带共享 `strips` 一个材质（不透明，不参与 `fading`），显隐随 `root.visible`，亮度 `glow` 已乘 `presence`。

- [ ] **Step 4: 接入 Stage**

`src/scene/three/Stage.tsx`：导入 `import { Room } from './Room'`；在 `<Suspense>` 内 `<Floor ... />` 之后加 `<Room pose={pose} ambience={ambience} deterministic={deterministic} />`。

- [ ] **Step 5: Checks and commit**

```bash
npx vitest run
npx tsc -b
npx tsc -p tsconfig.node.json --noEmit
npm run build
git add src/scene/three/useRoomLevel.ts src/scene/three/Room.tsx src/scene/three/NeonSign.tsx src/scene/three/Stage.tsx
git commit -m "feat(scene): garage back wall, LED strips, neon sign and props"
```

---

### Task 8: 光柱与尘埃

**Files:**
- Create: `src/scene/three/Atmosphere.tsx`
- Modify: `src/scene/three/Stage.tsx`

**Interfaces:**
- Consumes: `useRoomLevel`、`ROOM_ANCHOR` 不需要；用 `useRoomLevel(pose, ambience, deterministic)`。
- Produces: `export function Atmosphere(props: { pose: Pose; ambience: Ambience; deterministic: boolean })`，只在画质档 < 2 时由 Stage 渲染。

主灯在 `[3, 7, 4]`，照向原点。光柱：从主灯位置指向车的半透明加色锥体；尘埃：在以车为中心 8×4×8 m 的盒子里。

- [ ] **Step 1: Implement**

`src/scene/three/Atmosphere.tsx`：

```tsx
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Quaternion, Vector3, type MeshBasicMaterial, type PointsMaterial } from 'three'
import type { Ambience } from '../ambience'
import type { Pose } from '../poses'
import { useRoomLevel } from './useRoomLevel'

const KEY_POSITION = new Vector3(3, 7, 4)
const BEAM_LENGTH = KEY_POSITION.length()
const BEAM_OPACITY = 0.05
const DUST_COUNT = 150
const DUST_BOX: [number, number, number] = [8, 4, 8]
const DUST_SPEED = 0.05

function seeded(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function Atmosphere({ pose, ambience, deterministic }: { pose: Pose; ambience: Ambience; deterministic: boolean }) {
  const level = useRoomLevel(pose, ambience, deterministic)
  const beam = useRef<MeshBasicMaterial>(null)
  const dust = useRef<PointsMaterial>(null)
  const beamColor = useMemo(() => new Color(), [])

  const orientation = useMemo(() => {
    const down = KEY_POSITION.clone().negate().normalize()
    return new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), down)
  }, [])
  const midpoint = useMemo(() => KEY_POSITION.clone().multiplyScalar(0.5), [])

  const geometry = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3)
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3] = (seeded(i) - 0.5) * DUST_BOX[0]
      positions[i * 3 + 1] = seeded(i + 1000) * DUST_BOX[1]
      positions[i * 3 + 2] = (seeded(i + 2000) - 0.5) * DUST_BOX[2]
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(positions, 3))
    return result
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const { presence, glow } = level.current
    if (beam.current) {
      beamColor.set(ambience.key)
      beam.current.color.copy(beamColor)
      beam.current.opacity = BEAM_OPACITY * glow
      beam.current.visible = presence > 0.01
    }
    if (dust.current) {
      dust.current.opacity = 0.35 * presence
      dust.current.visible = presence > 0.01
    }
    if (deterministic) return
    const positions = geometry.getAttribute('position') as BufferAttribute
    const dt = Math.min(delta, 0.1)
    for (let i = 0; i < DUST_COUNT; i++) {
      let y = positions.getY(i) + DUST_SPEED * dt * (0.5 + seeded(i + 3000))
      if (y > DUST_BOX[1]) y -= DUST_BOX[1]
      positions.setY(i, y)
    }
    positions.needsUpdate = true
  })

  return (
    <group>
      <mesh position={midpoint} quaternion={orientation}>
        <coneGeometry args={[2.2, BEAM_LENGTH, 48, 1, true]} />
        <meshBasicMaterial ref={beam} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} side={DoubleSide} />
      </mesh>
      <points geometry={geometry}>
        <pointsMaterial ref={dust} color="#f3e6d0" size={0.025} sizeAttenuation transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
    </group>
  )
}
```

注意 `coneGeometry` 默认尖端朝 +Y：上面的四元数把 −Y 对准从主灯指向原点的方向，因此尖端落在主灯处、开口罩住车。实现时在浏览器里确认朝向；若反了，把 `new Vector3(0, -1, 0)` 改为 `new Vector3(0, 1, 0)`，并在报告中说明。

- [ ] **Step 2: 接入 Stage**

`src/scene/three/Stage.tsx`：导入 `import { Atmosphere } from './Atmosphere'`；在 `<Suspense>` 外、`<Studio>` 之后加：
```tsx
      {quality < 2 && <Atmosphere pose={pose} ambience={ambience} deterministic={deterministic} />}
```

- [ ] **Step 3: Checks and commit**

```bash
npx vitest run
npx tsc -b
npx tsc -p tsconfig.node.json --noEmit
npm run build
git add src/scene/three/Atmosphere.tsx src/scene/three/Stage.tsx
git commit -m "feat(scene): light shaft and drifting dust in the garage"
```

---

### Task 9: 鸣谢、静帧与验收

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/SettingsPage.test.tsx`
- Regenerate (committed): `public/stills/*.webp`

- [ ] **Step 1: Write the failing test**

`src/pages/SettingsPage.test.tsx` 的 `'credits the car model and other third-party assets'` 用例末尾加：

```tsx
    expect(credits.getByRole('link', { name: 'Garage Floor' })).toHaveAttribute('href', 'https://polyhaven.com/a/garage_floor')
    expect(credits.getByRole('link', { name: 'Box Profile Metal Sheet' })).toHaveAttribute('href', 'https://polyhaven.com/a/box_profile_metal_sheet')
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: FAIL，找不到这两个链接。

- [ ] **Step 3: Implement**

`src/pages/SettingsPage.tsx`：在 Freesound 音效那一段 `<p>` 之后加一段，链接属性与现有鸣谢链接一致（`target="_blank" rel="noreferrer" className="underline"`）：

```tsx
          <p>
            材质来自 Poly Haven（CC0）：Jenelle van Heerden「
            <a href="https://polyhaven.com/a/garage_floor" target="_blank" rel="noreferrer" className="underline">Garage Floor</a>
            」、Amal Kumar「
            <a href="https://polyhaven.com/a/box_profile_metal_sheet" target="_blank" rel="noreferrer" className="underline">Box Profile Metal Sheet</a>
            」。
          </p>
```

- [ ] **Step 4: Regenerate stills and verify**

```bash
npx vitest run src/pages/SettingsPage.test.tsx
npm run stills
```
Expected: 测试 PASS；6 张静帧重新生成，每张 ≤ 120 KB。打开 `public/stills/garage-landscape.webp` 与 `garage-portrait.webp` 目视确认：能看到展台、后墙、灯带、灯牌，构图与之前一致。

- [ ] **Step 5: Final checks and commit**

```bash
npx vitest run
npx tsc -b
npx tsc -p tsconfig.node.json --noEmit
npm run build
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx public/stills
git commit -m "feat(settings): credit the Poly Haven textures; regenerate stills"
```

- [ ] **Step 6: Controller browser check（控制器执行，不由实现者执行）**

开发服务器 `npm run dev -- --port 5173 --strictPort`，逐项截图：
1. `/?hour=2`、`/?hour=7`、`/?hour=13`、`/?hour=19` 车库四个时刻。
2. 从车库切到 `/trial`、`/vault`：房间、光柱、尘埃淡出；展台灯带在保险库变金。
3. 清掉 `introSeen` 重新进入：点火时灯带、灯牌随车库一起亮起。
4. 设置页关 3D：静帧上有时间叠色（`?hour=13`）。
5. 仪表盘条在手机竖屏宽度（390 px）下一行排开不换行。
