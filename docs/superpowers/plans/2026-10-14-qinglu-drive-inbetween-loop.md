# 青庐疾驰环中间帧补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用关键帧之间的密集中间帧重烘焙 `fc-drive-loop`，使首页成为连贯疾驰循环而非幻灯渐变。

**Architecture:** 只读已批关键帧；在 `docs/superpowers/assets/2026-10-14-qinglu-drive-inbetweens/` 生成可排序中间帧；`bake-drive-loop.mjs` 改为按清单短持帧+极短 dissolve 输出 `public/sketch/fc-drive-loop.{webm,mp4}`；SketchStage 契约不变。

**Tech Stack:** GenerateImage（参考关键帧+styleboard）、ffmpeg、Node bake 脚本、Vitest、现有 SketchStage。

**Spec:** `docs/superpowers/specs/2026-10-14-qinglu-drive-inbetween-loop-design.md`

## Global Constraints

- 镜头路径：K1→K2 右入弯→K3→K3b→K4→K5≈K1；车灯全程开；蓝铅笔夜稿；不抄广告商标/篮球。
- 关键帧目录 `docs/superpowers/assets/2026-10-14-qinglu-bluepencil-drive/` **只读不改**。
- 环长 8–12s @24fps；同名替换 `fc-drive-loop.webm` / `.mp4`；still / 路由淡化 / reduced-motion 不变。
- 不改日课、锦匣、进度语义；不回 3D。
- 每任务：可验证后 commit；全量门禁 `npx vitest run` 与 `npx tsc -b`。

## File map

| 路径 | 职责 |
|------|------|
| `docs/superpowers/assets/2026-10-14-qinglu-drive-inbetweens/*` | 中间帧 JPEG + `manifest.json` 播放顺序 |
| `scripts/bake-drive-loop.mjs` | 读 manifest/关键帧序列 → webm/mp4 |
| `public/sketch/fc-drive-loop.webm` / `.mp4` | 首页循环成片（替换） |
| `src/scene/SketchStage.*` | 不改契约；仅当路径/测试需断言时长时可选轻触 |

### 中间帧命名（锁定）

```
docs/superpowers/assets/2026-10-14-qinglu-drive-inbetweens/
  manifest.json
  a01.jpg a02.jpg a03.jpg          # K1→K2
  b01.jpg b02.jpg b03.jpg          # K2→K3
  c01.jpg c02.jpg c03.jpg c04.jpg  # K3→K3b
  d01.jpg d02.jpg d03.jpg d04.jpg  # K3b→K4
  e01.jpg e02.jpg e03.jpg          # K4→K5
```

`manifest.json` `frames` 为完整播放序列（含关键帧绝对/相对路径），例如：

```json
{
  "fps": 24,
  "holdFrames": 3,
  "dissolveFrames": 2,
  "frames": [
    "../2026-10-14-qinglu-bluepencil-drive/k01-straight.jpg",
    "a01.jpg", "a02.jpg", "a03.jpg",
    "../2026-10-14-qinglu-bluepencil-drive/k02-entry.jpg",
    "b01.jpg", "b02.jpg", "b03.jpg",
    "../2026-10-14-qinglu-bluepencil-drive/k03-drift.jpg",
    "c01.jpg", "c02.jpg", "c03.jpg", "c04.jpg",
    "../2026-10-14-qinglu-bluepencil-drive/k03b-side.jpg",
    "d01.jpg", "d02.jpg", "d03.jpg", "d04.jpg",
    "../2026-10-14-qinglu-bluepencil-drive/k04-exit.jpg",
    "e01.jpg", "e02.jpg", "e03.jpg",
    "../2026-10-14-qinglu-bluepencil-drive/k05-loop.jpg"
  ]
}
```

---

### Task 1: 清单脚手架 + bake 脚本改读序列

**Files:**
- Create: `docs/superpowers/assets/2026-10-14-qinglu-drive-inbetweens/manifest.json`（先列路径；缺文件时 bake 应清晰失败）
- Modify: `scripts/bake-drive-loop.mjs`
- Optional test: 脚本可用 node 干跑校验 manifest 结构（或在 Task 4 用 ffprobe 验收）

**Interfaces:**
- Produces: bake 脚本读取 `manifest.json`，对 `frames[]` 每张图持 `holdFrames`、相邻 `dissolveFrames` @ `fps`，输出 webm+mp4，时长落入 8–12s（实现时用 hold/dissolve 校准；约 23 姿态 × 3 hold ≈ 与 dissolve 重叠后 ~9–11s）

- [ ] **Step 1: 写 manifest.json**（完整 frames 列表，如上）
- [ ] **Step 2: 改写 bake-drive-loop.mjs** 去掉仅关键帧 xfade；改为 sequence + 短 dissolve
- [ ] **Step 3: 无中间帧文件时跑 bake → 预期非 0 退出且报缺文件**
- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/assets/2026-10-14-qinglu-drive-inbetweens/manifest.json scripts/bake-drive-loop.mjs
git commit -m "build(qinglu): bake drive loop from in-between frame manifest"
```

---

### Task 2: 生成中间帧 A–E

**Files:**
- Create: `a01`–`a03`, `b01`–`b03`, `c01`–`c04`, `d01`–`d04`, `e01`–`e03` under inbetweens dir

**Interfaces:**
- Consumes: 只读关键帧 + `styleboard.jpg`
- Produces: 17 张 JPEG，16:9，蓝铅笔夜稿，车灯开

每张生成：以相邻两端关键帧 + styleboard 为 `reference_image_paths`；描述须写清「中间态百分比」、右入弯方向、开灯、禁止篮球/商标。

- [ ] **Step 1: 生成段 A（K1→K2）a01–a03**
- [ ] **Step 2: 生成段 B（K2→K3）b01–b03**
- [ ] **Step 3: 生成段 C（K3→K3b）c01–c04**
- [ ] **Step 4: 生成段 D（K3b→K4）d01–d04**
- [ ] **Step 5: 生成段 E（K4→K5）e01–e03**
- [ ] **Step 6: 逐段目视验收；失败段重做**
- [ ] **Step 7: Commit 资产**

```bash
git add docs/superpowers/assets/2026-10-14-qinglu-drive-inbetweens/
git commit -m "assets(qinglu): add blue-pencil drive in-between frames"
```

---

### Task 3: 烘焙成片 + 时长校验

**Files:**
- Modify: `public/sketch/fc-drive-loop.webm`, `public/sketch/fc-drive-loop.mp4`

- [ ] **Step 1: `node scripts/bake-drive-loop.mjs`**
- [ ] **Step 2: ffprobe 时长 ∈ [8, 12]**
- [ ] **Step 3: 抽帧目视连贯性与接环**
- [ ] **Step 4: Commit**

```bash
git add public/sketch/fc-drive-loop.webm public/sketch/fc-drive-loop.mp4 scripts/bake-drive-loop.mjs
git commit -m "assets(qinglu): rebake drive loop from dense in-between sequence"
```

---

### Task 4: 全量门禁 + 手测

**Files:** 无新代码（仅修回归）

- [ ] **Step 1: `npx tsc -b`**
- [ ] **Step 2: `npx vitest run`**
- [ ] **Step 3: 手测首页连贯环；inner still；reduced-motion**
- [ ] **Step 4: 若有修复则 commit**

---

## Self-review (plan vs spec)

| Spec 要求 | Task |
|-----------|------|
| 密集中间帧 3–4 / 段 | Task 2 |
| 帧序列烘焙 8–12s | Tasks 1, 3 |
| 关键帧只读 | Global + Task 2 |
| 运行时契约不变 | Task 4 |
| 接环 K5≈K1 | Tasks 2–3 |
