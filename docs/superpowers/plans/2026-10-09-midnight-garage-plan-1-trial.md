# Midnight Garage · 计划 1：外壳 + 赛道试炼 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把旧 Hexo 博客替换为一个可上线的 Vite + React 单页站点：黑武士车库首页（2D 静态背景）、完整的四六级「赛道试炼」背单词流程、进度导出/导入，并通过 GitHub Actions 发布到 GitHub Pages。

**Architecture:** 规则层全部是纯函数（学习日、复习间隔、每日选词、出题、会话引擎、进度序列化），各自有 Vitest 单元测试；React 层只负责把规则接到界面上。词库由本地脚本从 ECDICT 生成静态 JSON 分包，运行时按需加载。进度通过一个 React Context 存进 `localStorage`。

**Tech Stack:** Node.js 24、Vite 8、React 19、TypeScript 6、React Router 8、Tailwind CSS 4、Motion 14、Vitest 5 + jsdom + Testing Library、tsx、csv-parse、@fontsource/rajdhani。

**规格文档：** `docs/superpowers/specs/2026-10-09-midnight-garage-design.md`

**本计划不包含（后续计划）：** 计划 2：加密保险库（本计划里 `/vault` 只放占位页）。计划 3：3D 车库场景、后期光效、开场动画、声音、低端设备降级（本计划用 2D SVG 背景代替）。

## Global Constraints

- 运行环境 Windows + PowerShell；所有命令在仓库根目录 `D:\CODE\Krazymud.github.io` 执行。若终端找不到 `node`/`npm`，先执行 `$env:Path = "C:\Program Files\nodejs;$env:Path"`。
- 界面文案一律中文；单词、音标、品牌字样 `MIDNIGHT GARAGE` 为英文。
- 不出现任何真实汽车品牌的车标或名称。
- 配色（车库/赛道）：大面积 `#9E1C22`，关键元素 `#C1272D`；保险库：大面积 `#A8894F`，关键元素 `#BF9F62`；背景 `#050506`，面板 `#0E0E10`，分隔线 `#2A2A2E`，正文 `#E4E4E6`，次要文字 `#86868C`。
- 每天最多 20 词；先到期复习（越过期越优先），空位按常用程度补新词；到期超过 20 个时顺延。
- 「一天」从本地时间凌晨 4:00 开始。
- 复习间隔：不会 → 1 天；还行 → `max(3, interval × 2)`；会了 → `max(7, interval × 2)`；`interval ≥ 30` 计为已掌握。
- 答错后 1500 ms 自动下一题；答对后 4000 ms 不评级则默认「还行」。连击达到 5 和 10 时触发氮气光效。
- 进度存储键 `midnight-garage/progress`，`schemaVersion` 当前为 `1`。
- 以手机竖屏为主设计，内容区最大宽度 `max-w-md`。
- TypeScript 开启了 `verbatimModuleSyntax`：只作类型使用的导入必须写 `import type` 或 `type` 修饰。

---

## 文件结构

```
.github/workflows/deploy.yml        构建、测试、发布到 GitHub Pages
.gitignore
index.html
package.json / package-lock.json
tsconfig.json / tsconfig.app.json / tsconfig.node.json
vite.config.ts                      Vite + Tailwind + Vitest 配置
public/favicon.svg
public/words/                       生成的词库：index.json、chunk-000.json…、ECDICT-LICENSE.txt
scripts/lib/ecdict.ts               ECDICT 行解析（纯函数）
scripts/lib/ecdict.test.ts
scripts/build-words.ts              生成词库的命令行脚本
src/main.tsx                        挂载 ProgressProvider + Router
src/index.css                       Tailwind、主题色、字体
src/config/site.ts                  昵称、在一起起始日期
src/test/setup.ts                   jest-dom 匹配器
src/app/routes.tsx                  路由表
src/app/Layout.tsx                  顶部导航、主题切换、保存失败提示
src/app/GarageBackdrop.tsx          2D 背景（车剪影 / 赛道线）
src/app/App.test.tsx
src/pages/HomePage.tsx
src/pages/TrialPage.tsx
src/pages/VaultPage.tsx             占位页
src/pages/SettingsPage.tsx          导出/导入进度
src/pages/SettingsPage.test.tsx
src/progress/store.ts               进度类型、解析、读写
src/progress/store.test.ts
src/progress/ProgressProvider.tsx   React Context
src/trial/day.ts + day.test.ts      学习日计算
src/trial/srs.ts + srs.test.ts      复习间隔
src/trial/types.ts                  Word / WordIndex / SessionItem
src/trial/session.ts + session.test.ts     每日选词
src/trial/question.ts + question.test.ts   出题和干扰项
src/trial/engine.ts + engine.test.ts       会话推进和统计
src/trial/wordsRepo.ts + wordsRepo.test.ts 词库加载
src/trial/useWordSource.ts
src/trial/TrialScreen.tsx + TrialScreen.test.tsx
src/trial/components/Gauge.tsx
src/trial/components/QuestionCard.tsx
src/trial/components/GradeBar.tsx
src/trial/components/ResultPanel.tsx
src/trial/components/SpeakButton.tsx
src/trial/components/Effects.tsx
src/trial/components/LoadError.tsx
```

---

### Task 1: 归档旧博客并搭建工具链

**Files:**
- Delete: `2018/`、`2019/`、`about/`、`archives/`、`css/`、`images/`、`js/`、`lib/`、`page/`、`tags/`、`index.html`、`search.json`
- Modify: `.gitignore`
- Create: `package.json`、`tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`、`vite.config.ts`、`index.html`、`public/favicon.svg`、`src/main.tsx`、`src/index.css`、`src/test/setup.ts`、`src/App.tsx`、`src/App.test.tsx`

**Interfaces:**
- Consumes: 无
- Produces: `npm test`（`vitest run`）、`npm run build`（产出 `dist/` 和 `dist/404.html`）、`npm run words`（Task 7 使用）。Tailwind 颜色类：`bg-ink`、`bg-panel`、`border-line`、`text-fg`、`text-muted`、`bg-accent`、`text-accent-hi`、`border-accent-hi` 等；字体类 `font-display`。`src/App.tsx` 和 `src/App.test.tsx` 是临时文件，Task 9 删除。

- [ ] **Step 1: 把旧博客保存到 `legacy-blog` 分支**

```powershell
git branch legacy-blog 249b992
git branch --list legacy-blog
```

Expected: 输出 `  legacy-blog`。

- [ ] **Step 2: 从 master 删除旧博客文件**

```powershell
git rm -r -q 2018 2019 about archives css images js lib page tags index.html search.json
git status --short | Select-Object -First 5
```

Expected: 列出若干 `D ` 开头的删除记录。

- [ ] **Step 3: 覆盖 `.gitignore`**

```gitignore
node_modules/
dist/
scripts/.cache/
.superpowers/
*.local
```

- [ ] **Step 4: 创建 `package.json`**

```json
{
  "name": "midnight-garage",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build && node -e \"require('node:fs').copyFileSync('dist/index.html','dist/404.html')\"",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "words": "tsx scripts/build-words.ts"
  },
  "dependencies": {
    "@fontsource/rajdhani": "^5.3.0",
    "motion": "^14.0.0",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-router": "^8.4.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@types/node": "^24.13.3",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.2.7",
    "@vitejs/plugin-react": "^6.1.2",
    "csv-parse": "^7.0.3",
    "jsdom": "^30.1.2",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.23.15",
    "typescript": "~6.0.2",
    "vite": "^8.3.4",
    "vitest": "^5.0.3"
  }
}
```

- [ ] **Step 5: 创建三个 tsconfig**

`tsconfig.json`:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts", "scripts"]
}
```

- [ ] **Step 6: 创建 `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 7: 创建 `index.html` 和 `public/favicon.svg`**

`index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#050506" />
    <title>Midnight Garage</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#050506"/>
  <path d="M6 42 L14 34 L28 30 L36 22 L48 22 L58 32 L58 42 Z" fill="#141416" stroke="#C1272D" stroke-width="2"/>
  <circle cx="18" cy="43" r="5" fill="#050506" stroke="#C1272D" stroke-width="2"/>
  <circle cx="48" cy="43" r="5" fill="#050506" stroke="#C1272D" stroke-width="2"/>
</svg>
```

- [ ] **Step 8: 创建 `src/index.css`**

```css
@import 'tailwindcss';
@import '@fontsource/rajdhani/500.css';
@import '@fontsource/rajdhani/700.css';

@theme {
  --color-ink: #050506;
  --color-panel: #0e0e10;
  --color-line: #2a2a2e;
  --color-fg: #e4e4e6;
  --color-muted: #86868c;
  --font-display: 'Rajdhani', system-ui, sans-serif;
}

:root {
  --accent: #9e1c22;
  --accent-hi: #c1272d;
}

[data-theme='vault'] {
  --accent: #a8894f;
  --accent-hi: #bf9f62;
}

@theme inline {
  --color-accent: var(--accent);
  --color-accent-hi: var(--accent-hi);
}

html,
body {
  background: var(--color-ink);
  color: var(--color-fg);
  font-family: system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 9: 创建 `src/test/setup.ts`、临时 `src/App.tsx`、`src/main.tsx`**

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

`src/App.tsx`:

```tsx
export function App() {
  return <h1 className="font-display text-accent-hi">MIDNIGHT GARAGE</h1>
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 10: 写冒烟测试 `src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { App } from './App'

it('renders the brand', () => {
  render(<App />)
  expect(screen.getByRole('heading')).toHaveTextContent('MIDNIGHT GARAGE')
})
```

- [ ] **Step 11: 安装依赖并验证**

```powershell
npm install
npm test
npm run build
Test-Path dist/404.html
```

Expected: `npm test` 显示 `1 passed`；`npm run build` 成功；最后一行输出 `True`。

- [ ] **Step 12: Commit**

```powershell
git add -A
git commit -m "chore: archive Hexo blog and scaffold Vite React app"
```

---

### Task 2: 学习日和复习间隔规则

**Files:**
- Create: `src/trial/day.ts`、`src/trial/day.test.ts`、`src/trial/srs.ts`、`src/trial/srs.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `studyDay(now: Date): string`：返回 `YYYY-MM-DD`，凌晨 4:00 前算前一天。
  - `addDays(day: string, n: number): string`
  - `daysBetween(from: string, to: string): number`
  - `type Grade = 'again' | 'ok' | 'good'`（不会 / 还行 / 会了）
  - `interface WordProgress { interval: number; due: string; lastResult: Grade; seenCount: number }`
  - `nextProgress(prev: WordProgress | undefined, grade: Grade, today: string): WordProgress`
  - `MASTERED_INTERVAL = 30`、`isMastered(p: WordProgress): boolean`

- [ ] **Step 1: 写失败的测试 `src/trial/day.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, studyDay } from './day'

describe('studyDay', () => {
  it('counts times before 04:00 as the previous day', () => {
    expect(studyDay(new Date(2026, 9, 9, 3, 59))).toBe('2026-10-08')
  })

  it('starts the new day at 04:00', () => {
    expect(studyDay(new Date(2026, 9, 9, 4, 0))).toBe('2026-10-09')
  })

  it('handles the first of the month before 04:00', () => {
    expect(studyDay(new Date(2026, 10, 1, 1, 0))).toBe('2026-10-31')
  })
})

describe('addDays', () => {
  it('crosses year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('supports negative offsets', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('daysBetween', () => {
  it('returns whole days between two study days', () => {
    expect(daysBetween('2026-10-09', '2026-10-16')).toBe(7)
    expect(daysBetween('2026-10-16', '2026-10-09')).toBe(-7)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/trial/day.test.ts`
Expected: FAIL，提示无法解析 `./day`。

- [ ] **Step 3: 实现 `src/trial/day.ts`**

```ts
const CUTOFF_HOUR = 4
const MS_PER_DAY = 86_400_000

function format(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number)
  return [y, m, d]
}

export function studyDay(now: Date): string {
  const shifted = new Date(now.getTime())
  shifted.setHours(shifted.getHours() - CUTOFF_HOUR)
  return format(shifted)
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day)
  return format(new Date(y, m - 1, d + n))
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parts(from)
  const [y2, m2, d2] = parts(to)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / MS_PER_DAY)
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/trial/day.test.ts`
Expected: PASS（6 个测试）。

- [ ] **Step 5: 写失败的测试 `src/trial/srs.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { isMastered, nextProgress, type WordProgress } from './srs'

const TODAY = '2026-10-09'

function progress(interval: number): WordProgress {
  return { interval, due: TODAY, lastResult: 'ok', seenCount: 2 }
}

describe('nextProgress', () => {
  it('schedules a new word by grade: again 1, ok 3, good 7 days', () => {
    expect(nextProgress(undefined, 'again', TODAY)).toEqual({ interval: 1, due: '2026-10-10', lastResult: 'again', seenCount: 1 })
    expect(nextProgress(undefined, 'ok', TODAY)).toEqual({ interval: 3, due: '2026-10-12', lastResult: 'ok', seenCount: 1 })
    expect(nextProgress(undefined, 'good', TODAY)).toEqual({ interval: 7, due: '2026-10-16', lastResult: 'good', seenCount: 1 })
  })

  it('doubles the interval on later correct answers', () => {
    expect(nextProgress(progress(7), 'ok', TODAY).interval).toBe(14)
    expect(nextProgress(progress(14), 'good', TODAY).interval).toBe(28)
  })

  it('never drops below the grade floor when doubling', () => {
    expect(nextProgress(progress(3), 'good', TODAY).interval).toBe(7)
    expect(nextProgress(progress(1), 'ok', TODAY).interval).toBe(3)
  })

  it('resets to 1 day on again regardless of history', () => {
    expect(nextProgress(progress(40), 'again', TODAY)).toMatchObject({ interval: 1, due: '2026-10-10' })
  })

  it('increments seenCount', () => {
    expect(nextProgress(progress(3), 'ok', TODAY).seenCount).toBe(3)
  })
})

describe('isMastered', () => {
  it('treats interval of 30 days or more as mastered', () => {
    expect(isMastered(progress(30))).toBe(true)
    expect(isMastered(progress(29))).toBe(false)
  })
})
```

- [ ] **Step 6: 运行测试，确认失败**

Run: `npx vitest run src/trial/srs.test.ts`
Expected: FAIL，提示无法解析 `./srs`。

- [ ] **Step 7: 实现 `src/trial/srs.ts`**

```ts
import { addDays } from './day'

export type Grade = 'again' | 'ok' | 'good'

export interface WordProgress {
  interval: number
  due: string
  lastResult: Grade
  seenCount: number
}

export const MASTERED_INTERVAL = 30

const FLOOR: Record<Grade, number> = { again: 1, ok: 3, good: 7 }

export function nextProgress(prev: WordProgress | undefined, grade: Grade, today: string): WordProgress {
  const previous = prev?.interval ?? 0
  const interval = grade === 'again' ? FLOOR.again : Math.max(FLOOR[grade], previous * 2)
  return {
    interval,
    due: addDays(today, interval),
    lastResult: grade,
    seenCount: (prev?.seenCount ?? 0) + 1,
  }
}

export function isMastered(p: WordProgress): boolean {
  return p.interval >= MASTERED_INTERVAL
}
```

- [ ] **Step 8: 运行测试，确认通过**

Run: `npx vitest run src/trial`
Expected: PASS（day 与 srs 全部通过）。

- [ ] **Step 9: Commit**

```powershell
git add src/trial/day.ts src/trial/day.test.ts src/trial/srs.ts src/trial/srs.test.ts
git commit -m "feat(trial): add study-day and spaced repetition rules"
```

---

### Task 3: 每日选词

**Files:**
- Create: `src/trial/types.ts`、`src/trial/session.ts`、`src/trial/session.test.ts`

**Interfaces:**
- Consumes: `WordProgress`（Task 2）
- Produces:
  - `interface Word { w: string; p: string; pos: string; m: string }`（单词、音标、主词性、带词性标签的释义）
  - `interface WordIndex { version: number; chunkSize: number; words: string[] }`
  - `type ItemKind = 'new' | 'review'`、`interface SessionItem { word: string; kind: ItemKind }`
  - `DAILY_LIMIT = 20`
  - `buildSession(today: string, progress: Record<string, WordProgress>, order: string[], limit?: number): SessionItem[]`

- [ ] **Step 1: 创建 `src/trial/types.ts`**

```ts
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
```

- [ ] **Step 2: 写失败的测试 `src/trial/session.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { buildSession } from './session'
import type { WordProgress } from './srs'

const TODAY = '2026-10-09'

function due(day: string): WordProgress {
  return { interval: 3, due: day, lastResult: 'ok', seenCount: 1 }
}

describe('buildSession', () => {
  it('puts due reviews first, most overdue first, then fills with new words in order', () => {
    const progress = { bravo: due('2026-10-09'), alpha: due('2026-10-01'), charlie: due('2026-10-20') }
    const order = ['alpha', 'bravo', 'charlie', 'delta', 'echo']
    expect(buildSession(TODAY, progress, order, 4)).toEqual([
      { word: 'alpha', kind: 'review' },
      { word: 'bravo', kind: 'review' },
      { word: 'delta', kind: 'new' },
      { word: 'echo', kind: 'new' },
    ])
  })

  it('caps the day at the limit and leaves extra reviews for later', () => {
    const progress = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`w${i}`, due('2026-10-01')]))
    const order = [...Object.keys(progress), 'fresh']
    const items = buildSession(TODAY, progress, order)
    expect(items).toHaveLength(20)
    expect(items.every((item) => item.kind === 'review')).toBe(true)
  })

  it('breaks ties between equally overdue words alphabetically', () => {
    const progress = { zulu: due('2026-10-01'), alpha: due('2026-10-01') }
    expect(buildSession(TODAY, progress, ['zulu', 'alpha']).map((i) => i.word)).toEqual(['alpha', 'zulu'])
  })

  it('skips progress entries for words no longer in the word list', () => {
    const progress = { removed: due('2026-10-01') }
    expect(buildSession(TODAY, progress, ['alpha'], 5)).toEqual([{ word: 'alpha', kind: 'new' }])
  })

  it('returns fewer items when the word list runs out', () => {
    expect(buildSession(TODAY, {}, ['alpha', 'bravo'])).toHaveLength(2)
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/trial/session.test.ts`
Expected: FAIL，提示无法解析 `./session`。

- [ ] **Step 4: 实现 `src/trial/session.ts`**

```ts
import type { WordProgress } from './srs'
import type { SessionItem } from './types'

export const DAILY_LIMIT = 20

export function buildSession(
  today: string,
  progress: Record<string, WordProgress>,
  order: string[],
  limit = DAILY_LIMIT,
): SessionItem[] {
  const known = new Set(order)
  const items: SessionItem[] = Object.entries(progress)
    .filter(([word, p]) => known.has(word) && p.due <= today)
    .sort(([wordA, a], [wordB, b]) => (a.due === b.due ? wordA.localeCompare(wordB) : a.due < b.due ? -1 : 1))
    .slice(0, limit)
    .map(([word]) => ({ word, kind: 'review' }))

  for (const word of order) {
    if (items.length >= limit) break
    if (!(word in progress)) items.push({ word, kind: 'new' })
  }
  return items
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/trial/session.test.ts`
Expected: PASS（5 个测试）。

- [ ] **Step 6: Commit**

```powershell
git add src/trial/types.ts src/trial/session.ts src/trial/session.test.ts
git commit -m "feat(trial): build the daily 20-word session"
```

---

### Task 4: 出题和干扰项

**Files:**
- Create: `src/trial/question.ts`、`src/trial/question.test.ts`

**Interfaces:**
- Consumes: `Word`、`ItemKind`（Task 3）
- Produces:
  - `type Direction = 'en2zh' | 'zh2en'`
  - `type Rng = () => number`
  - `interface Question { word: Word; direction: Direction; options: Word[]; answerIndex: number }`
  - `pickDistractors(word: Word, pool: Word[], rng: Rng, count?: number): Word[]`
  - `buildQuestion(word: Word, kind: ItemKind, pool: Word[], rng: Rng): Question`

- [ ] **Step 1: 写失败的测试 `src/trial/question.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { buildQuestion, pickDistractors, type Rng } from './question'
import type { Word } from './types'

function seeded(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const word = (w: string, pos: string, m: string): Word => ({ w, p: '', pos, m })

const target = word('ambiguous', 'adj.', 'adj. 不明确的')
const pool: Word[] = [
  target,
  word('ample', 'adj.', 'adj. 充足的'),
  word('anonymous', 'adj.', 'adj. 匿名的'),
  word('ambitious', 'adj.', 'adj. 有雄心的'),
  word('vague', 'adj.', 'adj. 不明确的'),
  word('abandon', 'v.', 'v. 放弃'),
  word('record', 'n.', 'n. 记录'),
]

describe('pickDistractors', () => {
  it('prefers words with the same part of speech', () => {
    const picked = pickDistractors(target, pool, seeded(1))
    expect(picked).toHaveLength(3)
    expect(picked.every((w) => w.pos === 'adj.')).toBe(true)
  })

  it('never includes the answer or a word with the same meaning', () => {
    for (let seed = 0; seed < 20; seed++) {
      const picked = pickDistractors(target, pool, seeded(seed))
      expect(picked.map((w) => w.w)).not.toContain('ambiguous')
      expect(picked.map((w) => w.w)).not.toContain('vague')
    }
  })

  it('falls back to other parts of speech when needed', () => {
    const small = [target, word('ample', 'adj.', 'adj. 充足的'), word('abandon', 'v.', 'v. 放弃'), word('record', 'n.', 'n. 记录')]
    const picked = pickDistractors(target, small, seeded(3))
    expect(picked.map((w) => w.w).sort()).toEqual(['abandon', 'ample', 'record'])
  })
})

describe('buildQuestion', () => {
  it('always asks new words English to Chinese', () => {
    for (let seed = 0; seed < 10; seed++) {
      expect(buildQuestion(target, 'new', pool, seeded(seed)).direction).toBe('en2zh')
    }
  })

  it('asks review words in either direction', () => {
    const directions = new Set(Array.from({ length: 30 }, (_, seed) => buildQuestion(target, 'review', pool, seeded(seed)).direction))
    expect(directions).toEqual(new Set(['en2zh', 'zh2en']))
  })

  it('places the answer at answerIndex among four options', () => {
    const q = buildQuestion(target, 'new', pool, seeded(7))
    expect(q.options).toHaveLength(4)
    expect(q.options[q.answerIndex]).toBe(target)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/trial/question.test.ts`
Expected: FAIL，提示无法解析 `./question`。

- [ ] **Step 3: 实现 `src/trial/question.ts`**

```ts
import type { ItemKind, Word } from './types'

export type Direction = 'en2zh' | 'zh2en'
export type Rng = () => number

export interface Question {
  word: Word
  direction: Direction
  options: Word[]
  answerIndex: number
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function pickDistractors(word: Word, pool: Word[], rng: Rng, count = 3): Word[] {
  const candidates = pool.filter((c) => c.w !== word.w && c.m !== word.m)
  const samePos = shuffle(candidates.filter((c) => c.pos === word.pos), rng)
  const otherPos = shuffle(candidates.filter((c) => c.pos !== word.pos), rng)
  const meanings = new Set([word.m])
  const picked: Word[] = []
  for (const candidate of [...samePos, ...otherPos]) {
    if (picked.length >= count) break
    if (meanings.has(candidate.m)) continue
    meanings.add(candidate.m)
    picked.push(candidate)
  }
  return picked
}

export function buildQuestion(word: Word, kind: ItemKind, pool: Word[], rng: Rng): Question {
  const direction: Direction = kind === 'review' && rng() < 0.5 ? 'zh2en' : 'en2zh'
  const options = shuffle([word, ...pickDistractors(word, pool, rng)], rng)
  return { word, direction, options, answerIndex: options.indexOf(word) }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/trial/question.test.ts`
Expected: PASS（6 个测试）。

- [ ] **Step 5: Commit**

```powershell
git add src/trial/question.ts src/trial/question.test.ts
git commit -m "feat(trial): build questions with same-POS distractors"
```

---

### Task 5: 进度存储、校验和导入格式

**Files:**
- Create: `src/progress/store.ts`、`src/progress/store.test.ts`

**Interfaces:**
- Consumes: `Grade`、`WordProgress`（Task 2）；`SessionItem`（Task 3）
- Produces:
  - `SCHEMA_VERSION = 1`、`STORAGE_KEY = 'midnight-garage/progress'`
  - `interface DaySession { day: string; items: SessionItem[]; cursor: number; correct: number; combo: number; bestCombo: number; startedAt: number; finishedAt?: number }`
  - `interface DayStat { day: string; total: number; correct: number; newCount: number; reviewCount: number; bestCombo: number; durationMs: number }`
  - `interface ProgressData { schemaVersion: number; words: Record<string, WordProgress>; session?: DaySession; history: DayStat[] }`
  - `type ParseResult = { ok: true; data: ProgressData } | { ok: false; reason: string }`
  - `emptyProgress(): ProgressData`
  - `parseProgress(text: string): ParseResult`
  - `serializeProgress(data: ProgressData): string`
  - `getStorage(): Storage | null`
  - `loadProgress(storage: Storage): ProgressData`
  - `saveProgress(storage: Storage, data: ProgressData): boolean`

- [ ] **Step 1: 写失败的测试 `src/progress/store.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  emptyProgress,
  loadProgress,
  parseProgress,
  saveProgress,
  serializeProgress,
  STORAGE_KEY,
  type ProgressData,
} from './store'

const sample: ProgressData = {
  schemaVersion: 1,
  words: { alpha: { interval: 7, due: '2026-10-16', lastResult: 'good', seenCount: 1 } },
  session: {
    day: '2026-10-09',
    items: [{ word: 'alpha', kind: 'new' }],
    cursor: 1,
    correct: 1,
    combo: 1,
    bestCombo: 1,
    startedAt: 1000,
    finishedAt: 61000,
  },
  history: [{ day: '2026-10-09', total: 1, correct: 1, newCount: 1, reviewCount: 0, bestCombo: 1, durationMs: 60000 }],
}

describe('parseProgress', () => {
  it('round-trips serialized data', () => {
    expect(parseProgress(serializeProgress(sample))).toEqual({ ok: true, data: sample })
  })

  it('rejects text that is not JSON', () => {
    expect(parseProgress('not json')).toEqual({ ok: false, reason: '文件不是有效的 JSON' })
  })

  it('rejects JSON without a schema version', () => {
    expect(parseProgress('{"words":{}}')).toEqual({ ok: false, reason: '文件里没有进度数据' })
  })

  it('rejects files from a newer schema version', () => {
    const result = parseProgress(JSON.stringify({ ...sample, schemaVersion: 2 }))
    expect(result).toEqual({ ok: false, reason: '这个进度文件来自更新版本的站点，请先刷新页面再导入' })
  })

  it('rejects corrupted word entries', () => {
    const broken = { ...sample, words: { alpha: { interval: 'x' } } }
    expect(parseProgress(JSON.stringify(broken))).toEqual({ ok: false, reason: '进度数据已损坏' })
  })

  it('drops an invalid session but keeps words', () => {
    const result = parseProgress(JSON.stringify({ ...sample, session: { day: 'yesterday' } }))
    expect(result.ok && result.data.session).toBeUndefined()
    expect(result.ok && result.data.words.alpha.interval).toBe(7)
  })
})

describe('loadProgress / saveProgress', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty progress when nothing is stored', () => {
    expect(loadProgress(localStorage)).toEqual(emptyProgress())
  })

  it('loads what was saved', () => {
    expect(saveProgress(localStorage, sample)).toBe(true)
    expect(loadProgress(localStorage)).toEqual(sample)
  })

  it('backs up corrupted data and starts fresh', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    expect(loadProgress(localStorage)).toEqual(emptyProgress())
    const backups = Object.keys(localStorage).filter((k) => k.startsWith(`${STORAGE_KEY}/corrupt-`))
    expect(backups).toHaveLength(1)
  })

  it('reports failure when storage throws', () => {
    const full = {
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    } as unknown as Storage
    expect(saveProgress(full, sample)).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/progress/store.test.ts`
Expected: FAIL，提示无法解析 `./store`。

- [ ] **Step 3: 实现 `src/progress/store.ts`**

```ts
import type { Grade, WordProgress } from '../trial/srs'
import type { SessionItem } from '../trial/types'

export const SCHEMA_VERSION = 1
export const STORAGE_KEY = 'midnight-garage/progress'

export interface DaySession {
  day: string
  items: SessionItem[]
  cursor: number
  correct: number
  combo: number
  bestCombo: number
  startedAt: number
  finishedAt?: number
}

export interface DayStat {
  day: string
  total: number
  correct: number
  newCount: number
  reviewCount: number
  bestCombo: number
  durationMs: number
}

export interface ProgressData {
  schemaVersion: number
  words: Record<string, WordProgress>
  session?: DaySession
  history: DayStat[]
}

export type ParseResult = { ok: true; data: ProgressData } | { ok: false; reason: string }

type Migration = (data: Record<string, unknown>) => Record<string, unknown>

// Key N upgrades data from schemaVersion N to N + 1.
const MIGRATIONS: Record<number, Migration> = {}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const GRADES: readonly string[] = ['again', 'ok', 'good'] satisfies Grade[]

function fail(reason: string): ParseResult {
  return { ok: false, reason }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isDay(value: unknown): value is string {
  return typeof value === 'string' && DAY_RE.test(value)
}

function isWordProgress(value: unknown): value is WordProgress {
  return (
    isRecord(value) &&
    isNumber(value.interval) &&
    value.interval >= 0 &&
    isDay(value.due) &&
    typeof value.lastResult === 'string' &&
    GRADES.includes(value.lastResult) &&
    isNumber(value.seenCount)
  )
}

function isSessionItem(value: unknown): value is SessionItem {
  return isRecord(value) && typeof value.word === 'string' && (value.kind === 'new' || value.kind === 'review')
}

function isDaySession(value: unknown): value is DaySession {
  return (
    isRecord(value) &&
    isDay(value.day) &&
    Array.isArray(value.items) &&
    value.items.every(isSessionItem) &&
    isNumber(value.cursor) &&
    isNumber(value.correct) &&
    isNumber(value.combo) &&
    isNumber(value.bestCombo) &&
    isNumber(value.startedAt) &&
    (value.finishedAt === undefined || isNumber(value.finishedAt))
  )
}

function isDayStat(value: unknown): value is DayStat {
  return (
    isRecord(value) &&
    isDay(value.day) &&
    isNumber(value.total) &&
    isNumber(value.correct) &&
    isNumber(value.newCount) &&
    isNumber(value.reviewCount) &&
    isNumber(value.bestCombo) &&
    isNumber(value.durationMs)
  )
}

export function emptyProgress(): ProgressData {
  return { schemaVersion: SCHEMA_VERSION, words: {}, history: [] }
}

export function parseProgress(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fail('文件不是有效的 JSON')
  }
  if (!isRecord(raw) || !isNumber(raw.schemaVersion)) return fail('文件里没有进度数据')
  if (raw.schemaVersion > SCHEMA_VERSION) return fail('这个进度文件来自更新版本的站点，请先刷新页面再导入')

  let current = raw
  for (let version = raw.schemaVersion; version < SCHEMA_VERSION; version++) {
    const migrate = MIGRATIONS[version]
    if (!migrate) return fail(`无法从版本 ${version} 升级`)
    current = migrate(current)
  }

  const words = current.words
  if (!isRecord(words) || !Object.values(words).every(isWordProgress)) return fail('进度数据已损坏')

  const data: ProgressData = {
    schemaVersion: SCHEMA_VERSION,
    words: words as Record<string, WordProgress>,
    history: Array.isArray(current.history) ? current.history.filter(isDayStat) : [],
  }
  if (isDaySession(current.session)) data.session = current.session
  return { ok: true, data }
}

export function serializeProgress(data: ProgressData): string {
  return JSON.stringify(data)
}

export function getStorage(): Storage | null {
  try {
    const storage = window.localStorage
    const probe = `${STORAGE_KEY}/probe`
    storage.setItem(probe, probe)
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

export function loadProgress(storage: Storage): ProgressData {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return emptyProgress()
  const result = parseProgress(raw)
  if (result.ok) return result.data
  try {
    storage.setItem(`${STORAGE_KEY}/corrupt-${Date.now()}`, raw)
  } catch {
    return emptyProgress()
  }
  return emptyProgress()
}

export function saveProgress(storage: Storage, data: ProgressData): boolean {
  try {
    storage.setItem(STORAGE_KEY, serializeProgress(data))
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/progress/store.test.ts`
Expected: PASS（10 个测试）。

- [ ] **Step 5: Commit**

```powershell
git add src/progress/store.ts src/progress/store.test.ts
git commit -m "feat(progress): versioned local progress with import validation"
```

---

### Task 6: 会话引擎

**Files:**
- Create: `src/trial/engine.ts`、`src/trial/engine.test.ts`

**Interfaces:**
- Consumes: `buildSession`、`DAILY_LIMIT`（Task 3）；`nextProgress`、`isMastered`、`Grade`、`WordProgress`（Task 2）；`addDays`（Task 2）；`ProgressData`、`DaySession`、`DayStat`（Task 5）
- Produces:
  - `ensureSession(data: ProgressData, today: string, order: string[], now: number, limit?: number): ProgressData`：当天已有会话时原样返回同一个对象。
  - `currentItem(session: DaySession | undefined): SessionItem | undefined`
  - `isFinished(session: DaySession): boolean`
  - `recordAnswer(data: ProgressData, grade: Grade, now: number): ProgressData`：用 `session.day` 计算到期日；`grade !== 'again'` 视为答对。
  - `dueOn(words: Record<string, WordProgress>, day: string): number`：到期日 ≤ `day` 的词数。
  - `masteredCount(words: Record<string, WordProgress>): number`

- [ ] **Step 1: 写失败的测试 `src/trial/engine.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { emptyProgress, type ProgressData } from '../progress/store'
import { currentItem, dueOn, ensureSession, isFinished, masteredCount, recordAnswer } from './engine'

const TODAY = '2026-10-09'
const ORDER = ['alpha', 'bravo', 'charlie']

function started(): ProgressData {
  return ensureSession(emptyProgress(), TODAY, ORDER, 1000)
}

describe('ensureSession', () => {
  it('creates today\'s session from the word order', () => {
    const data = started()
    expect(data.session).toMatchObject({ day: TODAY, cursor: 0, correct: 0, combo: 0, bestCombo: 0, startedAt: 1000 })
    expect(data.session?.items.map((i) => i.word)).toEqual(ORDER)
  })

  it('returns the same object when today\'s session already exists', () => {
    const data = started()
    expect(ensureSession(data, TODAY, ORDER, 5000)).toBe(data)
  })

  it('replaces a session from an earlier day', () => {
    const next = ensureSession(started(), '2026-10-10', ORDER, 9000)
    expect(next.session).toMatchObject({ day: '2026-10-10', startedAt: 9000 })
  })
})

describe('recordAnswer', () => {
  it('grades the current word, advances and builds the combo', () => {
    const data = recordAnswer(started(), 'good', 2000)
    expect(data.words.alpha).toEqual({ interval: 7, due: '2026-10-16', lastResult: 'good', seenCount: 1 })
    expect(data.session).toMatchObject({ cursor: 1, correct: 1, combo: 1, bestCombo: 1 })
    expect(currentItem(data.session)).toEqual({ word: 'bravo', kind: 'new' })
  })

  it('resets the combo on a wrong answer but keeps the best combo', () => {
    let data = recordAnswer(started(), 'ok', 2000)
    data = recordAnswer(data, 'again', 3000)
    expect(data.session).toMatchObject({ cursor: 2, correct: 1, combo: 0, bestCombo: 1 })
    expect(data.words.bravo).toMatchObject({ interval: 1, due: '2026-10-10' })
  })

  it('finishes the session and records a day stat', () => {
    let data = started()
    data = recordAnswer(data, 'good', 2000)
    data = recordAnswer(data, 'again', 3000)
    data = recordAnswer(data, 'ok', 61000)
    expect(data.session?.finishedAt).toBe(61000)
    expect(isFinished(data.session!)).toBe(true)
    expect(data.history).toEqual([
      { day: TODAY, total: 3, correct: 2, newCount: 3, reviewCount: 0, bestCombo: 1, durationMs: 60000 },
    ])
  })

  it('ignores answers after the session is finished', () => {
    let data = started()
    for (const grade of ['ok', 'ok', 'ok'] as const) data = recordAnswer(data, grade, 2000)
    expect(recordAnswer(data, 'good', 3000)).toBe(data)
  })
})

describe('stats', () => {
  const words = {
    alpha: { interval: 1, due: '2026-10-09', lastResult: 'again', seenCount: 1 },
    bravo: { interval: 3, due: '2026-10-10', lastResult: 'ok', seenCount: 1 },
    charlie: { interval: 32, due: '2026-11-10', lastResult: 'good', seenCount: 4 },
  } as const

  it('counts words due on or before a day', () => {
    expect(dueOn(words, '2026-10-09')).toBe(1)
    expect(dueOn(words, '2026-10-10')).toBe(2)
  })

  it('counts mastered words', () => {
    expect(masteredCount(words)).toBe(1)
  })

  it('treats an empty session as finished', () => {
    const data = ensureSession(emptyProgress(), TODAY, [], 1000)
    expect(isFinished(data.session!)).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/trial/engine.test.ts`
Expected: FAIL，提示无法解析 `./engine`。

- [ ] **Step 3: 实现 `src/trial/engine.ts`**

```ts
import type { DaySession, DayStat, ProgressData } from '../progress/store'
import { buildSession, DAILY_LIMIT } from './session'
import { isMastered, nextProgress, type Grade, type WordProgress } from './srs'
import type { SessionItem } from './types'

export function ensureSession(
  data: ProgressData,
  today: string,
  order: string[],
  now: number,
  limit = DAILY_LIMIT,
): ProgressData {
  if (data.session?.day === today) return data
  const session: DaySession = {
    day: today,
    items: buildSession(today, data.words, order, limit),
    cursor: 0,
    correct: 0,
    combo: 0,
    bestCombo: 0,
    startedAt: now,
  }
  return { ...data, session }
}

export function currentItem(session: DaySession | undefined): SessionItem | undefined {
  if (!session || isFinished(session)) return undefined
  return session.items[session.cursor]
}

export function isFinished(session: DaySession): boolean {
  return session.finishedAt !== undefined || session.cursor >= session.items.length
}

function toStat(session: DaySession, finishedAt: number): DayStat {
  const newCount = session.items.filter((item) => item.kind === 'new').length
  return {
    day: session.day,
    total: session.items.length,
    correct: session.correct,
    newCount,
    reviewCount: session.items.length - newCount,
    bestCombo: session.bestCombo,
    durationMs: finishedAt - session.startedAt,
  }
}

export function recordAnswer(data: ProgressData, grade: Grade, now: number): ProgressData {
  const session = data.session
  const item = currentItem(session)
  if (!session || !item) return data

  const correct = grade !== 'again'
  const combo = correct ? session.combo + 1 : 0
  const next: DaySession = {
    ...session,
    cursor: session.cursor + 1,
    correct: session.correct + (correct ? 1 : 0),
    combo,
    bestCombo: Math.max(session.bestCombo, combo),
  }
  const words = { ...data.words, [item.word]: nextProgress(data.words[item.word], grade, session.day) }

  if (next.cursor < next.items.length) return { ...data, words, session: next }
  next.finishedAt = now
  return { ...data, words, session: next, history: [...data.history, toStat(next, now)] }
}

export function dueOn(words: Readonly<Record<string, WordProgress>>, day: string): number {
  return Object.values(words).filter((p) => p.due <= day).length
}

export function masteredCount(words: Readonly<Record<string, WordProgress>>): number {
  return Object.values(words).filter(isMastered).length
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/trial/engine.test.ts`
Expected: PASS（10 个测试）。

- [ ] **Step 5: Commit**

```powershell
git add src/trial/engine.ts src/trial/engine.test.ts
git commit -m "feat(trial): session engine with combo and day stats"
```

---

### Task 7: 从 ECDICT 生成四六级词库

**Files:**
- Create: `scripts/lib/ecdict.ts`、`scripts/lib/ecdict.test.ts`、`scripts/build-words.ts`
- Create (generated): `public/words/index.json`、`public/words/chunk-000.json` … `chunk-011.json`、`public/words/ECDICT-LICENSE.txt`

**Interfaces:**
- Consumes: 无（脚本端不导入 `src/`；输出格式与 Task 3 的 `Word`、`WordIndex` 一致）
- Produces: `public/words/index.json`（`{ version: 1, chunkSize: 500, words: string[] }`，按常用程度排序）；`public/words/chunk-NNN.json`（`Word[]`，第 N 包对应 `words[N*500 .. N*500+499]`，顺序一致）。

ECDICT 的 CSV 列为 `word,phonetic,definition,translation,pos,collins,oxford,tag,bnc,frq,exchange,detail,audio`。`pos` 列为空，词性从 `translation` 每行开头的 `n.`、`vt.`、`a.` 等前缀读取；各行之间用字面的 `\n`（反斜杠 + n）分隔；`[计]`、`[法]` 这类以 `[` 开头的行是专业领域释义，丢弃。带 `cet4` 或 `cet6` 标签的词约 5,805 个。

- [ ] **Step 1: 写失败的测试 `scripts/lib/ecdict.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { isCetWord, parseTranslation, rankOf, toEntry, type EcdictRow } from './ecdict.ts'

function row(overrides: Partial<EcdictRow>): EcdictRow {
  return { word: 'x', phonetic: '', translation: '', tag: 'cet4', frq: '0', bnc: '0', ...overrides }
}

describe('isCetWord', () => {
  it('accepts cet4 or cet6 tags only', () => {
    expect(isCetWord('gk cet6 ky')).toBe(true)
    expect(isCetWord('zk gk cet4')).toBe(true)
    expect(isCetWord('zk gk')).toBe(false)
    expect(isCetWord('')).toBe(false)
  })
})

describe('parseTranslation', () => {
  it('normalizes the part of speech and drops domain lines', () => {
    expect(parseTranslation('a. 不明确的, 模棱两可的\\n[法] 意思含糊的, 模棱两可的')).toEqual({
      pos: 'adj.',
      meaning: 'adj. 不明确的，模棱两可的',
    })
  })

  it('keeps at most two senses with three meanings each', () => {
    const t = 'n. 记录, 履历, 档案, 审判记录\\nvt. 记录, 记载, 标明, 将...录音\\nvi. 记录, 录音\\n[计] 录制, 记录'
    expect(parseTranslation(t)).toEqual({ pos: 'n.', meaning: 'n. 记录，履历，档案；v. 记录，记载，标明' })
  })

  it('accepts lines without a part of speech', () => {
    expect(parseTranslation('你好')).toEqual({ pos: '', meaning: '你好' })
  })

  it('returns null when only domain lines remain', () => {
    expect(parseTranslation('[计] 录制')).toBeNull()
  })
})

describe('toEntry', () => {
  it('builds a word entry and normalizes the schwa character', () => {
    const entry = toEntry(row({ word: 'abandon', phonetic: "ә'bændәn", translation: 'vt. 放弃, 抛弃' }))
    expect(entry).toEqual({ w: 'abandon', p: "ə'bændən", pos: 'v.', m: 'v. 放弃，抛弃' })
  })

  it('returns null for rows without a usable meaning', () => {
    expect(toEntry(row({ translation: '[计] 录制' }))).toBeNull()
  })
})

describe('rankOf', () => {
  it('prefers frq, falls back to bnc, otherwise sorts last', () => {
    expect(rankOf(row({ frq: '516', bnc: '507' }))).toBe(516)
    expect(rankOf(row({ frq: '0', bnc: '67' }))).toBe(67)
    expect(rankOf(row({ frq: '', bnc: '0' }))).toBe(Number.POSITIVE_INFINITY)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/ecdict.test.ts`
Expected: FAIL，提示无法解析 `./ecdict.ts`。

- [ ] **Step 3: 实现 `scripts/lib/ecdict.ts`**

```ts
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
}

const MAX_SENSES = 2
const MAX_MEANINGS_PER_SENSE = 3

export function isCetWord(tag: string): boolean {
  const tags = tag.split(' ')
  return tags.includes('cet4') || tags.includes('cet6')
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
  return { w: row.word, p: row.phonetic.replace(/ә/g, 'ə'), pos: parsed.pos, m: parsed.meaning }
}

export function rankOf(row: EcdictRow): number {
  const frq = Number(row.frq)
  if (frq > 0) return frq
  const bnc = Number(row.bnc)
  if (bnc > 0) return bnc
  return Number.POSITIVE_INFINITY
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/ecdict.test.ts`
Expected: PASS（8 个测试）。

- [ ] **Step 5: 实现 `scripts/build-words.ts`**

```ts
import { createReadStream, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'csv-parse'
import { isCetWord, rankOf, toEntry, type EcdictRow, type WordEntry } from './lib/ecdict.ts'

const CHUNK_SIZE = 500
const csvPath = process.argv[2] ?? 'scripts/.cache/ecdict.csv'
const outDir = process.argv[3] ?? 'public/words'

const picked = new Map<string, { entry: WordEntry; rank: number }>()
const parser = createReadStream(csvPath).pipe(parse({ columns: true, relax_quotes: true }))
for await (const row of parser as AsyncIterable<EcdictRow>) {
  if (!isCetWord(row.tag) || picked.has(row.word)) continue
  const entry = toEntry(row)
  if (entry) picked.set(row.word, { entry, rank: rankOf(row) })
}

const sorted = [...picked.values()]
  .sort((a, b) => a.rank - b.rank || a.entry.w.localeCompare(b.entry.w))
  .map((item) => item.entry)

mkdirSync(outDir, { recursive: true })
for (const file of readdirSync(outDir)) {
  if (/^chunk-\d+\.json$/.test(file)) rmSync(join(outDir, file))
}

const chunkCount = Math.ceil(sorted.length / CHUNK_SIZE)
for (let id = 0; id < chunkCount; id++) {
  const chunk = sorted.slice(id * CHUNK_SIZE, (id + 1) * CHUNK_SIZE)
  writeFileSync(join(outDir, `chunk-${String(id).padStart(3, '0')}.json`), JSON.stringify(chunk))
}
writeFileSync(
  join(outDir, 'index.json'),
  JSON.stringify({ version: 1, chunkSize: CHUNK_SIZE, words: sorted.map((w) => w.w) }),
)

console.log(`${sorted.length} words -> ${chunkCount} chunks in ${outDir}`)
```

- [ ] **Step 6: 下载 ECDICT 和许可证，生成词库**

```powershell
New-Item -ItemType Directory -Force scripts/.cache, public/words | Out-Null
Invoke-WebRequest -UseBasicParsing https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv -OutFile scripts/.cache/ecdict.csv
Invoke-WebRequest -UseBasicParsing https://raw.githubusercontent.com/skywind3000/ECDICT/master/LICENSE -OutFile public/words/ECDICT-LICENSE.txt
npm run words
```

Expected: 最后一行类似 `5805 words -> 12 chunks in public/words`（数量可能因个别词条没有可用释义而略少于 5805，块数为 12）。

- [ ] **Step 7: 抽查生成结果**

```powershell
node -e "const i=require('./public/words/index.json');const c=require('./public/words/chunk-000.json');console.log(i.words.length,i.chunkSize,c.length);console.log(c.slice(0,3))"
```

Expected: 第一行形如 `5805 500 500`；第二行打印 3 个 `{ w, p, pos, m }` 对象，`m` 以词性标签开头（如 `adj. ...`），都是非常常用的词。

- [ ] **Step 8: 类型检查**

Run: `npx tsc -b`
Expected: 无输出，退出码 0。

- [ ] **Step 9: Commit**

```powershell
git add scripts public/words
git commit -m "feat(words): generate CET-4/6 word packs from ECDICT"
```

---

### Task 8: 运行时词库加载

**Files:**
- Create: `src/trial/wordsRepo.ts`、`src/trial/wordsRepo.test.ts`、`src/trial/useWordSource.ts`

**Interfaces:**
- Consumes: `Word`、`WordIndex`（Task 3）；Task 7 生成的 `public/words/*`
- Produces:
  - `interface ResolvedWord { word: Word; pool: Word[] }`（`pool` 是该词所在分包的全部词，用于挑干扰项）
  - `interface WordSource { order: string[]; lookup(words: string[]): Promise<Map<string, ResolvedWord>> }`
  - `type FetchJson = <T>(url: string) => Promise<T>`
  - `chunkName(id: number): string`
  - `createWordSource(fetchJson?: FetchJson): Promise<WordSource>`
  - `useWordSource(): { state: WordSourceState; retry: () => void }`，其中 `type WordSourceState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; source: WordSource }`

- [ ] **Step 1: 写失败的测试 `src/trial/wordsRepo.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import type { Word, WordIndex } from './types'
import { chunkName, createWordSource, type FetchJson } from './wordsRepo'

const word = (w: string): Word => ({ w, p: '', pos: 'n.', m: `n. ${w}` })

const INDEX: WordIndex = { version: 1, chunkSize: 2, words: ['a', 'b', 'c', 'd', 'e'] }
const CHUNKS: Record<string, Word[]> = {
  'chunk-000.json': [word('a'), word('b')],
  'chunk-001.json': [word('c'), word('d')],
  'chunk-002.json': [word('e')],
}

function fakeFetch(failOnce?: string) {
  let failed = false
  return vi.fn(async (url: string) => {
    const name = url.split('/').pop()!
    if (name === failOnce && !failed) {
      failed = true
      throw new Error('network')
    }
    if (name === 'index.json') return INDEX
    return CHUNKS[name]
  }) as unknown as FetchJson & ReturnType<typeof vi.fn>
}

describe('chunkName', () => {
  it('pads chunk ids to three digits', () => {
    expect(chunkName(7)).toBe('chunk-007.json')
  })
})

describe('createWordSource', () => {
  it('exposes the word order from the index', async () => {
    const source = await createWordSource(fakeFetch())
    expect(source.order).toEqual(INDEX.words)
  })

  it('resolves words with their chunk as the distractor pool', async () => {
    const source = await createWordSource(fakeFetch())
    const result = await source.lookup(['a', 'd'])
    expect(result.get('a')).toEqual({ word: word('a'), pool: CHUNKS['chunk-000.json'] })
    expect(result.get('d')).toEqual({ word: word('d'), pool: CHUNKS['chunk-001.json'] })
    expect(result.has('b')).toBe(false)
  })

  it('loads each chunk only once', async () => {
    const fetchJson = fakeFetch()
    const source = await createWordSource(fetchJson)
    await source.lookup(['a'])
    await source.lookup(['b'])
    expect(fetchJson.mock.calls.filter(([url]) => String(url).endsWith('chunk-000.json'))).toHaveLength(1)
  })

  it('retries a chunk that failed to load', async () => {
    const source = await createWordSource(fakeFetch('chunk-002.json'))
    await expect(source.lookup(['e'])).rejects.toThrow('network')
    expect((await source.lookup(['e'])).get('e')?.word).toEqual(word('e'))
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/trial/wordsRepo.test.ts`
Expected: FAIL，提示无法解析 `./wordsRepo`。

- [ ] **Step 3: 实现 `src/trial/wordsRepo.ts`**

```ts
import type { Word, WordIndex } from './types'

export interface ResolvedWord {
  word: Word
  pool: Word[]
}

export interface WordSource {
  order: string[]
  lookup(words: string[]): Promise<Map<string, ResolvedWord>>
}

export type FetchJson = <T>(url: string) => Promise<T>

const BASE = `${import.meta.env.BASE_URL}words/`

const fetchJsonOverHttp: FetchJson = async <T>(url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return (await response.json()) as T
}

export function chunkName(id: number): string {
  return `chunk-${String(id).padStart(3, '0')}.json`
}

export async function createWordSource(fetchJson: FetchJson = fetchJsonOverHttp): Promise<WordSource> {
  const index = await fetchJson<WordIndex>(`${BASE}index.json`)
  const position = new Map(index.words.map((w, i) => [w, i]))
  const chunks = new Map<number, Promise<Word[]>>()

  function loadChunk(id: number): Promise<Word[]> {
    const cached = chunks.get(id)
    if (cached) return cached
    const pending = fetchJson<Word[]>(`${BASE}${chunkName(id)}`)
    pending.catch(() => chunks.delete(id))
    chunks.set(id, pending)
    return pending
  }

  return {
    order: index.words,
    async lookup(words) {
      const wanted = new Set(words)
      const ids = new Set<number>()
      for (const w of wanted) {
        const pos = position.get(w)
        if (pos !== undefined) ids.add(Math.floor(pos / index.chunkSize))
      }
      const pools = await Promise.all([...ids].map(loadChunk))
      const result = new Map<string, ResolvedWord>()
      for (const pool of pools) {
        for (const word of pool) {
          if (wanted.has(word.w)) result.set(word.w, { word, pool })
        }
      }
      return result
    },
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/trial/wordsRepo.test.ts`
Expected: PASS（5 个测试）。

- [ ] **Step 5: 实现 `src/trial/useWordSource.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import { createWordSource, type WordSource } from './wordsRepo'

export type WordSourceState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; source: WordSource }

export function useWordSource(): { state: WordSourceState; retry: () => void } {
  const [state, setState] = useState<WordSourceState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    createWordSource().then(
      (source) => alive && setState({ status: 'ready', source }),
      () => alive && setState({ status: 'error' }),
    )
    return () => {
      alive = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
```

- [ ] **Step 6: 类型检查并提交**

```powershell
npx tsc -b
git add src/trial/wordsRepo.ts src/trial/wordsRepo.test.ts src/trial/useWordSource.ts
git commit -m "feat(trial): lazy word pack loading with retry"
```

Expected: `tsc` 无输出。

---

### Task 9: 应用外壳、车库首页和保险库占位页

**Files:**
- Delete: `src/App.tsx`、`src/App.test.tsx`
- Create: `src/config/site.ts`、`src/progress/ProgressProvider.tsx`、`src/app/GarageBackdrop.tsx`、`src/app/Layout.tsx`、`src/app/routes.tsx`、`src/app/App.test.tsx`、`src/pages/HomePage.tsx`、`src/pages/VaultPage.tsx`、`src/pages/TrialPage.tsx`（本任务先放临时内容，Task 10 替换）、`src/pages/SettingsPage.tsx`（本任务先放临时内容，Task 11 替换）
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `studyDay`、`daysBetween`（Task 2）；`DAILY_LIMIT`（Task 3）；`dueOn`、`isFinished`（Task 6）；`ProgressData`、`emptyProgress`、`getStorage`、`loadProgress`、`saveProgress`（Task 5）
- Produces:
  - `site: { nickname: string; togetherSince: string | null }`
  - `ProgressProvider`（组件）、`useProgress(): { data: ProgressData; update: (fn: (d: ProgressData) => ProgressData) => void; saveFailed: boolean }`
  - `routes: RouteObject[]`（`/`、`/trial`、`/vault`、`/settings`，其他路径重定向到 `/`）
  - `type Scene = 'garage' | 'track' | 'vault'`

- [ ] **Step 1: 删除临时文件，创建 `src/config/site.ts`**

```powershell
git rm -q src/App.tsx src/App.test.tsx
```

```ts
export const site = {
  nickname: 'YOU',
  // 'YYYY-MM-DD'; null hides the "在一起第 N 天" line.
  togetherSince: null as string | null,
}
```

- [ ] **Step 2: 创建 `src/progress/ProgressProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { emptyProgress, getStorage, loadProgress, saveProgress, type ProgressData } from './store'

interface ProgressContextValue {
  data: ProgressData
  update: (fn: (data: ProgressData) => ProgressData) => void
  saveFailed: boolean
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [storage] = useState(getStorage)
  const [data, setData] = useState(() => (storage ? loadProgress(storage) : emptyProgress()))
  const [saveFailed, setSaveFailed] = useState(storage === null)

  useEffect(() => {
    setSaveFailed(!(storage && saveProgress(storage, data)))
  }, [storage, data])

  const value = useMemo(() => ({ data, update: setData, saveFailed }), [data, saveFailed])
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext)
  if (!value) throw new Error('useProgress must be used inside ProgressProvider')
  return value
}
```

- [ ] **Step 3: 创建 `src/app/GarageBackdrop.tsx`**

```tsx
export type Scene = 'garage' | 'track' | 'vault'

function CarSilhouette() {
  return (
    <svg viewBox="0 0 400 120" className="absolute bottom-[14%] left-1/2 w-[min(92vw,520px)] -translate-x-1/2 opacity-40">
      <path d="M20 88 L40 70 L120 60 L170 40 L240 34 L300 46 L360 60 L385 72 L388 88 Z" fill="#131315" stroke="#2a2a2e" />
      <path d="M172 44 L238 38 L282 51 L186 57 Z" fill="#09090b" stroke="#36363c" strokeWidth="0.8" />
      <path d="M60 79 L345 70" stroke="var(--accent)" strokeWidth="1.2" />
      <path d="M362 64 L384 71" stroke="var(--accent-hi)" strokeWidth="2.2" />
      <circle cx="95" cy="88" r="20" fill="#0a0a0b" stroke="var(--accent)" strokeWidth="1.8" />
      <circle cx="310" cy="88" r="20" fill="#0a0a0b" stroke="var(--accent)" strokeWidth="1.8" />
      <ellipse cx="200" cy="112" rx="170" ry="5" fill="var(--accent)" opacity="0.15" />
    </svg>
  )
}

function TrackLines() {
  return (
    <svg viewBox="0 0 240 480" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[55%] w-full opacity-60">
      <path d="M108 0 L0 480 M132 0 L240 480" stroke="#2a2a2e" strokeWidth="2" />
      <path d="M120 10 L120 40 M120 80 L120 140 M120 200 L120 300 M120 360 L120 480" stroke="var(--accent)" strokeWidth="3" />
    </svg>
  )
}

export function GarageBackdrop({ scene }: { scene: Scene }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 30%, #1f1f22 0%, #0a0a0c 60%, #050506 100%)' }}
    >
      {scene === 'track' ? <TrackLines /> : <CarSilhouette />}
    </div>
  )
}
```

- [ ] **Step 4: 创建 `src/app/Layout.tsx`**

```tsx
import { NavLink, Outlet, useLocation } from 'react-router'
import { useProgress } from '../progress/ProgressProvider'
import { GarageBackdrop, type Scene } from './GarageBackdrop'

const NAV = [
  { to: '/', label: '车库', end: true },
  { to: '/trial', label: '赛道试炼', end: false },
  { to: '/vault', label: '保险库', end: false },
  { to: '/settings', label: '设置', end: false },
]

function sceneFor(pathname: string): Scene {
  if (pathname.startsWith('/vault')) return 'vault'
  if (pathname.startsWith('/trial')) return 'track'
  return 'garage'
}

export function Layout() {
  const { pathname } = useLocation()
  const { saveFailed } = useProgress()
  const scene = sceneFor(pathname)

  return (
    <div data-theme={scene === 'vault' ? 'vault' : undefined} className="relative min-h-dvh bg-ink text-fg">
      <GarageBackdrop scene={scene} />
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-4 text-xs">
        <span className="font-display tracking-[0.35em] text-accent-hi">MIDNIGHT GARAGE</span>
        <nav className="flex gap-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'border-b border-accent-hi text-fg' : 'text-muted hover:text-fg')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {saveFailed && (
        <p role="alert" className="relative z-10 mx-5 mt-3 border border-accent px-3 py-2 text-xs">
          进度暂时无法保存到这台设备，建议去「设置」导出进度。
        </p>
      )}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pt-6 pb-10">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 5: 创建页面**

`src/pages/HomePage.tsx`:

```tsx
import { Link } from 'react-router'
import { site } from '../config/site'
import { useProgress } from '../progress/ProgressProvider'
import { daysBetween, studyDay } from '../trial/day'
import { dueOn, isFinished } from '../trial/engine'
import { DAILY_LIMIT } from '../trial/session'

export function HomePage() {
  const { data } = useProgress()
  const today = studyDay(new Date())
  const session = data.session?.day === today ? data.session : undefined
  const done = session?.cursor ?? 0
  const total = session?.items.length ?? DAILY_LIMIT
  const finished = session !== undefined && isFinished(session)
  const together = site.togetherSince ? daysBetween(site.togetherSince, today) + 1 : null

  return (
    <section className="flex min-h-[72dvh] flex-col justify-between">
      <div>
        <p className="font-display text-xs tracking-[0.35em] text-muted">WELCOME BACK</p>
        <h1 className="mt-2 font-display text-5xl font-bold tracking-wide">
          HELLO, <span className="text-accent-hi">{site.nickname}</span>
        </h1>
        {together !== null && (
          <p className="mt-3 text-sm text-muted">
            在一起第 <span className="font-display text-lg text-fg">{together}</span> 天
          </p>
        )}
      </div>
      <div className="space-y-3">
        <Link to="/trial" className="flex items-center justify-between border border-accent-hi bg-accent/20 px-5 py-4">
          <span>
            <span className="block text-xs text-muted">今日试炼</span>
            <span className="font-display text-2xl font-bold">
              {done} / {total}
            </span>
          </span>
          <span className="text-sm">{finished ? '已完成 · 看结算' : '出发'}</span>
        </Link>
        <p className="text-xs text-muted">到期复习 {dueOn(data.words, today)} 个</p>
        <Link to="/vault" className="block border border-line px-5 py-3 text-sm text-muted hover:text-fg">
          保险库
        </Link>
      </div>
    </section>
  )
}
```

`src/pages/VaultPage.tsx`:

```tsx
export function VaultPage() {
  return (
    <section className="mt-10 border border-accent/60 bg-panel/80 px-5 py-8 text-center">
      <p className="font-display text-xs tracking-[0.35em] text-accent-hi">PRIVATE VAULT</p>
      <p className="mt-4 font-serif text-2xl italic">
        Only <span className="text-accent-hi">us</span>.
      </p>
      <p className="mt-4 text-sm text-muted">保险库将在下一阶段开放。</p>
    </section>
  )
}
```

`src/pages/TrialPage.tsx`（临时）:

```tsx
export function TrialPage() {
  return <p className="text-center text-sm text-muted">赛道试炼准备中…</p>
}
```

`src/pages/SettingsPage.tsx`（临时）:

```tsx
export function SettingsPage() {
  return <p className="text-center text-sm text-muted">设置准备中…</p>
}
```

- [ ] **Step 6: 创建 `src/app/routes.tsx` 并改写 `src/main.tsx`**

`src/app/routes.tsx`:

```tsx
import { Navigate, type RouteObject } from 'react-router'
import { HomePage } from '../pages/HomePage'
import { SettingsPage } from '../pages/SettingsPage'
import { TrialPage } from '../pages/TrialPage'
import { VaultPage } from '../pages/VaultPage'
import { Layout } from './Layout'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'trial', element: <TrialPage /> },
      { path: 'vault', element: <VaultPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './app/routes'
import './index.css'
import { ProgressProvider } from './progress/ProgressProvider'

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>
  </StrictMode>,
)
```

- [ ] **Step 7: 写测试 `src/app/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { ProgressProvider } from '../progress/ProgressProvider'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>,
  )
}

describe('app shell', () => {
  beforeEach(() => localStorage.clear())

  it('greets her in the garage with today\'s trial status', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('HELLO, YOU')
    expect(screen.getByText('0 / 20')).toBeInTheDocument()
    expect(screen.getByText('到期复习 0 个')).toBeInTheDocument()
  })

  it('switches to the gold theme inside the vault', () => {
    renderAt('/vault')
    expect(document.querySelector('[data-theme="vault"]')).not.toBeNull()
    expect(screen.getByText('保险库将在下一阶段开放。')).toBeInTheDocument()
  })

  it('redirects unknown paths to the garage', async () => {
    renderAt('/2018/09/05/leetcode05/')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('HELLO, YOU')
  })
})
```

- [ ] **Step 8: 运行测试并检查构建**

```powershell
npm test
npm run build
```

Expected: 所有测试通过；构建成功。

- [ ] **Step 9: 手动看一眼**

Run: `npm run dev`，浏览器打开终端显示的地址（通常是 `http://localhost:5173/`），用开发者工具切到手机尺寸（如 390×844）。
Expected: 黑色背景、底部有酒红轮圈的车剪影、`HELLO, YOU` 标题、`0 / 20` 出发卡片；点「保险库」后点缀色变成香槟金；点「赛道试炼」背景变成赛道线。看完按 `Ctrl+C` 停止。

- [ ] **Step 10: Commit**

```powershell
git add -A
git commit -m "feat(shell): garage home, nav, theme switch and progress provider"
```

---

### Task 10: 赛道试炼答题界面

**Files:**
- Create: `src/trial/components/Gauge.tsx`、`src/trial/components/SpeakButton.tsx`、`src/trial/components/QuestionCard.tsx`、`src/trial/components/GradeBar.tsx`、`src/trial/components/ResultPanel.tsx`、`src/trial/components/Effects.tsx`、`src/trial/components/LoadError.tsx`、`src/trial/TrialScreen.tsx`、`src/trial/TrialScreen.test.tsx`
- Modify: `src/pages/TrialPage.tsx`（替换 Task 9 的临时内容）

**Interfaces:**
- Consumes: `useProgress`（Task 9）；`studyDay`、`addDays`（Task 2）；`Grade`（Task 2）；`ensureSession`、`currentItem`、`isFinished`、`recordAnswer`、`dueOn`、`masteredCount`（Task 6）；`buildQuestion`、`Question`（Task 4）；`WordSource`、`ResolvedWord`（Task 8）；`useWordSource`（Task 8）；`DaySession`（Task 5）
- Produces: `TrialScreen({ source, now? }: { source: WordSource; now?: () => Date })`；常量 `WRONG_DELAY_MS = 1500`、`GRADE_TIMEOUT_MS = 4000`、`NITRO_COMBOS = [5, 10]`。

- [ ] **Step 1: 写失败的测试 `src/trial/TrialScreen.test.tsx`**

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgressProvider } from '../progress/ProgressProvider'
import { STORAGE_KEY } from '../progress/store'
import { TrialScreen } from './TrialScreen'
import type { Word } from './types'
import type { WordSource } from './wordsRepo'

const WORDS: Word[] = [
  { w: 'alpha', p: 'ˈælfə', pos: 'n.', m: 'n. 阿尔法' },
  { w: 'bravo', p: 'ˈbrɑːvəʊ', pos: 'n.', m: 'n. 喝彩' },
  { w: 'charlie', p: 'ˈtʃɑːli', pos: 'n.', m: 'n. 查理' },
  { w: 'delta', p: 'ˈdeltə', pos: 'n.', m: 'n. 三角洲' },
  { w: 'echo', p: 'ˈekəʊ', pos: 'n.', m: 'n. 回声' },
]

const source: WordSource = {
  order: WORDS.map((w) => w.w),
  lookup: async (words) => new Map(WORDS.filter((w) => words.includes(w.w)).map((w) => [w.w, { word: w, pool: WORDS }])),
}

function renderTrial() {
  const router = createMemoryRouter(
    [{ path: '/', element: <TrialScreen source={source} now={() => new Date(2026, 9, 9, 12)} /> }],
    { initialEntries: ['/'] },
  )
  render(
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>,
  )
}

function options() {
  return within(screen.getByRole('list')).getAllByRole('button')
}

function saved() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!)
}

describe('TrialScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('grades a correct answer as good when 会了 is pressed', async () => {
    renderTrial()
    await screen.findByRole('heading', { name: 'alpha' })
    fireEvent.click(options().find((b) => b.textContent?.includes('阿尔法'))!)
    fireEvent.click(await screen.findByRole('button', { name: '会了' }))
    await screen.findByRole('heading', { name: 'bravo' })
    expect(saved().words.alpha).toMatchObject({ interval: 7, due: '2026-10-16', lastResult: 'good' })
  })

  it('defaults a correct answer to ok after 4 seconds', async () => {
    renderTrial()
    await screen.findByRole('heading', { name: 'alpha' })
    fireEvent.click(options().find((b) => b.textContent?.includes('阿尔法'))!)
    await screen.findByRole('button', { name: '还行' })
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    await screen.findByRole('heading', { name: 'bravo' })
    expect(saved().words.alpha).toMatchObject({ interval: 3, lastResult: 'ok' })
  })

  it('grades a wrong answer as again and moves on after 1.5 seconds', async () => {
    renderTrial()
    await screen.findByRole('heading', { name: 'alpha' })
    fireEvent.click(options().find((b) => !b.textContent?.includes('阿尔法'))!)
    expect(screen.queryByRole('button', { name: '会了' })).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    await screen.findByRole('heading', { name: 'bravo' })
    expect(saved().words.alpha).toMatchObject({ interval: 1, lastResult: 'again' })
  })

  it('answers with number keys', async () => {
    renderTrial()
    await screen.findByRole('heading', { name: 'alpha' })
    const index = options().findIndex((b) => b.textContent?.includes('阿尔法'))
    fireEvent.keyDown(window, { key: String(index + 1) })
    expect(await screen.findByRole('button', { name: '会了' })).toBeInTheDocument()
  })

  it('shows the lap summary after the last word', async () => {
    renderTrial()
    for (const word of WORDS) {
      await screen.findByRole('heading', { name: word.w })
      fireEvent.click(options().find((b) => b.textContent?.includes(word.m.slice(3)))!)
      fireEvent.click(await screen.findByRole('button', { name: '会了' }))
    }
    expect(await screen.findByText('圈速')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(saved().history).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/trial/TrialScreen.test.tsx`
Expected: FAIL，提示无法解析 `./TrialScreen`。

- [ ] **Step 3: 创建 `src/trial/components/Gauge.tsx`**

```tsx
import { motion } from 'motion/react'

const ARC = 'M20 105 A80 80 0 0 1 180 105'

interface GaugeProps {
  value: number
  total: number
  combo: number
  boost: boolean
}

export function Gauge({ value, total, combo, boost }: GaugeProps) {
  const fraction = total > 0 ? Math.min(value / total, 1) : 0
  const angle = -90 + 180 * fraction + (boost ? 14 : 0)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-48" role="img" aria-label={`进度 ${value} / ${total}`}>
        <path d={ARC} fill="none" stroke="var(--color-line)" strokeWidth="10" strokeLinecap="round" />
        <motion.path
          d={ARC}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="10"
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: fraction }}
          transition={{ duration: 0.5 }}
        />
        <motion.g
          style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
          initial={false}
          animate={{ rotate: angle }}
          transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        >
          <line x1="100" y1="105" x2="100" y2="42" stroke="var(--accent-hi)" strokeWidth="2.5" />
        </motion.g>
        <circle cx="100" cy="105" r="5" fill="var(--accent-hi)" />
        <text x="100" y="88" textAnchor="middle" fill="var(--color-fg)" fontSize="22" fontWeight="700" className="font-display">
          {value}
          <tspan fontSize="11" fill="var(--color-muted)">
            {' '}
            / {total}
          </tspan>
        </text>
      </svg>
      <p className="-mt-1 font-display text-xs tracking-[0.2em] text-accent-hi">COMBO ×{combo}</p>
    </div>
  )
}
```

- [ ] **Step 4: 创建 `src/trial/components/SpeakButton.tsx`**

```tsx
export function SpeakButton({ text }: { text: string }) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null

  function speak() {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  return (
    <button type="button" onClick={speak} aria-label={`朗读 ${text}`} className="text-muted hover:text-accent-hi">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
      </svg>
    </button>
  )
}
```

- [ ] **Step 5: 创建 `src/trial/components/QuestionCard.tsx`**

```tsx
import type { Question } from '../question'
import { SpeakButton } from './SpeakButton'

type OptionState = 'idle' | 'right' | 'wrong' | 'dim'

const OPTION_CLASS: Record<OptionState, string> = {
  idle: 'border-line bg-panel/90 hover:border-accent',
  right: 'border-accent-hi bg-accent/25 text-white',
  wrong: 'border-line bg-panel/90 line-through opacity-60',
  dim: 'border-line bg-panel/90 opacity-40',
}

interface QuestionCardProps {
  question: Question
  picked: number | null
  onPick: (index: number) => void
}

export function QuestionCard({ question, picked, onPick }: QuestionCardProps) {
  const { word, direction, options, answerIndex } = question
  const revealed = picked !== null
  const showWord = direction === 'en2zh' || revealed

  return (
    <div className="w-full">
      <div className="min-h-28 text-center">
        {direction === 'zh2en' && <p className="text-lg leading-relaxed">{word.m}</p>}
        {showWord && (
          <>
            <div className="mt-2 flex items-center justify-center gap-2">
              <h2 className="font-display text-4xl font-bold tracking-wide">{word.w}</h2>
              <SpeakButton text={word.w} />
            </div>
            {word.p && <p className="mt-1 text-sm text-muted">/{word.p}/</p>}
          </>
        )}
      </div>
      <ol className="mt-6 grid gap-2">
        {options.map((option, i) => {
          const state: OptionState = !revealed ? 'idle' : i === answerIndex ? 'right' : i === picked ? 'wrong' : 'dim'
          return (
            <li key={option.w}>
              <button
                type="button"
                disabled={revealed}
                onClick={() => onPick(i)}
                className={`w-full border px-4 py-3 text-left text-sm transition-colors ${OPTION_CLASS[state]}`}
              >
                <span className="mr-3 font-display text-muted">{i + 1}</span>
                {direction === 'en2zh' ? option.m : option.w}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
```

- [ ] **Step 6: 创建 `src/trial/components/GradeBar.tsx`**

```tsx
import { motion } from 'motion/react'
import type { Grade } from '../srs'

interface GradeBarProps {
  timeoutMs: number
  onGrade: (grade: Grade) => void
}

export function GradeBar({ timeoutMs, onGrade }: GradeBarProps) {
  return (
    <div className="mt-6">
      <div className="h-0.5 w-full bg-line">
        <motion.div
          className="h-full bg-accent-hi"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: timeoutMs / 1000, ease: 'linear' }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onGrade('ok')} className="border border-line bg-panel/90 py-3">
          还行
        </button>
        <button type="button" onClick={() => onGrade('good')} className="border border-accent-hi bg-accent/30 py-3 font-bold">
          会了
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: 创建 `src/trial/components/ResultPanel.tsx`**

```tsx
import { Link } from 'react-router'
import type { DaySession } from '../../progress/store'

function formatLap(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

interface ResultPanelProps {
  session: DaySession
  dueTomorrow: number
  mastered: number
}

export function ResultPanel({ session, dueTomorrow, mastered }: ResultPanelProps) {
  const total = session.items.length
  if (total === 0) {
    return <p className="mt-10 text-center text-sm text-muted">今天没有要练的词，明天再来。</p>
  }

  const newCount = session.items.filter((item) => item.kind === 'new').length
  const stats = [
    { label: '圈速', value: formatLap((session.finishedAt ?? session.startedAt) - session.startedAt) },
    { label: '正确率', value: `${Math.round((session.correct / total) * 100)}%` },
    { label: '最高连击', value: `×${session.bestCombo}` },
    { label: '新词 / 复习', value: `${newCount} / ${total - newCount}` },
    { label: '已掌握', value: String(mastered) },
    { label: '明天到期', value: String(dueTomorrow) },
  ]

  return (
    <section className="mt-6">
      <p className="text-center font-display text-xs tracking-[0.35em] text-accent-hi">LAP COMPLETE</p>
      <dl className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-line bg-panel/90 px-4 py-3">
            <dt className="text-xs text-muted">{stat.label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <Link to="/" className="mt-6 block border border-accent-hi bg-accent/20 py-3 text-center">
        回车库
      </Link>
    </section>
  )
}
```

- [ ] **Step 8: 创建 `src/trial/components/Effects.tsx` 和 `LoadError.tsx`**

`src/trial/components/Effects.tsx`:

```tsx
import { motion, useReducedMotion } from 'motion/react'

const STREAKS = [0, 1, 2, 3, 4, 5]

export function TrackStreak() {
  const reduced = useReducedMotion()
  if (reduced) return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {STREAKS.map((i) => (
        <motion.span
          key={i}
          className="absolute h-px w-1/3 bg-accent-hi"
          style={{ top: `${22 + i * 11}%` }}
          initial={{ x: '120vw', opacity: 0.9 }}
          animate={{ x: '-60vw', opacity: 0 }}
          transition={{ duration: 0.45, delay: i * 0.04, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}

export function NitroFlash() {
  const reduced = useReducedMotion()
  if (reduced) return null
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(193, 39, 45, 0.45), transparent 60%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 0.9 }}
    />
  )
}
```

`src/trial/components/LoadError.tsx`:

```tsx
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-10 text-center">
      <p className="text-sm">词库加载失败</p>
      <button type="button" onClick={onRetry} className="mt-4 border border-accent-hi px-6 py-2 text-sm">
        重试
      </button>
    </div>
  )
}
```

- [ ] **Step 9: 创建 `src/trial/TrialScreen.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProgress } from '../progress/ProgressProvider'
import { addDays, studyDay } from './day'
import { currentItem, dueOn, ensureSession, isFinished, masteredCount, recordAnswer } from './engine'
import { buildQuestion } from './question'
import type { Grade } from './srs'
import type { ResolvedWord, WordSource } from './wordsRepo'
import { NitroFlash, TrackStreak } from './components/Effects'
import { Gauge } from './components/Gauge'
import { GradeBar } from './components/GradeBar'
import { LoadError } from './components/LoadError'
import { QuestionCard } from './components/QuestionCard'
import { ResultPanel } from './components/ResultPanel'

export const WRONG_DELAY_MS = 1500
export const GRADE_TIMEOUT_MS = 4000
export const NITRO_COMBOS = [5, 10]

interface TrialScreenProps {
  source: WordSource
  now?: () => Date
}

export function TrialScreen({ source, now = () => new Date() }: TrialScreenProps) {
  const { data, update } = useProgress()
  const [today] = useState(() => studyDay(now()))
  const [resolved, setResolved] = useState<Map<string, ResolvedWord> | null>(null)
  const [lookupFailed, setLookupFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const committedCursor = useRef(-1)

  useEffect(() => {
    update((d) => ensureSession(d, today, source.order, Date.now()))
  }, [update, today, source])

  const session = data.session?.day === today ? data.session : undefined
  const items = session?.items
  const words = useMemo(() => items?.map((item) => item.word) ?? [], [items])

  useEffect(() => {
    if (words.length === 0) return
    let alive = true
    source.lookup(words).then(
      (map) => {
        if (!alive) return
        setResolved(map)
        setLookupFailed(false)
      },
      () => alive && setLookupFailed(true),
    )
    return () => {
      alive = false
    }
  }, [source, words, attempt])

  const item = currentItem(session)
  const cursor = session?.cursor ?? 0
  const question = useMemo(() => {
    const entry = item && resolved?.get(item.word)
    return item && entry ? buildQuestion(entry.word, item.kind, entry.pool, Math.random) : null
  }, [item, resolved])

  const correct = picked !== null && question !== null && picked === question.answerIndex

  const commit = useCallback(
    (grade: Grade) => {
      if (committedCursor.current === cursor) return
      committedCursor.current = cursor
      update((d) => recordAnswer(d, grade, Date.now()))
      setPicked(null)
    },
    [cursor, update],
  )

  useEffect(() => {
    if (picked === null) return
    const timer = setTimeout(() => commit(correct ? 'ok' : 'again'), correct ? GRADE_TIMEOUT_MS : WRONG_DELAY_MS)
    return () => clearTimeout(timer)
  }, [picked, correct, commit])

  useEffect(() => {
    if (!question || picked !== null) return
    const onKey = (event: KeyboardEvent) => {
      const n = Number(event.key)
      if (Number.isInteger(n) && n >= 1 && n <= question.options.length) setPicked(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [question, picked])

  if (lookupFailed) {
    return (
      <LoadError
        onRetry={() => {
          setLookupFailed(false)
          setAttempt((n) => n + 1)
        }}
      />
    )
  }
  if (!session) return <p className="text-center text-sm text-muted">正在进站…</p>
  if (isFinished(session)) {
    return (
      <ResultPanel session={session} dueTomorrow={dueOn(data.words, addDays(today, 1))} mastered={masteredCount(data.words)} />
    )
  }
  if (!question) return <p className="text-center text-sm text-muted">正在加载词库…</p>

  const nextCombo = session.combo + 1
  return (
    <section className="flex flex-col items-center">
      {correct && <TrackStreak key={`streak-${cursor}`} />}
      {correct && NITRO_COMBOS.includes(nextCombo) && <NitroFlash key={`nitro-${cursor}`} />}
      <Gauge value={cursor} total={session.items.length} combo={correct ? nextCombo : session.combo} boost={correct} />
      <div className="mt-6 w-full">
        <QuestionCard question={question} picked={picked} onPick={setPicked} />
        {correct && <GradeBar timeoutMs={GRADE_TIMEOUT_MS} onGrade={commit} />}
      </div>
    </section>
  )
}
```

- [ ] **Step 10: 替换 `src/pages/TrialPage.tsx`**

```tsx
import { LoadError } from '../trial/components/LoadError'
import { TrialScreen } from '../trial/TrialScreen'
import { useWordSource } from '../trial/useWordSource'

export function TrialPage() {
  const { state, retry } = useWordSource()
  if (state.status === 'loading') return <p className="text-center text-sm text-muted">正在加载词库…</p>
  if (state.status === 'error') return <LoadError onRetry={retry} />
  return <TrialScreen source={state.source} />
}
```

- [ ] **Step 11: 运行测试，确认通过**

Run: `npx vitest run src/trial/TrialScreen.test.tsx`
Expected: PASS（5 个测试）。

- [ ] **Step 12: 全量测试、构建、手动试跑**

```powershell
npm test
npm run build
npm run dev
```

Expected: 测试全部通过，构建成功。在手机尺寸下打开 `/trial`：转速表、单词、四个选项；答对时出现赛道光线和「还行 / 会了」倒计时条，答错时正确项亮起、1.5 秒后跳题；连续答对 5 题时有一次红色闪光；跑完 20 题看到结算。按 `Ctrl+C` 停止。

- [ ] **Step 13: Commit**

```powershell
git add -A
git commit -m "feat(trial): dashboard quiz with grading, combo effects and lap summary"
```

---

### Task 11: 设置页：导出和导入进度

**Files:**
- Modify: `src/pages/SettingsPage.tsx`（替换 Task 9 的临时内容）
- Create: `src/pages/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `useProgress`（Task 9）；`parseProgress`、`serializeProgress`、`ProgressData`（Task 5）；`studyDay`（Task 2）
- Produces: 无（叶子页面）

- [ ] **Step 1: 写失败的测试 `src/pages/SettingsPage.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ProgressProvider } from '../progress/ProgressProvider'
import { emptyProgress, STORAGE_KEY } from '../progress/store'
import { SettingsPage } from './SettingsPage'

function renderSettings() {
  render(
    <ProgressProvider>
      <SettingsPage />
    </ProgressProvider>,
  )
  return screen.getByLabelText('导入进度文件')
}

function upload(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { files: [new File([text], 'progress.json', { type: 'application/json' })] } })
}

describe('SettingsPage', () => {
  beforeEach(() => localStorage.clear())

  it('explains why an invalid file is rejected', async () => {
    upload(renderSettings(), 'not json')
    expect(await screen.findByText('文件不是有效的 JSON')).toBeInTheDocument()
  })

  it('previews and imports a valid progress file', async () => {
    const data = {
      ...emptyProgress(),
      words: { alpha: { interval: 7, due: '2026-10-16', lastResult: 'good', seenCount: 1 } },
    }
    upload(renderSettings(), JSON.stringify(data))
    expect(await screen.findByText('文件里有 1 个已学单词，导入会覆盖当前进度。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))
    expect(await screen.findByText('进度已导入')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).words.alpha.interval).toBe(7)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: FAIL，找不到「导入进度文件」标签。

- [ ] **Step 3: 实现 `src/pages/SettingsPage.tsx`**

```tsx
import { useState, type ChangeEvent } from 'react'
import { useProgress } from '../progress/ProgressProvider'
import { parseProgress, serializeProgress, type ProgressData } from '../progress/store'
import { studyDay } from '../trial/day'

export function SettingsPage() {
  const { data, update } = useProgress()
  const [pending, setPending] = useState<ProgressData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function exportProgress() {
    const blob = new Blob([serializeProgress(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `midnight-garage-progress-${studyDay(new Date())}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const result = parseProgress(await file.text())
    setMessage(null)
    if (result.ok) {
      setPending(result.data)
      setError(null)
    } else {
      setPending(null)
      setError(result.reason)
    }
  }

  function confirmImport() {
    if (!pending) return
    update(() => pending)
    setPending(null)
    setMessage('进度已导入')
  }

  const learned = Object.keys(data.words).length

  return (
    <section className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-wide">设置</h1>

      <div className="border border-line bg-panel/90 p-4">
        <h2 className="text-sm font-bold">导出进度</h2>
        <p className="mt-1 text-xs text-muted">当前已学 {learned} 个单词。换设备前先导出，在新设备上导入。</p>
        <button type="button" onClick={exportProgress} className="mt-3 border border-accent-hi bg-accent/20 px-4 py-2 text-sm">
          导出进度文件
        </button>
      </div>

      <div className="border border-line bg-panel/90 p-4">
        <h2 className="text-sm font-bold">导入进度</h2>
        <label className="mt-3 block text-xs text-muted">
          导入进度文件
          <input type="file" accept="application/json,.json" onChange={onFile} className="mt-2 block w-full text-xs" />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-accent-hi">
            {error}
          </p>
        )}
        {pending && (
          <div className="mt-3">
            <p className="text-sm">文件里有 {Object.keys(pending.words).length} 个已学单词，导入会覆盖当前进度。</p>
            <button type="button" onClick={confirmImport} className="mt-3 border border-accent-hi bg-accent/30 px-4 py-2 text-sm">
              确认导入
            </button>
          </div>
        )}
        {message && <p className="mt-3 text-sm">{message}</p>}
      </div>

      <p className="text-xs text-muted">
        词库来自{' '}
        <a href="https://github.com/skywind3000/ECDICT" className="underline">
          ECDICT
        </a>
        （MIT 协议）。
      </p>
    </section>
  )
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: PASS（2 个测试）。

- [ ] **Step 5: 全量测试并提交**

```powershell
npm test
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx
git commit -m "feat(settings): export and import learning progress"
```

Expected: 全部测试通过。

---

### Task 12: GitHub Actions 发布上线

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm test`、`npm run build`（Task 1）
- Produces: 推送 `master` 后自动发布到 `https://krazymud.github.io/`

- [ ] **Step 1: 创建 `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 本地最终验证**

```powershell
npm ci
npm test
npm run build
npm run preview
```

Expected: 测试全部通过；构建成功；打开 preview 地址，直接访问 `/trial` 和 `/settings` 都能显示页面。按 `Ctrl+C` 停止。

- [ ] **Step 3: Commit**

```powershell
git add .github/workflows/deploy.yml
git commit -m "ci: build, test and deploy to GitHub Pages"
```

- [ ] **Step 4: 把 Pages 来源切换到 GitHub Actions（推送前必须完成）**

旧站点目前从 `master` 分支直接发布。如果不先切换，推送后 GitHub 会把源码当静态文件发布，页面会是空白。

在浏览器打开 `https://github.com/Krazymud/Krazymud.github.io/settings/pages`，把 **Build and deployment → Source** 改成 **GitHub Actions**。

Expected: 页面显示 Source 为 GitHub Actions。

- [ ] **Step 5: 推送**

```powershell
git push origin legacy-blog
git push origin master
```

Expected: 两个推送都成功。

- [ ] **Step 6: 确认发布**

打开 `https://github.com/Krazymud/Krazymud.github.io/actions`，等 Deploy 工作流两个作业都变绿。然后在手机上访问 `https://krazymud.github.io/`，再直接访问 `https://krazymud.github.io/trial` 并刷新。

Expected: 首页显示车库和 `HELLO, YOU`；`/trial` 刷新后仍能正常进入试炼（由 `404.html` 兜底）。

- [ ] **Step 7: 个性化**

把 `src/config/site.ts` 里的 `nickname` 改成她的昵称，`togetherSince` 改成你们在一起的日期（格式 `YYYY-MM-DD`），然后：

```powershell
npm test
git add src/config/site.ts
git commit -m "chore: personalize greeting"
git push origin master
```

Expected: 部署完成后首页显示她的昵称和「在一起第 N 天」。

---

## 规格覆盖对照

| 规格章节 | 本计划任务 | 备注 |
|---|---|---|
| 1 完成标准 1、2、3 | Task 9、10、11、12 | 标准 4（保险库）属于计划 2；标准 5 的 3D 降级属于计划 3，本计划没有 3D，所以天然满足 |
| 2 视觉方向（配色、字体） | Task 1、9 | |
| 3.1 仓库和部署 | Task 1、12 | |
| 3.2 技术栈 | Task 1 | React Three Fiber 在计划 3 引入 |
| 3.3 单一 3D 场景 | — | 计划 3；本计划用 `GarageBackdrop` 的 2D 场景按路由切换 |
| 3.4 代码模块 | Task 2–11 | `vault` 模块属于计划 2 |
| 4.1 词库 | Task 7、8 | |
| 4.2 每日选词 | Task 2、3、6 | |
| 4.3 题型和干扰项 | Task 4 | |
| 4.4 答题流程 | Task 10 | |
| 4.5 复习间隔 | Task 2 | |
| 4.6 结算界面 | Task 10 | |
| 4.7 进度存储 | Task 5、9、11 | |
| 5 保险库 | — | 计划 2 |
| 6.1 首页内容 | Task 9 | |
| 6.2 3D、开场、声音 | — | 计划 3 |
| 7 错误处理 | Task 5（损坏/版本）、8 和 10（词包失败重试）、9（无法保存提示）、11（导入拒绝） | 密文和模型相关的错误处理属于计划 2、3 |
| 8 测试 | 各任务的单元测试和手动验收步骤 | |
