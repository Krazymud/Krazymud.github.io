# 保险库金色轮廓光 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保险库镜头加一圈克制的金色轮廓光（金色背光聚光灯 + 金色环境光板），其余镜头不变。

**Architecture:** `Pose` 增加 `rim` 强度系数（只有保险库为 1）。`Studio` 新增两个金色光源，每帧把当前系数朝 `pose.rim` 用 `TRANSITION_LAMBDA` 阻尼逼近；静帧模式直接取目标值，环境光板首次渲染即按 `pose.rim` 设好亮度。改完重新生成静帧。

**Tech Stack:** React 19、@react-three/fiber 9.8.1、@react-three/drei 10.7.9（`Environment`、`Lightformer`）、three 0.186.1、Vitest 5。

Spec: `docs/superpowers/specs/2026-10-10-midnight-garage-vault-rim-design.md`

## Global Constraints

- 只改保险库灯光；车库、赛道、设置三个镜头的画面不得变化。
- 不改任何镜头的构图（`camera`、`target`、`framedCamera` 不动）。
- 金色固定为 `#A8894F`，与 `POSES.vault.light` 相同。
- `three`、`@react-three/*` 只能在 `src/scene/three/` 内导入；主包不得引入 `three`。
- 新光源不投影（不开 `castShadow`）。
- 不提交 `assets-src/`；不推送；不在 master 上实施（分支 `feature/vault-rim`）。
- 界面文案用中文；代码注释只写代码本身表达不了的约束。

---

### Task 1: `Pose.rim` 字段

**Files:**
- Modify: `src/scene/poses.ts`
- Test: `src/scene/poses.test.ts`

**Interfaces:**
- Produces: `Pose.rim: number`（0 到 1）；`export const GOLD = '#A8894F'`（从 `poses.ts` 导出，供 `Studio` 使用）。

- [ ] **Step 1: Write the failing test** — 在 `src/scene/poses.test.ts` 的 `describe('POSES', ...)` 里，`'lights the vault in champagne gold ...'` 用例之后加：

```ts
  it('rims only the vault in gold', () => {
    expect(Object.entries(POSES).filter(([, p]) => p.rim > 0).map(([s]) => s)).toEqual(['vault'])
    expect(POSES.vault.rim).toBe(1)
    expect(GOLD).toBe(POSES.vault.light)
  })
```

并把文件顶部导入改为：

```ts
import { CAMERA_FOV, CAR_RADIUS, framedCamera, GOLD, POSES, sceneFor, type Pose } from './poses'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scene/poses.test.ts`
Expected: FAIL（`GOLD` 未导出 / `rim` 为 undefined），`tsc` 层面也会报 `rim` 不存在。

- [ ] **Step 3: Write minimal implementation** — 在 `src/scene/poses.ts`：

`Pose` 接口在 `sweep: boolean` 之后加一行：

```ts
  rim: number
```

把 `const GOLD = '#A8894F'` 改为：

```ts
export const GOLD = '#A8894F'
```

四个姿态各加 `rim`（放在 `sweep` 之后）：`garage` 为 `rim: 0,`，`track` 为 `rim: 0,`，`vault` 为 `rim: 1,`，`settings` 为 `rim: 0,`。

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/scene/poses.test.ts` → PASS
Run: `npx tsc -b` → 无错误（如有其他地方字面量构造 `Pose` 导致报错，给它补上 `rim`；`poses.test.ts` 里的 `{ ...POSES.garage, ... }` 已自动带上）。
Run: `npm test` → 全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/scene/poses.ts src/scene/poses.test.ts
git commit -m "feat(scene): rim strength per pose, gold only in the vault"
```

---

### Task 2: 金色背光与环境光板，调光并重生成静帧

**Files:**
- Modify: `src/scene/three/Studio.tsx`
- Regenerate: `public/stills/vault-portrait.webp`、`public/stills/vault-landscape.webp`

**Interfaces:**
- Consumes: `Pose.rim`、`GOLD`（Task 1）；`dampFactor`、`TRANSITION_LAMBDA`（`src/scene/motion.ts`，已存在）。

- [ ] **Step 1: Implement** — `src/scene/three/Studio.tsx` 改为：

```tsx
import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type Mesh, type MeshBasicMaterial, type SpotLight } from 'three'
import { dampFactor, STILL_SWEEP_X, sweepX, TRANSITION_LAMBDA } from '../motion'
import { GOLD, type Pose } from '../poses'

const RIM_SPOT_INTENSITY = 120
const RIM_PANEL_INTENSITY = 2

interface StudioProps {
  pose: Pose
  deterministic: boolean
}

export function Studio({ pose, deterministic }: StudioProps) {
  const key = useRef<SpotLight>(null)
  const sweep = useRef<Mesh>(null)
  const rimSpot = useRef<SpotLight>(null)
  const rimPanel = useRef<Mesh>(null)
  const rim = useRef(pose.rim)
  const goal = useMemo(() => new Color(), [])

  useFrame(({ clock }, delta) => {
    const k = dampFactor(TRANSITION_LAMBDA, Math.min(delta, 0.1))
    goal.set(pose.light)
    if (key.current) {
      if (deterministic) key.current.color.copy(goal)
      else key.current.color.lerp(goal, k)
    }
    rim.current = deterministic ? pose.rim : rim.current + (pose.rim - rim.current) * k
    if (rimSpot.current) rimSpot.current.intensity = RIM_SPOT_INTENSITY * rim.current
    if (rimPanel.current) {
      rimPanel.current.visible = rim.current > 0.001
      ;(rimPanel.current.material as MeshBasicMaterial).color.set(GOLD).multiplyScalar(RIM_PANEL_INTENSITY * rim.current)
    }
    if (sweep.current) {
      const x = pose.sweep ? (deterministic ? STILL_SWEEP_X : sweepX(clock.elapsedTime)) : null
      sweep.current.visible = x !== null
      if (x !== null) sweep.current.position.x = x
    }
  })

  return (
    <>
      <spotLight ref={key} position={[3, 7, 4]} angle={0.55} penumbra={1} intensity={150} decay={2} color={pose.light} />
      <spotLight ref={rimSpot} position={[0, 4.5, 5.5]} angle={0.6} penumbra={1} intensity={RIM_SPOT_INTENSITY * pose.rim} decay={2} color={GOLD} />
      <Environment frames={deterministic ? 1 : Infinity} resolution={128}>
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 1.2, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 6, -3]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 0.6, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 6, 3]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 0.6, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[-8, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[8, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 2.5, -8]} rotation={[0, 0, 0]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 2.5, 8]} rotation={[0, Math.PI, 0]} scale={[10, 3, 1]} />
        <Lightformer ref={sweep} form="rect" intensity={4} color="#C1272D" visible={pose.sweep} position={[deterministic ? STILL_SWEEP_X : (sweepX(0) ?? 0), 4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.8, 14, 1]} />
        <Lightformer ref={rimPanel} form="rect" intensity={RIM_PANEL_INTENSITY * pose.rim} color={GOLD} visible={pose.rim > 0} position={[0, 4, 6]} target={[0, 0.6, 0]} scale={[6, 1.5, 1]} />
      </Environment>
    </>
  )
}
```

现有 8 个 `Lightformer` 与当前文件一字不差，只在 sweep 之后追加 `rimPanel`。`rimPanel` 不传 `rotation`，靠 `target` 自动朝向车身中心。

- [ ] **Step 2: Typecheck and tests**

Run: `npx tsc -b` → 无错误
Run: `npm test` → 全部通过

- [ ] **Step 3: Browser check & tune（由控制者在浏览器中执行，实施者只需报告“待控制者调光”）**

开发服务器 `http://localhost:5173/vault`：车顶、尾翼和车尾边缘应有清晰但克制的金色亮线，车身反射里有一条金色光带；不压过主光，车身不整体变金。若过强/过弱，只调整 `RIM_SPOT_INTENSITY`、`RIM_PANEL_INTENSITY` 两个常量（必要时微调两个光源的 `position`）。切到 `/` 和 `/trial`：金光约 1 秒淡出，画面与改动前一致。

- [ ] **Step 4: Regenerate stills**

Run: `npm run stills`
Expected: 成功；`git status --short public/stills` 只显示两张 `vault-*.webp` 有变化。若车库或赛道静帧也变了，停下并报告。

- [ ] **Step 5: Commit**

```bash
git add src/scene/three/Studio.tsx public/stills/vault-portrait.webp public/stills/vault-landscape.webp
git commit -m "feat(scene): gold rim light in the vault"
```

---

### Task 3: 最终验证

- [ ] `npm test`、`npx tsc -b`、`npm run build` 全部通过。
- [ ] `dist/assets/index-*.js` 中不含 `three` 的 `WebGLRenderer`（主包未引入 three），gzip 仍小于 200 KB。
- [ ] 查看两张新的保险库静帧（转 PNG 后看图）：金色轮廓可见、车完整在画面内、无黑块。
