# Midnight Garage 1.4 分档视效 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 3D 场景加电影感调色、车灯光晕、分档镜面地板、景深、环境光遮蔽，并按画质档位分配，手机中档起步、流畅时自动升档。

**Architecture:** 画质档位逻辑留在纯函数模块 `src/scene/frameGuard.ts`（新增起步档位与升档）；新增纯函数模块 `src/scene/fxTiers.ts` 把档位映射成各效果开关；`src/scene/three/` 里的 `Stage`、`Floor`、`PostFx` 读这份开关，新增 `GradeEffect`（自写后期效果）与 `LampGlow`（车灯贴片）。

**Tech Stack:** React 19, TypeScript, three 0.186, @react-three/fiber 9, @react-three/drei, @react-three/postprocessing 3.1 / postprocessing, Vitest (jsdom)。

## Global Constraints

- 设计文档：`docs/superpowers/specs/2026-10-10-midnight-garage-visual-fx-design.md`。
- 在功能分支 `feature/visual-fx` 上实现，不直接改 master；完成后快进合并到 master；推送前必须问用户。
- 不提交 `assets-src/`、`dist/`、`node_modules/`、`.superpowers/`。
- three / R3F / drei / postprocessing 只能在 `src/scene/three/` 里引入。
- 不改镜头构图（`src/scene/poses.ts` 的镜头位置与 `CAMERA_FOV`）。
- 主包 `dist/assets/index-*.js` gzip 不超过 200 KB。
- 不新增依赖（环境光遮蔽实测太重时，先停下来问用户是否加 `n8ao`）。
- 不额外下载文件：调色不用调色表文件，光晕贴图用代码画。
- 编辑源码只用编辑工具，不用 PowerShell `Set-Content`（会破坏 UTF-8 或加 BOM）。
- 命令前先执行 `$env:Path = "C:\Program Files\nodejs;$env:Path"`。
- 代码注释风格沿用现有代码：只写代码本身表达不了的约束，中文。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `src/scene/frameGuard.ts`（改） | 起步档位 `startQuality`、按档位生成初始状态 `guardFrom`、升档规则 |
| `src/scene/fxTiers.ts`（新） | `fxFor(quality)`：档位 → 各效果开关 |
| `src/scene/three/FrameGuard.tsx`（改） | 接收起步档位 |
| `src/scene/three/Stage.tsx`（改） | 起步档位、把开关传给子组件、记录档位到诊断 |
| `src/scene/three/Floor.tsx`（改） | 按开关选反射分辨率或普通材质 |
| `src/scene/three/GradeEffect.ts`（新） | 调色后期效果 |
| `src/scene/three/PostFx.tsx`（改） | 按开关组合调色、景深、环境光遮蔽 |
| `src/scene/three/lamps.ts`（新） | 车灯位置与朝向淡出的纯函数 |
| `src/scene/three/LampGlow.tsx`（新） | 车灯光晕贴片 |
| `src/scene/three/Car.tsx`（改） | 挂上 `LampGlow` |
| `src/perf/perf.ts`、`src/perf/PerfOverlay.tsx`（改） | 显示当前画质、记录升降档 |
| `public/stills/*`（重新生成） | 静态图与新画面一致 |

---

### Task 1：起步档位与升档规则

**Files:**
- Modify: `src/scene/frameGuard.ts`
- Test: `src/scene/frameGuard.test.ts`

**Interfaces:**
- Produces:
  - `GuardState` 增加 `upgradeLocked: boolean`、`highFor: number`
  - `initialGuard: GuardState`（高档，等于 `guardFrom(0)`，保留给现有调用）
  - `guardFrom(quality: Quality): GuardState`
  - `startQuality(coarsePointer: boolean): Quality`（触屏 1，否则 0）
  - `UPGRADE_FPS = 50`、`UPGRADE_AFTER = 5`
  - `guardStep(state, fps, seconds)` 签名不变

- [ ] **Step 1：先切分支**

```powershell
git checkout -b feature/visual-fx
```

- [ ] **Step 2：写失败的测试**

在 `src/scene/frameGuard.test.ts` 的 import 里加上 `guardFrom, startQuality, UPGRADE_AFTER, UPGRADE_FPS`，并在 `describe` 末尾追加：

```ts
  it('starts touch devices at medium quality and the rest at full quality', () => {
    expect(startQuality(true)).toBe(1)
    expect(startQuality(false)).toBe(0)
    expect(guardFrom(1).quality).toBe(1)
    expect(guardFrom(0)).toEqual(initialGuard)
  })

  it('steps up one level after a steady high frame rate', () => {
    const medium = guardFrom(1)
    expect(feed(medium, UPGRADE_FPS, UPGRADE_AFTER - 1).quality).toBe(1)
    const high = feed(medium, UPGRADE_FPS, UPGRADE_AFTER)
    expect(high.quality).toBe(0)
    expect(feed(high, 60, 30).quality).toBe(0)
  })

  it('needs the high frame rate without a break to step up', () => {
    const dip = feed(feed(guardFrom(1), 60, UPGRADE_AFTER - 1), 40, 1)
    expect(feed(dip, 60, UPGRADE_AFTER - 1).quality).toBe(1)
  })

  it('never steps up again once it had to step down after stepping up', () => {
    const high = feed(guardFrom(1), 60, UPGRADE_AFTER)
    const back = feed(high, 20, 3)
    expect(back.quality).toBe(1)
    expect(back.upgradeLocked).toBe(true)
    expect(feed(back, 60, 30).quality).toBe(1)
  })

  it('does not step up from a level it was pushed down to', () => {
    const low = feed(initialGuard, 20, 3)
    expect(feed(low, 60, 30).quality).toBe(1)
  })
```

把现有测试里两处字面量状态补全新字段：

```ts
    const failed: GuardState = { ...guardFrom(2), lowFor: 5, failed: true }
```

```ts
    const slow: GuardState = { ...initialGuard, lowFor: 2 }
```

```ts
    const slow: GuardState = { ...guardFrom(2), lowFor: 2 }
```

- [ ] **Step 3：运行测试确认失败**

Run: `npx vitest run src/scene/frameGuard.test.ts`
Expected: FAIL，`guardFrom` / `startQuality` 不存在。

- [ ] **Step 4：实现**

把 `src/scene/frameGuard.ts` 改成：

```ts
export type Quality = 0 | 1 | 2

export interface GuardState {
  quality: Quality
  lowFor: number
  highFor: number
  failed: boolean
  upgradeLocked: boolean
}

export const MIN_FPS = 24
export const DOWNGRADE_AFTER = 3
export const GIVE_UP_AFTER = 5
export const UPGRADE_FPS = 50
export const UPGRADE_AFTER = 5

export function guardFrom(quality: Quality): GuardState {
  return { quality, lowFor: 0, highFor: 0, failed: false, upgradeLocked: false }
}

export const initialGuard: GuardState = guardFrom(0)

export function startQuality(coarsePointer: boolean): Quality {
  return coarsePointer ? 1 : 0
}

// 降过一次档就不再升档，免得在两档之间来回切换。
export function guardStep(state: GuardState, fps: number, seconds: number): GuardState {
  if (state.failed || !Number.isFinite(fps) || !Number.isFinite(seconds)) return state
  if (fps >= MIN_FPS) {
    if (state.quality === 0 || state.upgradeLocked) {
      return state.lowFor === 0 && state.highFor === 0 ? state : { ...state, lowFor: 0, highFor: 0 }
    }
    const highFor = fps >= UPGRADE_FPS ? state.highFor + seconds : 0
    if (highFor >= UPGRADE_AFTER) return { ...state, quality: (state.quality - 1) as Quality, lowFor: 0, highFor: 0 }
    return { ...state, lowFor: 0, highFor }
  }
  const lowFor = state.lowFor + seconds
  if (state.quality < 2) {
    if (lowFor < DOWNGRADE_AFTER) return { ...state, lowFor, highFor: 0 }
    return { ...state, quality: (state.quality + 1) as Quality, lowFor: 0, highFor: 0, upgradeLocked: true }
  }
  return { ...state, lowFor, highFor: 0, failed: lowFor >= GIVE_UP_AFTER }
}

export function dprFor(quality: Quality): [number, number] {
  return quality === 0 ? [1, 1.5] : [1, 1]
}
```

- [ ] **Step 5：运行测试确认通过**

Run: `npx vitest run src/scene/frameGuard.test.ts`
Expected: PASS（全部用例，包括现有的「keeps full quality at a healthy frame rate」：高档时直接返回原状态）。

- [ ] **Step 6：提交**

```powershell
git add src/scene/frameGuard.ts src/scene/frameGuard.test.ts
git commit -m "feat(scene): start touch devices at medium quality and step up on a steady frame rate"
```

---

### Task 2：档位到效果的映射

**Files:**
- Create: `src/scene/fxTiers.ts`
- Test: `src/scene/fxTiers.test.ts`

**Interfaces:**
- Consumes: `Quality`（Task 1）
- Produces:
  ```ts
  export interface Fx {
    postFx: boolean
    grade: boolean
    lampGlow: boolean
    atmosphere: boolean
    reflection: 512 | 256 | null
    depthOfField: boolean
    ambientOcclusion: boolean
  }
  export function fxFor(quality: Quality): Fx
  ```

- [ ] **Step 1：写失败的测试** `src/scene/fxTiers.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { fxFor } from './fxTiers'

describe('fxFor', () => {
  it('turns everything on at full quality', () => {
    expect(fxFor(0)).toEqual({
      postFx: true,
      grade: true,
      lampGlow: true,
      atmosphere: true,
      reflection: 512,
      depthOfField: true,
      ambientOcclusion: true,
    })
  })

  it('keeps the cheap effects and halves the reflection at medium quality', () => {
    expect(fxFor(1)).toEqual({
      postFx: true,
      grade: true,
      lampGlow: true,
      atmosphere: true,
      reflection: 256,
      depthOfField: false,
      ambientOcclusion: false,
    })
  })

  it('drops every extra pass at low quality', () => {
    expect(fxFor(2)).toEqual({
      postFx: false,
      grade: false,
      lampGlow: false,
      atmosphere: false,
      reflection: null,
      depthOfField: false,
      ambientOcclusion: false,
    })
  })
})
```

- [ ] **Step 2：运行确认失败**

Run: `npx vitest run src/scene/fxTiers.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3：实现** `src/scene/fxTiers.ts`

```ts
import type { Quality } from './frameGuard'

export interface Fx {
  postFx: boolean
  grade: boolean
  lampGlow: boolean
  atmosphere: boolean
  reflection: 512 | 256 | null
  depthOfField: boolean
  ambientOcclusion: boolean
}

export function fxFor(quality: Quality): Fx {
  const high = quality === 0
  const shown = quality < 2
  return {
    postFx: shown,
    grade: shown,
    lampGlow: shown,
    atmosphere: shown,
    reflection: high ? 512 : shown ? 256 : null,
    depthOfField: high,
    ambientOcclusion: high,
  }
}
```

- [ ] **Step 4：运行确认通过**

Run: `npx vitest run src/scene/fxTiers.test.ts`
Expected: PASS

- [ ] **Step 5：提交**

```powershell
git add src/scene/fxTiers.ts src/scene/fxTiers.test.ts
git commit -m "feat(scene): map quality levels to visual effects"
```

---

### Task 3：Stage 起步档位、开关下发、诊断显示档位

**Files:**
- Modify: `src/scene/three/FrameGuard.tsx`
- Modify: `src/scene/three/Stage.tsx`
- Modify: `src/perf/perf.ts`、`src/perf/PerfOverlay.tsx`
- Test: `src/perf/perf.test.ts`（已存在则追加，不存在则新建）

**Interfaces:**
- Consumes: `startQuality`、`guardFrom`（Task 1），`fxFor`、`Fx`（Task 2）
- Produces:
  - `FrameGuard` 新增必填 prop `initial: Quality`
  - `Floor` 新增 prop `reflection: 512 | 256 | null`（Task 4 实现）
  - `PostFx` 新增 prop `fx: Fx`（Task 5 实现）
  - `Car` 新增 prop `lampGlow: boolean`（Task 6 实现）
  - `perf.ts`：`perfState: { quality: string }`、`perfQuality(quality: 0 | 1 | 2, enabled?: boolean): void`

- [ ] **Step 1：写失败的测试**（`src/perf/perf.test.ts`，追加）

```ts
import { perfMarks, perfQuality, perfState } from './perf'

describe('perfQuality', () => {
  it('shows the current quality and marks every change', () => {
    perfQuality(1, true)
    perfQuality(0, true)
    expect(perfState.quality).toBe('高')
    expect(perfMarks.map((mark) => mark.name).filter((name) => name.startsWith('画质'))).toEqual(['画质：中（1）', '画质：高（2）'])
  })
})
```

（如文件已有 `describe`/`expect` 的 import，合并 import 即可。）

- [ ] **Step 2：运行确认失败**

Run: `npx vitest run src/perf/perf.test.ts`
Expected: FAIL，`perfQuality` 不存在。

- [ ] **Step 3：实现 perf**

在 `src/perf/perf.ts` 的 `perfMark` 后追加：

```ts
const QUALITY_NAMES = ['高', '中', '低'] as const

export const perfState = { quality: '' }
let qualityChanges = 0

export function perfQuality(quality: 0 | 1 | 2, enabled = perfEnabled): void {
  if (!enabled) return
  perfState.quality = QUALITY_NAMES[quality]
  qualityChanges += 1
  perfMark(`画质：${perfState.quality}（${qualityChanges}）`, enabled)
}
```

在 `src/perf/PerfOverlay.tsx` 的第一行文字之后加一行：

```tsx
        `画质：${perfState.quality || '—'}`,
```

并把 import 改为 `import { perfMarks, perfState, programTimings } from './perf'`。

- [ ] **Step 4：FrameGuard 接收起步档位**

`src/scene/three/FrameGuard.tsx`：

```tsx
import { guardFrom, guardStep, type Quality } from '../frameGuard'
```

```tsx
interface FrameGuardProps {
  initial: Quality
  onQuality: (quality: Quality) => void
  onGiveUp: () => void
}

export function FrameGuard({ initial, onQuality, onGiveUp }: FrameGuardProps) {
  const [start] = useState(() => guardFrom(initial))
  const state = useRef(start)
```

（`useState` 加进 react 的 import。）

- [ ] **Step 5：Stage 使用起步档位并下发开关**

`src/scene/three/Stage.tsx`：

import 增加：

```tsx
import { perfQuality } from '../../perf/perf'
import { dprFor, startQuality, type Quality } from '../frameGuard'
import { fxFor } from '../fxTiers'
```

（替换原来的 `import { dprFor, type Quality } from '../frameGuard'`，并把 `perfMark` 与 `perfQuality` 合并成一条 import。）

在组件外加：

```tsx
const coarsePointer = () => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
```

把 `const [quality, setQuality] = useState<Quality>(0)` 改为：

```tsx
  const [initialQuality] = useState<Quality>(() => (deterministic ? 0 : startQuality(coarsePointer())))
  const [quality, setQuality] = useState<Quality>(initialQuality)
  const fx = fxFor(quality)
  useEffect(() => perfQuality(quality), [quality])
```

JSX 中：

```tsx
      {fx.atmosphere && <Atmosphere pose={pose} ambience={ambience} deterministic={deterministic} />}
```

```tsx
        <Floor pose={pose} deterministic={deterministic} reflection={fx.reflection} />
```

```tsx
        <Car pose={pose} deterministic={deterministic} lampGlow={fx.lampGlow} />
```

```tsx
      {fx.postFx && <PostFx deterministic={deterministic} fx={fx} />}
      {!deterministic && <FrameGuard initial={initialQuality} onQuality={setQuality} onGiveUp={() => onFail('slow')} />}
```

为了这一步能单独通过类型检查，同时给三个子组件加上新 prop（先不使用）：

- `Floor.tsx`：`interface FloorProps` 加 `reflection: 512 | 256 | null`
- `PostFx.tsx`：签名改为 `PostFx({ deterministic, fx }: { deterministic: boolean; fx: Fx })`，`import type { Fx } from '../fxTiers'`
- `Car.tsx`：`interface CarProps` 加 `lampGlow: boolean`

未使用的解构参数会触发 `noUnusedParameters`，所以这三处先不解构新 prop（只加进类型）。

- [ ] **Step 6：运行测试与类型检查**

Run: `npx vitest run src/perf src/scene` 然后 `npx tsc -b`
Expected: 全部 PASS，tsc 无输出。

- [ ] **Step 7：提交**

```powershell
git add src/perf src/scene/three/FrameGuard.tsx src/scene/three/Stage.tsx src/scene/three/Floor.tsx src/scene/three/PostFx.tsx src/scene/three/Car.tsx
git commit -m "feat(scene): pick effects by quality level and show the level in ?perf"
```

---

### Task 4：镜面地板随档位变化

**Files:**
- Modify: `src/scene/three/Floor.tsx`

**Interfaces:**
- Consumes: `reflection: 512 | 256 | null`（Task 3 已加进 `FloorProps`）

- [ ] **Step 1：实现**

把 `Floor` 的解构改为 `{ pose, deterministic, reflection }`，把反射 mesh 改为：

```tsx
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[200, 200]} />
        {reflection === null ? (
          <meshStandardMaterial
            map={concrete.map}
            roughnessMap={concrete.roughnessMap}
            normalMap={concrete.normalMap}
            normalScale={[0.4, 0.4]}
            color="#2a2a2e"
            metalness={0.2}
            roughness={1}
          />
        ) : (
          <MeshReflectorMaterial
            key={reflection}
            resolution={reflection}
            blur={[300, 80]}
            mixBlur={1}
            mixStrength={0.6}
            metalness={0.2}
            depthScale={0.6}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.2}
            map={concrete.map}
            roughnessMap={concrete.roughnessMap}
            normalMap={concrete.normalMap}
            normalScale={[0.4, 0.4]}
            color="#2a2a2e"
            roughness={1}
          />
        )}
      </mesh>
```

`key={reflection}` 让分辨率变化时重建反射目标（drei 只在创建时读 `resolution`）。

- [ ] **Step 2：类型检查与测试**

Run: `npx tsc -b` 然后 `npx vitest run src/scene`
Expected: 无错误，全部 PASS。

- [ ] **Step 3：浏览器检查**

开发服务器 `http://localhost:5173/`（已在跑；没有就 `npm run dev -- --port 5173 --strictPort`）。在浏览器控制台用 CDP `Emulation.setCPUThrottlingRate`（rate 6）压低帧率，确认 `?perf` 浮层的画质从「高」降到「中」再到「低」，地面倒影先变糊再消失，没有报错。之后恢复 rate 1。

- [ ] **Step 4：提交**

```powershell
git add src/scene/three/Floor.tsx
git commit -m "feat(scene): halve the floor reflection at medium quality and drop it at low quality"
```

---

### Task 5：调色、景深、环境光遮蔽

**Files:**
- Create: `src/scene/three/GradeEffect.ts`
- Test: `src/scene/three/GradeEffect.test.ts`
- Modify: `src/scene/three/PostFx.tsx`

**Interfaces:**
- Consumes: `Fx`（Task 2）
- Produces: `class GradeEffect extends Effect`，构造参数 `GradeOptions = { shadowTint?: [number, number, number]; highlightTint?: [number, number, number]; contrast?: number; saturation?: number }`；导出 `GRADE`（默认参数常量）

- [ ] **Step 1：写失败的测试** `src/scene/three/GradeEffect.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { GRADE, GradeEffect } from './GradeEffect'

describe('GradeEffect', () => {
  it('exposes its look as uniforms so it can be tuned live', () => {
    const effect = new GradeEffect()
    expect(effect.uniforms.get('contrast')?.value).toBe(GRADE.contrast)
    expect(effect.uniforms.get('saturation')?.value).toBe(GRADE.saturation)
    expect(effect.uniforms.get('shadowTint')?.value.toArray()).toEqual(GRADE.shadowTint)
    expect(effect.uniforms.get('highlightTint')?.value.toArray()).toEqual(GRADE.highlightTint)
    effect.dispose()
  })
})
```

- [ ] **Step 2：运行确认失败**

Run: `npx vitest run src/scene/three/GradeEffect.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3：实现** `src/scene/three/GradeEffect.ts`

```ts
import { Effect } from 'postprocessing'
import { Uniform, Vector3 } from 'three'

// 暗部偏冷、高光偏暖，加一点 S 形对比；数值在浏览器里对着画面调。
export const GRADE = {
  shadowTint: [-0.012, 0.0, 0.02] as [number, number, number],
  highlightTint: [0.03, 0.012, -0.015] as [number, number, number],
  contrast: 0.25,
  saturation: 1.05,
}

export type GradeOptions = Partial<typeof GRADE>

const fragmentShader = /* glsl */ `
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float contrast;
uniform float saturation;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = max(inputColor.rgb, 0.0);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, saturation);
  color += shadowTint * (1.0 - smoothstep(0.0, 0.4, luma)) + highlightTint * smoothstep(0.4, 1.0, luma);
  vec3 clamped = clamp(color, 0.0, 1.0);
  color = mix(color, clamped * clamped * (3.0 - 2.0 * clamped), contrast);
  outputColor = vec4(max(color, 0.0), inputColor.a);
}
`

export class GradeEffect extends Effect {
  constructor(options: GradeOptions = {}) {
    const look = { ...GRADE, ...options }
    super('GradeEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ['shadowTint', new Uniform(new Vector3(...look.shadowTint))],
        ['highlightTint', new Uniform(new Vector3(...look.highlightTint))],
        ['contrast', new Uniform(look.contrast)],
        ['saturation', new Uniform(look.saturation)],
      ]),
    })
  }
}
```

- [ ] **Step 4：运行确认通过**

Run: `npx vitest run src/scene/three/GradeEffect.test.ts`
Expected: PASS

- [ ] **Step 5：PostFx 按开关组合**

`src/scene/three/PostFx.tsx` 改成：

```tsx
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, SSAO, Vignette } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { BlendFunction, type ChromaticAberrationEffect } from 'postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import { Vector2, Vector3 } from 'three'
import type { Fx } from '../fxTiers'
import { onNitro } from '../events'
import { nitroOffset } from '../motion'
import { GradeEffect } from './GradeEffect'

const FOCUS = new Vector3(0, 0.6, 0)

export function PostFx({ deterministic, fx }: { deterministic: boolean; fx: Fx }) {
  const aberration = useRef<ChromaticAberrationEffect>(null)
  const nitroAt = useRef(-Infinity)
  const clock = useThree((state) => state.clock)
  const zero = useMemo(() => new Vector2(0, 0), [])
  const grade = useMemo(() => new GradeEffect(), [])
  useEffect(() => () => grade.dispose(), [grade])

  useEffect(
    () =>
      onNitro(() => {
        nitroAt.current = clock.elapsedTime
      }),
    [clock],
  )

  useFrame(({ clock: frameClock }) => {
    const offset = nitroOffset(frameClock.elapsedTime - nitroAt.current)
    aberration.current?.offset.set(offset, offset)
  })

  // EffectComposer 的子效果在挂载时一次性组装，开关变化时用 key 整体重建。
  const layout = `${fx.ambientOcclusion}-${fx.depthOfField}-${fx.grade}`
  return (
    <EffectComposer key={layout} multisampling={4} enableNormalPass={fx.ambientOcclusion}>
      <>{fx.ambientOcclusion && <SSAO samples={16} radius={0.12} intensity={12} luminanceInfluence={0.6} resolutionScale={0.5} />}</>
      <>{fx.depthOfField && <DepthOfField target={FOCUS} focalLength={0.02} bokehScale={2} />}</>
      <Bloom mipmapBlur luminanceThreshold={0.7} intensity={0.7} />
      <>{fx.grade && <primitive object={grade} />}</>
      <ChromaticAberration ref={aberration} offset={zero} radialModulation={false} modulationOffset={0} />
      <Vignette offset={0.3} darkness={0.75} />
      <Noise opacity={deterministic ? 0 : 0.05} blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  )
}
```

如果 `EffectComposer` 的 children 类型不接受 `<>{cond && ...}</>`，改为先构造数组：

```tsx
  const effects = [
    fx.ambientOcclusion && <SSAO key="ao" samples={16} radius={0.12} intensity={12} luminanceInfluence={0.6} resolutionScale={0.5} />,
    fx.depthOfField && <DepthOfField key="dof" target={FOCUS} focalLength={0.02} bokehScale={2} />,
    <Bloom key="bloom" mipmapBlur luminanceThreshold={0.7} intensity={0.7} />,
    fx.grade && <primitive key="grade" object={grade} />,
    <ChromaticAberration key="ca" ref={aberration} offset={zero} radialModulation={false} modulationOffset={0} />,
    <Vignette key="vignette" offset={0.3} darkness={0.75} />,
    <Noise key="noise" opacity={deterministic ? 0 : 0.05} blendFunction={BlendFunction.SOFT_LIGHT} />,
  ].filter((effect) => effect !== false)
```

然后 `<EffectComposer ...>{effects}</EffectComposer>`。

- [ ] **Step 6：类型检查与测试**

Run: `npx tsc -b` 然后 `npx vitest run`
Expected: 无错误，全部 PASS。

- [ ] **Step 7：浏览器检查与调参**

打开 `http://localhost:5173/?perf`（电脑，高档）。逐项核对，必要时只改常量：
- 调色：暗部微冷、高光微暖，不偏色、不发灰。调 `GRADE`。
- 景深：整辆车清晰，背景墙与远处地面微虚。车糊了就调大 `focalLength` 或调小 `bokehScale`。
- 环境光遮蔽：车底、轮拱、墙角变暗，车身表面没有脏斑或闪烁。调 `intensity` / `radius`。
- 用 CDP `Runtime.evaluate` 读 2 秒内的 `requestAnimationFrame` 次数，高档帧率不低于 55。若环境光遮蔽一开就低于 55，停下来问用户是否加 `n8ao`。
- 截图对比改动前后（改动前截图可在 master 上先截）。

- [ ] **Step 8：提交**

```powershell
git add src/scene/three/GradeEffect.ts src/scene/three/GradeEffect.test.ts src/scene/three/PostFx.tsx
git commit -m "feat(scene): cinematic grade, depth of field and ambient occlusion by quality level"
```

---

### Task 6：车灯光晕

**Files:**
- Create: `src/scene/three/lamps.ts`
- Test: `src/scene/three/lamps.test.ts`
- Create: `src/scene/three/LampGlow.tsx`
- Modify: `src/scene/three/Car.tsx`

**Interfaces:**
- Consumes: `lampGlow: boolean`（Task 3 已加进 `CarProps`），`useIgnitionLevel()`（返回 `{ current: number }` 的 ref，0 灭到 1 亮）
- Produces:
  ```ts
  export interface Lamp { kind: 'head' | 'tail'; position: [number, number, number] }
  export interface CarBox { min: [number, number, number]; max: [number, number, number] }
  export const FRONT: 1 | -1
  export function lampsFor(box: CarBox): Lamp[]
  export function facingFade(cosine: number): number
  ```

- [ ] **Step 1：写失败的测试** `src/scene/three/lamps.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { facingFade, FRONT, lampsFor } from './lamps'

const box = { min: [-1, 0, -2] as [number, number, number], max: [1, 1.2, 2] as [number, number, number] }

describe('lampsFor', () => {
  it('puts a pair of head lamps at the front and a pair of tail lamps at the back', () => {
    const lamps = lampsFor(box)
    const heads = lamps.filter((lamp) => lamp.kind === 'head')
    const tails = lamps.filter((lamp) => lamp.kind === 'tail')
    expect(heads).toHaveLength(2)
    expect(tails).toHaveLength(2)
    for (const lamp of heads) expect(Math.sign(lamp.position[2])).toBe(FRONT)
    for (const lamp of tails) expect(Math.sign(lamp.position[2])).toBe(-FRONT)
    expect(heads[0].position[0]).toBeCloseTo(-heads[1].position[0])
    for (const lamp of lamps) {
      expect(lamp.position[1]).toBeGreaterThan(box.min[1])
      expect(lamp.position[1]).toBeLessThan(box.max[1])
    }
  })
})

describe('facingFade', () => {
  it('shows a lamp facing the camera and hides one facing away', () => {
    expect(facingFade(1)).toBe(1)
    expect(facingFade(0)).toBe(0)
    expect(facingFade(-1)).toBe(0)
    expect(facingFade(0.3)).toBeGreaterThan(0)
    expect(facingFade(0.3)).toBeLessThan(1)
  })
})
```

- [ ] **Step 2：运行确认失败**

Run: `npx vitest run src/scene/three/lamps.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3：实现** `src/scene/three/lamps.ts`

```ts
export interface Lamp {
  kind: 'head' | 'tail'
  position: [number, number, number]
}

export interface CarBox {
  min: [number, number, number]
  max: [number, number, number]
}

// 车头朝车模局部坐标 z 的哪一边；各比例是相对包围盒的位置。都在浏览器里对着车模核对。
export const FRONT: 1 | -1 = 1
const LAMP = {
  head: { side: 0.72, height: 0.45, depth: 0.97 },
  tail: { side: 0.75, height: 0.55, depth: 0.98 },
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

export function lampsFor({ min, max }: CarBox): Lamp[] {
  const centerX = (min[0] + max[0]) / 2
  const halfX = (max[0] - min[0]) / 2
  const centerZ = (min[2] + max[2]) / 2
  const halfZ = (max[2] - min[2]) / 2
  return (['head', 'tail'] as const).flatMap((kind) => {
    const { side, height, depth } = LAMP[kind]
    const z = centerZ + (kind === 'head' ? FRONT : -FRONT) * halfZ * depth
    const y = lerp(min[1], max[1], height)
    return [-1, 1].map((sign) => ({ kind, position: [centerX + sign * halfX * side, y, z] as [number, number, number] }))
  })
}

export function facingFade(cosine: number): number {
  const t = Math.min(Math.max((cosine - 0.05) / 0.45, 0), 1)
  return t * t * (3 - 2 * t)
}
```

- [ ] **Step 4：运行确认通过**

Run: `npx vitest run src/scene/three/lamps.test.ts`
Expected: PASS（`facingFade(0)`：`(0 - 0.05)/0.45 < 0` → 0；`facingFade(1)` → 1）。

- [ ] **Step 5：实现** `src/scene/three/LampGlow.tsx`

```tsx
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Box3, CanvasTexture, SpriteMaterial, Vector3, type Group, type Object3D } from 'three'
import { facingFade, FRONT, lampsFor } from './lamps'
import { useIgnitionLevel } from './useIgnitionLevel'

const HEAD_COLOR = '#fff4e0'
const TAIL_COLOR = '#ff2a2a'
const HALO_SIZE = { head: 0.45, tail: 0.3 }
const STREAK_SIZE: [number, number] = [2.4, 0.05]
const STRENGTH = { head: 1.6, tail: 1.2 }

function radialTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  }
  return new CanvasTexture(canvas)
}

const glowMaterial = (map: CanvasTexture, color: string) =>
  new SpriteMaterial({ map, color, blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })

export function LampGlow({ car }: { car: Object3D }) {
  const lights = useIgnitionLevel()
  const root = useRef<Group>(null)
  const texture = useMemo(radialTexture, [])
  const materials = useMemo(() => ({ head: glowMaterial(texture, HEAD_COLOR), tail: glowMaterial(texture, TAIL_COLOR) }), [texture])
  const lamps = useMemo(() => {
    const box = new Box3().setFromObject(car)
    const local = box.applyMatrix4(car.matrixWorld.clone().invert())
    return lampsFor({ min: local.min.toArray(), max: local.max.toArray() })
  }, [car])
  const forward = useMemo(() => new Vector3(), [])
  const toCamera = useMemo(() => new Vector3(), [])

  useEffect(
    () => () => {
      texture.dispose()
      materials.head.dispose()
      materials.tail.dispose()
    },
    [texture, materials],
  )

  useFrame(({ camera }) => {
    const group = root.current
    if (!group) return
    forward.set(0, 0, FRONT).transformDirection(group.matrixWorld)
    group.getWorldPosition(toCamera)
    toCamera.subVectors(camera.position, toCamera).normalize()
    const facing = forward.dot(toCamera)
    materials.head.opacity = STRENGTH.head * lights.current * facingFade(facing)
    materials.tail.opacity = STRENGTH.tail * lights.current * facingFade(-facing)
  })

  return (
    <group ref={root}>
      {lamps.map((lamp, index) => (
        <group key={index} position={lamp.position}>
          <sprite material={materials[lamp.kind]} scale={HALO_SIZE[lamp.kind]} />
          {lamp.kind === 'head' && <sprite material={materials.head} scale={[...STREAK_SIZE, 1]} />}
        </group>
      ))}
    </group>
  )
}
```

- [ ] **Step 6：挂到车上**

`src/scene/three/Car.tsx`：import `LampGlow`，解构 `lampGlow`，在 `<primitive object={scene} ... />` 后加：

```tsx
      {lampGlow && (
        <group position-y={TURNTABLE_HEIGHT}>
          <LampGlow car={scene} />
        </group>
      )}
```

- [ ] **Step 7：类型检查与测试**

Run: `npx tsc -b` 然后 `npx vitest run`
Expected: 无错误，全部 PASS。

- [ ] **Step 8：浏览器检查与调参**

打开 `http://localhost:5173/`，点火或等车库亮起，让转台转一圈：
- 车头朝镜头时车头灯有柔和光晕和一条细横向光芒，车尾朝镜头时尾灯是红色光晕；背对镜头的灯不显示。如果前后反了，把 `FRONT` 改成 `-1`。
- 光晕中心落在车灯上；位置偏了只改 `lamps.ts` 里的 `LAMP` 比例，测试仍须通过。
- 光晕被车身挡住时不穿帮；太亮或太暗调 `STRENGTH`、`HALO_SIZE`。
- 熄火（静音 / 未点火状态）时光晕为 0。

- [ ] **Step 9：提交**

```powershell
git add src/scene/three/lamps.ts src/scene/three/lamps.test.ts src/scene/three/LampGlow.tsx src/scene/three/Car.tsx
git commit -m "feat(scene): soft head and tail lamp glow that follows the ignition"
```

---

### Task 7：静态图、整体验收、合并

**Files:**
- Regenerate: `public/stills/*.webp`

- [ ] **Step 1：重新生成静态图**

Run: `npm run stills`
Expected: 输出 6 行「已截取 …」，`public/stills` 下 6 个文件更新。打开其中的 `garage-landscape.webp` 看一眼，确认有调色与车灯效果、不黑屏。

- [ ] **Step 2：全量检查**

Run: `npx vitest run`、`npx tsc -b`、`npm run build`
Expected: 测试全部 PASS；tsc 无输出；构建输出里 `index-*.js` 的 gzip 不超过 200 KB。

- [ ] **Step 3：浏览器验收**

`npx vite preview --port 4173 --strictPort` 后打开 `http://localhost:4173/?perf`：
- 电脑：画质显示「高」，五项效果可见。
- 用 CDP `Emulation.setTouchEmulationEnabled`（并刷新）模拟触屏：起步显示「中」，帧率高时 5 秒后升到「高」，`?perf` 里有升档记录。
- `Emulation.setCPUThrottlingRate` rate 6：依次降到「中」「低」，不会再升回去；没有来回切换。
- 静态图淡出到 3D 时没有明显跳变。
- 结束后清除所有模拟设置。

- [ ] **Step 4：提交并合并**

```powershell
git add public/stills
git commit -m "chore(stills): regenerate stills with the new grade and lamp glow"
git checkout master
git merge --ff-only feature/visual-fx
```

- [ ] **Step 5：问用户是否推送部署**

推送后检查 CI：`https://api.github.com/repos/Krazymud/Krazymud.github.io/actions/runs?per_page=1`，并请用户在 iPhone 微信里用 `?perf` 核对档位与帧率。
