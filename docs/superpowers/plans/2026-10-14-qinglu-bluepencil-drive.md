# 青庐蓝铅笔疾驰背景 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全站夜稿皮肤 + 蓝铅笔 FC 东京疾驰循环背景（首页播 8–12s 环，非首页静帧短淡入淡出）。

**Architecture:** CSS 夜稿 token 替换暖纸主路径；`SceneHost`/`SketchStage` 按路由在「循环视频」与「静帧」间 ≤300ms 交叉淡化；成片以已批关键帧 `docs/superpowers/assets/2026-10-14-qinglu-bluepencil-drive/` 为分镜锚点烘焙后放入 `public/sketch/`。

**Tech Stack:** React 19、Vite、Tailwind v4（`src/index.css`）、Vitest + Testing Library、`<video>` + WebP still、ffmpeg（成片封装）。

**Spec:** `docs/superpowers/specs/2026-10-14-qinglu-bluepencil-drive-design.md`

## Global Constraints

- 画风：蓝/靛线稿、排线局部上色、速度线、浅纸底；车灯全程开启；不抄参考广告题材/商标。
- 环：8–12s；路径 K1→K2 右入弯→K3→K3b→K4→K5≈K1。
- 首页可动播 loop；非首页 ≤300ms 淡出到静帧；回首页静帧 ≤300ms 淡入后再播；reduced-motion 仅静帧。
- 全站夜稿：冷白～浅灰蓝纸底，非暖米黄 `#f1ebdd` 主路径；墨蓝正文；冷白玻璃。
- 首页壳（开敞英雄「青庐」）与内页主栏结构保持 PR #40 行为，只换色与背景媒体。
- 不改日课算法、锦匣加密同步、进度语义；不回 3D。
- 旧 `fc-loop.webp` / `fc-still.webp` 与 drive 成片**同 PR 替换**下线。
- 每任务：相关 vitest 绿后 commit；全量门禁 `npx vitest run` 与 `npx tsc -b`。

## File map

| 路径 | 职责 |
|------|------|
| `src/index.css` | 夜稿 token、冷玻璃、首页渐变改冷纸 |
| `src/scene/SketchStage.tsx` | drive still/video、路由模式、≤300ms 交叉淡化 |
| `src/scene/SketchStage.test.tsx` | loop/still/fade/reduced-motion |
| `src/scene/SceneHost.tsx` | 把「是否首页」传给 SketchStage |
| `public/sketch/fc-drive-still.webp` | 静帧 |
| `public/sketch/fc-drive-loop.webm`（+ `fc-drive-loop.mp4` 可选） | 循环 |
| `public/sketch/fc-still.webp` / `fc-loop.webp` | 删除 |
| `docs/superpowers/assets/2026-10-14-qinglu-bluepencil-drive/*` | 分镜锚点（只读） |
| `scripts/bake-drive-loop.mjs`（新建，可选） | 从关键帧封装/校验成片的辅助脚本 |

---

### Task 1: 夜稿 CSS token

**Files:**
- Modify: `src/index.css`
- Modify: `src/app/App.test.tsx` 或新建 `src/theme/nightSkin.test.ts`（读 `index.css?raw`）
- Modify: `src/scene/SketchStage.tsx` 仅改舞台底色 class/常量若仍写死 `#f1ebdd`（可与 Task 3 合并；本任务至少改 CSS 变量）

**Interfaces:**
- Produces: CSS 变量  
  - `--color-ink: #eef1f5`（冷纸底）  
  - `--color-fg: #1a2433`（深墨蓝黑）  
  - `--color-muted: #5c6570`  
  - `--color-line: #c5ccd6`  
  - `--color-panel: rgba(245, 248, 252, 0.5)`  
  - `--accent: #1a2433`；`--accent-hi: #243044`  
  - `.glass-panel` 背景改为偏冷白 `rgba(245, 248, 252, 0.48)`  
  - `.glass-panel-solid` → `rgba(238, 241, 245, 0.9)`  
  - `.home-hero-fade` 渐变改为 `#eef1f5` 系，去掉暖黄

- [ ] **Step 1: 写失败测试**

```ts
// src/theme/nightSkin.test.ts
import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'

describe('night skin tokens', () => {
  it('uses cool paper ink instead of warm cream as the default page ground', () => {
    expect(css).toMatch(/--color-ink:\s*#eef1f5/)
    expect(css).not.toMatch(/--color-ink:\s*#f7f4ec/)
    expect(css).toMatch(/--color-fg:\s*#1a2433/)
    expect(css).toMatch(/\.home-hero-fade[\s\S]*#eef1f5/)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/theme/nightSkin.test.ts`  
Expected: FAIL（仍是暖纸值）

- [ ] **Step 3: 改 `src/index.css`**

按 Interfaces 写入变量与 glass / `home-hero-fade`。`html, body` 继续用 `var(--color-ink)`。不要加紫霓虹或第二套 `data-theme`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/theme/nightSkin.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/theme/nightSkin.test.ts
git commit -m "style(qinglu): switch default tokens to cool night paper"
```

---

### Task 2: 静帧资产（从 K1）

**Files:**
- Create: `public/sketch/fc-drive-still.webp`
- Create: `scripts/bake-drive-still.mjs`（一次性转换脚本，可保留）

**Interfaces:**
- Produces: `fc-drive-still.webp`，建议 ≤1600px 宽，画质来自 `docs/superpowers/assets/2026-10-14-qinglu-bluepencil-drive/k01-straight.jpg`

- [ ] **Step 1: 用 sharp/ffmpeg 从 K1 生成 webp**

```bash
# 若有 sharp（node）或 ffmpeg：
ffmpeg -y -i docs/superpowers/assets/2026-10-14-qinglu-bluepencil-drive/k01-straight.jpg \
  -vf "scale=1600:-1" -quality 82 public/sketch/fc-drive-still.webp
ls -la public/sketch/fc-drive-still.webp
```

Expected: 文件存在且明显小于原 JPG。

- [ ] **Step 2: Commit**

```bash
git add public/sketch/fc-drive-still.webp scripts/bake-drive-still.mjs
git commit -m "assets(qinglu): add blue-pencil drive still from K1"
```

---

### Task 3: SketchStage 路由感知 + ≤300ms 淡化

**Files:**
- Modify: `src/scene/SketchStage.tsx`
- Modify: `src/scene/SketchStage.test.tsx`
- Modify: `src/scene/SceneHost.tsx`
- Modify: `src/scene/SceneHost.test.tsx`（若有；按现有断言更新）

**Interfaces:**
- Consumes: `useLocation('pathname')` 或 props `playLoop: boolean` from SceneHost  
- Produces:  
  - `export const DRIVE_STILL = \`${base}sketch/fc-drive-still.webp\``  
  - `export const DRIVE_LOOP = \`${base}sketch/fc-drive-loop.webm\``（mp4 回退可选）  
  - `data-motion="loop" | "still"`  
  - `data-route="home" | "inner"`  
  - 交叉淡化时长常量 `export const ROUTE_FADE_MS = 300`

行为：
- `playLoop = pathname === '/' && !reduced` → 显示/播 video loop；否则 still。  
- 在 still↔loop 切换时对两层做 opacity 过渡，时长 300ms。  
- video：`autoPlay muted loop playsInline`；`aria-hidden`。  
- 本任务若 loop 文件尚不存在：video `src` 仍指向约定路径，测试用 stub；或暂时用 still 双层仅测属性（优先：Task 4 先出最小可播 loop，再完成本任务——若顺序对调，本任务可先只接 still + 属性，Task 5 再挂 video）。

**推荐顺序依赖：** Task 4 产出可播 loop 后再把 video 接死；本任务可先实现 still + `playLoop` 分支，video 用空文件占位测试。

- [ ] **Step 1: 写失败测试**

```ts
// SketchStage.test.tsx 增加（需用 MemoryRouter 或 props）
it('stays on still when not on home', () => {
  media(false)
  render(<SketchStage playLoop={false} />)
  expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
  expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-route', 'inner')
  expect(document.querySelector('img')!).toHaveAttribute('src', expect.stringContaining('fc-drive-still'))
})

it('requests the drive loop on home when motion is allowed', () => {
  media(false)
  render(<SketchStage playLoop />)
  expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'loop')
  expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-route', 'home')
  const video = document.querySelector('video')
  expect(video).toBeTruthy()
  expect(video!.getAttribute('src') || video!.querySelector('source')?.getAttribute('src')).toEqual(
    expect.stringContaining('fc-drive-loop'),
  )
})

it('exposes a 300ms route fade constant', async () => {
  const mod = await import('./SketchStage')
  expect(mod.ROUTE_FADE_MS).toBe(300)
})
```

删除/改写仍断言 `fc-still` / `fc-loop` 的旧用例。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/scene/SketchStage.test.tsx`  
Expected: FAIL

- [ ] **Step 3: 实现 SketchStage + SceneHost**

```tsx
// SceneHost.tsx
export function SceneHost({ scene }: SceneHostProps) {
  useEffect(() => { setLoading({ kind: 'still', fraction: 1 }) }, [])
  const playLoop = scene === 'garage' // sceneFor('/') === 'garage'
  return <SketchStage playLoop={playLoop} />
}

// SketchStage.tsx — 结构要点
export const ROUTE_FADE_MS = 300
export const DRIVE_STILL = `${base}sketch/fc-drive-still.webp`
export const DRIVE_LOOP = `${base}sketch/fc-drive-loop.webm`

export function SketchStage({ playLoop }: { playLoop: boolean }) {
  const reduced = usePrefersReducedMotion()
  const wantLoop = playLoop && !reduced
  // 两层：img still 始终挂载；video 在 wantLoop 时挂载
  // 用 CSS transition opacity ROUTE_FADE_MS；data-motion / data-route 如上
  // 舞台底：bg 用夜稿 ink（如 bg-ink），删除 #f1ebdd
}
```

`poses.ts` 已使 `/` → `garage`；勿改路由语义。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/scene`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scene/SketchStage.tsx src/scene/SketchStage.test.tsx src/scene/SceneHost.tsx src/scene/SceneHost.test.tsx
git commit -m "feat(qinglu): route-aware drive stage with 300ms still/loop fade"
```

---

### Task 4: 烘焙 8–12s 循环成片

**Files:**
- Create: `public/sketch/fc-drive-loop.webm`
- Create: `public/sketch/fc-drive-loop.mp4`（H.264 回退，建议同时提供）
- Create: `scripts/bake-drive-loop.mjs`（记录输入关键帧、时长、编码参数）

**Interfaces:**
- Consumes: `docs/superpowers/assets/2026-10-14-qinglu-bluepencil-drive/{k01,k02,k03,k03b,k04,k05}-*.jpg`  
- Produces: 时长 **8–12s**、无缝接环、车灯常亮、蓝铅笔画风；宽度建议 1280–1600

- [ ] **Step 1: 按分镜生成中间帧 / 片段**

以关键帧为锚，生成足够帧率的序列（推荐路径任选其一，写进脚本注释）：
1. **优选：** 用图像生成按 K1→K2→K3→K3b→K4→K5 补段间过渡帧（保持右入弯与绕镜语义），导出 PNG 序列；或  
2. 用 ffmpeg `xfade`/`minterpolate` 在六张关键帧间做时长分配（总 8–12s），再手工检查接环。

时长分配建议（总和 10s 示例）：K1 床 1.5s → 入弯 1.5s → 漂移 2s → 侧面 2s → 出弯 1.5s → 接环 1.5s。

- [ ] **Step 2: 封装 webm/mp4**

```bash
# 示例：从 frames/%04d.png
ffmpeg -y -framerate 24 -i /tmp/drive-frames/%04d.png -c:v libvpx-vp9 -b:v 0 -crf 32 -an public/sketch/fc-drive-loop.webm
ffmpeg -y -framerate 24 -i /tmp/drive-frames/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 23 -an public/sketch/fc-drive-loop.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 public/sketch/fc-drive-loop.webm
```

Expected: duration ∈ [8, 12]。

- [ ] **Step 3: 接环目检**

截取首尾各 1 帧对比 K1/K5；偏差大则重烘。  
`ffmpeg -y -sseof -0.05 -i public/sketch/fc-drive-loop.webm -frames:v 1 /tmp/drive-end.jpg`  
`ffmpeg -y -ss 0 -i public/sketch/fc-drive-loop.webm -frames:v 1 /tmp/drive-start.jpg`

- [ ] **Step 4: Commit**

```bash
git add public/sketch/fc-drive-loop.webm public/sketch/fc-drive-loop.mp4 scripts/bake-drive-loop.mjs
git commit -m "assets(qinglu): bake 8-12s blue-pencil FC drive loop"
```

---

### Task 5: 下线旧石墨翻灯资产 + 全站断言更新

**Files:**
- Delete: `public/sketch/fc-loop.webp`、`public/sketch/fc-still.webp`（若 `fc-up.webp` 仅服务旧环且无引用则一并删）
- Modify: 全库测试/文案中仍写 `fc-loop` / `fc-still` 的引用
- Modify: `src/pages/SettingsPage.tsx` / 测试若提及旧素描占位说明则更新为 drive 夜稿

**Interfaces:**
- Produces: 仓库内无 `fc-loop.webp` / `fc-still.webp` 引用

- [ ] **Step 1: 搜索并改测试**

```bash
rg -n "fc-loop|fc-still|fc-up" src public docs/superpowers/plans || true
```

更新 `SketchStage` 相关断言为 `fc-drive-*`（Task 3 应已完成大部分）。

- [ ] **Step 2: 删除旧文件**

```bash
git rm public/sketch/fc-loop.webp public/sketch/fc-still.webp
# 若确认无引用：
git rm public/sketch/fc-up.webp
```

- [ ] **Step 3: 跑 scene + app 测试**

Run: `npx vitest run src/scene src/app src/pages/HomePage.test.tsx`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A src public
git commit -m "chore(qinglu): retire graphite headlight sketch assets"
```

---

### Task 6: 全量门禁 + 手动核对

**Files:** 无新代码（仅修回归）

- [ ] **Step 1: `npx tsc -b`** — exit 0  
- [ ] **Step 2: `npx vitest run`** — 全绿  
- [ ] **Step 3: 手动**
  - 桌面/窄屏首页：夜稿 + 循环；英雄「青庐」可读  
  - `/trial` `/vault` `/settings`：静帧、冷玻璃可读、≤300ms 过渡  
  - reduced-motion：仅静帧  
  - 接环目检；无篮球/广告商标  
- [ ] **Step 4: 若有修复则 commit**

```bash
git commit -m "test(qinglu): fix regressions from blue-pencil drive stage"
```

---

## Self-review (plan vs spec)

| Spec 要求 | Task |
|-----------|------|
| 夜稿 token / 非 `#f1ebdd` | Task 1 |
| 静帧资产 | Task 2 |
| 首页 loop / 非首页 still / 300ms / reduced-motion | Task 3 |
| 8–12s 环 + 关键帧路径 | Task 4 |
| 旧石墨资产同 PR 下线 | Task 5 |
| 测试 §7 | Tasks 3–6 |
| 不改业务逻辑 | Global Constraints |
| K3b/K4 第一版锚点 | Task 4 输入路径锁定 |
