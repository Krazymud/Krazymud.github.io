# Midnight Garage · 计划 3A：3D 车库场景 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 SVG 剪影背景换成一辆可转动的 3D 超跑（V12 Goblin），切换栏目时镜头和灯光平滑过渡；不满足条件或失败时显示预渲染静帧。

**Architecture:** 主程序包里只有很小的 `SceneHost`（静帧、降级判断、按需加载）和若干纯函数模块；three.js、React Three Fiber 和后期效果全部放在 `src/scene/three/` 异步分包里。车模型由本地脚本 `npm run car` 用 gltf-transform 重新上材质、合并、摆正并用 meshopt 压缩成 `public/models/car.glb`；静帧由 `npm run stills` 用 Playwright 在真实 Chromium 里渲染。

**Tech Stack:** 现有 Vite 8 / React 19.3 / TypeScript 6 / React Router 8 / Tailwind 4 / Motion 14 / Vitest 5 / sharp 0.35；新增运行时依赖 `three` 0.186.1、`@react-three/fiber` 9.8.1、`@react-three/drei` 10.7.9、`@react-three/postprocessing` 3.1.3、`postprocessing` 6.39.5；新增开发依赖 `@types/three` 0.186.0、`@gltf-transform/core` / `extensions` / `functions` 4.5.1、`meshoptimizer` 1.3.0、`playwright` 1.64.0。

**规格文档：** `docs/superpowers/specs/2026-10-10-midnight-garage-scene-design.md`

## Global Constraints

- 运行环境 Windows + PowerShell；所有命令在仓库根目录执行（本机为 `E:\CODE\Krazymud.github.io`）。若终端找不到 `node`/`npm`，先执行 `$env:Path = "C:\Program Files\nodejs;$env:Path"`。
- 依赖版本固定为上面 Tech Stack 里的精确版本（`npm i -E`）。
- 界面文案一律中文；`MIDNIGHT GARAGE` 等品牌字样为英文。
- 颜色：牛血红 `#9E1C22`、高亮红 `#C1272D`、香槟金 `#A8894F`。
- 主程序包（`dist/assets/index-*.js`）压缩后 ≤ 200 KB（基线 146.9 KB）。`src/scene/three/` 以外的 `src/` 文件**不得**在运行时导入 `three`、`@react-three/*`、`postprocessing`（只作类型的 `import type` 也不需要）。
- `public/models/car.glb` ≤ 3 MB；静帧 6 张（三个镜头 × 竖屏 900×1600 / 横屏 1600×900），WebP，每张 ≤ 120 KB，放在 `public/stills/`，文件名 `{garage|track|vault}-{portrait|landscape}.webp`。
- 时长：镜头/灯光/压暗过渡约 1.2 秒（阻尼系数 `TRANSITION_LAMBDA = 4`）；3D 淡入 0.6 秒；静帧交叉淡入 0.4 秒；自转 40 秒一圈；光带每 6 秒一次；氮气色散 0.6 秒；松手后 2 秒恢复自转。
- 设备像素比限制在 `[1, 1.5]`。
- 压暗遮罩不透明度：车库 0、赛道 0.45、保险库 0.35、设置 0.2。
- 本地偏好存放在 `localStorage` 键 `midnight-garage/prefs`，与进度（`midnight-garage/progress`）分开。
- `assets-src/` 已在 `.gitignore` 里，绝不提交；`public/models/**`、`public/stills/**` 在 `.gitattributes` 里标记 `-text`。
- TypeScript 开启了 `verbatimModuleSyntax` 和 `erasableSyntaxOnly`：只作类型使用的导入写 `import type` 或 `type` 修饰；不用 `enum`、参数属性。`src/` 内的导入不带后缀；`scripts/` 引用任何文件都带 `.ts` 后缀。
- 用到 `sharp`、gltf-transform 或 Node 文件系统的测试文件第一行写 `// @vitest-environment node`。
- 原模型结构（已核实）：网格名 `car_wheel_{FL,FR,BL,BR}_car_tire_0`、`car_wheel_{…}_car_body_0`、`car_brake_{…}_car_body_0`、`car_glass_car_glass_0`、`clearcoat_clearcoat_0`、`car_body_car_body_0`、`car_shadow_car_shadow_0`；车轮节点 `car_wheel_{FL,FR,BL,BR}`，其子节点无变换；车头原本朝 −Z；漆面在高光贴图里是精确的 `(60,128,26)`；遮挡贴图只有 R 通道有数据。

---

## 文件结构

```
package.json                              新依赖；car / stills 脚本
.gitattributes                            public/models/**、public/stills/** 标记 -text
src/test/setup.ts                         每个测试后清空偏好缓存
src/prefs/prefs.ts + prefs.test.ts        3D 开关的本地偏好（外部 store + hook）
src/scene/types.ts                        Scene / StillScene / StageProps / StageModule
src/scene/mode.ts + mode.test.ts          显示模式判断、WebGL 2 检测、本次访问失败标记
src/scene/events.ts + events.test.ts      「氮气」事件通道
src/scene/poses.ts + poses.test.ts        每个场景的镜头/灯光/压暗；路由映射；保证整车入画
src/scene/hooks.ts                        减少动态效果、页面可见性
src/scene/Still.tsx + Still.test.tsx      静帧（竖/横屏自动选择，失败退回渐变）
src/scene/turntable.ts + turntable.test.ts  转台：自转、拖动、惯性、对齐
src/scene/drag.ts + drag.test.ts          横向拖动识别（纯逻辑）
src/scene/motion.ts + motion.test.ts      阻尼、光带位置、色散强度等常量和函数
src/scene/frameGuard.ts + frameGuard.test.ts  帧率保护状态机
src/scene/SceneErrorBoundary.tsx          3D 出错时回退
src/scene/SceneHost.tsx + SceneHost.test.tsx  静帧 + 按需加载 3D + 淡入 + 压暗
src/scene/three/Stage.tsx                 画布（异步分包入口）
src/scene/three/Car.tsx                   加载 car.glb、车轮枢轴、转台
src/scene/three/Studio.tsx                Lightformer 灯板、主光、红色光带
src/scene/three/Floor.tsx                 反射地面、赛道线
src/scene/three/CameraRig.tsx             镜头阻尼过渡
src/scene/three/PostFx.tsx                辉光、色散、暗角、颗粒
src/scene/three/FrameGuard.tsx            帧率监测
src/scene/three/useCarDrag.ts             车库页拖动转车
src/scene/three/StillsPage.tsx            开发模式 /__stills 页面
src/app/Layout.tsx                        改用 SceneHost；车库页 touch-action
src/app/GarageBackdrop.tsx                删除
src/app/routes.tsx                        开发模式 /__stills 路由
src/app/App.test.tsx                      静帧断言
src/pages/SettingsPage.tsx + test         3D 开关、鸣谢
src/trial/TrialScreen.tsx + test          连击触发「氮气」事件
scripts/car.config.ts                     网格 → 角色、贴图位置等配置
scripts/lib/carTypes.ts                   CarError、配置类型
scripts/lib/carRoles.ts + test            网格角色分配与校验
scripts/lib/carAtlas.ts + test            车身贴图集：Spec-Gloss → 金属度/粗糙度、车牌、尾灯
scripts/lib/carAlign.ts + test            摆正：朝向、贴地、缩放
scripts/lib/carModel.ts + test            gltf-transform 文档处理
scripts/lib/carFixture.ts                 测试用的小 glTF
scripts/lib/carCommand.ts + test          读写、压缩、体积上限
scripts/car.ts                            npm run car
scripts/lib/stills.ts + test              静帧检查与编码
scripts/stills.ts                         npm run stills
public/models/car.glb                     生成产物（提交）
public/stills/*.webp                      生成产物（提交）
```

---

### Task 1: 本地偏好

**Files:**
- Create: `src/prefs/prefs.ts`、`src/prefs/prefs.test.ts`
- Modify: `src/test/setup.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `PREFS_KEY = 'midnight-garage/prefs'`
  - `interface Prefs { scene3d: boolean }`、`DEFAULT_PREFS: Prefs`
  - `readPrefs(): Prefs`（直接读存储，任何异常都返回默认值）
  - `getPrefs(): Prefs`（带缓存）、`setPrefs(patch: Partial<Prefs>): void`（更新缓存、尽力写入、通知订阅者）
  - `usePrefs(): Prefs`（`useSyncExternalStore`，无需 Provider）
  - `resetPrefsCache(): void`（测试用）

- [ ] **Step 1: 写失败的测试 `src/prefs/prefs.test.ts`**

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFS, getPrefs, PREFS_KEY, readPrefs, resetPrefsCache, setPrefs, usePrefs } from './prefs'

describe('prefs', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPrefsCache()
  })
  afterEach(() => vi.restoreAllMocks())

  it('turns the 3D garage on by default', () => {
    expect(getPrefs()).toEqual({ scene3d: true })
  })

  it('saves the switch apart from the progress data', () => {
    setPrefs({ scene3d: false })
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ scene3d: false })
    resetPrefsCache()
    expect(getPrefs().scene3d).toBe(false)
  })

  it('ignores damaged values', () => {
    localStorage.setItem(PREFS_KEY, '{oops')
    expect(readPrefs()).toEqual(DEFAULT_PREFS)
    localStorage.setItem(PREFS_KEY, '{"scene3d":"no"}')
    expect(readPrefs()).toEqual(DEFAULT_PREFS)
  })

  it('still works for this visit when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(getPrefs()).toEqual(DEFAULT_PREFS)
    setPrefs({ scene3d: false })
    expect(getPrefs().scene3d).toBe(false)
  })

  it('re-renders hook users when the switch changes', () => {
    const { result } = renderHook(() => usePrefs())
    expect(result.current.scene3d).toBe(true)
    act(() => setPrefs({ scene3d: false }))
    expect(result.current.scene3d).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/prefs/prefs.test.ts`
Expected: FAIL，提示找不到 `./prefs`。

- [ ] **Step 3: 实现 `src/prefs/prefs.ts`**

```ts
import { useSyncExternalStore } from 'react'

export const PREFS_KEY = 'midnight-garage/prefs'

export interface Prefs {
  scene3d: boolean
}

export const DEFAULT_PREFS: Prefs = { scene3d: true }

export function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PREFS }
    const scene3d = (parsed as Record<string, unknown>).scene3d
    return { scene3d: typeof scene3d === 'boolean' ? scene3d : DEFAULT_PREFS.scene3d }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function writePrefs(prefs: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // 存不下时只在本次访问生效
  }
}

let current: Prefs | null = null
const listeners = new Set<() => void>()

export function getPrefs(): Prefs {
  current ??= readPrefs()
  return current
}

export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...getPrefs(), ...patch }
  writePrefs(current)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs)
}

export function resetPrefsCache(): void {
  current = null
}
```

- [ ] **Step 4: 让每个测试后清空偏好缓存，`src/test/setup.ts` 改为**

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetPrefsCache } from '../prefs/prefs'

afterEach(() => {
  cleanup()
  resetPrefsCache()
})
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/prefs/prefs.test.ts`
Expected: PASS（5 个测试）。

- [ ] **Step 6: Commit**

```powershell
git add src/prefs src/test/setup.ts
git commit -m "feat(scene): local preference for the 3D garage switch"
```

---

### Task 2: 场景类型、显示模式和「氮气」事件

**Files:**
- Create: `src/scene/types.ts`、`src/scene/mode.ts`、`src/scene/mode.test.ts`、`src/scene/events.ts`、`src/scene/events.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type Scene = 'garage' | 'track' | 'vault' | 'settings'`、`type StillScene = 'garage' | 'track' | 'vault'`
  - `interface StageProps { scene: Scene; onReady: () => void; onFail: (reason: string) => void; deterministic?: boolean }`
  - `interface StageModule { Stage: ComponentType<StageProps> }`
  - `type SceneMode = '3d' | 'still'`、`interface ModeInputs { reducedMotion; webgl2; enabled; failed }`（均为 `boolean`）
  - `sceneMode(inputs: ModeInputs): SceneMode`
  - `supportsWebGL2(): boolean`（结果缓存；jsdom 里为 `false`）
  - `markSceneFailed(): void`、`sceneFailed(): boolean`、`resetSceneFailure(): void`
  - `emitNitro(): void`、`onNitro(listener: () => void): () => void`

- [ ] **Step 1: 写失败的测试 `src/scene/mode.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { markSceneFailed, resetSceneFailure, sceneFailed, sceneMode, supportsWebGL2 } from './mode'

const OK = { reducedMotion: false, webgl2: true, enabled: true, failed: false }

describe('sceneMode', () => {
  it('uses 3D only when nothing rules it out', () => {
    expect(sceneMode(OK)).toBe('3d')
    expect(sceneMode({ ...OK, reducedMotion: true })).toBe('still')
    expect(sceneMode({ ...OK, webgl2: false })).toBe('still')
    expect(sceneMode({ ...OK, enabled: false })).toBe('still')
    expect(sceneMode({ ...OK, failed: true })).toBe('still')
  })
})

describe('WebGL 2 detection', () => {
  it('reports no WebGL 2 where the browser has none', () => {
    expect(supportsWebGL2()).toBe(false)
  })
})

describe('failure memory', () => {
  beforeEach(() => resetSceneFailure())

  it('remembers a failure for the rest of the visit', () => {
    expect(sceneFailed()).toBe(false)
    markSceneFailed()
    expect(sceneFailed()).toBe(true)
  })
})
```

- [ ] **Step 2: 写失败的测试 `src/scene/events.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { emitNitro, onNitro } from './events'

describe('nitro events', () => {
  it('reaches subscribers until they unsubscribe', () => {
    const listener = vi.fn()
    const off = onNitro(listener)
    emitNitro()
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    emitNitro()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/scene/mode.test.ts src/scene/events.test.ts`
Expected: FAIL，提示找不到模块。

- [ ] **Step 4: 实现 `src/scene/types.ts`**

```ts
import type { ComponentType } from 'react'

export type Scene = 'garage' | 'track' | 'vault' | 'settings'

export type StillScene = 'garage' | 'track' | 'vault'

export interface StageProps {
  scene: Scene
  onReady: () => void
  onFail: (reason: string) => void
  deterministic?: boolean
}

export interface StageModule {
  Stage: ComponentType<StageProps>
}
```

- [ ] **Step 5: 实现 `src/scene/mode.ts`**

```ts
export type SceneMode = '3d' | 'still'

export interface ModeInputs {
  reducedMotion: boolean
  webgl2: boolean
  enabled: boolean
  failed: boolean
}

export function sceneMode({ reducedMotion, webgl2, enabled, failed }: ModeInputs): SceneMode {
  return !reducedMotion && webgl2 && enabled && !failed ? '3d' : 'still'
}

let webgl2: boolean | null = null

function detectWebGL2(): boolean {
  if (typeof WebGL2RenderingContext === 'undefined') return false
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

export function supportsWebGL2(): boolean {
  webgl2 ??= detectWebGL2()
  return webgl2
}

let failed = false

export function markSceneFailed(): void {
  failed = true
}

export function sceneFailed(): boolean {
  return failed
}

export function resetSceneFailure(): void {
  failed = false
}
```

- [ ] **Step 6: 实现 `src/scene/events.ts`**

```ts
type Listener = () => void

const nitroListeners = new Set<Listener>()

export function emitNitro(): void {
  for (const listener of nitroListeners) listener()
}

export function onNitro(listener: Listener): () => void {
  nitroListeners.add(listener)
  return () => {
    nitroListeners.delete(listener)
  }
}
```

- [ ] **Step 7: 运行测试，确认通过**

Run: `npx vitest run src/scene/mode.test.ts src/scene/events.test.ts`
Expected: PASS（4 个测试）。

- [ ] **Step 8: Commit**

```powershell
git add src/scene/types.ts src/scene/mode.ts src/scene/mode.test.ts src/scene/events.ts src/scene/events.test.ts
git commit -m "feat(scene): display mode rules and nitro event channel"
```

---

### Task 3: 镜头位置和路由映射

**Files:**
- Create: `src/scene/poses.ts`、`src/scene/poses.test.ts`

**Interfaces:**
- Consumes: `Scene`、`StillScene`（Task 2）
- Produces:
  - `type Vec3 = [number, number, number]`
  - `interface Pose { camera: Vec3; target: Vec3; light: string; dim: number; spin: boolean; carYaw: number | null; trackLines: boolean; sweep: boolean; still: StillScene }`
    - `camera` 是横屏/桌面上的基准机位；`carYaw` 为 `null` 时保持车当前角度，为数字时把车转回该角度；`spin` 只有车库为 `true`（拖动转车也只在 `spin` 为 `true` 时生效）。
  - `POSES: Record<Scene, Pose>`
  - `sceneFor(pathname: string): Scene`
  - `CAMERA_FOV = 40`、`CAR_RADIUS = 2.5`
  - `framedCamera(pose: Pose, aspect: number, fovDeg?: number, radius?: number): Vec3`：沿基准方向拉远到整车（半径 `radius` 的球）在横纵两个方向都入画；已经入画时保持基准机位。

- [ ] **Step 1: 写失败的测试 `src/scene/poses.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { CAMERA_FOV, CAR_RADIUS, framedCamera, POSES, sceneFor, type Pose } from './poses'

const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]))

describe('sceneFor', () => {
  it('maps every route to a scene', () => {
    expect(sceneFor('/')).toBe('garage')
    expect(sceneFor('/trial')).toBe('track')
    expect(sceneFor('/vault')).toBe('vault')
    expect(sceneFor('/settings')).toBe('settings')
    expect(sceneFor('/2018/09/05/leetcode05/')).toBe('garage')
  })
})

describe('POSES', () => {
  it('dims each page as the spec says', () => {
    expect(POSES.garage.dim).toBe(0)
    expect(POSES.track.dim).toBe(0.45)
    expect(POSES.vault.dim).toBe(0.35)
    expect(POSES.settings.dim).toBe(0.2)
  })

  it('spins and sweeps only in the garage', () => {
    expect(Object.entries(POSES).filter(([, p]) => p.spin).map(([s]) => s)).toEqual(['garage'])
    expect(Object.entries(POSES).filter(([, p]) => p.sweep).map(([s]) => s)).toEqual(['garage'])
  })

  it('lights the vault in champagne gold and the rest in ox-blood red', () => {
    expect(POSES.vault.light).toBe('#A8894F')
    expect(POSES.garage.light).toBe('#9E1C22')
    expect(POSES.track.light).toBe('#9E1C22')
  })

  it('shows the settings page from the garage camera without spinning', () => {
    expect(POSES.settings.camera).toEqual(POSES.garage.camera)
    expect(POSES.settings.still).toBe('garage')
    expect(POSES.settings.spin).toBe(false)
  })

  it('shows the track lines only on the trial page and squares the car up away from the garage', () => {
    expect(POSES.track.trackLines).toBe(true)
    expect(POSES.garage.trackLines || POSES.vault.trackLines || POSES.settings.trackLines).toBe(false)
    expect(POSES.track.carYaw).toBe(0)
    expect(POSES.vault.carYaw).toBe(0)
  })
})

describe('framedCamera', () => {
  const pose: Pose = { ...POSES.garage, camera: [0, 0, 8], target: [0, 0, 0] }

  it('keeps the base camera when the car already fits', () => {
    expect(framedCamera(pose, 16 / 9)).toEqual([0, 0, 8])
  })

  it('pulls back on a narrow portrait screen, along the same direction', () => {
    const [x, y, z] = framedCamera(pose, 9 / 16)
    expect(x).toBe(0)
    expect(y).toBe(0)
    expect(z).toBeGreaterThan(8)
    const hHalf = Math.atan(Math.tan((CAMERA_FOV * Math.PI) / 360) * (9 / 16))
    expect(distance([x, y, z], [0, 0, 0])).toBeCloseTo(CAR_RADIUS / Math.sin(hHalf), 6)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/scene/poses.test.ts`
Expected: FAIL，提示找不到 `./poses`。

- [ ] **Step 3: 实现 `src/scene/poses.ts`**

```ts
import type { Scene, StillScene } from './types'

export type Vec3 = [number, number, number]

export interface Pose {
  camera: Vec3
  target: Vec3
  light: string
  dim: number
  spin: boolean
  carYaw: number | null
  trackLines: boolean
  sweep: boolean
  still: StillScene
}

const RED = '#9E1C22'
const GOLD = '#A8894F'
const GARAGE_CAMERA: Vec3 = [-4.6, 2.3, 6.4]
const GARAGE_TARGET: Vec3 = [0, -0.6, 0]

export const POSES: Record<Scene, Pose> = {
  garage: {
    camera: GARAGE_CAMERA,
    target: GARAGE_TARGET,
    light: RED,
    dim: 0,
    spin: true,
    carYaw: null,
    trackLines: false,
    sweep: true,
    still: 'garage',
  },
  track: {
    camera: [7.2, 0.7, 0.8],
    target: [0, 0.5, 0],
    light: RED,
    dim: 0.45,
    spin: false,
    carYaw: 0,
    trackLines: true,
    sweep: false,
    still: 'track',
  },
  vault: {
    camera: [1.4, 1.5, -7.6],
    target: [0, 0.6, 0],
    light: GOLD,
    dim: 0.35,
    spin: false,
    carYaw: 0,
    trackLines: false,
    sweep: false,
    still: 'vault',
  },
  settings: {
    camera: GARAGE_CAMERA,
    target: GARAGE_TARGET,
    light: RED,
    dim: 0.2,
    spin: false,
    carYaw: null,
    trackLines: false,
    sweep: false,
    still: 'garage',
  },
}

export function sceneFor(pathname: string): Scene {
  if (pathname.startsWith('/vault')) return 'vault'
  if (pathname.startsWith('/trial')) return 'track'
  if (pathname.startsWith('/settings')) return 'settings'
  return 'garage'
}

export const CAMERA_FOV = 40
export const CAR_RADIUS = 2.5

export function framedCamera(pose: Pose, aspect: number, fovDeg = CAMERA_FOV, radius = CAR_RADIUS): Vec3 {
  const offset = pose.camera.map((v, i) => v - pose.target[i])
  const length = Math.hypot(...offset)
  const vHalf = (fovDeg * Math.PI) / 360
  const hHalf = Math.atan(Math.tan(vHalf) * aspect)
  const needed = radius / Math.sin(Math.min(vHalf, hHalf))
  const scale = Math.max(length, needed) / length
  return offset.map((v, i) => pose.target[i] + v * scale) as Vec3
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/scene/poses.test.ts`
Expected: PASS（8 个测试）。

- [ ] **Step 5: Commit**

```powershell
git add src/scene/poses.ts src/scene/poses.test.ts
git commit -m "feat(scene): camera poses per route with whole-car framing"
```

---

### Task 4: 静帧组件和环境 hooks

**Files:**
- Create: `src/scene/hooks.ts`、`src/scene/Still.tsx`、`src/scene/Still.test.tsx`

**Interfaces:**
- Consumes: `StillScene`（Task 2）
- Produces:
  - `usePrefersReducedMotion(): boolean`（读 `(prefers-reduced-motion: reduce)`，没有 `matchMedia` 时为 `false`）
  - `usePageVisible(): boolean`（`document.visibilityState !== 'hidden'`）
  - `stillUrl(scene: StillScene, orientation: 'portrait' | 'landscape'): string`
  - `<Still scene={StillScene} />`：根元素 `data-testid="scene-still"`，底色为深色径向渐变；切换镜头时 0.4 秒交叉淡入；图片加载失败时只留渐变。

- [ ] **Step 1: 写失败的测试 `src/scene/Still.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Still, stillUrl } from './Still'

describe('Still', () => {
  it('picks the portrait image and offers the landscape one by orientation', () => {
    const { container } = render(<Still scene="garage" />)
    expect(container.querySelector('img')).toHaveAttribute('src', stillUrl('garage', 'portrait'))
    const source = container.querySelector('source')
    expect(source).toHaveAttribute('media', '(orientation: landscape)')
    expect(source).toHaveAttribute('srcset', stillUrl('garage', 'landscape'))
    expect(stillUrl('vault', 'landscape')).toBe('/stills/vault-landscape.webp')
  })

  it('falls back to the dark gradient when the image cannot load', () => {
    const { container } = render(<Still scene="track" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByTestId('scene-still')).toBeInTheDocument()
  })

  it('brings in the new camera when the scene changes', () => {
    const { container, rerender } = render(<Still scene="garage" />)
    rerender(<Still scene="vault" />)
    const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(sources).toContain(stillUrl('vault', 'portrait'))
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/scene/Still.test.tsx`
Expected: FAIL，提示找不到 `./Still`。

- [ ] **Step 3: 实现 `src/scene/hooks.ts`**

```ts
import { useSyncExternalStore } from 'react'

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(REDUCED_QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)
}

function subscribeVisibility(callback: () => void): () => void {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== 'hidden', () => true)
}
```

- [ ] **Step 4: 实现 `src/scene/Still.tsx`**

```tsx
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { StillScene } from './types'

const FALLBACK = 'radial-gradient(ellipse 70% 50% at 50% 30%, #1f1f22 0%, #0a0a0c 60%, #050506 100%)'

export function stillUrl(scene: StillScene, orientation: 'portrait' | 'landscape'): string {
  return `${import.meta.env.BASE_URL}stills/${scene}-${orientation}.webp`
}

function StillImage({ scene }: { scene: StillScene }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <picture>
      <source media="(orientation: landscape)" srcSet={stillUrl(scene, 'landscape')} />
      <img src={stillUrl(scene, 'portrait')} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
    </picture>
  )
}

export function Still({ scene }: { scene: StillScene }) {
  return (
    <div data-testid="scene-still" className="absolute inset-0" style={{ background: FALLBACK }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={scene}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <StillImage scene={scene} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/scene/Still.test.tsx`
Expected: PASS（3 个测试）。

- [ ] **Step 6: Commit**

```powershell
git add src/scene/hooks.ts src/scene/Still.tsx src/scene/Still.test.tsx
git commit -m "feat(scene): pre-rendered still with orientation pick and gradient fallback"
```

---

### Task 5: 转台和拖动识别

**Files:**
- Create: `src/scene/turntable.ts`、`src/scene/turntable.test.ts`、`src/scene/drag.ts`、`src/scene/drag.test.ts`

**Interfaces:**
- Consumes: 无
- Produces（`turntable.ts`，角度单位弧度，时间单位秒）：
  - `interface Turntable { angle: number; velocity: number; dragging: boolean; idle: number }`（`idle` 为距上次松手的秒数）
  - 常量 `SPIN_SPEED = 2π/40`、`RESUME_AFTER = 2`、`FRICTION = 3`、`RAD_PER_PX = 0.008`、`ALIGN_LAMBDA = 4`、`FLICK_WINDOW = 0.12`
  - `initialTurntable(angle?: number): Turntable`（`idle` 从 `RESUME_AFTER` 开始，打开页面立即自转）
  - `grab(t)`、`dragBy(t, dx: number, dt: number)`、`release(t, sinceLastMove: number)`（松手前停顿超过 `FLICK_WINDOW` 就不带惯性）
  - `nearestEquivalent(angle: number, target: number): number`
  - `interface TurntableMode { spin: boolean; holdYaw: number | null }`
  - `stepTurntable(t, dt, mode): Turntable`
- Produces（`drag.ts`）：
  - `DRAG_SLOP = 8`、`CAR_BAND: [number, number] = [0.25, 0.75]`
  - `inCarBand(y: number, height: number): boolean`
  - `isInteractive(target: EventTarget | null): boolean`
  - `type DragPhase = 'idle' | 'pending' | 'dragging'`
  - `class DragTracker { state: DragPhase（只读 getter）; start(x, y): void; move(x, y): number | null; end(): boolean }`：`move` 在锁定为水平拖动后返回本次水平位移，否则返回 `null`；纵向先超过阈值就放弃；`end` 返回是否处于拖动中。

- [ ] **Step 1: 写失败的测试 `src/scene/turntable.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import {
  dragBy,
  FRICTION,
  grab,
  initialTurntable,
  nearestEquivalent,
  RAD_PER_PX,
  release,
  RESUME_AFTER,
  stepTurntable,
  type Turntable,
  type TurntableMode,
} from './turntable'

const SPIN: TurntableMode = { spin: true, holdYaw: null }
const STILL: TurntableMode = { spin: false, holdYaw: null }

function run(t: Turntable, seconds: number, mode: TurntableMode, dt = 0.01): Turntable {
  let state = t
  for (let i = 0; i < Math.round(seconds / dt); i++) state = stepTurntable(state, dt, mode)
  return state
}

describe('turntable', () => {
  it('spins one full turn in about 40 seconds', () => {
    expect(run(initialTurntable(), 40, SPIN).angle).toBeCloseTo(2 * Math.PI, 3)
  })

  it('stands still on the settings page', () => {
    expect(run(initialTurntable(1), 5, STILL).angle).toBe(1)
  })

  it('follows the finger while held', () => {
    let t = grab(initialTurntable())
    t = dragBy(t, 100, 0.1)
    expect(t.angle).toBeCloseTo(100 * RAD_PER_PX)
    expect(t.velocity).toBeCloseTo((100 * RAD_PER_PX) / 0.1)
    expect(run(t, 1, SPIN).angle).toBe(t.angle)
  })

  it('coasts after a flick and slows down', () => {
    const flicked = release(dragBy(grab(initialTurntable()), 100, 0.1), 0.02)
    const later = run(flicked, 1.5, STILL)
    const travelled = later.angle - flicked.angle
    expect(travelled).toBeGreaterThan(0)
    expect(travelled).toBeLessThan(flicked.velocity / FRICTION)
    expect(Math.abs(later.velocity)).toBeLessThan(flicked.velocity * 0.05)
  })

  it('does not coast when the finger rested before letting go', () => {
    const rested = release(dragBy(grab(initialTurntable()), 100, 0.1), 0.5)
    expect(rested.velocity).toBe(0)
  })

  it('waits 2 seconds after release before spinning again', () => {
    const released = release(grab(initialTurntable()), 1)
    const before = run(released, RESUME_AFTER - 0.1, SPIN)
    expect(before.angle).toBe(released.angle)
    expect(run(before, 0.5, SPIN).angle).toBeGreaterThan(released.angle)
  })

  it('turns back to the requested angle the short way', () => {
    const t = initialTurntable(2 * Math.PI + 0.3)
    expect(run(t, 3, { spin: false, holdYaw: 0 }).angle).toBeCloseTo(2 * Math.PI, 3)
  })

  it('finds the nearest equivalent angle', () => {
    expect(nearestEquivalent(0.2, 0)).toBe(0)
    expect(nearestEquivalent(7, 0)).toBeCloseTo(2 * Math.PI)
    expect(nearestEquivalent(-3.5, 0)).toBeCloseTo(-2 * Math.PI)
  })
})
```

- [ ] **Step 2: 写失败的测试 `src/scene/drag.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { DragTracker, inCarBand, isInteractive } from './drag'

describe('DragTracker', () => {
  it('locks onto a horizontal drag and reports each step', () => {
    const tracker = new DragTracker()
    tracker.start(100, 300)
    expect(tracker.move(104, 301)).toBeNull()
    expect(tracker.move(120, 302)).toBe(20)
    expect(tracker.state).toBe('dragging')
    expect(tracker.move(130, 340)).toBe(10)
    expect(tracker.end()).toBe(true)
    expect(tracker.state).toBe('idle')
  })

  it('lets a vertical swipe scroll the page', () => {
    const tracker = new DragTracker()
    tracker.start(100, 300)
    expect(tracker.move(103, 320)).toBeNull()
    expect(tracker.state).toBe('idle')
    expect(tracker.move(200, 320)).toBeNull()
    expect(tracker.end()).toBe(false)
  })
})

describe('inCarBand', () => {
  it('accepts only the middle half of the screen', () => {
    expect(inCarBand(100, 800)).toBe(false)
    expect(inCarBand(400, 800)).toBe(true)
    expect(inCarBand(700, 800)).toBe(false)
  })
})

describe('isInteractive', () => {
  it('spots buttons, links and form controls, including their children', () => {
    document.body.innerHTML = '<a href="/x"><span id="inner">go</span></a><p id="text">hi</p><button id="b">b</button>'
    expect(isInteractive(document.getElementById('inner'))).toBe(true)
    expect(isInteractive(document.getElementById('b'))).toBe(true)
    expect(isInteractive(document.getElementById('text'))).toBe(false)
    expect(isInteractive(null)).toBe(false)
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/scene/turntable.test.ts src/scene/drag.test.ts`
Expected: FAIL，提示找不到模块。

- [ ] **Step 4: 实现 `src/scene/turntable.ts`**

```ts
export interface Turntable {
  angle: number
  velocity: number
  dragging: boolean
  idle: number
}

export const SPIN_SPEED = (2 * Math.PI) / 40
export const RESUME_AFTER = 2
export const FRICTION = 3
export const RAD_PER_PX = 0.008
export const ALIGN_LAMBDA = 4
export const FLICK_WINDOW = 0.12

export function initialTurntable(angle = 0): Turntable {
  return { angle, velocity: 0, dragging: false, idle: RESUME_AFTER }
}

export function grab(t: Turntable): Turntable {
  return { ...t, dragging: true, velocity: 0 }
}

export function dragBy(t: Turntable, dx: number, dt: number): Turntable {
  const delta = dx * RAD_PER_PX
  return { ...t, angle: t.angle + delta, velocity: dt > 0 ? delta / dt : t.velocity }
}

export function release(t: Turntable, sinceLastMove: number): Turntable {
  return { ...t, dragging: false, idle: 0, velocity: sinceLastMove > FLICK_WINDOW ? 0 : t.velocity }
}

export function nearestEquivalent(angle: number, target: number): number {
  const turns = Math.round((angle - target) / (2 * Math.PI))
  return target + turns * 2 * Math.PI
}

export interface TurntableMode {
  spin: boolean
  holdYaw: number | null
}

export function stepTurntable(t: Turntable, dt: number, mode: TurntableMode): Turntable {
  if (t.dragging) return t
  const idle = t.idle + dt
  if (mode.holdYaw !== null) {
    const goal = nearestEquivalent(t.angle, mode.holdYaw)
    return { ...t, idle, velocity: 0, angle: goal + (t.angle - goal) * Math.exp(-ALIGN_LAMBDA * dt) }
  }
  const velocity = t.velocity * Math.exp(-FRICTION * dt)
  const spin = mode.spin && idle >= RESUME_AFTER ? SPIN_SPEED : 0
  if (velocity === 0 && spin === 0) return { ...t, idle, velocity }
  return { ...t, idle, velocity, angle: t.angle + (velocity + spin) * dt }
}
```

- [ ] **Step 5: 实现 `src/scene/drag.ts`**

```ts
export const DRAG_SLOP = 8
export const CAR_BAND: [number, number] = [0.25, 0.75]

export function inCarBand(y: number, height: number): boolean {
  return y >= height * CAR_BAND[0] && y <= height * CAR_BAND[1]
}

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [role="switch"], [contenteditable="true"]'

export function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null
}

export type DragPhase = 'idle' | 'pending' | 'dragging'

export class DragTracker {
  private phase: DragPhase = 'idle'
  private startX = 0
  private startY = 0
  private lastX = 0

  get state(): DragPhase {
    return this.phase
  }

  start(x: number, y: number): void {
    this.phase = 'pending'
    this.startX = x
    this.startY = y
    this.lastX = x
  }

  move(x: number, y: number): number | null {
    if (this.phase === 'pending') {
      const dx = x - this.startX
      const dy = y - this.startY
      if (Math.abs(dy) > DRAG_SLOP && Math.abs(dy) >= Math.abs(dx)) {
        this.phase = 'idle'
        return null
      }
      if (Math.abs(dx) <= DRAG_SLOP) return null
      this.phase = 'dragging'
    }
    if (this.phase !== 'dragging') return null
    const delta = x - this.lastX
    this.lastX = x
    return delta
  }

  end(): boolean {
    const wasDragging = this.phase === 'dragging'
    this.phase = 'idle'
    return wasDragging
  }
}
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `npx vitest run src/scene/turntable.test.ts src/scene/drag.test.ts`
Expected: PASS（12 个测试）。

- [ ] **Step 7: Commit**

```powershell
git add src/scene/turntable.ts src/scene/turntable.test.ts src/scene/drag.ts src/scene/drag.test.ts
git commit -m "feat(scene): turntable physics and horizontal drag detection"
```

---

### Task 6: 动画数学和帧率保护

**Files:**
- Create: `src/scene/motion.ts`、`src/scene/motion.test.ts`、`src/scene/frameGuard.ts`、`src/scene/frameGuard.test.ts`

**Interfaces:**
- Consumes: 无
- Produces（`motion.ts`）：
  - `TRANSITION_LAMBDA = 4`、`damp(current, target, lambda, dt): number`、`dampFactor(lambda, dt): number`（`1 - e^{-λdt}`，给 `Vector3.lerp` / `Color.lerp` 用）
  - `SWEEP_PERIOD = 6`、`SWEEP_DURATION = 1.5`、`SWEEP_RANGE = 9`、`STILL_SWEEP_X = 1.2`、`sweepX(time: number): number | null`（不在扫光时返回 `null`）
  - `NITRO_DURATION = 0.6`、`NITRO_OFFSET = 0.006`、`nitroOffset(elapsed: number): number`
  - `TRACK_SPEED = 1.2`（赛道线贴图每秒滚动的重复数）、`WHEEL_SPEED = 20`（弧度/秒）
- Produces（`frameGuard.ts`）：
  - `type Quality = 0 | 1 | 2`（0 全效果；1 设备像素比降到 1；2 再关闭后期效果）
  - `interface GuardState { quality: Quality; lowFor: number; failed: boolean }`、`initialGuard: GuardState`
  - `MIN_FPS = 30`、`DOWNGRADE_AFTER = 3`、`GIVE_UP_AFTER = 5`
  - `guardStep(state: GuardState, fps: number, seconds: number): GuardState`
  - `dprFor(quality: Quality): [number, number]`

- [ ] **Step 1: 写失败的测试 `src/scene/motion.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { damp, dampFactor, NITRO_DURATION, NITRO_OFFSET, nitroOffset, SWEEP_DURATION, SWEEP_RANGE, sweepX, TRANSITION_LAMBDA } from './motion'

describe('damp', () => {
  it('settles within 1% in about 1.2 seconds', () => {
    let value = 0
    for (let i = 0; i < 120; i++) value = damp(value, 1, TRANSITION_LAMBDA, 0.01)
    expect(value).toBeGreaterThan(0.99)
    expect(dampFactor(TRANSITION_LAMBDA, 1.2)).toBeGreaterThan(0.99)
  })

  it('does not depend on frame rate', () => {
    let fast = 0
    for (let i = 0; i < 60; i++) fast = damp(fast, 1, 4, 1 / 60)
    let slow = 0
    for (let i = 0; i < 30; i++) slow = damp(slow, 1, 4, 1 / 30)
    expect(fast).toBeCloseTo(slow, 10)
  })
})

describe('sweepX', () => {
  it('crosses the car once every 6 seconds and is gone in between', () => {
    expect(sweepX(0)).toBe(-SWEEP_RANGE)
    expect(sweepX(SWEEP_DURATION / 2)).toBeCloseTo(0)
    expect(sweepX(SWEEP_DURATION + 0.1)).toBeNull()
    expect(sweepX(6)).toBe(-SWEEP_RANGE)
    expect(sweepX(9)).toBeNull()
  })
})

describe('nitroOffset', () => {
  it('flashes and fades within 0.6 seconds', () => {
    expect(nitroOffset(0)).toBe(NITRO_OFFSET)
    expect(nitroOffset(NITRO_DURATION / 2)).toBeCloseTo(NITRO_OFFSET / 2)
    expect(nitroOffset(NITRO_DURATION)).toBe(0)
    expect(nitroOffset(-1)).toBe(0)
    expect(nitroOffset(Infinity)).toBe(0)
  })
})
```

- [ ] **Step 2: 写失败的测试 `src/scene/frameGuard.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { dprFor, guardStep, initialGuard, type GuardState } from './frameGuard'

function feed(state: GuardState, fps: number, seconds: number): GuardState {
  let next = state
  for (let i = 0; i < seconds; i++) next = guardStep(next, fps, 1)
  return next
}

describe('frame guard', () => {
  it('keeps full quality at a healthy frame rate', () => {
    expect(feed(initialGuard, 58, 30)).toEqual(initialGuard)
  })

  it('lowers resolution, then drops post effects, then gives up', () => {
    const lower = feed(initialGuard, 20, 3)
    expect(lower.quality).toBe(1)
    const plain = feed(lower, 20, 3)
    expect(plain.quality).toBe(2)
    expect(feed(plain, 20, 4).failed).toBe(false)
    expect(feed(plain, 20, 5).failed).toBe(true)
  })

  it('forgives a short stutter', () => {
    const stutter = feed(feed(initialGuard, 20, 2), 60, 1)
    expect(feed(stutter, 20, 2).quality).toBe(0)
  })

  it('stays failed once it has given up', () => {
    const failed: GuardState = { quality: 2, lowFor: 5, failed: true }
    expect(guardStep(failed, 60, 1)).toBe(failed)
  })

  it('caps the pixel ratio at 1.5, then 1', () => {
    expect(dprFor(0)).toEqual([1, 1.5])
    expect(dprFor(1)).toEqual([1, 1])
    expect(dprFor(2)).toEqual([1, 1])
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/scene/motion.test.ts src/scene/frameGuard.test.ts`
Expected: FAIL，提示找不到模块。

- [ ] **Step 4: 实现 `src/scene/motion.ts`**

```ts
export const TRANSITION_LAMBDA = 4

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt)
}

export function dampFactor(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt)
}

export const SWEEP_PERIOD = 6
export const SWEEP_DURATION = 1.5
export const SWEEP_RANGE = 9
export const STILL_SWEEP_X = 1.2

export function sweepX(time: number): number | null {
  const phase = ((time % SWEEP_PERIOD) + SWEEP_PERIOD) % SWEEP_PERIOD
  if (phase >= SWEEP_DURATION) return null
  return -SWEEP_RANGE + (2 * SWEEP_RANGE * phase) / SWEEP_DURATION
}

export const NITRO_DURATION = 0.6
export const NITRO_OFFSET = 0.006

export function nitroOffset(elapsed: number): number {
  if (!(elapsed >= 0 && elapsed < NITRO_DURATION)) return 0
  return NITRO_OFFSET * (1 - elapsed / NITRO_DURATION)
}

export const TRACK_SPEED = 1.2
export const WHEEL_SPEED = 20
```

- [ ] **Step 5: 实现 `src/scene/frameGuard.ts`**

```ts
export type Quality = 0 | 1 | 2

export interface GuardState {
  quality: Quality
  lowFor: number
  failed: boolean
}

export const MIN_FPS = 30
export const DOWNGRADE_AFTER = 3
export const GIVE_UP_AFTER = 5

export const initialGuard: GuardState = { quality: 0, lowFor: 0, failed: false }

export function guardStep(state: GuardState, fps: number, seconds: number): GuardState {
  if (state.failed) return state
  if (fps >= MIN_FPS) return state.lowFor === 0 ? state : { ...state, lowFor: 0 }
  const lowFor = state.lowFor + seconds
  if (state.quality < 2) {
    if (lowFor < DOWNGRADE_AFTER) return { ...state, lowFor }
    return { quality: (state.quality + 1) as Quality, lowFor: 0, failed: false }
  }
  return { ...state, lowFor, failed: lowFor >= GIVE_UP_AFTER }
}

export function dprFor(quality: Quality): [number, number] {
  return quality === 0 ? [1, 1.5] : [1, 1]
}
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `npx vitest run src/scene/motion.test.ts src/scene/frameGuard.test.ts`
Expected: PASS（9 个测试）。

- [ ] **Step 7: Commit**

```powershell
git add src/scene/motion.ts src/scene/motion.test.ts src/scene/frameGuard.ts src/scene/frameGuard.test.ts
git commit -m "feat(scene): damping, light sweep timing and frame-rate guard"
```

---

### Task 7: 模型脚本的配置和网格角色

**Files:**
- Modify: `package.json`（新开发依赖）
- Create: `scripts/lib/carTypes.ts`、`scripts/car.config.ts`、`scripts/lib/carRoles.ts`、`scripts/lib/carRoles.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `class CarError extends Error`（`name = 'CarError'`，脚本只对它打印消息并以退出码 1 结束）
  - `type Role = 'body' | 'wheel' | 'caliper' | 'glass' | 'tire' | 'shadow'`
  - `interface RoleRule { role: Role; mesh: RegExp }`、`interface Rect { x; y; width; height }`（像素，原贴图集 4096×2048 坐标）
  - `interface AtlasConfig { diffuse: string; specularGlossiness: string; occlusion: string; paintSpecular: [number, number, number]; paintTolerance: number; plate: Rect; plateText: string; taillights: Rect; outputSize: [number, number] }`（前三项是贴图文件名片段，按 URI 包含关系查找）
  - `interface CarConfig { remove: RegExp[]; roles: RoleRule[]; wheels: Record<'FL' | 'FR' | 'BL' | 'BR', string>; atlas: AtlasConfig; tireNormal: string; tireOcclusion: string; shadowTexture: string; textureMaxSize: number; targetLength: number; maxBytes: number }`
  - `carConfig: CarConfig`（`scripts/car.config.ts`）
  - `assignRoles(meshNames: string[], rules: RoleRule[], remove: RegExp[]): Map<string, Role>`：规则或删除模式匹配不到任何网格、或有网格没被覆盖时抛 `CarError`；被删除的网格不出现在结果里；一个网格按第一条匹配的规则分配。

- [ ] **Step 1: 安装 gltf-transform 和 meshoptimizer（开发依赖）**

```powershell
npm i -D -E @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0
```

Expected: `package.json` 的 `devDependencies` 多出这四项，版本号不带 `^`。

- [ ] **Step 2: 写失败的测试 `scripts/lib/carRoles.test.ts`**

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { carConfig } from '../car.config.ts'
import { assignRoles } from './carRoles.ts'
import { CarError } from './carTypes.ts'

const GOBLIN_MESHES = [
  'car_wheel_BL_car_tire_0',
  'car_wheel_BL_car_body_0',
  'car_brake_BL_car_body_0',
  'car_wheel_BR_car_body_0',
  'car_wheel_BR_car_tire_0',
  'car_brake_BR_car_body_0',
  'car_wheel_FL_car_body_0',
  'car_wheel_FL_car_tire_0',
  'car_brake_FL_car_body_0',
  'car_wheel_FR_car_tire_0',
  'car_wheel_FR_car_body_0',
  'car_brake_FR_car_body_0',
  'car_glass_car_glass_0',
  'clearcoat_clearcoat_0',
  'car_body_car_body_0',
  'car_shadow_car_shadow_0',
]

describe('assignRoles', () => {
  it('covers every V12 Goblin mesh with the shipped config', () => {
    const roles = assignRoles(GOBLIN_MESHES, carConfig.roles, carConfig.remove)
    expect(roles.get('car_body_car_body_0')).toBe('body')
    expect(roles.get('car_wheel_FL_car_body_0')).toBe('wheel')
    expect(roles.get('car_wheel_BR_car_tire_0')).toBe('tire')
    expect(roles.get('car_brake_FR_car_body_0')).toBe('caliper')
    expect(roles.get('car_glass_car_glass_0')).toBe('glass')
    expect(roles.get('car_shadow_car_shadow_0')).toBe('shadow')
    expect(roles.has('clearcoat_clearcoat_0')).toBe(false)
    expect(roles.size).toBe(15)
  })

  it('rejects a rule that matches nothing', () => {
    const rules = [...carConfig.roles, { role: 'body' as const, mesh: /^spoiler_/ }]
    expect(() => assignRoles(GOBLIN_MESHES, rules, carConfig.remove)).toThrow(/spoiler_/)
  })

  it('rejects a mesh that no rule covers', () => {
    expect(() => assignRoles([...GOBLIN_MESHES, 'car_spoiler_0'], carConfig.roles, carConfig.remove)).toThrow(/car_spoiler_0/)
  })

  it('rejects a removal pattern that matches nothing', () => {
    expect(() => assignRoles(GOBLIN_MESHES, carConfig.roles, [/^roof_box_/])).toThrow(CarError)
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/carRoles.test.ts`
Expected: FAIL，提示找不到模块。

- [ ] **Step 4: 实现 `scripts/lib/carTypes.ts`**

```ts
export class CarError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CarError'
  }
}

export type Role = 'body' | 'wheel' | 'caliper' | 'glass' | 'tire' | 'shadow'

export interface RoleRule {
  role: Role
  mesh: RegExp
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface AtlasConfig {
  diffuse: string
  specularGlossiness: string
  occlusion: string
  paintSpecular: [number, number, number]
  paintTolerance: number
  plate: Rect
  plateText: string
  taillights: Rect
  outputSize: [number, number]
}

export interface CarConfig {
  remove: RegExp[]
  roles: RoleRule[]
  wheels: Record<'FL' | 'FR' | 'BL' | 'BR', string>
  atlas: AtlasConfig
  tireNormal: string
  tireOcclusion: string
  shadowTexture: string
  textureMaxSize: number
  targetLength: number
  maxBytes: number
}
```

- [ ] **Step 5: 实现 `scripts/car.config.ts`**

```ts
import type { CarConfig } from './lib/carTypes.ts'

export const carConfig: CarConfig = {
  remove: [/^clearcoat_/],
  roles: [
    { role: 'tire', mesh: /^car_wheel_(FL|FR|BL|BR)_car_tire_/ },
    { role: 'wheel', mesh: /^car_wheel_(FL|FR|BL|BR)_car_body_/ },
    { role: 'caliper', mesh: /^car_brake_(FL|FR|BL|BR)_/ },
    { role: 'glass', mesh: /^car_glass_/ },
    { role: 'shadow', mesh: /^car_shadow_/ },
    { role: 'body', mesh: /^car_body_/ },
  ],
  wheels: { FL: 'car_wheel_FL', FR: 'car_wheel_FR', BL: 'car_wheel_BL', BR: 'car_wheel_BR' },
  atlas: {
    diffuse: 'car_body_diffuse',
    specularGlossiness: 'car_body_specularGlossiness',
    occlusion: 'car_body_occlusion',
    paintSpecular: [60, 128, 26],
    paintTolerance: 6,
    plate: { x: 620, y: 290, width: 302, height: 200 },
    plateText: 'WE-456',
    taillights: { x: 2440, y: 1200, width: 1120, height: 300 },
    outputSize: [2048, 1024],
  },
  tireNormal: 'car_tire_normal',
  tireOcclusion: 'car_tire_occlusion',
  shadowTexture: 'car_shadow_diffuse',
  textureMaxSize: 1024,
  targetLength: 4.5,
  maxBytes: 3 * 1024 * 1024,
}
```

- [ ] **Step 6: 实现 `scripts/lib/carRoles.ts`**

```ts
import { CarError, type Role, type RoleRule } from './carTypes.ts'

export function assignRoles(meshNames: string[], rules: RoleRule[], remove: RegExp[]): Map<string, Role> {
  const deadRules = rules.filter((rule) => !meshNames.some((name) => rule.mesh.test(name)))
  if (deadRules.length > 0) {
    throw new CarError(`car.config.ts 里这些规则没有匹配到任何网格：${deadRules.map((rule) => rule.mesh.source).join('、')}`)
  }
  const deadRemovals = remove.filter((pattern) => !meshNames.some((name) => pattern.test(name)))
  if (deadRemovals.length > 0) {
    throw new CarError(`car.config.ts 里这些删除规则没有匹配到任何网格：${deadRemovals.map((pattern) => pattern.source).join('、')}`)
  }
  const roles = new Map<string, Role>()
  const uncovered: string[] = []
  for (const name of meshNames) {
    if (remove.some((pattern) => pattern.test(name))) continue
    const rule = rules.find((candidate) => candidate.mesh.test(name))
    if (rule) roles.set(name, rule.role)
    else uncovered.push(name)
  }
  if (uncovered.length > 0) throw new CarError(`这些网格没有被 car.config.ts 的任何规则覆盖：${uncovered.join('、')}`)
  return roles
}
```

- [ ] **Step 7: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/carRoles.test.ts`
Expected: PASS（4 个测试）。

- [ ] **Step 8: 类型检查**

Run: `npx tsc -b`
Expected: 无输出（通过）。

- [ ] **Step 9: Commit**

```powershell
git add package.json package-lock.json scripts/lib/carTypes.ts scripts/car.config.ts scripts/lib/carRoles.ts scripts/lib/carRoles.test.ts
git commit -m "feat(car): model config and mesh role assignment"
```

---

### Task 8: 车身贴图集转换、车牌和尾灯

**Files:**
- Create: `scripts/lib/carAtlas.ts`、`scripts/lib/carAtlas.test.ts`

**Interfaces:**
- Consumes: `CarError`、`AtlasConfig`、`Rect`（Task 7）
- Produces:
  - `type Rgb = [number, number, number]`
  - `interface RawImage { data: Uint8Array; width: number; height: number }`（始终 RGBA）
  - `interface PixelOut { base: Rgb; roughness: number; metallic: number }`（0–1）
  - 常量 `DIELECTRIC = 0.04`、`PAINT_BASE = 9`（sRGB 0–255）、`PAINT_ROUGHNESS = 0.55`、`PLATE_ROUGHNESS = 0.6`
  - `decodeRgba(image: Uint8Array): Promise<RawImage>`
  - `solveMetallic(diffuse: number, specular: number, oneMinusSpecularStrength: number): number`
  - `specGlossPixel(diffuse: Rgb, specular: Rgb, glossiness: number): PixelOut`（输入 0–1；`glossiness === 0` 的像素视为贴图集里的空白填充：保留漫反射、非金属、粗糙度 1）
  - `isPaint(rgb: Rgb, paint: Rgb, tolerance: number): boolean`、`isTaillight(rgb: Rgb): boolean`（0–255）、`inRect(x, y, rect): boolean`
  - `interface AtlasPixels { baseColor: Uint8Array; orm: Uint8Array; emissive: Uint8Array; emissivePixels: number; width: number; height: number }`（三张都是 RGB；ORM 的 R=遮挡、G=粗糙度、B=金属度）
  - `convertAtlas(diffuse: RawImage, specGloss: RawImage, occlusion: RawImage, config: AtlasConfig): AtlasPixels`
  - `plateSvg(text: string, width: number, height: number): string`
  - `paintPlate(rgb: Uint8Array, width: number, height: number, plate: Rect, text: string): Promise<Uint8Array>`（左右镜像绘制）
  - `interface BodyTextures { baseColor: Uint8Array; orm: Uint8Array; emissive: Uint8Array; emissivePixels: number }`（WebP 编码后的字节）
  - `buildBodyTextures(images: { diffuse: Uint8Array; specularGlossiness: Uint8Array; occlusion: Uint8Array }, config: AtlasConfig): Promise<BodyTextures>`（尾灯区域一个像素都没挑出来时抛 `CarError`）
  - `fitWebp(image: Uint8Array, maxSize: number, quality?: number): Promise<Uint8Array>`（最长边不超过 `maxSize`，不放大）

- [ ] **Step 1: 写失败的测试 `scripts/lib/carAtlas.test.ts`**

```ts
// @vitest-environment node
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { carConfig } from '../car.config.ts'
import {
  buildBodyTextures,
  convertAtlas,
  decodeRgba,
  fitWebp,
  isTaillight,
  PAINT_BASE,
  PAINT_ROUGHNESS,
  paintPlate,
  plateSvg,
  PLATE_ROUGHNESS,
  specGlossPixel,
  type RawImage,
} from './carAtlas.ts'
import { CarError, type AtlasConfig } from './carTypes.ts'

const W = 16
const H = 8
const config: AtlasConfig = {
  ...carConfig.atlas,
  plate: { x: 0, y: 0, width: 4, height: 4 },
  taillights: { x: 8, y: 0, width: 8, height: 4 },
  outputSize: [8, 4],
}

type Rgba = [number, number, number, number]

function image(fill: (x: number, y: number) => Rgba, width = W, height = H): RawImage {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4)
  return { data, width, height }
}

const png = (img: RawImage) => sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } }).png().toBuffer()
const rgbAt = (rgb: Uint8Array, x: number, y: number, width = W) => [...rgb.slice((y * width + x) * 3, (y * width + x) * 3 + 3)]

const RED: Rgba = [200, 30, 20, 255]
const diffuse = image((x, y) => ((x === 10 && y === 2) || (x === 6 && y === 6) ? RED : [0, 0, 0, 255]))
const specGloss = image((x, y) => (x === 5 && y === 5 ? [60, 128, 26, 178] : [10, 10, 10, 127]))
const occlusion = image(() => [200, 255, 255, 255])

describe('specGlossPixel', () => {
  it('keeps a plain dielectric as it is', () => {
    const out = specGlossPixel([0.5, 0.5, 0.5], [0.04, 0.04, 0.04], 0.5)
    expect(out.metallic).toBeCloseTo(0)
    out.base.forEach((v) => expect(v).toBeCloseTo(0.5))
    expect(out.roughness).toBeCloseTo(0.5)
  })

  it('turns a bright specular over black into polished metal', () => {
    const out = specGlossPixel([0, 0, 0], [0.95, 0.95, 0.95], 0.95)
    expect(out.metallic).toBeCloseTo(1, 3)
    out.base.forEach((v) => expect(v).toBeCloseTo(0.95, 2))
    expect(out.roughness).toBeCloseTo(0.05)
  })

  it('treats zero-gloss padding as rough non-metal', () => {
    expect(specGlossPixel([0.2, 0.2, 0.2], [1, 1, 1], 0)).toEqual({ base: [0.2, 0.2, 0.2], roughness: 1, metallic: 0 })
  })
})

describe('isTaillight', () => {
  it('picks red and amber lamp pixels only', () => {
    expect(isTaillight([120, 0, 5])).toBe(true)
    expect(isTaillight([255, 170, 40])).toBe(true)
    expect(isTaillight([255, 255, 255])).toBe(false)
    expect(isTaillight([50, 10, 10])).toBe(false)
  })
})

describe('convertAtlas', () => {
  const out = convertAtlas(diffuse, specGloss, occlusion, config)

  it('paints the body area matte black', () => {
    expect(rgbAt(out.baseColor, 5, 5)).toEqual([PAINT_BASE, PAINT_BASE, PAINT_BASE])
    expect(rgbAt(out.orm, 5, 5)).toEqual([200, Math.round(PAINT_ROUGHNESS * 255), 0])
  })

  it('lights up red pixels inside the taillight area only', () => {
    expect(rgbAt(out.emissive, 10, 2)).toEqual([200, 30, 20])
    expect(rgbAt(out.emissive, 6, 6)).toEqual([0, 0, 0])
    expect(out.emissivePixels).toBe(1)
    expect(rgbAt(out.baseColor, 10, 2)).toEqual([200, 30, 20])
    expect(rgbAt(out.orm, 10, 2)[2]).toBe(0)
  })

  it('makes the plate a plain non-metal', () => {
    expect(rgbAt(out.orm, 1, 1)).toEqual([200, Math.round(PLATE_ROUGHNESS * 255), 0])
  })

  it('copies the occlusion into the red channel', () => {
    expect(rgbAt(out.orm, 3, 7)[0]).toBe(200)
  })

  it('rejects textures of different sizes', () => {
    const small = image(() => [0, 0, 0, 255], 8, 8)
    expect(() => convertAtlas(diffuse, specGloss, small, config)).toThrow(CarError)
  })
})

describe('plate', () => {
  it('writes only the new number', () => {
    const svg = plateSvg('WE-456', 302, 200)
    expect(svg).toContain('WE-456')
    expect(svg).not.toMatch(/NEW YORK|EMPIRE/)
  })

  it('draws inside the plate area and nowhere else', async () => {
    const width = 64
    const height = 32
    const plate = { x: 8, y: 8, width: 30, height: 20 }
    const painted = await paintPlate(new Uint8Array(width * height * 3), width, height, plate, 'WE-456')
    let bright = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [r] = rgbAt(painted, x, y, width)
        const inside = x >= plate.x && x < plate.x + plate.width && y >= plate.y && y < plate.y + plate.height
        if (!inside) expect(r).toBe(0)
        else if (r > 150) bright++
      }
    }
    expect(bright).toBeGreaterThan(50)
  })

  it('refuses a plate area outside the texture', async () => {
    await expect(paintPlate(new Uint8Array(16 * 8 * 3), 16, 8, { x: 10, y: 0, width: 10, height: 4 }, 'WE-456')).rejects.toThrow(CarError)
  })
})

describe('buildBodyTextures', () => {
  it('encodes all three maps as WebP at the output size', async () => {
    const result = await buildBodyTextures(
      { diffuse: await png(diffuse), specularGlossiness: await png(specGloss), occlusion: await png(occlusion) },
      config,
    )
    expect(result.emissivePixels).toBe(1)
    for (const data of [result.baseColor, result.orm, result.emissive]) {
      const meta = await sharp(data).metadata()
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 8, 4])
    }
  })

  it('fails when the taillight area has no lamp pixels', async () => {
    const dark = image(() => [0, 0, 0, 255])
    await expect(
      buildBodyTextures({ diffuse: await png(dark), specularGlossiness: await png(specGloss), occlusion: await png(occlusion) }, config),
    ).rejects.toThrow(/尾灯/)
  })
})

describe('decodeRgba and fitWebp', () => {
  it('always decodes to four channels', async () => {
    const gray = await sharp({ create: { width: 4, height: 2, channels: 3, background: '#808080' } }).toColourspace('b-w').png().toBuffer()
    const decoded = await decodeRgba(gray)
    expect(decoded.data.length).toBe(4 * 2 * 4)
  })

  it('shrinks to the longest side without enlarging', async () => {
    const big = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#808080' } }).png().toBuffer()
    expect(await sharp(await fitWebp(big, 10)).metadata()).toMatchObject({ format: 'webp', width: 10, height: 5 })
    expect(await sharp(await fitWebp(big, 100)).metadata()).toMatchObject({ width: 40, height: 20 })
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/carAtlas.test.ts`
Expected: FAIL，提示找不到 `./carAtlas.ts`。

- [ ] **Step 3: 实现 `scripts/lib/carAtlas.ts`**

```ts
import sharp from 'sharp'
import { CarError, type AtlasConfig, type Rect } from './carTypes.ts'

export type Rgb = [number, number, number]

export interface RawImage {
  data: Uint8Array
  width: number
  height: number
}

export interface PixelOut {
  base: Rgb
  roughness: number
  metallic: number
}

export const DIELECTRIC = 0.04
export const PAINT_BASE = 9
export const PAINT_ROUGHNESS = 0.55
export const PLATE_ROUGHNESS = 0.6

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const unit = (rgb: Rgb): Rgb => [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255]

export async function decodeRgba(image: Uint8Array): Promise<RawImage> {
  const { data, info } = await sharp(image).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 4) throw new CarError(`贴图解码后应有 4 个通道，实际 ${info.channels} 个`)
  return { data, width: info.width, height: info.height }
}

export function solveMetallic(diffuse: number, specular: number, oneMinusSpecularStrength: number): number {
  if (specular < DIELECTRIC) return 0
  const a = DIELECTRIC
  const b = (diffuse * oneMinusSpecularStrength) / (1 - DIELECTRIC) + specular - 2 * DIELECTRIC
  const c = DIELECTRIC - specular
  const discriminant = Math.max(b * b - 4 * a * c, 0)
  return clamp01((-b + Math.sqrt(discriminant)) / (2 * a))
}

export function specGlossPixel(diffuse: Rgb, specular: Rgb, glossiness: number): PixelOut {
  if (glossiness === 0) return { base: diffuse, roughness: 1, metallic: 0 }
  const oneMinus = 1 - Math.max(...specular)
  const metallic = solveMetallic(luminance(diffuse), luminance(specular), oneMinus)
  const t = metallic * metallic
  const dielectricScale = oneMinus / (1 - DIELECTRIC) / Math.max(1 - metallic, 1e-4)
  const base = diffuse.map((d, i) =>
    clamp01(d * dielectricScale * (1 - t) + ((specular[i] - DIELECTRIC * (1 - metallic)) / Math.max(metallic, 1e-4)) * t),
  ) as Rgb
  return { base, roughness: 1 - glossiness, metallic }
}

export function isPaint(rgb: Rgb, paint: Rgb, tolerance: number): boolean {
  return rgb.every((value, i) => Math.abs(value - paint[i]) <= tolerance)
}

export function isTaillight([r, g, b]: Rgb): boolean {
  return r >= 90 && r >= 1.6 * b && g <= 0.85 * r
}

export function inRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

export interface AtlasPixels {
  baseColor: Uint8Array
  orm: Uint8Array
  emissive: Uint8Array
  emissivePixels: number
  width: number
  height: number
}

function classify(x: number, y: number, diffuse: Rgb, specular: Rgb, glossiness: number, lit: boolean, config: AtlasConfig): PixelOut {
  if (inRect(x, y, config.plate)) return { base: unit(diffuse), roughness: PLATE_ROUGHNESS, metallic: 0 }
  if (isPaint(specular, config.paintSpecular, config.paintTolerance)) {
    const paint = PAINT_BASE / 255
    return { base: [paint, paint, paint], roughness: PAINT_ROUGHNESS, metallic: 0 }
  }
  if (lit) return { base: unit(diffuse), roughness: 1 - glossiness, metallic: 0 }
  return specGlossPixel(unit(diffuse), unit(specular), glossiness)
}

export function convertAtlas(diffuse: RawImage, specGloss: RawImage, occlusion: RawImage, config: AtlasConfig): AtlasPixels {
  const { width, height } = diffuse
  for (const other of [specGloss, occlusion]) {
    if (other.width !== width || other.height !== height) {
      throw new CarError(`车身贴图尺寸不一致：${width}×${height} 和 ${other.width}×${other.height}`)
    }
  }
  const baseColor = new Uint8Array(width * height * 3)
  const orm = new Uint8Array(width * height * 3)
  const emissive = new Uint8Array(width * height * 3)
  let emissivePixels = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const o = (y * width + x) * 3
      const d: Rgb = [diffuse.data[i], diffuse.data[i + 1], diffuse.data[i + 2]]
      const s: Rgb = [specGloss.data[i], specGloss.data[i + 1], specGloss.data[i + 2]]
      const glossiness = specGloss.data[i + 3] / 255
      const lit = inRect(x, y, config.taillights) && isTaillight(d)
      const pixel = classify(x, y, d, s, glossiness, lit, config)
      baseColor[o] = Math.round(pixel.base[0] * 255)
      baseColor[o + 1] = Math.round(pixel.base[1] * 255)
      baseColor[o + 2] = Math.round(pixel.base[2] * 255)
      orm[o] = occlusion.data[i]
      orm[o + 1] = Math.round(pixel.roughness * 255)
      orm[o + 2] = Math.round(pixel.metallic * 255)
      if (lit) {
        emissive.set(d, o)
        emissivePixels++
      }
    }
  }
  return { baseColor, orm, emissive, emissivePixels, width, height }
}

export function plateSvg(text: string, width: number, height: number): string {
  const border = Math.max(1, Math.round(height * 0.05))
  const radius = Math.round(height * 0.07)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<rect width="${width}" height="${height}" rx="${radius}" fill="#1c1c1f"/>`,
    `<rect x="${border}" y="${border}" width="${width - 2 * border}" height="${height - 2 * border}" rx="${Math.max(0, radius - border)}" fill="#d4d4d8"/>`,
    `<text x="${width / 2}" y="${height / 2}" dominant-baseline="central" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(height * 0.36)}" textLength="${Math.round(width * 0.8)}" lengthAdjust="spacingAndGlyphs" fill="#1c1c1f">${text}</text>`,
    '</svg>',
  ].join('')
}

export async function paintPlate(rgb: Uint8Array, width: number, height: number, plate: Rect, text: string): Promise<Uint8Array> {
  if (plate.x < 0 || plate.y < 0 || plate.x + plate.width > width || plate.y + plate.height > height) {
    throw new CarError(`车牌区域 ${plate.x},${plate.y} ${plate.width}×${plate.height} 超出贴图 ${width}×${height}`)
  }
  const overlay = await sharp(Buffer.from(plateSvg(text, plate.width, plate.height))).flop().png().toBuffer()
  const { data, info } = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .composite([{ input: overlay, left: plate.x, top: plate.y }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.channels !== 3) throw new CarError(`车牌合成后应有 3 个通道，实际 ${info.channels} 个`)
  return data
}

export interface BodyTextures {
  baseColor: Uint8Array
  orm: Uint8Array
  emissive: Uint8Array
  emissivePixels: number
}

export async function buildBodyTextures(
  images: { diffuse: Uint8Array; specularGlossiness: Uint8Array; occlusion: Uint8Array },
  config: AtlasConfig,
): Promise<BodyTextures> {
  const [diffuse, specGloss, occlusion] = await Promise.all([
    decodeRgba(images.diffuse),
    decodeRgba(images.specularGlossiness),
    decodeRgba(images.occlusion),
  ])
  const pixels = convertAtlas(diffuse, specGloss, occlusion, config)
  if (pixels.emissivePixels === 0) throw new CarError('尾灯区域里没有找到红橙色像素，请检查 car.config.ts 的 taillights')
  const withPlate = await paintPlate(pixels.baseColor, pixels.width, pixels.height, config.plate, config.plateText)
  const [outWidth, outHeight] = config.outputSize
  const encode = (data: Uint8Array) =>
    sharp(data, { raw: { width: pixels.width, height: pixels.height, channels: 3 } })
      .resize(outWidth, outHeight, { fit: 'fill' })
      .webp({ quality: 82 })
      .toBuffer()
  return {
    baseColor: await encode(withPlate),
    orm: await encode(pixels.orm),
    emissive: await encode(pixels.emissive),
    emissivePixels: pixels.emissivePixels,
  }
}

export function fitWebp(image: Uint8Array, maxSize: number, quality = 82): Promise<Uint8Array> {
  return sharp(image).resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer()
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/carAtlas.test.ts`
Expected: PASS（16 个测试）。

- [ ] **Step 5: 类型检查**

Run: `npx tsc -b`
Expected: 无输出。

- [ ] **Step 6: Commit**

```powershell
git add scripts/lib/carAtlas.ts scripts/lib/carAtlas.test.ts
git commit -m "feat(car): convert the body atlas, repaint the plate and extract taillights"
```

---

### Task 9: 摆正车模型的几何计算

**Files:**
- Create: `scripts/lib/carAlign.ts`、`scripts/lib/carAlign.test.ts`

**Interfaces:**
- Consumes: `CarError`（Task 7）
- Produces:
  - `type Vec3 = [number, number, number]`、`interface Bounds { min: Vec3; max: Vec3 }`
  - `headingYaw(front: Vec3, back: Vec3): number`：绕 Y 轴旋转该角度后，从后轮中点指向前轮中点的方向变为 +Z；前后重合时抛 `CarError`
  - `yawQuaternion(yaw: number): [number, number, number, number]`
  - `unionBounds(list: Bounds[]): Bounds`
  - `groundScale(bounds: Bounds, targetLength: number): number`（按 Z 方向长度缩放；长度为 0 时抛 `CarError`）
  - `groundOffset(bounds: Bounds): Vec3`（水平居中、最低点放到 y = 0）

- [ ] **Step 1: 写失败的测试 `scripts/lib/carAlign.test.ts`**

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { groundOffset, groundScale, headingYaw, unionBounds, yawQuaternion, type Vec3 } from './carAlign.ts'
import { CarError } from './carTypes.ts'

function rotateY([x, y, z]: Vec3, yaw: number): Vec3 {
  return [x * Math.cos(yaw) + z * Math.sin(yaw), y, -x * Math.sin(yaw) + z * Math.cos(yaw)]
}

function expectFacesPlusZ(front: Vec3, back: Vec3) {
  const yaw = headingYaw(front, back)
  const heading: Vec3 = [front[0] - back[0], 0, front[2] - back[2]]
  const [x, , z] = rotateY(heading, yaw)
  expect(x).toBeCloseTo(0)
  expect(z).toBeGreaterThan(0)
}

describe('headingYaw', () => {
  it('turns a car facing -Z around', () => expectFacesPlusZ([0, 0, -1], [0, 0, 1]))
  it('turns a car facing +X', () => expectFacesPlusZ([1, 0, 0], [-1, 0, 0]))
  it('leaves a car facing +Z alone', () => expect(headingYaw([0, 0, 1], [0, 0, -1])).toBeCloseTo(0))
  it('rejects wheels on top of each other', () => expect(() => headingYaw([1, 0, 1], [1, 2, 1])).toThrow(CarError))
})

describe('yawQuaternion', () => {
  it('describes the same turn around Y', () => {
    const [x, y, z, w] = yawQuaternion(Math.PI)
    expect([x, z]).toEqual([0, 0])
    expect(y).toBeCloseTo(1)
    expect(w).toBeCloseTo(0)
  })
})

describe('bounds', () => {
  it('unions boxes', () => {
    expect(unionBounds([
      { min: [0, 0, 0], max: [1, 1, 1] },
      { min: [-1, 0.5, -2], max: [0.5, 3, 0] },
    ])).toEqual({ min: [-1, 0, -2], max: [1, 3, 1] })
  })

  it('scales the length along Z to the target', () => {
    expect(groundScale({ min: [0, 0, -1], max: [0, 0, 1] }, 4.5)).toBe(2.25)
    expect(() => groundScale({ min: [0, 0, 1], max: [0, 0, 1] }, 4.5)).toThrow(CarError)
  })

  it('centres the car and puts it on the ground', () => {
    expect(groundOffset({ min: [-1, 0.2, -3], max: [3, 2, 1] })).toEqual([-1, -0.2, 1])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/carAlign.test.ts`
Expected: FAIL，提示找不到 `./carAlign.ts`。

- [ ] **Step 3: 实现 `scripts/lib/carAlign.ts`**

```ts
import { CarError } from './carTypes.ts'

export type Vec3 = [number, number, number]

export interface Bounds {
  min: Vec3
  max: Vec3
}

export function headingYaw(front: Vec3, back: Vec3): number {
  const dx = front[0] - back[0]
  const dz = front[2] - back[2]
  if (Math.hypot(dx, dz) < 1e-9) throw new CarError('前轮和后轮在水平面上重合，无法判断车头方向')
  return -Math.atan2(dx, dz)
}

export function yawQuaternion(yaw: number): [number, number, number, number] {
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
}

export function unionBounds(list: Bounds[]): Bounds {
  const axes = [0, 1, 2] as const
  return {
    min: axes.map((i) => Math.min(...list.map((b) => b.min[i]))) as Vec3,
    max: axes.map((i) => Math.max(...list.map((b) => b.max[i]))) as Vec3,
  }
}

export function groundScale(bounds: Bounds, targetLength: number): number {
  const length = bounds.max[2] - bounds.min[2]
  if (!(length > 0)) throw new CarError('车模型在前后方向上没有长度，无法缩放')
  return targetLength / length
}

export function groundOffset(bounds: Bounds): Vec3 {
  return [-(bounds.min[0] + bounds.max[0]) / 2, -bounds.min[1], -(bounds.min[2] + bounds.max[2]) / 2]
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/carAlign.test.ts`
Expected: PASS（8 个测试）。

- [ ] **Step 5: Commit**

```powershell
git add scripts/lib/carAlign.ts scripts/lib/carAlign.test.ts
git commit -m "feat(car): heading, ground and scale math for aligning the model"
```

---

### Task 10: 用 gltf-transform 处理车模型

**Files:**
- Create: `scripts/lib/carModel.ts`、`scripts/lib/carFixture.ts`、`scripts/lib/carModel.test.ts`

**Interfaces:**
- Consumes: `assignRoles`（Task 7）；`buildBodyTextures`、`fitWebp`（Task 8）；`headingYaw`、`yawQuaternion`、`unionBounds`、`groundScale`、`groundOffset`、`Bounds`、`Vec3`（Task 9）
- Produces:
  - `linearColor(hex: string): [number, number, number, number]`（sRGB 十六进制 → 线性 RGBA 因子）
  - `interface CarReport { meshes: string[]; materials: string[] }`、`describeCar(doc: Document): CarReport`
  - `processCar(doc: Document, config: CarConfig): Promise<void>`，处理后：
    - 只有 6 个材质 `body`、`wheel`、`caliper`、`glass`、`tire`、`shadow`；不再使用 `KHR_materials_pbrSpecularGlossiness`；所有贴图为 `image/webp` 并启用 `EXT_texture_webp`；`body` 带 `KHR_materials_clearcoat`、发光贴图和 `KHR_materials_emissive_strength`。
    - 四个车轮节点的 `extras.wheel` 分别为 `'FL' | 'FR' | 'BL' | 'BR'`，各自的网格含轮胎和轮毂两个图元；其余网格按材质合并。
    - 顶层只有一个名为 `car` 的节点，车头朝 +Z、最低点 y = 0、水平居中、车长 `config.targetLength`（不计阴影平面）。
  - 测试辅助（`carFixture.ts`）：`buildCarFixture(): Promise<Document>`（结构模仿 V12 Goblin，车头朝 −Z、整体缩放 0.5）、`fixtureConfig(overrides?: Partial<CarConfig>): CarConfig`

- [ ] **Step 1: 写测试辅助 `scripts/lib/carFixture.ts`**

```ts
import { Document, type Buffer as GltfBuffer, type Material, type Node, type Primitive } from '@gltf-transform/core'
import { KHRMaterialsPBRSpecularGlossiness } from '@gltf-transform/extensions'
import sharp from 'sharp'
import { carConfig } from '../car.config.ts'
import type { CarConfig } from './carTypes.ts'

type Vec3 = [number, number, number]
type Rgba = [number, number, number, number]

export const FIXTURE_TAILLIGHT = { x: 44, y: 20 }

const WHEELS: [string, number, number][] = [
  ['FL', 0.85, 1.4],
  ['FR', -0.85, 1.4],
  ['BL', 0.85, -1.4],
  ['BR', -0.85, -1.4],
]

async function png(width: number, height: number, fill: (x: number, y: number) => Rgba): Promise<Uint8Array> {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4)
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

function box(doc: Document, buffer: GltfBuffer, size: Vec3, center: Vec3 = [0, 0, 0]): Primitive {
  const [hx, hy, hz] = size.map((v) => v / 2)
  const positions: number[] = []
  for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [-hz, hz]) positions.push(center[0] + x, center[1] + y, center[2] + z)
  const indices = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3]
  return doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer))
}

export async function buildCarFixture(): Promise<Document> {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const texture = async (name: string, data: Promise<Uint8Array>) =>
    doc.createTexture(name).setURI(`${name}.png`).setMimeType('image/png').setImage(await data)

  const isLamp = (x: number, y: number) => (x === FIXTURE_TAILLIGHT.x && y === FIXTURE_TAILLIGHT.y) || (x === 10 && y === 28)
  const diffuse = await texture('car_body_diffuse', png(64, 32, (x, y) => (isLamp(x, y) ? [200, 30, 20, 255] : [0, 0, 0, 255])))
  const specGloss = await texture('car_body_specularGlossiness', png(64, 32, (x, y) => (x < 8 && y >= 16 ? [60, 128, 26, 178] : [0, 0, 0, 127])))
  const occlusion = await texture('car_body_occlusion', png(64, 32, () => [200, 255, 255, 255]))
  const tireNormal = await texture('car_tire_normal', png(8, 8, () => [128, 128, 255, 255]))
  const tireOcclusion = await texture('car_tire_occlusion', png(8, 8, () => [255, 255, 255, 255]))
  const shadowTexture = await texture('car_shadow_diffuse', png(8, 8, () => [255, 255, 255, 128]))

  const specGlossExtension = doc.createExtension(KHRMaterialsPBRSpecularGlossiness)
  const specGlossMaterial = (name: string): Material =>
    doc.createMaterial(name).setExtension('KHR_materials_pbrSpecularGlossiness', specGlossExtension.createPBRSpecularGlossiness())
  const bodyMaterial = specGlossMaterial('car_body').setBaseColorTexture(diffuse).setOcclusionTexture(occlusion)
  bodyMaterial.setExtension(
    'KHR_materials_pbrSpecularGlossiness',
    specGlossExtension.createPBRSpecularGlossiness().setSpecularGlossinessTexture(specGloss),
  )
  const tireMaterial = specGlossMaterial('car_tire').setNormalTexture(tireNormal).setOcclusionTexture(tireOcclusion)
  const glassMaterial = specGlossMaterial('car_glass')
  const clearcoatMaterial = specGlossMaterial('clearcoat')
  const shadowMaterial = specGlossMaterial('car_shadow').setBaseColorTexture(shadowTexture).setAlphaMode('BLEND')

  const part = (name: string, material: Material, primitive: Primitive): Node =>
    doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive.setMaterial(material)))
  const group = (name: string, ...children: Node[]): Node => {
    const node = doc.createNode(name)
    for (const child of children) node.addChild(child)
    return node
  }

  const top = doc.createNode('Sketchfab_model').setRotation([0, 1, 0, 0]).setScale([0.5, 0.5, 0.5])
  top.addChild(group('car_body', part('car_body_car_body_0', bodyMaterial, box(doc, buffer, [2, 1, 4.4], [0, 0.85, 0]))))
  top.addChild(group('car_glass', part('car_glass_car_glass_0', glassMaterial, box(doc, buffer, [1.6, 0.4, 2], [0, 1.45, -0.2]))))
  top.addChild(group('clearcoat', part('clearcoat_clearcoat_0', clearcoatMaterial, box(doc, buffer, [2.1, 1.1, 4.5], [0, 0.85, 0]))))
  top.addChild(group('car_shadow', part('car_shadow_car_shadow_0', shadowMaterial, box(doc, buffer, [10, 0, 10]))))
  for (const [position, x, z] of WHEELS) {
    const wheel = group(
      `car_wheel_${position}`,
      part(`car_wheel_${position}_car_tire_0`, tireMaterial, box(doc, buffer, [0.3, 0.7, 0.7])),
      part(`car_wheel_${position}_car_body_0`, bodyMaterial, box(doc, buffer, [0.32, 0.5, 0.5])),
    )
    const brake = group(`car_brake_${position}`, part(`car_brake_${position}_car_body_0`, bodyMaterial, box(doc, buffer, [0.1, 0.2, 0.3], [0, 0.1, 0])))
    top.addChild(wheel.setTranslation([x, 0.35, z]))
    top.addChild(brake.setTranslation([x, 0.35, z]))
  }
  const scene = doc.createScene('Sketchfab_Scene').addChild(top)
  doc.getRoot().setDefaultScene(scene)
  return doc
}

export function fixtureConfig(overrides: Partial<CarConfig> = {}): CarConfig {
  return {
    ...carConfig,
    atlas: {
      ...carConfig.atlas,
      plate: { x: 16, y: 2, width: 12, height: 8 },
      taillights: { x: 40, y: 16, width: 16, height: 8 },
      outputSize: [32, 16],
    },
    textureMaxSize: 8,
    ...overrides,
  }
}
```

- [ ] **Step 2: 写失败的测试 `scripts/lib/carModel.test.ts`**

```ts
// @vitest-environment node
import type { Document, Node } from '@gltf-transform/core'
import { getBounds } from '@gltf-transform/functions'
import { describe, expect, it } from 'vitest'
import { carConfig } from '../car.config.ts'
import { buildCarFixture, fixtureConfig } from './carFixture.ts'
import { describeCar, linearColor, processCar } from './carModel.ts'
import { CarError } from './carTypes.ts'

async function processed(): Promise<Document> {
  const doc = await buildCarFixture()
  await processCar(doc, fixtureConfig())
  return doc
}

const meshNodes = (doc: Document) => doc.getRoot().listNodes().filter((node) => node.getMesh() !== null)
const materialsOf = (node: Node) => node.getMesh()!.listPrimitives().map((p) => p.getMaterial()?.getName())
const material = (doc: Document, name: string) => doc.getRoot().listMaterials().find((m) => m.getName() === name)!

describe('linearColor', () => {
  it('converts sRGB hex to linear factors', () => {
    expect(linearColor('#FFFFFF')).toEqual([1, 1, 1, 1])
    expect(linearColor('#000000')).toEqual([0, 0, 0, 1])
    expect(linearColor('#9E1C22')[0]).toBeCloseTo(0.342, 3)
  })
})

describe('describeCar', () => {
  it('lists the original meshes and materials', async () => {
    const report = describeCar(await buildCarFixture())
    expect(report.meshes).toContain('car_wheel_FL_car_tire_0')
    expect(report.materials).toEqual(expect.arrayContaining(['car_body', 'clearcoat']))
  })
})

describe('processCar', () => {
  it('replaces the Spec-Gloss materials with one material per role and drops the clearcoat shell', async () => {
    const doc = await processed()
    expect(doc.getRoot().listMaterials().map((m) => m.getName()).sort()).toEqual(['body', 'caliper', 'glass', 'shadow', 'tire', 'wheel'])
    expect(doc.getRoot().listMeshes().map((m) => m.getName())).not.toContain('clearcoat_clearcoat_0')
    const used = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)
    expect(used).not.toContain('KHR_materials_pbrSpecularGlossiness')
    expect(used).toEqual(expect.arrayContaining(['EXT_texture_webp', 'KHR_materials_clearcoat', 'KHR_materials_emissive_strength']))
    expect(doc.getRoot().listTextures().every((t) => t.getMimeType() === 'image/webp')).toBe(true)
  })

  it('gives the body clearcoat and glowing taillights, and the calipers ox-blood red', async () => {
    const doc = await processed()
    const body = material(doc, 'body')
    expect(body.getExtension('KHR_materials_clearcoat')).not.toBeNull()
    expect(body.getEmissiveTexture()).not.toBeNull()
    const caliper = material(doc, 'caliper').getBaseColorFactor()
    linearColor('#9E1C22').forEach((v, i) => expect(caliper[i]).toBeCloseTo(v, 6))
    expect(material(doc, 'shadow').getAlphaMode()).toBe('BLEND')
    expect(material(doc, 'glass').getAlphaMode()).toBe('OPAQUE')
  })

  it('keeps four wheels as separate nodes, each with tire and rim', async () => {
    const doc = await processed()
    const wheels = meshNodes(doc).filter((node) => node.getExtras().wheel !== undefined)
    expect(wheels.map((node) => node.getExtras().wheel).sort()).toEqual(['BL', 'BR', 'FL', 'FR'])
    for (const wheel of wheels) expect(materialsOf(wheel).sort()).toEqual(['tire', 'wheel'])
  })

  it('joins everything else by material', async () => {
    const doc = await processed()
    const rest = meshNodes(doc).filter((node) => node.getExtras().wheel === undefined)
    expect(rest.flatMap(materialsOf).sort()).toEqual(['body', 'caliper', 'glass', 'shadow'])
  })

  it('turns the car to face +Z, puts it on the ground and scales it to the target length', async () => {
    const doc = await processed()
    const scene = doc.getRoot().getDefaultScene()!
    expect(scene.listChildren().map((node) => node.getName())).toEqual(['car'])
    const solid = meshNodes(doc).filter((node) => !materialsOf(node).includes('shadow'))
    const bounds = solid.map((node) => getBounds(node))
    const min = [0, 1, 2].map((i) => Math.min(...bounds.map((b) => b.min[i])))
    const max = [0, 1, 2].map((i) => Math.max(...bounds.map((b) => b.max[i])))
    expect(min[1]).toBeCloseTo(0, 5)
    expect(max[2] - min[2]).toBeCloseTo(4.5, 5)
    expect((min[0] + max[0]) / 2).toBeCloseTo(0, 5)
    expect((min[2] + max[2]) / 2).toBeCloseTo(0, 5)
    const wheelZ = (position: string) => meshNodes(doc).find((node) => node.getExtras().wheel === position)!.getWorldTranslation()[2]
    expect(wheelZ('FL')).toBeGreaterThan(0)
    expect(wheelZ('FR')).toBeGreaterThan(0)
    expect(wheelZ('BL')).toBeLessThan(0)
  })

  it('rejects a config rule that matches no mesh', async () => {
    const doc = await buildCarFixture()
    const roles = [...carConfig.roles, { role: 'body' as const, mesh: /^spoiler_/ }]
    await expect(processCar(doc, fixtureConfig({ roles }))).rejects.toThrow(CarError)
  })

  it('rejects wheel parts that carry their own offset', async () => {
    const doc = await buildCarFixture()
    doc.getRoot().listNodes().find((node) => node.getName() === 'car_wheel_FL_car_tire_0')!.setTranslation([0.1, 0, 0])
    await expect(processCar(doc, fixtureConfig())).rejects.toThrow(/car_wheel_FL_car_tire_0/)
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/carModel.test.ts`
Expected: FAIL，提示找不到 `./carModel.ts`。

- [ ] **Step 4: 实现 `scripts/lib/carModel.ts`**

```ts
import { Node, type Document, type Material, type Texture } from '@gltf-transform/core'
import {
  EXTTextureWebP,
  KHRMaterialsClearcoat,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsPBRSpecularGlossiness,
} from '@gltf-transform/extensions'
import { flatten, getBounds, join, prune } from '@gltf-transform/functions'
import { groundOffset, groundScale, headingYaw, unionBounds, yawQuaternion, type Bounds, type Vec3 } from './carAlign.ts'
import { buildBodyTextures, fitWebp } from './carAtlas.ts'
import { assignRoles } from './carRoles.ts'
import { CarError, type CarConfig, type Role } from './carTypes.ts'

export function linearColor(hex: string): [number, number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return [channel(16), channel(8), channel(0), 1]
}

export interface CarReport {
  meshes: string[]
  materials: string[]
}

export function describeCar(doc: Document): CarReport {
  return {
    meshes: doc.getRoot().listMeshes().map((mesh) => mesh.getName()),
    materials: doc.getRoot().listMaterials().map((material) => material.getName()),
  }
}

async function createMaterials(doc: Document, config: CarConfig): Promise<Record<Role, Material>> {
  const image = (fragment: string): Uint8Array => {
    const data = doc.getRoot().listTextures().find((texture) => texture.getURI().includes(fragment))?.getImage()
    if (!data) throw new CarError(`模型里找不到贴图 ${fragment}`)
    return data
  }
  const webp = (name: string, data: Uint8Array): Texture => doc.createTexture(name).setImage(data).setMimeType('image/webp').setURI(`${name}.webp`)

  const atlas = await buildBodyTextures(
    {
      diffuse: image(config.atlas.diffuse),
      specularGlossiness: image(config.atlas.specularGlossiness),
      occlusion: image(config.atlas.occlusion),
    },
    config.atlas,
  )
  const baseColor = webp('body_base', atlas.baseColor)
  const orm = webp('body_orm', atlas.orm)
  const emissive = webp('body_emissive', atlas.emissive)
  const tireNormal = webp('tire_normal', await fitWebp(image(config.tireNormal), config.textureMaxSize, 90))
  const tireOcclusion = webp('tire_occlusion', await fitWebp(image(config.tireOcclusion), config.textureMaxSize))
  const shadowTexture = webp('shadow', await fitWebp(image(config.shadowTexture), config.textureMaxSize))

  const clearcoat = doc.createExtension(KHRMaterialsClearcoat)
  const emissiveStrength = doc.createExtension(KHRMaterialsEmissiveStrength)

  const body = doc
    .createMaterial('body')
    .setBaseColorTexture(baseColor)
    .setMetallicRoughnessTexture(orm)
    .setOcclusionTexture(orm)
    .setMetallicFactor(1)
    .setRoughnessFactor(1)
    .setEmissiveTexture(emissive)
    .setEmissiveFactor([1, 1, 1])
  body.setExtension('KHR_materials_clearcoat', clearcoat.createClearcoat().setClearcoatFactor(0.3).setClearcoatRoughnessFactor(0.25))
  body.setExtension('KHR_materials_emissive_strength', emissiveStrength.createEmissiveStrength().setEmissiveStrength(3))

  const wheel = doc
    .createMaterial('wheel')
    .setBaseColorTexture(baseColor)
    .setBaseColorFactor([0.45, 0.45, 0.48, 1])
    .setMetallicRoughnessTexture(orm)
    .setOcclusionTexture(orm)
    .setMetallicFactor(1)
    .setRoughnessFactor(0.8)
  const caliper = doc.createMaterial('caliper').setBaseColorFactor(linearColor('#9E1C22')).setMetallicFactor(0.2).setRoughnessFactor(0.4)
  const glass = doc.createMaterial('glass').setBaseColorFactor(linearColor('#050607')).setMetallicFactor(0).setRoughnessFactor(0.05)
  const tire = doc
    .createMaterial('tire')
    .setBaseColorFactor(linearColor('#1A1A1A'))
    .setMetallicFactor(0)
    .setRoughnessFactor(0.9)
    .setNormalTexture(tireNormal)
    .setOcclusionTexture(tireOcclusion)
  const shadow = doc
    .createMaterial('shadow')
    .setBaseColorFactor([0, 0, 0, 1])
    .setBaseColorTexture(shadowTexture)
    .setAlphaMode('BLEND')
    .setMetallicFactor(0)
    .setRoughnessFactor(1)
  return { body, wheel, caliper, glass, tire, shadow }
}

function removeMeshes(doc: Document, patterns: RegExp[]) {
  for (const mesh of doc.getRoot().listMeshes()) {
    if (!patterns.some((pattern) => pattern.test(mesh.getName()))) continue
    for (const parent of mesh.listParents()) if (parent instanceof Node) parent.setMesh(null)
    mesh.dispose()
  }
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function mergeWheels(doc: Document, wheels: CarConfig['wheels']) {
  for (const [position, name] of Object.entries(wheels)) {
    const node = doc.getRoot().listNodes().find((candidate) => candidate.getName() === name)
    if (!node) throw new CarError(`模型里找不到车轮节点 ${name}`)
    if (node.getMesh()) throw new CarError(`车轮节点 ${name} 自己带有网格，无法合并`)
    const mesh = doc.createMesh(`wheel_${position}`)
    for (const child of node.listChildren()) {
      const offset = child.getMatrix().some((value, i) => Math.abs(value - IDENTITY[i]) > 1e-6)
      if (offset || child.listChildren().length > 0) {
        throw new CarError(`车轮 ${name} 的子节点 ${child.getName()} 带有自己的变换或子节点，无法合并`)
      }
      for (const primitive of child.getMesh()?.listPrimitives() ?? []) mesh.addPrimitive(primitive)
      child.dispose()
    }
    if (mesh.listPrimitives().length === 0) throw new CarError(`车轮 ${name} 下面没有网格`)
    node.setMesh(mesh).setExtras({ ...node.getExtras(), wheel: position })
  }
}

function alignCar(doc: Document, targetLength: number, shadow: Material) {
  const root = doc.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const parts = scene.listChildren()
  const wheelAt = (position: string): Vec3 => {
    const wheel = parts.find((node) => node.getExtras().wheel === position)
    if (!wheel) throw new CarError(`摆正时找不到车轮 ${position}`)
    return wheel.getWorldTranslation() as Vec3
  }
  const midpoint = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  const front = midpoint(wheelAt('FL'), wheelAt('FR'))
  const back = midpoint(wheelAt('BL'), wheelAt('BR'))

  const car = doc.createNode('car').setRotation(yawQuaternion(headingYaw(front, back)))
  for (const part of parts) {
    scene.removeChild(part)
    car.addChild(part)
  }
  scene.addChild(car)

  const solidBounds = (): Bounds =>
    unionBounds(
      car
        .listChildren()
        .filter((node) => !node.getMesh()?.listPrimitives().some((primitive) => primitive.getMaterial() === shadow))
        .map((node) => getBounds(node) as Bounds),
    )
  const scale = groundScale(solidBounds(), targetLength)
  car.setScale([scale, scale, scale])
  car.setTranslation(groundOffset(solidBounds()))
}

export async function processCar(doc: Document, config: CarConfig): Promise<void> {
  const root = doc.getRoot()
  const roles = assignRoles(root.listMeshes().map((mesh) => mesh.getName()), config.roles, config.remove)
  const materials = await createMaterials(doc, config)

  removeMeshes(doc, config.remove)
  for (const mesh of root.listMeshes()) {
    const role = roles.get(mesh.getName())
    if (!role) continue
    for (const primitive of mesh.listPrimitives()) primitive.setMaterial(materials[role])
  }
  doc.createExtension(KHRMaterialsPBRSpecularGlossiness).dispose()
  doc.createExtension(EXTTextureWebP).setRequired(true)

  mergeWheels(doc, config.wheels)
  await doc.transform(prune(), flatten(), join({ filter: (node) => node.getExtras().wheel === undefined }))
  alignCar(doc, config.targetLength, materials.shadow)
  await doc.transform(prune())
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/carModel.test.ts`
Expected: PASS（9 个测试）。若 `joins everything else by material` 失败，先打印 `rest.map((n) => n.getName())` 看是哪些节点没有合并，再检查 `join` 的 `filter`（返回 `true` 表示该节点可以参与合并）。

- [ ] **Step 6: 类型检查**

Run: `npx tsc -b`
Expected: 无输出。

- [ ] **Step 7: Commit**

```powershell
git add scripts/lib/carModel.ts scripts/lib/carFixture.ts scripts/lib/carModel.test.ts
git commit -m "feat(car): rematerial, merge wheels, join and align the model"
```

---

### Task 11: `npm run car` 命令，生成 `car.glb`

**Files:**
- Create: `scripts/lib/carCommand.ts`、`scripts/lib/carCommand.test.ts`、`scripts/car.ts`
- Modify: `package.json`（`car` 脚本）、`.gitattributes`
- Generate: `public/models/car.glb`

**Interfaces:**
- Consumes: `processCar`、`describeCar`（Task 10）；`CarError`、`CarConfig`（Task 7）；`carConfig`（Task 7）
- Produces:
  - `findSource(dir: string): Promise<string>`（目录不存在或没有 `.gltf`/`.glb` 时抛 `CarError`，提示从 Sketchfab 下载）
  - `createIO(): Promise<NodeIO>`（注册全部扩展和 meshopt 编解码器）
  - `interface CarRunOptions { sourceDir: string; outFile: string; config: CarConfig; log?: (line: string) => void }`
  - `interface CarRunResult { bytes: number; meshes: string[]; materials: string[] }`
  - `runCar(options: CarRunOptions): Promise<CarRunResult>`（先打印原模型的网格和材质名；处理、meshopt 压缩；超过 `config.maxBytes` 时抛 `CarError` 且不碰已有文件；否则先写 `.tmp` 再改名）

- [ ] **Step 1: 写失败的测试 `scripts/lib/carCommand.test.ts`**

```ts
// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildCarFixture, fixtureConfig } from './carFixture.ts'
import { createIO, runCar } from './carCommand.ts'
import { CarError } from './carTypes.ts'

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'car-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function writeFixture(): Promise<string> {
  const sourceDir = join(dir, 'src')
  await mkdir(sourceDir)
  await (await createIO()).write(join(sourceDir, 'scene.gltf'), await buildCarFixture())
  return sourceDir
}

describe('runCar', () => {
  it('writes a meshopt-compressed glb that keeps the four wheels', async () => {
    const sourceDir = await writeFixture()
    const outFile = join(dir, 'out', 'car.glb')
    const lines: string[] = []
    const result = await runCar({ sourceDir, outFile, config: fixtureConfig(), log: (line) => lines.push(line) })
    expect(lines.join('\n')).toContain('car_wheel_FL_car_tire_0')
    expect(result.bytes).toBe((await stat(outFile)).size)

    const doc = await (await createIO()).read(outFile)
    const used = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)
    expect(used).toEqual(expect.arrayContaining(['EXT_meshopt_compression', 'EXT_texture_webp', 'KHR_materials_clearcoat']))
    const wheels = doc.getRoot().listNodes().map((node) => node.getExtras().wheel).filter((wheel) => wheel !== undefined)
    expect(wheels.sort()).toEqual(['BL', 'BR', 'FL', 'FR'])
  }, 30_000)

  it('explains how to get the model when the folder is missing', async () => {
    await expect(runCar({ sourceDir: join(dir, 'nope'), outFile: join(dir, 'car.glb'), config: fixtureConfig() })).rejects.toThrow(/Sketchfab/)
  })

  it('explains a folder without a model file', async () => {
    await mkdir(join(dir, 'empty'))
    await expect(runCar({ sourceDir: join(dir, 'empty'), outFile: join(dir, 'car.glb'), config: fixtureConfig() })).rejects.toThrow(CarError)
  })

  it('refuses to overwrite the old model with an oversized one', async () => {
    const sourceDir = await writeFixture()
    const outFile = join(dir, 'car.glb')
    await writeFile(outFile, 'old')
    await expect(runCar({ sourceDir, outFile, config: fixtureConfig({ maxBytes: 100 }) })).rejects.toThrow(/超过上限/)
    expect(await readFile(outFile, 'utf8')).toBe('old')
  }, 30_000)
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/carCommand.test.ts`
Expected: FAIL，提示找不到 `./carCommand.ts`。

- [ ] **Step 3: 实现 `scripts/lib/carCommand.ts`**

```ts
import { mkdir, readdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Logger, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { describeCar, processCar } from './carModel.ts'
import { CarError, type CarConfig } from './carTypes.ts'

export async function findSource(dir: string): Promise<string> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    throw new CarError(`找不到 ${dir}。请登录 Sketchfab，以 glTF 格式下载「Fictional supercar - V12 Goblin」，解压到这个文件夹。`)
  }
  const model = names.find((name) => /\.(gltf|glb)$/i.test(name))
  if (!model) throw new CarError(`${dir} 里没有 .gltf 或 .glb 文件。请把 Sketchfab 下载的压缩包完整解压到这里。`)
  return join(dir, model)
}

export async function createIO(): Promise<NodeIO> {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
}

export interface CarRunOptions {
  sourceDir: string
  outFile: string
  config: CarConfig
  log?: (line: string) => void
}

export interface CarRunResult {
  bytes: number
  meshes: string[]
  materials: string[]
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2)

export async function runCar({ sourceDir, outFile, config, log = () => {} }: CarRunOptions): Promise<CarRunResult> {
  const source = await findSource(sourceDir)
  const io = await createIO()
  const doc = await io.read(source)
  doc.setLogger(new Logger(Logger.Verbosity.WARN))
  const report = describeCar(doc)
  log(`网格：${report.meshes.join('、')}`)
  log(`材质：${report.materials.join('、')}`)

  await processCar(doc, config)
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  const glb = await io.writeBinary(doc)
  if (glb.byteLength > config.maxBytes) {
    throw new CarError(`生成的模型有 ${mb(glb.byteLength)} MB，超过上限 ${mb(config.maxBytes)} MB，没有写入 ${outFile}`)
  }
  await mkdir(dirname(outFile), { recursive: true })
  const temporary = `${outFile}.tmp`
  await writeFile(temporary, glb)
  await rename(temporary, outFile)
  return { bytes: glb.byteLength, ...report }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/carCommand.test.ts`
Expected: PASS（4 个测试）。

- [ ] **Step 5: 写命令入口 `scripts/car.ts`**

```ts
import { carConfig } from './car.config.ts'
import { runCar } from './lib/carCommand.ts'
import { CarError } from './lib/carTypes.ts'

const SOURCE_DIR = 'assets-src/car'
const OUT_FILE = 'public/models/car.glb'

try {
  const result = await runCar({ sourceDir: SOURCE_DIR, outFile: OUT_FILE, config: carConfig, log: (line) => console.log(line) })
  console.log(`已写入 ${OUT_FILE}（${(result.bytes / 1024 / 1024).toFixed(2)} MB）`)
} catch (error) {
  if (!(error instanceof CarError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
```

- [ ] **Step 6: 在 `package.json` 的 `scripts` 里、`vault:rekey` 之后加一行**

```json
    "car": "tsx scripts/car.ts",
```

- [ ] **Step 7: `.gitattributes` 改为**

```
public/vault/** -text
public/models/** -text
public/stills/** -text
```

- [ ] **Step 8: 用真实模型运行**

先确认 `assets-src/car/scene.gltf`、`scene.bin` 和 `textures/` 存在（用户已下载）。

Run: `npm run car`
Expected: 打印 16 个网格名和 5 个材质名（`car_tire`、`car_body`、`car_glass`、`clearcoat`、`car_shadow`），最后一行类似 `已写入 public/models/car.glb（1.2 MB）`，大小在 0.8–2.5 MB 之间。若报「尾灯区域里没有找到红橙色像素」或车牌区域越界，说明贴图集坐标和 `car.config.ts` 不符，停下来报告，不要自行猜测坐标。

- [ ] **Step 9: 全量测试和类型检查**

```powershell
npm test
npx tsc -b
```

Expected: 全部通过。

- [ ] **Step 10: Commit**

```powershell
git add scripts/lib/carCommand.ts scripts/lib/carCommand.test.ts scripts/car.ts package.json .gitattributes public/models/car.glb
git commit -m "feat(car): npm run car builds public/models/car.glb"
```

---

### Task 12: 3D 场景基础（画布、车、灯光、地面、镜头）和开发用 `/__stills` 页面

**Files:**
- Modify: `package.json`（运行时依赖、`@types/three`）、`src/app/routes.tsx`
- Create: `src/scene/SceneErrorBoundary.tsx`、`src/scene/SceneErrorBoundary.test.tsx`、`src/scene/three/Car.tsx`、`src/scene/three/Studio.tsx`、`src/scene/three/Floor.tsx`、`src/scene/three/CameraRig.tsx`、`src/scene/three/Stage.tsx`、`src/scene/three/StillsPage.tsx`

**Interfaces:**
- Consumes: `StageProps`（Task 2）；`POSES`、`Pose`、`CAMERA_FOV`、`framedCamera`（Task 3）；`usePageVisible`（Task 4）；`initialTurntable`、`stepTurntable`（Task 5）；`damp`、`dampFactor`、`TRANSITION_LAMBDA`、`sweepX`、`STILL_SWEEP_X`、`TRACK_SPEED`、`WHEEL_SPEED`（Task 6）；`public/models/car.glb`（Task 11，节点 `extras.wheel` 在 three.js 里变成 `userData.wheel`）
- Produces:
  - `<SceneErrorBoundary onError={(error: unknown) => void}>`：子树抛错时调用 `onError` 并渲染空
  - `CAR_URL`（`src/scene/three/Car.tsx`）
  - `<Stage scene onReady onFail deterministic? />`（命名导出，满足 `StageModule`）：车模型加载完成并渲染第一帧后调用一次 `onReady`；WebGL 上下文丢失时调用 `onFail('webgl-context-lost')`；页面不可见时暂停渲染。`deterministic` 为 `true` 时不自转、车轮不转、光带停在 `STILL_SWEEP_X`、镜头和灯光直接到位，用于截静帧。
  - 开发模式路由 `/__stills?scene=garage|track|vault|settings[&live]`：全屏渲染 `Stage`（默认 `deterministic`；带 `live` 时为正常动画），就绪后设置 `document.body.dataset.stillReady = 'true'`，失败时设置 `document.body.dataset.stillError = 原因`。生产构建中不存在。

- [ ] **Step 1: 安装 3D 运行时依赖**

```powershell
npm i -E three@0.186.1 @react-three/fiber@9.8.1 @react-three/drei@10.7.9 @react-three/postprocessing@3.1.3 postprocessing@6.39.5
npm i -D -E @types/three@0.186.0
```

Expected: `dependencies` 多出五项，`devDependencies` 多出 `@types/three`，版本号均不带 `^`；没有 peer dependency 报错（`@react-three/fiber` 9.8.1 要求 React `>=19 <19.4`，现有 19.3.0 满足）。

- [ ] **Step 2: 写失败的测试 `src/scene/SceneErrorBoundary.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SceneErrorBoundary } from './SceneErrorBoundary'

function Boom(): never {
  throw new Error('boom')
}

describe('SceneErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders its children when nothing goes wrong', () => {
    render(
      <SceneErrorBoundary onError={() => {}}>
        <p>car</p>
      </SceneErrorBoundary>,
    )
    expect(screen.getByText('car')).toBeInTheDocument()
  })

  it('reports the error and renders nothing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    const { container } = render(
      <SceneErrorBoundary onError={onError}>
        <Boom />
      </SceneErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/scene/SceneErrorBoundary.test.tsx`
Expected: FAIL，提示找不到 `./SceneErrorBoundary`。

- [ ] **Step 4: 实现 `src/scene/SceneErrorBoundary.tsx`**

```tsx
import { Component, type ReactNode } from 'react'

interface Props {
  onError: (error: unknown) => void
  children: ReactNode
}

interface State {
  failed: boolean
}

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/scene/SceneErrorBoundary.test.tsx`
Expected: PASS（2 个测试）。

- [ ] **Step 6: 实现 `src/scene/three/Car.tsx`**

```tsx
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, Group, Mesh, Texture, Vector3, type Object3D } from 'three'
import { damp, WHEEL_SPEED } from '../motion'
import type { Pose } from '../poses'
import { initialTurntable, stepTurntable } from '../turntable'

export const CAR_URL = `${import.meta.env.BASE_URL}models/car.glb`

interface CarRig {
  wheels: Group[]
}

function rigCar(scene: Object3D): CarRig {
  const cached = scene.userData.rig as CarRig | undefined
  if (cached) return cached
  scene.updateMatrixWorld(true)
  const targets: Object3D[] = []
  scene.traverse((object) => {
    if (typeof object.userData.wheel === 'string') targets.push(object)
  })
  // meshopt 量化会挪动节点原点，所以绕包围盒中心另建枢轴，按场景的 X 轴（车的横向）转
  const wheels = targets.map((wheel) => {
    const pivot = new Group()
    pivot.name = `pivot_${wheel.userData.wheel}`
    pivot.position.copy(scene.worldToLocal(new Box3().setFromObject(wheel).getCenter(new Vector3())))
    scene.add(pivot)
    pivot.updateMatrixWorld(true)
    pivot.attach(wheel)
    return pivot
  })
  scene.traverse((object) => {
    if (object instanceof Mesh && !Array.isArray(object.material) && object.material.transparent) {
      object.material.depthWrite = false
      object.renderOrder = 1
    }
  })
  const rig = { wheels }
  scene.userData.rig = rig
  return rig
}

function disposeObject(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    for (const material of [object.material].flat()) {
      for (const value of Object.values(material)) if (value instanceof Texture) value.dispose()
      material.dispose()
    }
  })
}

interface CarProps {
  pose: Pose
  deterministic: boolean
}

export function Car({ pose, deterministic }: CarProps) {
  const { scene } = useGLTF(CAR_URL, false, true)
  const rig = useMemo(() => rigCar(scene), [scene])
  const group = useRef<Group>(null)
  const turntable = useRef(initialTurntable(pose.carYaw ?? 0))
  const wheelSpeed = useRef(0)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (!deterministic) turntable.current = stepTurntable(turntable.current, dt, { spin: pose.spin, holdYaw: pose.carYaw })
    if (group.current) group.current.rotation.y = turntable.current.angle
    wheelSpeed.current = damp(wheelSpeed.current, pose.trackLines && !deterministic ? WHEEL_SPEED : 0, 2, dt)
    for (const wheel of rig.wheels) wheel.rotation.x += wheelSpeed.current * dt
  })

  useEffect(() => () => disposeObject(scene), [scene])

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}
```

- [ ] **Step 7: 实现 `src/scene/three/Studio.tsx`**

```tsx
import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type Mesh, type SpotLight } from 'three'
import { dampFactor, STILL_SWEEP_X, sweepX, TRANSITION_LAMBDA } from '../motion'
import type { Pose } from '../poses'

interface StudioProps {
  pose: Pose
  deterministic: boolean
}

export function Studio({ pose, deterministic }: StudioProps) {
  const key = useRef<SpotLight>(null)
  const sweep = useRef<Mesh>(null)
  const goal = useMemo(() => new Color(), [])

  useFrame(({ clock }, delta) => {
    goal.set(pose.light)
    if (key.current) {
      if (deterministic) key.current.color.copy(goal)
      else key.current.color.lerp(goal, dampFactor(TRANSITION_LAMBDA, Math.min(delta, 0.1)))
    }
    if (sweep.current) {
      const x = pose.sweep ? (deterministic ? STILL_SWEEP_X : sweepX(clock.elapsedTime)) : null
      sweep.current.visible = x !== null
      if (x !== null) sweep.current.position.x = x
    }
  })

  return (
    <>
      <spotLight ref={key} position={[3, 7, 4]} angle={0.55} penumbra={1} intensity={80} decay={2} color={pose.light} />
      <Environment frames={deterministic ? 1 : Infinity} resolution={128}>
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 1.2, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 6, -3]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 0.6, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 6, 3]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 0.6, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[-8, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[8, 2, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[10, 2, 1]} />
        <Lightformer ref={sweep} form="rect" intensity={4} color="#C1272D" position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.8, 14, 1]} />
      </Environment>
    </>
  )
}
```

- [ ] **Step 8: 实现 `src/scene/three/Floor.tsx`**

```tsx
import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type MeshBasicMaterial } from 'three'
import { damp, TRACK_SPEED, TRANSITION_LAMBDA } from '../motion'
import type { Pose } from '../poses'

function trackLinesTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = 'rgba(134, 134, 140, 0.55)'
    context.fillRect(2, 0, 3, 256)
    context.fillRect(59, 0, 3, 256)
    context.fillStyle = '#C1272D'
    context.fillRect(30, 0, 4, 120)
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapT = RepeatWrapping
  texture.repeat.set(1, 10)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

interface FloorProps {
  pose: Pose
  deterministic: boolean
}

export function Floor({ pose, deterministic }: FloorProps) {
  const lines = useMemo(trackLinesTexture, [])
  const linesMaterial = useRef<MeshBasicMaterial>(null)

  useEffect(() => () => lines.dispose(), [lines])

  useFrame((_, delta) => {
    const material = linesMaterial.current
    if (!material) return
    const dt = Math.min(delta, 0.1)
    const goal = pose.trackLines ? 1 : 0
    material.opacity = deterministic ? goal : damp(material.opacity, goal, TRANSITION_LAMBDA, dt)
    material.visible = material.opacity > 0.01
    if (!deterministic) lines.offset.y -= TRACK_SPEED * dt
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[60, 60]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[300, 80]}
          mixBlur={1}
          mixStrength={0.6}
          roughness={0.9}
          metalness={0.2}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#08080a"
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[6, 60]} />
        <meshBasicMaterial ref={linesMaterial} map={lines} transparent opacity={pose.trackLines ? 1 : 0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 9: 实现 `src/scene/three/CameraRig.tsx`**

```tsx
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { dampFactor, TRANSITION_LAMBDA } from '../motion'
import { framedCamera, type Pose } from '../poses'

interface CameraRigProps {
  pose: Pose
  deterministic: boolean
}

export function CameraRig({ pose, deterministic }: CameraRigProps) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const goal = useMemo(() => new Vector3(), [])
  const lookGoal = useMemo(() => new Vector3(), [])
  const look = useRef<Vector3 | null>(null)

  useFrame((_, delta) => {
    goal.fromArray(framedCamera(pose, size.width / Math.max(size.height, 1)))
    lookGoal.fromArray(pose.target)
    if (deterministic || look.current === null) {
      camera.position.copy(goal)
      look.current = lookGoal.clone()
    } else {
      const k = dampFactor(TRANSITION_LAMBDA, Math.min(delta, 0.1))
      camera.position.lerp(goal, k)
      look.current.lerp(lookGoal, k)
    }
    camera.lookAt(look.current)
  })

  return null
}
```

- [ ] **Step 10: 实现 `src/scene/three/Stage.tsx`**

```tsx
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { usePageVisible } from '../hooks'
import { CAMERA_FOV, POSES } from '../poses'
import type { StageProps } from '../types'
import { CameraRig } from './CameraRig'
import { Car } from './Car'
import { Floor } from './Floor'
import { Studio } from './Studio'

function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    requestAnimationFrame(() => onReady())
  })
  return null
}

export function Stage({ scene, onReady, onFail, deterministic = false }: StageProps) {
  const pose = POSES[scene]
  const visible = usePageVisible()

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={visible || deterministic ? 'always' : 'never'}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 150, position: pose.camera }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: deterministic }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault()
          onFail('webgl-context-lost')
        })
      }}
    >
      <color attach="background" args={['#050506']} />
      <fog attach="fog" args={['#050506', 25, 70]} />
      <Studio pose={pose} deterministic={deterministic} />
      <Floor pose={pose} deterministic={deterministic} />
      <CameraRig pose={pose} deterministic={deterministic} />
      <Suspense fallback={null}>
        <Car pose={pose} deterministic={deterministic} />
        <FirstFrame onReady={onReady} />
      </Suspense>
    </Canvas>
  )
}
```

- [ ] **Step 11: 实现 `src/scene/three/StillsPage.tsx`**

```tsx
import { useSearchParams } from 'react-router'
import { SceneErrorBoundary } from '../SceneErrorBoundary'
import type { Scene } from '../types'
import { Stage } from './Stage'

const SCENES: Scene[] = ['garage', 'track', 'vault', 'settings']

function reportFailure(reason: string) {
  document.body.dataset.stillError = reason
}

export function StillsPage() {
  const [params] = useSearchParams()
  const requested = params.get('scene')
  const scene = SCENES.find((candidate) => candidate === requested) ?? 'garage'
  return (
    <div className="fixed inset-0 bg-ink">
      <SceneErrorBoundary onError={(error) => reportFailure(error instanceof Error ? error.message : String(error))}>
        <Stage
          scene={scene}
          deterministic={!params.has('live')}
          onReady={() => {
            document.body.dataset.stillReady = 'true'
          }}
          onFail={reportFailure}
        />
      </SceneErrorBoundary>
    </div>
  )
}
```

- [ ] **Step 12: 在 `src/app/routes.tsx` 加开发模式路由**

把 `export const routes: RouteObject[] = [` 这一行之前插入：

```tsx
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/__stills',
        lazy: async () => {
          const { StillsPage } = await import('../scene/three/StillsPage')
          return { Component: StillsPage }
        },
      },
    ]
  : []
```

并把 `routes` 数组的第一个元素前加上 `...devRoutes,`，即：

```tsx
export const routes: RouteObject[] = [
  ...devRoutes,
  {
    path: '/',
    element: <Layout />,
```

（其余不变。生产构建里 `import.meta.env.DEV` 为 `false`，整个分支连同动态导入一起被删掉。）

- [ ] **Step 13: 类型检查和全量测试**

```powershell
npx tsc -b
npm test
```

Expected: 全部通过。若 `tsc` 报 drei/fiber 的 JSX 类型错误（例如 `Lightformer` 不接受 `rotation`），按报错改为该组件接受的写法，不要用 `any` 或 `@ts-ignore`。

- [ ] **Step 14: 在浏览器里目测三个镜头**

```powershell
npm run dev
```

依次打开（端口以终端输出为准）：
- `http://localhost:5173/__stills?scene=garage&live`：车停在画面中上部，从左前方略高处看；车缓慢自转；每 6 秒一道红色光带从车顶反射扫过；地面有微弱倒影。
- `http://localhost:5173/__stills?scene=track&live`：镜头在车侧偏低，车头朝画面右侧或左侧均可；地面有向车尾方向流动的赛道线；四个车轮在原地转动（不能绕轮缘某点公转）。
- `http://localhost:5173/__stills?scene=vault&live`：从车尾看，主光偏香槟金；车牌上是镜像正确、可读的「WE-456」，没有「NEW YORK」字样。
- 浏览器控制台没有报错；`document.body.dataset.stillReady` 为 `'true'`。

车整体过暗或过曝时，只调整 `Studio.tsx` 里的 `spotLight` `intensity`（40–150）和各 `Lightformer` 的 `intensity`（0.3–3），并在提交信息里写明最终数值。车头朝向、车轮位置、车牌镜像有误时停下来报告，不要在运行时打补丁。

- [ ] **Step 15: Commit**

```powershell
git add package.json package-lock.json src/scene/SceneErrorBoundary.tsx src/scene/SceneErrorBoundary.test.tsx src/scene/three src/app/routes.tsx
git commit -m "feat(scene): 3D garage stage with car, studio lights, floor and camera rig"
```

---

### Task 13: 后期效果、帧率保护和拖动转车

**Files:**
- Create: `src/scene/three/PostFx.tsx`、`src/scene/three/FrameGuard.tsx`、`src/scene/three/useCarDrag.ts`
- Modify: `src/scene/three/Car.tsx`、`src/scene/three/Stage.tsx`

**Interfaces:**
- Consumes: `onNitro`（Task 2）；`usePageVisible`（Task 4）；`DragTracker`、`inCarBand`、`isInteractive`、`grab`、`dragBy`、`release`、`Turntable`（Task 5）；`nitroOffset`（Task 6）；`Quality`、`guardStep`、`initialGuard`、`dprFor`（Task 6）
- Produces:
  - `<PostFx deterministic />`：辉光、色散（平时为 0，收到「氮气」后 0.6 秒内衰减）、暗角、颗粒（`deterministic` 时颗粒为 0）
  - `<FrameGuard onQuality={(q: Quality) => void} onGiveUp={() => void} />`：开场 2 秒后每秒采样一次帧率；页面切回前台后重新计时
  - `useCarDrag(turntable: RefObject<Turntable>, enabled: boolean): void`：在 `window` 上监听指针事件，只在非按钮/链接、位于屏幕中部的按下点开始，锁定为水平拖动后转车
  - `Stage` 更新：按帧率保护降级（`dprFor(quality)`；`quality === 2` 时不渲染 `PostFx`；放弃时 `onFail('slow')`）；`Car` 在 `pose.spin`（车库页）时启用拖动

- [ ] **Step 1: 实现 `src/scene/three/PostFx.tsx`**

```tsx
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { BlendFunction, type ChromaticAberrationEffect } from 'postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import { Vector2 } from 'three'
import { onNitro } from '../events'
import { nitroOffset } from '../motion'

export function PostFx({ deterministic }: { deterministic: boolean }) {
  const aberration = useRef<ChromaticAberrationEffect>(null)
  const nitroAt = useRef(-Infinity)
  const clock = useThree((state) => state.clock)
  const zero = useMemo(() => new Vector2(0, 0), [])

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

  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.7} intensity={0.7} />
      <ChromaticAberration ref={aberration} offset={zero} radialModulation={false} modulationOffset={0} />
      <Vignette offset={0.3} darkness={0.75} />
      <Noise opacity={deterministic ? 0 : 0.05} blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  )
}
```

- [ ] **Step 2: 实现 `src/scene/three/FrameGuard.tsx`**

```tsx
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { guardStep, initialGuard, type Quality } from '../frameGuard'
import { usePageVisible } from '../hooks'

const WARMUP_SECONDS = 2
const SAMPLE_SECONDS = 1
const MAX_FRAME_GAP = 0.5

interface FrameGuardProps {
  onQuality: (quality: Quality) => void
  onGiveUp: () => void
}

export function FrameGuard({ onQuality, onGiveUp }: FrameGuardProps) {
  const state = useRef(initialGuard)
  const frames = useRef(0)
  const elapsed = useRef(0)
  const visible = usePageVisible()

  useEffect(() => {
    frames.current = 0
    elapsed.current = 0
    state.current = { ...state.current, lowFor: 0 }
  }, [visible])

  useFrame(({ clock }, delta) => {
    if (clock.elapsedTime < WARMUP_SECONDS || delta > MAX_FRAME_GAP) {
      frames.current = 0
      elapsed.current = 0
      return
    }
    frames.current += 1
    elapsed.current += delta
    if (elapsed.current < SAMPLE_SECONDS) return
    const previous = state.current
    const next = guardStep(previous, frames.current / elapsed.current, elapsed.current)
    frames.current = 0
    elapsed.current = 0
    state.current = next
    if (next.failed && !previous.failed) onGiveUp()
    else if (next.quality !== previous.quality) onQuality(next.quality)
  })

  return null
}
```

- [ ] **Step 3: 实现 `src/scene/three/useCarDrag.ts`**

```ts
import { useEffect, type RefObject } from 'react'
import { DragTracker, inCarBand, isInteractive } from '../drag'
import { dragBy, grab, release, type Turntable } from '../turntable'

export function useCarDrag(turntable: RefObject<Turntable>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const tracker = new DragTracker()
    let pointer: number | null = null
    let lastTime = 0

    const finish = (timeStamp: number) => {
      pointer = null
      if (tracker.end()) turntable.current = release(turntable.current, (timeStamp - lastTime) / 1000)
    }
    const down = (event: PointerEvent) => {
      if (pointer !== null || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
      if (isInteractive(event.target) || !inCarBand(event.clientY, window.innerHeight)) return
      pointer = event.pointerId
      lastTime = event.timeStamp
      tracker.start(event.clientX, event.clientY)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return
      const wasDragging = tracker.state === 'dragging'
      const dx = tracker.move(event.clientX, event.clientY)
      if (tracker.state === 'idle') {
        pointer = null
        return
      }
      if (dx === null) return
      if (!wasDragging) turntable.current = grab(turntable.current)
      turntable.current = dragBy(turntable.current, dx, (event.timeStamp - lastTime) / 1000)
      lastTime = event.timeStamp
    }
    const up = (event: PointerEvent) => {
      if (event.pointerId === pointer) finish(event.timeStamp)
    }

    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      finish(performance.now())
    }
  }, [enabled, turntable])
}
```

- [ ] **Step 4: 在 `src/scene/three/Car.tsx` 启用拖动**

在 import 区加入：

```tsx
import { useCarDrag } from './useCarDrag'
```

在 `Car` 函数里 `const wheelSpeed = useRef(0)` 的下一行加入：

```tsx
  useCarDrag(turntable, pose.spin && !deterministic)
```

- [ ] **Step 5: `src/scene/three/Stage.tsx` 改为**

```tsx
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef, useState } from 'react'
import { dprFor, type Quality } from '../frameGuard'
import { usePageVisible } from '../hooks'
import { CAMERA_FOV, POSES } from '../poses'
import type { StageProps } from '../types'
import { CameraRig } from './CameraRig'
import { Car } from './Car'
import { Floor } from './Floor'
import { FrameGuard } from './FrameGuard'
import { PostFx } from './PostFx'
import { Studio } from './Studio'

function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    requestAnimationFrame(() => onReady())
  })
  return null
}

export function Stage({ scene, onReady, onFail, deterministic = false }: StageProps) {
  const pose = POSES[scene]
  const visible = usePageVisible()
  const [quality, setQuality] = useState<Quality>(0)

  return (
    <Canvas
      dpr={dprFor(quality)}
      frameloop={visible || deterministic ? 'always' : 'never'}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 150, position: pose.camera }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: deterministic }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault()
          onFail('webgl-context-lost')
        })
      }}
    >
      <color attach="background" args={['#050506']} />
      <fog attach="fog" args={['#050506', 25, 70]} />
      <Studio pose={pose} deterministic={deterministic} />
      <Floor pose={pose} deterministic={deterministic} />
      <CameraRig pose={pose} deterministic={deterministic} />
      <Suspense fallback={null}>
        <Car pose={pose} deterministic={deterministic} />
        <FirstFrame onReady={onReady} />
      </Suspense>
      {quality < 2 && <PostFx deterministic={deterministic} />}
      {!deterministic && <FrameGuard onQuality={setQuality} onGiveUp={() => onFail('slow')} />}
    </Canvas>
  )
}
```

- [ ] **Step 6: 类型检查和全量测试**

```powershell
npx tsc -b
npm test
```

Expected: 全部通过。

- [ ] **Step 7: 在浏览器里目测**

`npm run dev`，打开 `http://localhost:5173/__stills?scene=garage&live`：
- 尾灯和红色光带有辉光；画面四角变暗；有很轻的颗粒。
- 在画面中部按住鼠标左右拖动，车跟手转；快速甩动松手后带惯性减速，约 2 秒后恢复自转；上下拖动不转车。
- 浏览器开发者工具里用 Performance 面板的 CPU 6× 降速，观察约 3 秒后画面变得略糊（分辨率降低），再约 3 秒后辉光/暗角消失；再持续约 5 秒后 `document.body.dataset.stillError` 变为 `'slow'`。验证完关闭降速。
- 在控制台执行 `(await import('/src/scene/events.ts')).emitNitro()`，画面边缘短暂出现红蓝色散后恢复。

- [ ] **Step 8: Commit**

```powershell
git add src/scene/three
git commit -m "feat(scene): post effects, frame-rate guard and drag-to-turn"
```

---

### Task 14: `SceneHost` 接入布局

**Files:**
- Create: `src/scene/SceneHost.tsx`、`src/scene/SceneHost.test.tsx`
- Modify: `src/app/Layout.tsx`、`src/app/App.test.tsx`
- Delete: `src/app/GarageBackdrop.tsx`

**Interfaces:**
- Consumes: `usePrefs`、`setPrefs`、`resetPrefsCache`（Task 1）；`Scene`、`StageModule`、`StageProps`、`sceneMode`、`supportsWebGL2`、`markSceneFailed`、`sceneFailed`、`resetSceneFailure`（Task 2）；`POSES`、`sceneFor`（Task 3）；`Still`、`usePrefersReducedMotion`（Task 4）；`SceneErrorBoundary`（Task 12）；`./three/Stage`（Task 13）
- Produces:
  - `FADE_MS = 600`
  - `<SceneHost scene loadStage? webgl2? />`：
    - 先显示当前镜头的静帧；只有 `sceneMode(...) === '3d'` 时才在空闲时加载 3D 分包；
    - `Stage` 调用 `onReady` 后 0.6 秒淡入，淡入结束移除静帧；
    - 分包加载失败、`Stage` 调用 `onFail`、或渲染抛错时，记为本次访问失败并回到静帧，之后不再尝试；
    - 关闭 3D 开关时立即卸载 `Stage`、显示静帧；重新打开时再挂载；
    - 压暗层 `data-testid="scene-dim"`，不透明度为 `POSES[scene].dim`，1.2 秒过渡。
  - `Layout`：用 `sceneFor` + `SceneHost` 取代 `GarageBackdrop`；车库页根元素加 `touch-pan-y touch-pinch-zoom`，让横向拖动不被浏览器当作手势吞掉。

- [ ] **Step 1: 写失败的测试 `src/scene/SceneHost.test.tsx`**

```tsx
import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPrefsCache, setPrefs } from '../prefs/prefs'
import { resetSceneFailure, sceneFailed } from './mode'
import { SceneHost } from './SceneHost'
import type { StageModule, StageProps } from './types'

function fakeStage(behaviour: 'ready' | 'fail' | 'wait'): StageModule {
  function Stage({ scene, onReady, onFail }: StageProps) {
    useEffect(() => {
      if (behaviour === 'ready') onReady()
      if (behaviour === 'fail') onFail('test')
    }, [onReady, onFail])
    return <div data-testid="fake-stage">{scene}</div>
  }
  return { Stage }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const still = () => screen.queryByTestId('scene-still')
const yes = () => true

describe('SceneHost', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPrefsCache()
    resetSceneFailure()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows only the still without WebGL 2', async () => {
    const loadStage = vi.fn(async () => fakeStage('ready'))
    render(<SceneHost scene="garage" loadStage={loadStage} webgl2={() => false} />)
    await pause(30)
    expect(still()).toBeInTheDocument()
    expect(loadStage).not.toHaveBeenCalled()
  })

  it('shows only the still when the system asks for reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const loadStage = vi.fn(async () => fakeStage('ready'))
    render(<SceneHost scene="garage" loadStage={loadStage} webgl2={yes} />)
    await pause(30)
    expect(loadStage).not.toHaveBeenCalled()
  })

  it('shows only the still when 3D is switched off in settings', async () => {
    setPrefs({ scene3d: false })
    const loadStage = vi.fn(async () => fakeStage('ready'))
    render(<SceneHost scene="garage" loadStage={loadStage} webgl2={yes} />)
    await pause(30)
    expect(loadStage).not.toHaveBeenCalled()
  })

  it('loads the 3D stage, fades it in and then removes the still', async () => {
    render(<SceneHost scene="track" loadStage={async () => fakeStage('ready')} webgl2={yes} />)
    expect(await screen.findByTestId('fake-stage')).toHaveTextContent('track')
    expect(still()).toBeInTheDocument()
    await waitFor(() => expect(still()).toBeNull(), { timeout: 2000 })
  })

  it('stays on the still and does not retry when the bundle fails to load', async () => {
    const loadStage = vi.fn(async (): Promise<StageModule> => {
      throw new Error('offline')
    })
    const { unmount } = render(<SceneHost scene="garage" loadStage={loadStage} webgl2={yes} />)
    await waitFor(() => expect(sceneFailed()).toBe(true))
    expect(still()).toBeInTheDocument()
    unmount()
    render(<SceneHost scene="garage" loadStage={loadStage} webgl2={yes} />)
    await pause(30)
    expect(loadStage).toHaveBeenCalledTimes(1)
  })

  it('falls back to the still when the stage reports a failure', async () => {
    render(<SceneHost scene="garage" loadStage={async () => fakeStage('fail')} webgl2={yes} />)
    await waitFor(() => expect(sceneFailed()).toBe(true))
    expect(screen.queryByTestId('fake-stage')).toBeNull()
    expect(still()).toBeInTheDocument()
  })

  it('drops the 3D stage as soon as 3D is switched off', async () => {
    render(<SceneHost scene="garage" loadStage={async () => fakeStage('wait')} webgl2={yes} />)
    await screen.findByTestId('fake-stage')
    act(() => setPrefs({ scene3d: false }))
    expect(screen.queryByTestId('fake-stage')).toBeNull()
    expect(still()).toBeInTheDocument()
  })

  it('dims the scene for each page', () => {
    const { rerender } = render(<SceneHost scene="track" webgl2={() => false} />)
    expect(screen.getByTestId('scene-dim').style.opacity).toBe('0.45')
    rerender(<SceneHost scene="garage" webgl2={() => false} />)
    expect(screen.getByTestId('scene-dim').style.opacity).toBe('0')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/scene/SceneHost.test.tsx`
Expected: FAIL，提示找不到 `./SceneHost`。

- [ ] **Step 3: 实现 `src/scene/SceneHost.tsx`**

```tsx
import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { usePrefs } from '../prefs/prefs'
import { usePrefersReducedMotion } from './hooks'
import { markSceneFailed, sceneFailed, sceneMode, supportsWebGL2 } from './mode'
import { POSES } from './poses'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import { Still } from './Still'
import type { Scene, StageModule, StageProps } from './types'

export const FADE_MS = 600

const loadDefaultStage = (): Promise<StageModule> => import('./three/Stage')

function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 1500 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(callback, 1)
  return () => window.clearTimeout(id)
}

interface SceneHostProps {
  scene: Scene
  loadStage?: () => Promise<StageModule>
  webgl2?: () => boolean
}

export function SceneHost({ scene, loadStage = loadDefaultStage, webgl2 = supportsWebGL2 }: SceneHostProps) {
  const pose = POSES[scene]
  const reducedMotion = usePrefersReducedMotion()
  const { scene3d } = usePrefs()
  const [hasWebGL2] = useState(webgl2)
  const [failed, setFailed] = useState(sceneFailed)
  const mode = sceneMode({ reducedMotion, webgl2: hasWebGL2, enabled: scene3d, failed })
  const [Stage, setStage] = useState<ComponentType<StageProps> | null>(null)
  const [ready, setReady] = useState(false)
  const [stillGone, setStillGone] = useState(false)

  const fail = useCallback(() => {
    markSceneFailed()
    setFailed(true)
  }, [])
  const markReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    if (mode !== '3d' || Stage !== null) return
    let alive = true
    const cancel = whenIdle(() => {
      loadStage().then(
        (module) => {
          if (alive) setStage(() => module.Stage)
        },
        () => {
          if (alive) fail()
        },
      )
    })
    return () => {
      alive = false
      cancel()
    }
  }, [mode, Stage, loadStage, fail])

  useEffect(() => {
    if (mode === '3d') return
    setReady(false)
    setStillGone(false)
  }, [mode])

  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => setStillGone(true), FADE_MS)
    return () => window.clearTimeout(id)
  }, [ready])

  const showStage = mode === '3d' && Stage !== null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {!(showStage && stillGone) && <Still scene={pose.still} />}
      {showStage && (
        <div
          className="absolute inset-0 transition-opacity ease-out"
          style={{ opacity: ready ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        >
          <SceneErrorBoundary onError={fail}>
            <Stage scene={scene} onReady={markReady} onFail={fail} />
          </SceneErrorBoundary>
        </div>
      )}
      <div
        data-testid="scene-dim"
        className="absolute inset-0 bg-black transition-opacity duration-[1200ms] ease-out"
        style={{ opacity: pose.dim }}
      />
    </div>
  )
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/scene/SceneHost.test.tsx`
Expected: PASS（8 个测试）。

- [ ] **Step 5: `src/app/Layout.tsx` 改为**

```tsx
import { NavLink, Outlet, useLocation } from 'react-router'
import { useProgress } from '../progress/ProgressProvider'
import { sceneFor } from '../scene/poses'
import { SceneHost } from '../scene/SceneHost'

const NAV = [
  { to: '/', label: '车库', end: true },
  { to: '/trial', label: '赛道试炼', end: false },
  { to: '/vault', label: '保险库', end: false },
  { to: '/settings', label: '设置', end: false },
]

export function Layout() {
  const { pathname } = useLocation()
  const { saveFailed } = useProgress()
  const scene = sceneFor(pathname)

  return (
    <div
      data-theme={scene === 'vault' ? 'vault' : undefined}
      className={`relative min-h-dvh bg-ink text-fg ${scene === 'garage' ? 'touch-pan-y touch-pinch-zoom' : ''}`}
    >
      <SceneHost scene={scene} />
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

- [ ] **Step 6: 删除旧背景**

```powershell
git rm src/app/GarageBackdrop.tsx
```

- [ ] **Step 7: 在 `src/app/App.test.tsx` 的 `describe('app shell', ...)` 里、`redirects unknown paths to the garage` 用例之前加一个用例**

```tsx
  it('shows the garage still behind the page when WebGL 2 is unavailable', () => {
    renderAt('/')
    expect(screen.getByTestId('scene-still')).toBeInTheDocument()
    expect(screen.getByTestId('scene-dim').style.opacity).toBe('0')
  })
```

- [ ] **Step 8: 全量测试、类型检查和构建**

```powershell
npm test
npm run build
```

Expected: 全部测试通过；构建成功。构建输出里：
- `dist/assets/index-*.js` 的 gzip 大小 ≤ 200 KB；
- 另有一个包含 three.js 的分包（gzip 约 250–400 KB，文件名含 `Stage`）；
- 没有任何包含 `StillsPage` 的文件。

若主程序包超过 200 KB，运行 `npx vite-bundle-visualizer` 或检查 `src/scene/three/` 以外是否有文件在运行时导入了 `three` / `@react-three/*` / `postprocessing`，修正后再构建。

- [ ] **Step 9: 在浏览器里目测**

`npm run dev`，打开 `http://localhost:5173/`：
- 先看到静帧（此时 `public/stills/` 还没有图片，看到深色渐变），随后 3D 车库在约 0.6 秒内淡入。
- 依次点击「赛道试炼」「保险库」「设置」「车库」，镜头和灯光约 1.2 秒平滑过渡，画布没有闪烁或重建；赛道页文字下方的压暗明显。
- 在车库页中部横向拖动可以转车，点击「出发」「保险库」等按钮不受影响；在赛道页拖动不转车。

- [ ] **Step 10: Commit**

```powershell
git add src/scene/SceneHost.tsx src/scene/SceneHost.test.tsx src/app/Layout.tsx src/app/App.test.tsx
git commit -m "feat(scene): SceneHost replaces the SVG backdrop with the 3D garage"
```

---

### Task 15: 连击触发「氮气」事件

**Files:**
- Modify: `src/trial/TrialScreen.tsx`、`src/trial/TrialScreen.test.tsx`

**Interfaces:**
- Consumes: `emitNitro`、`onNitro`（Task 2）；已有的 `NITRO_COMBOS`
- Produces: 答对且连击达到 5 或 10 的那一刻调用一次 `emitNitro()`（与现有的 `NitroFlash` 同时出现），3D 场景据此做色散。

- [ ] **Step 1: 在 `src/trial/TrialScreen.test.tsx` 加失败的测试**

import 区加入：

```tsx
import { onNitro } from '../scene/events'
```

在 `shows the lap summary after the last word` 用例之后加入：

```tsx
  it('fires the nitro event on the fifth correct answer in a row', async () => {
    const nitro = vi.fn()
    const off = onNitro(nitro)
    renderTrial()
    for (const [index, word] of WORDS.entries()) {
      await screen.findByRole('heading', { name: word.w })
      fireEvent.click(options().find((b) => b.textContent?.includes(word.m.slice(3)))!)
      const good = await screen.findByRole('button', { name: '会了' })
      expect(nitro).toHaveBeenCalledTimes(index === 4 ? 1 : 0)
      fireEvent.click(good)
    }
    off()
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/trial/TrialScreen.test.tsx`
Expected: 新用例 FAIL（第 5 个词时 `nitro` 调用 0 次），其余通过。

- [ ] **Step 3: 修改 `src/trial/TrialScreen.tsx`**

import 区加入：

```tsx
import { emitNitro } from '../scene/events'
```

在 `useLayoutEffect(() => { if (!question || picked !== null) return ... }, [question, picked])` 之后、`if (lookupFailed) {` 之前加入：

```tsx
  const nitro = correct && session !== undefined && NITRO_COMBOS.includes(session.combo + 1)

  useEffect(() => {
    if (nitro) emitNitro()
  }, [nitro, cursor])
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/trial/TrialScreen.test.tsx`
Expected: PASS（全部用例）。

- [ ] **Step 5: Commit**

```powershell
git add src/trial/TrialScreen.tsx src/trial/TrialScreen.test.tsx
git commit -m "feat(trial): emit the nitro event on 5 and 10 combos"
```

---

### Task 16: 设置页「3D 车库」开关和「鸣谢」

**Files:**
- Modify: `src/pages/SettingsPage.tsx`、`src/pages/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `usePrefs`、`setPrefs`、`PREFS_KEY`（Task 1）
- Produces: 设置页新增 `role="switch"` 的「3D 车库」开关（默认开启，改动立即生效并写入 `midnight-garage/prefs`）；页面底部「鸣谢」区块，包含车模型 CC BY 4.0 署名、ECDICT（MIT）、Rajdhani 字体（SIL OFL 1.1）。原来底部的 ECDICT 段落移入「鸣谢」。

- [ ] **Step 1: 在 `src/pages/SettingsPage.test.tsx` 加失败的测试**

import 区改为：

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { PREFS_KEY } from '../prefs/prefs'
import { ProgressProvider } from '../progress/ProgressProvider'
import { emptyProgress, STORAGE_KEY } from '../progress/store'
import { SettingsPage } from './SettingsPage'
```

在 `describe` 末尾加入：

```tsx
  it('turns the 3D garage off and on', () => {
    renderSettings()
    const toggle = screen.getByRole('switch', { name: /3D 车库/ })
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    expect(toggle).not.toBeChecked()
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ scene3d: false })
    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
  })

  it('credits the car model and other third-party assets', () => {
    renderSettings()
    const credits = within(screen.getByRole('region', { name: '鸣谢' }))
    expect(credits.getByRole('link', { name: 'Fictional supercar - V12 Goblin' })).toHaveAttribute(
      'href',
      'https://sketchfab.com/3d-models/fictional-supercar-v12-goblin-0a20e49ad5774d778567cb5c3f345786',
    )
    expect(credits.getByText(/ollitei/)).toBeInTheDocument()
    expect(credits.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/')
    expect(credits.getByText(/已修改：材质、配色和压缩/)).toBeInTheDocument()
    expect(credits.getByRole('link', { name: 'ECDICT' })).toBeInTheDocument()
    expect(credits.getByText(/Rajdhani/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: 两个新用例 FAIL（找不到 switch / 「鸣谢」区块），原有用例通过。

- [ ] **Step 3: 修改 `src/pages/SettingsPage.tsx`**

import 区加入：

```tsx
import { setPrefs, usePrefs } from '../prefs/prefs'
```

在 `const learned = Object.keys(data.words).length` 之后加入：

```tsx
  const { scene3d } = usePrefs()
```

在 `<h1 ...>设置</h1>` 之后、「导出进度」面板之前加入：

```tsx
      <div className="border border-line bg-panel/90 p-4">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-bold">3D 车库</span>
            <span className="mt-1 block text-xs text-muted">关闭后只显示静态画面，更省电。</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={scene3d}
            onChange={(event) => setPrefs({ scene3d: event.target.checked })}
            className="h-5 w-5 shrink-0 accent-[var(--accent-hi)]"
          />
        </label>
      </div>
```

把末尾的 ECDICT 段落（`<p className="text-xs text-muted">词库来自 ... （MIT 协议）。</p>`）整段替换为：

```tsx
      <section aria-labelledby="credits-title" className="space-y-2 text-xs text-muted">
        <h2 id="credits-title" className="text-sm font-bold text-fg">
          鸣谢
        </h2>
        <p>
          车模型「
          <a
            href="https://sketchfab.com/3d-models/fictional-supercar-v12-goblin-0a20e49ad5774d778567cb5c3f345786"
            className="underline"
          >
            Fictional supercar - V12 Goblin
          </a>
          」，作者 ollitei，采用{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" className="underline">
            CC BY 4.0
          </a>{' '}
          授权。已修改：材质、配色和压缩。
        </p>
        <p>
          词库来自{' '}
          <a href="https://github.com/skywind3000/ECDICT" className="underline">
            ECDICT
          </a>
          （MIT 协议）。
        </p>
        <p>英文字体 Rajdhani，采用 SIL Open Font License 1.1。</p>
      </section>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: PASS（5 个测试）。

- [ ] **Step 5: Commit**

```powershell
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx
git commit -m "feat(settings): 3D garage switch and credits"
```

---

### Task 17: `npm run stills` 生成静帧

**Files:**
- Modify: `package.json`（`playwright` 开发依赖、`stills` 脚本）
- Create: `scripts/lib/stills.ts`、`scripts/lib/stills.test.ts`、`scripts/stills.ts`、`public/stills/*.webp`（生成产物）

**Interfaces:**
- Consumes: 开发模式 `/__stills` 页面及其 `data-still-ready` / `data-still-error` 约定（Task 12）；`Still` 读取的文件名（Task 4）
- Produces:
  - `STILL_SCENES`、`ORIENTATIONS`（竖屏 900×1600、横屏 1600×900）、`MAX_STILL_BYTES = 120 * 1024`
  - `stillFileName(scene, orientation): string` → `garage-portrait.webp` 这类
  - `StillsError`
  - `checkNotBlack(png, label): Promise<void>`：所有通道平均亮度 < 4 或最大亮度 < 48 时抛 `StillsError`
  - `encodeStill(png, label): Promise<Uint8Array>`：WebP 质量从 80 起每次降 8，直到 ≤ 120 KB；到 48 仍超出则抛 `StillsError`
  - `npm run stills`：六张截图全部成功后才写入 `public/stills/`，任何一张失败都不覆盖已有文件

- [ ] **Step 1: 安装 Playwright 和 Chromium**

```powershell
npm i -D -E playwright@1.64.0
npx playwright install chromium
```

- [ ] **Step 2: 写失败的测试 `scripts/lib/stills.test.ts`**

```ts
// @vitest-environment node
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { checkNotBlack, encodeStill, MAX_STILL_BYTES, ORIENTATIONS, STILL_SCENES, stillFileName, StillsError } from './stills.ts'

function solid(width: number, height: number, value: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: value, g: value, b: value } } })
    .png()
    .toBuffer()
}

async function gradient(width: number, height: number): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      data[i] = Math.round((x / width) * 200)
      data[i + 1] = 20
      data[i + 2] = Math.round((y / height) * 60)
    }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

describe('stills', () => {
  it('names six files for three scenes in two orientations', () => {
    expect(STILL_SCENES).toEqual(['garage', 'track', 'vault'])
    expect(ORIENTATIONS).toEqual({ portrait: { width: 900, height: 1600 }, landscape: { width: 1600, height: 900 } })
    expect(stillFileName('vault', 'landscape')).toBe('vault-landscape.webp')
  })

  it('rejects a black screenshot', async () => {
    await expect(checkNotBlack(await solid(64, 64, 0), 'garage-portrait')).rejects.toThrow(StillsError)
    await expect(checkNotBlack(await solid(64, 64, 0), 'garage-portrait')).rejects.toThrow(/garage-portrait/)
  })

  it('accepts a lit screenshot', async () => {
    await expect(checkNotBlack(await gradient(64, 64), 'track-landscape')).resolves.toBeUndefined()
  })

  it('encodes a still as WebP within the size limit', async () => {
    const webp = await encodeStill(await gradient(900, 1600), 'garage-portrait')
    expect(webp.length).toBeLessThanOrEqual(MAX_STILL_BYTES)
    const meta = await sharp(webp).metadata()
    expect(meta.format).toBe('webp')
    expect([meta.width, meta.height]).toEqual([900, 1600])
  })

  it('gives up on a still that cannot fit the size limit', async () => {
    const noise = await sharp(randomBytes(1600 * 900 * 3), { raw: { width: 1600, height: 900, channels: 3 } })
      .png()
      .toBuffer()
    await expect(encodeStill(noise, 'vault-landscape')).rejects.toThrow(/vault-landscape/)
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run scripts/lib/stills.test.ts`
Expected: FAIL，提示找不到 `./stills.ts`。

- [ ] **Step 4: 实现 `scripts/lib/stills.ts`**

```ts
import sharp from 'sharp'

export const STILL_SCENES = ['garage', 'track', 'vault'] as const
export type StillName = (typeof STILL_SCENES)[number]

export const ORIENTATIONS = {
  portrait: { width: 900, height: 1600 },
  landscape: { width: 1600, height: 900 },
} as const
export type Orientation = keyof typeof ORIENTATIONS

export const MAX_STILL_BYTES = 120 * 1024

const QUALITY_START = 80
const QUALITY_FLOOR = 48
const QUALITY_STEP = 8

export class StillsError extends Error {
  name = 'StillsError'
}

export function stillFileName(scene: StillName, orientation: Orientation): string {
  return `${scene}-${orientation}.webp`
}

export async function checkNotBlack(png: Uint8Array, label: string): Promise<void> {
  const { channels } = await sharp(png).removeAlpha().stats()
  const mean = channels.reduce((sum, channel) => sum + channel.mean, 0) / channels.length
  const max = Math.max(...channels.map((channel) => channel.max))
  if (mean < 4 || max < 48) throw new StillsError(`${label}：截图几乎全黑（平均亮度 ${mean.toFixed(1)}，最高 ${max}）`)
}

export async function encodeStill(png: Uint8Array, label: string): Promise<Uint8Array> {
  for (let quality = QUALITY_START; quality >= QUALITY_FLOOR; quality -= QUALITY_STEP) {
    const webp = await sharp(png).webp({ quality, effort: 6 }).toBuffer()
    if (webp.length <= MAX_STILL_BYTES) return webp
  }
  throw new StillsError(`${label}：WebP 质量降到 ${QUALITY_FLOOR} 仍超过 ${MAX_STILL_BYTES / 1024} KB`)
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run scripts/lib/stills.test.ts`
Expected: PASS（5 个测试）。

- [ ] **Step 6: 实现 `scripts/stills.ts`**

```ts
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import {
  checkNotBlack,
  encodeStill,
  ORIENTATIONS,
  STILL_SCENES,
  stillFileName,
  StillsError,
  type Orientation,
} from './lib/stills.ts'

const PORT = 5199
const OUT_DIR = 'public/stills'
const READY_TIMEOUT_MS = 120_000
const SETTLE_MS = 500

async function capture(): Promise<{ name: string; data: Uint8Array }[]> {
  const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'warn' })
  await server.listen()
  const base = server.resolvedUrls?.local[0] ?? `http://localhost:${PORT}/`
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const results: { name: string; data: Uint8Array }[] = []
  try {
    for (const scene of STILL_SCENES) {
      for (const orientation of Object.keys(ORIENTATIONS) as Orientation[]) {
        const label = `${scene}-${orientation}`
        const page = await browser.newPage({ viewport: ORIENTATIONS[orientation], deviceScaleFactor: 1 })
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(`${base}__stills?scene=${scene}`)
        await page.waitForFunction(
          () => document.body.dataset.stillReady === 'true' || document.body.dataset.stillError !== undefined,
          null,
          { timeout: READY_TIMEOUT_MS },
        )
        const failure = await page.evaluate(() => document.body.dataset.stillError)
        if (failure !== undefined || errors.length > 0) {
          throw new StillsError(`${label}：页面渲染失败（${failure ?? errors.join('；')}）`)
        }
        await page.waitForTimeout(SETTLE_MS)
        const png = await page.screenshot({ type: 'png' })
        await checkNotBlack(png, label)
        results.push({ name: stillFileName(scene, orientation), data: await encodeStill(png, label) })
        await page.close()
        console.log(`已截取 ${label}`)
      }
    }
  } finally {
    await browser.close()
    await server.close()
  }
  return results
}

async function main() {
  const stills = await capture()
  await mkdir(OUT_DIR, { recursive: true })
  for (const { name, data } of stills) {
    const target = join(OUT_DIR, name)
    await writeFile(`${target}.tmp`, data)
    await rename(`${target}.tmp`, target)
    console.log(`${target}  ${(data.length / 1024).toFixed(1)} KB`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof StillsError ? error.message : error)
  process.exitCode = 1
})
```

- [ ] **Step 7: 在 `package.json` 的 `scripts` 里、`"car"` 之后加入**

```json
    "stills": "tsx scripts/stills.ts"
```

（注意给上一行补逗号。）

- [ ] **Step 8: 类型检查**

Run: `npx tsc -b`
Expected: 通过。

- [ ] **Step 9: 生成静帧**

Run: `npm run stills`
Expected: 依次输出六行「已截取 …」，最后列出六个文件，每个 ≤ 120 KB。软件渲染较慢，整体可能需要 1–3 分钟。

若报「截图几乎全黑」或页面渲染失败：先用 `npm run dev` 打开对应的 `/__stills?scene=…`（不带 `live`）确认页面本身正常；若页面正常而无头模式失败，把 `chromium.launch` 改为 `chromium.launch({ channel: 'chromium', args: [...] })` 再试一次，仍失败则停下来报告。

- [ ] **Step 10: 逐张查看静帧**

用图片查看工具打开 `public/stills/` 下的六张图，确认：
- 车完整入画，竖屏图里车位于画面中上部；
- 车库图里能看到红色光带在车身上的反射；赛道图有赛道线；保险库图是车尾、偏金色，车牌「WE-456」可读；
- 没有黑块、条纹或明显的色带。

- [ ] **Step 11: Commit**

```powershell
git add package.json package-lock.json scripts/lib/stills.ts scripts/lib/stills.test.ts scripts/stills.ts public/stills
git commit -m "feat(stills): npm run stills renders the fallback stills in Chromium"
```

---

### Task 18: 最终验证

**Files:** 无新增；只在发现问题时修改对应文件。

- [ ] **Step 1: 全量测试和构建**

```powershell
npm test
npm run build
```

Expected: 全部测试通过；构建成功。

- [ ] **Step 2: 检查体积**

```powershell
Get-ChildItem dist/assets/*.js | ForEach-Object { $bytes = [IO.File]::ReadAllBytes($_.FullName); $ms = New-Object IO.MemoryStream; $gz = New-Object IO.Compression.GZipStream($ms, [IO.Compression.CompressionLevel]::Optimal); $gz.Write($bytes, 0, $bytes.Length); $gz.Close(); '{0,-40} {1,8:N1} KB gzip' -f $_.Name, ($ms.ToArray().Length / 1KB) }
(Get-Item public/models/car.glb).Length / 1MB
Get-ChildItem public/stills/*.webp | Select-Object Name, @{ n = 'KB'; e = { [math]::Round($_.Length / 1KB, 1) } }
Get-ChildItem dist -Recurse -Filter *StillsPage* 
```

Expected:
- `index-*.js` ≤ 200 KB gzip；有一个单独的 `Stage-*.js` 分包；
- `car.glb` ≤ 3 MB；
- 六张静帧都在且每张 ≤ 120 KB；
- 最后一条命令没有输出（`/__stills` 不在生产构建里）。

- [ ] **Step 3: 生产构建预览下手动验收**

```powershell
npm run preview
```

按规格第 1 节逐条检查（桌面浏览器 + 开发者工具的手机模拟；有条件的话用真机打开局域网地址 `npm run preview -- --host`）：
1. 首页先看到静帧，随后 3D 车库淡入；车缓慢自转，横向拖动可以转车，竖向滑动仍能滚动页面。
2. 切到「赛道试炼」：镜头移到车侧，车轮转动、赛道线流动；连续答对 5 题时画面边缘闪过色散。切到「保险库」：车尾、香槟金色光；切到「设置」：回到车库镜头、压暗、不自转。
3. 在设置里关掉「3D 车库」：立即变成静帧；重新打开：3D 再次淡入。开发者工具 Rendering 面板里模拟 `prefers-reduced-motion: reduce` 后刷新：只有静帧，Network 面板里没有请求 `Stage-*.js` 和 `car.glb`。
4. 设置页「鸣谢」里有车模型的 CC BY 署名。

- [ ] **Step 4: 清理临时文件**

```powershell
Remove-Item -Recurse -Force scripts/.cache -ErrorAction SilentlyContinue
git status
```

Expected: 工作区干净（`scripts/.cache/` 本就在 `.gitignore` 里）。

- [ ] **Step 5: 如有修复，提交**

```powershell
git add -A
git commit -m "chore(scene): final verification fixes"
```

（没有改动则跳过。）
