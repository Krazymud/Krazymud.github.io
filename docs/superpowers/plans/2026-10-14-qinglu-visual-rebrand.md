# 青庐视觉重塑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将站点从 Midnight Garage 深夜 3D 车库，重塑为「青庐」：暖纸 + 墨色 liquid glass、石墨素描 RX-7 FC 预烘焙翻灯循环、全站新文案与新音效。

**Architecture:** 先落设计 token 与文案常量（全站可测），再把首页 `SceneHost` 的 garage 路径换成轻量 `SketchStage`（预烘焙 WebP + reduced-motion 静帧），同时替换 `SoundName` 与调用点；最后扫掉旧品牌字符串、改装入口与点火演出，并回归日课/锦匣行为。

**Tech Stack:** React 19、Vite、Tailwind v4（`src/index.css` `@theme`）、Vitest + Testing Library、现有 `src/audio/sound.ts` Web Audio 封装。

**Spec:** `docs/superpowers/specs/2026-10-14-qinglu-visual-rebrand-design.md`

## Global Constraints

- 用户可见文案：站名「青庐」；导航「日课 / 锦匣 / 案头」；问候眉题「又见」、主标题「{nickname}，安」、天数「相伴第 N 天」；锦匣开匣「启封」。
- 禁止用户可见：`Midnight Garage`、`MIDNIGHT GARAGE`、`PRIVATE VAULT`、`WELCOME BACK`、`HELLO,`、旧「试炼 / 保险库 / 设置」导航名、START/点火口吻。
- 色：暖纸底 `#f7f4ec`–`#faf9f6`；墨色强调近黑；删除红/金双 `data-theme='vault'` accent 体系。
- 首页 garage：**不**再请求 `.glb` / 车库 PBR；预烘焙循环进站自动播；`prefers-reduced-motion: reduce` → 静帧。
- 音效：不用 `ignition` / `rev` / `blip` / `unlock` 文件与语义；改用 `tap` / `confirm` / `unseal`。
- 路由 path 保持 `/` `/trial` `/vault` `/settings`；`localStorage` 的 `midnight-garage/*` key **暂不迁移**（实现注释说明，UI 不暴露旧站名）。
- 每任务结束：相关 vitest 通过后 `git commit`；全量门禁 `npx vitest run` 与 `npx tsc -b`。

## File map

| 路径 | 职责 |
|------|------|
| `src/index.css` | 纸色/墨色 token、玻璃工具类、去掉 Rajdhani/vault 金主题 |
| `src/config/copy.ts`（新建） | 站名、导航、问候、锦匣等用户可见文案常量 |
| `src/app/Layout.tsx` | 顶栏青庐、导航、玻璃壳、去掉 vault theme / 旧 intro |
| `src/pages/HomePage.tsx` | 问候、日课 CTA、锦匣入口、去掉改装 |
| `src/scene/SketchStage.tsx`（新建） | 预烘焙循环 / 静帧 |
| `src/scene/SceneHost.tsx` | garage（及非 track）走 SketchStage，不再 lazy 3D Stage |
| `public/sketch/fc-loop.webp`、`fc-still.webp` | 占位后换成正式成片 |
| `src/audio/sound.ts` + `public/audio/*.mp3` | 新 SoundName 与文件 |
| `src/vault/**`、`src/pages/SettingsPage.tsx`、trial UI | 文案与玻璃皮肤 |
| `index.html` | title / theme-color |
| `src/intro/*` | 删除或改为无引擎的轻量入场 |

试炼页若仍挂 `track` 3D：本计划 **允许暂时保留** track 的 WebGL（非首页）；garage/vault 背景必须非 3D。后续可另开计划去 track 3D。

---

### Task 1: 文案常量 + 设计 token

**Files:**
- Create: `src/config/copy.ts`
- Create: `src/config/copy.test.ts`
- Modify: `src/index.css`
- Modify: `index.html`

**Interfaces:**
- Produces: `export const copy = { siteName, nav: { home, trial, vault, settings }, home: { eyebrow, hello(nickname), together(n) }, vault: { title, opening, empty, broken, unseal, unsealing }, … }`

- [ ] **Step 1: 写失败测试（文案）**

```ts
// src/config/copy.test.ts
import { describe, expect, it } from 'vitest'
import { copy } from './copy'

describe('copy', () => {
  it('exposes 青庐 naming and greetings', () => {
    expect(copy.siteName).toBe('青庐')
    expect(copy.nav).toEqual({ home: '青庐', trial: '日课', vault: '锦匣', settings: '案头' })
    expect(copy.home.eyebrow).toBe('又见')
    expect(copy.home.hello('婉婉儿')).toBe('婉婉儿，安')
    expect(copy.home.together(3)).toBe('相伴第 3 天')
    expect(copy.vault.unseal).toBe('启封')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/config/copy.test.ts`  
Expected: FAIL cannot find module `./copy`

- [ ] **Step 3: 实现 `copy.ts` + token CSS + `index.html`**

`src/config/copy.ts` 导出上表全部字符串（含锦匣空态「锦匣还是空的。」「锦匣暂时打不开」「正在打开锦匣…」、进度提示里的「案头」）。

`src/index.css`：
- 去掉 `@import '@fontsource/rajdhani/…'`
- `--color-ink: #f7f4ec`（纸色底）、`--color-panel: rgba(255,255,255,0.55)`、`--color-line: #d8d2c4`、`--color-fg: #1a1a1a`、`--color-muted: #6e6e73`
- `--accent` / `--accent-hi` 改为近黑墨色（如 `#1a1a1a` / `#2c2c2c`）
- 删除 `[data-theme='vault']` 金主题块
- `--font-display` 改为 `"Songti SC", "STSong", "Noto Serif SC", ui-serif, serif`
- 增加工具类示例（供后续使用）：

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 8px 28px rgba(20, 20, 20, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px) saturate(1.15);
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
}
```

`index.html`：`<title>青庐</title>`，`theme-color` → `#f7f4ec`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/config/copy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/copy.ts src/config/copy.test.ts src/index.css index.html
git commit -m "feat(qinglu): add copy constants and paper ink tokens"
```

---

### Task 2: Layout 壳 — 青庐导航与玻璃顶栏

**Files:**
- Modify: `src/app/Layout.tsx`
- Modify: `src/app/Layout.test.tsx`
- Modify: `src/app/App.test.tsx`（若断言顶栏旧文案）

**Interfaces:**
- Consumes: `copy` from `src/config/copy.ts`
- Produces: 顶栏展示青庐与日课/锦匣/案头；无 `data-theme='vault'`；无 MIDNIGHT GARAGE

- [ ] **Step 1: 更新 Layout 测试为新文案（先失败）**

将 `Layout.test.tsx` 中「设置」改为「案头」；增加断言顶栏有「青庐」「日课」「锦匣」，没有 `MIDNIGHT GARAGE`。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/app/Layout.test.tsx`  
Expected: FAIL on missing 案头 / 仍见旧文案

- [ ] **Step 3: 改 `Layout.tsx`**

- `NAV` 使用 `copy.nav`（首页 link 可用 `copy.siteName` 或单独「青庐」；若首页与站名重复，首页项 label = `copy.siteName`，其余 trial/vault/settings 用对应字段）。
- 品牌 span：`copy.siteName`，去掉 `tracking-[0.35em]` 全大写英式样式，改宋体 `font-display`。
- 去掉 `data-theme={…}`。
- 保存失败提示：「…建议去「案头」导出进度。」
- header/main 卡片容器加 `glass-panel` 或等价 class；页面 `bg-ink` 此时已是纸色。
- **先保留** Intro/Warmup 挂载（Task 6 再删），避免本任务范围过大。

- [ ] **Step 4: 跑测试**

Run: `npx vitest run src/app/Layout.test.tsx src/app/App.test.tsx`  
Expected: Layout 相关 PASS；App 若仍断言 HELLO 可先 xfail 到 Task 3，或同步改断言。

- [ ] **Step 5: Commit**

```bash
git add src/app/Layout.tsx src/app/Layout.test.tsx src/app/App.test.tsx
git commit -m "feat(qinglu): rebrand layout nav and shell"
```

---

### Task 3: 首页问候、日课 CTA、去掉改装

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomePage.test.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `copy.home`；`play('tap'|'confirm')` 在 Task 5 落地前可暂留 `blip` 并在 Task 5 替换
- Produces: 无 ModsPanel；问候为又见 / {nickname}，安 / 相伴第 N 天

- [ ] **Step 1: 改首页测试断言**

断言 `又见`、`婉婉儿，安`（或 `site.nickname`）、`今日日课`、`锦匣` link；不出现 `改装`、`WELCOME BACK`、`HELLO`、`今日试炼`。

- [ ] **Step 2: 跑测确认失败**

Run: `npx vitest run src/pages/HomePage.test.tsx src/app/App.test.tsx`

- [ ] **Step 3: 改 `HomePage.tsx`**

```tsx
<p className="font-display text-sm text-muted">{copy.home.eyebrow}</p>
<h1 className="mt-2 font-display text-4xl font-bold tracking-wide text-fg">
  {copy.home.hello(site.nickname)}
</h1>
{together !== null && (
  <p className="mt-3 text-sm text-muted">{copy.home.together(together)}</p>
)}
```

CTA：`今日日课` / `今日日课 · 到期 N`；次入口「锦匣」；删除 `modding` / `ModsPanel` / `sceneLive` 改装按钮及相关 import。主按钮用 `glass-panel` + 墨色边。

- [ ] **Step 4: 跑测 PASS → Commit**

```bash
git add src/pages/HomePage.tsx src/pages/HomePage.test.tsx src/app/App.test.tsx
git commit -m "feat(qinglu): home greetings and remove mods entry"
```

---

### Task 4: SketchStage 替换 garage 3D 主路径

**Files:**
- Create: `src/scene/SketchStage.tsx`
- Create: `src/scene/SketchStage.test.tsx`
- Create: `public/sketch/fc-still.svg`（占位静帧）
- Create: `public/sketch/fc-loop.webp` **或** 占位阶段用同一 SVG + CSS/`<img>`（若暂无 webp，循环可用 `fc-still.svg` 双份，并在注释标明成片替换点）
- Modify: `src/scene/SceneHost.tsx`
- Modify: `src/scene/SceneHost.test.tsx`
- Modify: early-fetch / `index.html` 注入（若有 3D prefetch：garage 不再 prefetch glb）— 查 `src/scene/stageAssets.ts` 与构建入口

**Interfaces:**
- Produces: `export function SketchStage()` — 固定定位背景层；`matchMedia('(prefers-reduced-motion: reduce)')` 时只渲染静帧 `<img>`，否则渲染循环（`<img>` animated webp 或 `<video muted loop autoPlay playsInline>`）
- SceneHost：当 `scene === 'garage' || scene === 'vault'` 时渲染 SketchStage（vault 可用同一纸色静帧），**不**调用 `loadStage`；`scene === 'track'` 可暂留旧 3D 逻辑

- [ ] **Step 1: SketchStage 测试**

```tsx
it('shows a static frame when reduced motion is preferred', () => {
  // stub matchMedia reduce
  render(<SketchStage />)
  expect(screen.getByRole('img', { name: /青庐|素描|车库/ })).toHaveAttribute('src', expect.stringContaining('fc-still'))
})
```

- [ ] **Step 2: 实现占位资产 + SketchStage + SceneHost 分支**

占位 SVG：浅纸底 + 简化 FC 侧影即可（正式成片后覆盖 `public/sketch/*`）。

SceneHost 测试：garage + webgl2 true 时 **不再** 加载 Stage mock；断言无 3D canvas / loadStage 未被调用。

关闭或改写 `earlyFetchScript` 对 car.glb 的首页预取（避免首屏仍拉 glb）。

- [ ] **Step 3: 跑 `npx vitest run src/scene/SketchStage.test.tsx src/scene/SceneHost.test.tsx`**

- [ ] **Step 4: Commit**

```bash
git add src/scene/SketchStage.tsx src/scene/SketchStage.test.tsx src/scene/SceneHost.tsx src/scene/SceneHost.test.tsx public/sketch index.html
# 若改了 stageAssets / 构建注入一并 add
git commit -m "feat(qinglu): sketch backdrop replaces garage 3D host"
```

---

### Task 5: 音效换新

**Files:**
- Modify: `src/audio/sound.ts`
- Modify: `src/audio/sound.test.ts`
- Create: `public/audio/tap.mp3`, `confirm.mp3`, `unseal.mp3`（可用 ffmpeg 生成短正弦；见下）
- Delete or stop shipping: 不再被引用的 `ignition.mp3` `rev.mp3` `blip.mp3` `unlock.mp3`（删除文件并改测试）
- Modify call sites: `HomePage.tsx`, `UnlockPanel.tsx`, `VaultScreen.tsx`, trial 内 `play('…')` 等

**Interfaces:**
- Produces: `export type SoundName = 'tap' | 'confirm' | 'unseal'`
- Mapping: 导航/轻点 → `tap`；日课提交/主 CTA → `confirm`；锦匣成功打开 → `unseal`；**禁止**再 `play('ignition'|'rev')`

- [ ] **Step 1: 生成占位 mp3（实现时执行）**

```bash
ffmpeg -f lavfi -i "sine=frequency=880:duration=0.06" -y public/audio/tap.mp3
ffmpeg -f lavfi -i "sine=frequency=660:duration=0.09" -y public/audio/confirm.mp3
ffmpeg -f lavfi -i "sine=frequency=520:duration=0.12" -y public/audio/unseal.mp3
```

（无 ffmpeg 时用任意极短合法 mp3 占位，正式再换纸木采样。）

- [ ] **Step 2: 更新 sound 测试与实现枚举**

`SOUND_NAMES` 与 `soundUrl` 期望路径改为新文件；删除 ignition 相关用例。

- [ ] **Step 3: 替换所有 `play('…')` 调用并修 VaultScreen/Home 测试中的 sounds 断言**

UnlockPanel：去掉 `play('ignition')`；提交中用 `tap` 或静音等待；成功开匣 `unseal`。按钮文案改「启封」（可与 Task 7 合并，若本任务已改 UnlockPanel 文案则一并提交）。

- [ ] **Step 4: `npx vitest run src/audio src/vault/VaultScreen.test.tsx src/pages/HomePage.test.tsx`**

- [ ] **Step 5: Commit**

```bash
git add src/audio public/audio src/vault src/pages src/trial
git commit -m "feat(qinglu): replace garage SFX with light feedback tones"
```

---

### Task 6: 去掉点火 Intro / Warmup 引擎演出

**Files:**
- Modify: `src/app/Layout.tsx` — 移除 `Intro`/`Warmup`/`opening`/`setIgnitionPending` 相关状态与渲染；首页直接可交互
- Modify: `src/app/App.test.tsx` — 删除「ignition intro on first visit」类用例，改为「首访首页可见问候与素描层」
- Delete: `src/intro/Intro.tsx`、`Warmup.tsx`、`Tachometer.tsx` 及其测试（若无其它引用）

**Produces:** 首次访问首页直接可见素描循环 + UI；不播放旧点火流程。

- [ ] 更新 App 测试为新首访行为  
- [ ] 从 Layout 拆除 intro 并删除 intro 源文件与测试  
- [ ] Run: `npx vitest run src/app src/intro` — intro 目录应已无测试或目录删除  
- [ ] Commit  

```bash
git add src/app src/intro
git commit -m "feat(qinglu): drop engine ignition intro"
```

---

### Task 7: 锦匣与案头文案 + 玻璃皮肤

**Files:**
- Modify: `src/vault/VaultScreen.tsx`, `UnlockPanel.tsx`, `VaultContent.tsx`, `routes.tsx` fallback
- Modify: `src/pages/SettingsPage.tsx` + tests
- Modify: vault 相关测试中的「保险库」「PRIVATE VAULT」「START」「点火中」

**Produces:** 用户可见均为锦匣/启封/案头；解锁区无英文字标。

- [ ] 批量更新测试字符串 → 改组件用 `copy.*` → 跑 `npx vitest run src/vault src/pages/SettingsPage.test.tsx src/app/routes` → commit  

```bash
git commit -m "feat(qinglu): vault and settings copy as 锦匣 and 案头"
```

---

### Task 8: 日课文案扫尾 + 全站旧品牌禁令测试

**Files:**
- Modify: trial 页面/组件中用户可见「试炼」「赛道」等（改为日课语境，保持玩法不变）
- Create: `src/brand/noLegacyBrand.test.ts`（或 `src/config/noLegacyBrand.test.ts`）

**禁令测试思路：** 对 `src/**/*.{tsx,ts}` 做静态扫描（vitest 内 `fs`+glob），白名单 `copy.ts` 反例与注释/存储 key；失败若出现 `Midnight Garage`、`PRIVATE VAULT`、`WELCOME BACK`、`MIDNIGHT GARAGE`。

- [ ] 实现扫描测试并修掉剩余用户可见违规 → `npx vitest run` → commit  

```bash
git commit -m "feat(qinglu): trial copy and forbid legacy brand strings"
```

---

### Task 9: 全量回归与构建

- [ ] **Step 1:** `npx vitest run` — 全绿  
- [ ] **Step 2:** `npx tsc -b` — 无错误  
- [ ] **Step 3:** `npm run build` — 成功；抽查 `dist` 无 `car.glb` 被首页 chunk 强制预取（track 例外可接受）  
- [ ] **Step 4:** Commit 若仅有修复：`chore(qinglu): fix regressions from rebrand`  
- [ ] **Step 5:** 在 PR 说明：正式石墨成片替换 `public/sketch/fc-loop.webp` 与 `fc-still.webp`；正式音效替换 `public/audio/{tap,confirm,unseal}.mp3`

---

## Spec coverage checklist

| Spec 项 | Task |
|---------|------|
| 预烘焙 FC + 自动循环 + reduced-motion 静帧 | 4 |
| 去掉 garage 3D/转盘主路径 | 4, 6 |
| 暖纸 + 墨色 + glass 全站 | 1, 2, 7 |
| 青庐 / 日课 / 锦匣 / 案头 | 1, 2, 3, 7, 8 |
| 又见 / 安 / 相伴 | 3 |
| 去 Midnight Garage 文案 | 2, 6, 7, 8 |
| 音效全换 | 5 |
| 去改装入口 | 3 |
| 去点火演出 | 6 |
| 锦匣行为不变 | 7 + 9 回归 |

## 占位 vs 成片

实现可用 SVG/短音频占位打通；合并前用交付的石墨循环与纸木音效覆盖同名路径，无需改代码接口。
