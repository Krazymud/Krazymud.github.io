# 1.3 车辆改装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 车库页可以给 3D 车换车漆、轮毂、卡钳颜色（预设色板），选择保存在本机偏好里。

**Architecture:** 构建脚本把「车漆遮罩」写进车身贴图的 alpha 通道并重建 `car.glb`；运行时 `src/scene/three/carPaint.ts` 给车身材质挂一段着色器按遮罩混入车漆色，轮毂和卡钳直接改材质颜色。色板是纯数据（`src/garage/mods.ts`），选择存在 `prefs`；车库页的 `ModsPanel` 写偏好，`Car.tsx` 读偏好并应用。

**Tech Stack:** Node 脚本（sharp、glTF-Transform）、React 19、three 0.186 / R3F 9、Tailwind 4、Vitest。

## Global Constraints

- 只在功能分支 `feature/car-mods` 上实现，不在 master 上写代码。
- 不提交 `assets-src/`、`dist/`、`node_modules/`、`.superpowers/`。`public/models/car.glb` 要提交（Task 1 重建）。
- `src/scene/three/` 以外不得引入 three / R3F；`src/garage/mods.ts` 与 `src/prefs/prefs.ts` 不得引入 three。
- 主包 ≤ 200 KB gzip（当前约 154.3 KB）。
- 不改镜头构图、不改原厂效果：原厂选择下的渲染须与改动前一致。
- `car.glb` 不超过 `maxBytes` 3 MB。
- 界面文字为中文；代码注释只写代码本身表达不了的约束。
- 运行 node 前先：`$env:Path = "C:\Program Files\nodejs;$env:Path"`（PowerShell）。仓库没有 ESLint。

## 文件

- Modify `scripts/lib/carAtlas.ts`、`scripts/lib/carAtlas.test.ts`；重建 `public/models/car.glb`
- Create `src/garage/mods.ts`、`src/garage/mods.test.ts`
- Modify `src/prefs/prefs.ts`、`src/prefs/prefs.test.ts`、`src/pages/SettingsPage.test.tsx`
- Create `src/scene/three/carPaint.ts`、`src/scene/three/carPaint.test.ts`；Modify `src/scene/three/Car.tsx`
- Create `src/garage/ModsPanel.tsx`、`src/garage/ModsPanel.test.tsx`；Modify `src/pages/HomePage.tsx`、`src/pages/HomePage.test.tsx`

---

### Task 1: 车漆遮罩写进车身贴图 alpha，并重建车模型

**Files:**
- Modify: `scripts/lib/carAtlas.ts`
- Test: `scripts/lib/carAtlas.test.ts`
- Regenerate: `public/models/car.glb`（`npm run car`，读取本地 `assets-src/car`）

**Interfaces:**
- Produces: `AtlasPixels` 新增 `paintMask: Uint8Array`（每像素 1 字节，车漆 255、其余 0）；`buildBodyTextures(...).baseColor` 变为带 alpha 的 RGBA WebP（`orm`、`emissive` 不变）。运行时（Task 3）读取 `body` 材质贴图的 alpha 作为车漆遮罩。

- [ ] **Step 1: Write the failing tests**

在 `scripts/lib/carAtlas.test.ts` 的 `describe('convertAtlas', …)` 内（`rejects textures of different sizes` 之前）加：

```ts
  it('marks only paint pixels in the paint mask', () => {
    expect(out.paintMask.length).toBe(W * H)
    expect(out.paintMask[5 * W + 5]).toBe(255)
    expect(out.paintMask[7 * W + 3]).toBe(0)
    expect(out.paintMask[2 * W + 10]).toBe(0)
  })

  it('keeps the plate out of the paint mask', () => {
    const paintedPlate = image((x, y) => ((x === 1 && y === 1) || (x === 5 && y === 5) ? [60, 128, 26, 178] : [10, 10, 10, 127]))
    const mask = convertAtlas(diffuse, paintedPlate, occlusion, config).paintMask
    expect(mask[1 * W + 1]).toBe(0)
    expect(mask[5 * W + 5]).toBe(255)
  })
```

在 `describe('buildBodyTextures', …)` 的 `encodes all three maps as WebP at the output size` 用例末尾（`for` 循环之后）加：

```ts
    expect(await sharp(result.baseColor).metadata()).toMatchObject({ channels: 4, hasAlpha: true })
    expect((await sharp(result.orm).metadata()).hasAlpha).toBe(false)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/lib/carAtlas.test.ts`
Expected: FAIL（`paintMask` 为 undefined；`baseColor` 没有 alpha）。

- [ ] **Step 3: Implement**

`scripts/lib/carAtlas.ts`：

1. `AtlasPixels` 接口加一行 `paintMask: Uint8Array`。
2. `convertAtlas` 里：在 `const emissive = …` 之后加 `const paintMask = new Uint8Array(width * height)`；在循环里 `const pixel = classify(...)` 之后加：

```ts
      if (!inRect(x, y, config.plate) && isPaint(s, config.paintSpecular, config.paintTolerance)) paintMask[y * width + x] = 255
```

   返回值改为 `return { baseColor, orm, emissive, paintMask, emissivePixels, width, height }`。
3. `buildBodyTextures` 中把 `encode` 和返回值改为：

```ts
  const [outWidth, outHeight] = config.outputSize
  const encode = (data: Uint8Array, channels: 3 | 4) =>
    sharp(data, { raw: { width: pixels.width, height: pixels.height, channels } })
      .resize(outWidth, outHeight, { fit: 'fill' })
      .webp({ quality: 82 })
      .toBuffer()
  const withMask = new Uint8Array(pixels.width * pixels.height * 4)
  for (let i = 0; i < pixels.width * pixels.height; i++) {
    withMask.set(withPlate.subarray(i * 3, i * 3 + 3), i * 4)
    withMask[i * 4 + 3] = pixels.paintMask[i]
  }
  return {
    baseColor: await encode(withMask, 4),
    orm: await encode(pixels.orm, 3),
    emissive: await encode(pixels.emissive, 3),
    emissivePixels: pixels.emissivePixels,
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/lib`
Expected: PASS（含 carModel / carCommand 原有用例）。

- [ ] **Step 5: Rebuild the car**

Run: `npm run car`
Expected: 输出「已写入 public/models/car.glb（x.xx MB）」，x.xx < 3。然后确认 alpha 确实进了模型：

```powershell
node -e "const {NodeIO}=require('@gltf-transform/core');const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');(async()=>{const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read('public/models/car.glb');const tex=doc.getRoot().listMaterials().find(m=>m.getName()==='body').getBaseColorTexture();const sharp=require('sharp');console.log(await sharp(Buffer.from(tex.getImage())).metadata().then(m=>({channels:m.channels,hasAlpha:m.hasAlpha})))})()"
```

Expected: `{ channels: 4, hasAlpha: true }`。若 `require` 因包是 ESM 而失败，把同样的逻辑写进临时文件 `%TEMP%\check-car.mts`（用 `import`），以 `npx tsx %TEMP%\check-car.mts` 运行，不要把临时文件放进仓库。

- [ ] **Step 6: Full tests**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/carAtlas.ts scripts/lib/carAtlas.test.ts public/models/car.glb
git commit -m "feat(car): paint mask in the body texture alpha"
```

---

### Task 2: 色板与偏好

**Files:**
- Create: `src/garage/mods.ts`、`src/garage/mods.test.ts`
- Modify: `src/prefs/prefs.ts`、`src/prefs/prefs.test.ts`、`src/pages/SettingsPage.test.tsx`

**Interfaces:**
- Produces:
  - `interface Swatch { id: string; name: string; hex: string; chip?: string }`
  - `PAINTS`、`RIMS`、`CALIPERS: readonly Swatch[]`（首项为原厂）
  - `type ModPart = 'paint' | 'rim' | 'caliper'`
  - `interface Mods { paint: Swatch; rim: Swatch; caliper: Swatch }`
  - `function modsFor(choice: Record<ModPart, string>): Mods`（未知 id 回落到首项）
  - `function isSwatchId(part: ModPart, id: unknown): id is string`
  - `Prefs` 新增 `paint: string; rim: string; caliper: string`；`DEFAULT_PREFS` 为 `{ scene3d: true, muted: false, introSeen: false, paint: 'midnight', rim: 'gunmetal', caliper: 'red' }`

- [ ] **Step 1: Write the failing tests**

`src/garage/mods.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { CALIPERS, isSwatchId, modsFor, PAINTS, RIMS } from './mods'

describe('mods', () => {
  it('starts each palette with the factory colour', () => {
    expect([PAINTS[0], RIMS[0], CALIPERS[0]].map((s) => [s.id, s.hex])).toEqual([
      ['midnight', '#090909'],
      ['gunmetal', '#b3b3b8'],
      ['red', '#9e1c22'],
    ])
  })

  it('uses unique ids and plain hex colours', () => {
    for (const list of [PAINTS, RIMS, CALIPERS]) {
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length)
      for (const s of list) {
        expect(s.hex).toMatch(/^#[0-9a-f]{6}$/)
        if (s.chip) expect(s.chip).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
    expect([PAINTS.length, RIMS.length, CALIPERS.length]).toEqual([8, 6, 6])
  })

  it('resolves choices and falls back to the factory colour', () => {
    expect(modsFor({ paint: 'blue', rim: 'bronze', caliper: 'gold' })).toMatchObject({
      paint: { name: '宝石蓝' },
      rim: { name: '古铜' },
      caliper: { name: '金' },
    })
    expect(modsFor({ paint: 'nope', rim: '', caliper: 'red' })).toEqual({ paint: PAINTS[0], rim: RIMS[0], caliper: CALIPERS[0] })
  })

  it('knows which ids belong to which part', () => {
    expect(isSwatchId('paint', 'pearl')).toBe(true)
    expect(isSwatchId('rim', 'pearl')).toBe(false)
    expect(isSwatchId('caliper', 3)).toBe(false)
  })
})
```

`src/prefs/prefs.test.ts`：把文件中所有形如 `{ scene3d: …, muted: …, introSeen: … }` 的期望对象补上三项默认值 `paint: 'midnight', rim: 'gunmetal', caliper: 'red'`（共 7 处：第 14、20、43、44、61、63 行的期望，以及第 13 行用例标题改为 `'defaults to the 3D garage on, sound on, intro unseen and the factory colours'`）。例如第 14 行改为：

```ts
    expect(getPrefs()).toEqual({ scene3d: true, muted: false, introSeen: false, paint: 'midnight', rim: 'gunmetal', caliper: 'red' })
```

并在 `describe` 末尾加：

```ts
  it('keeps known car colours and drops unknown ones', () => {
    localStorage.setItem(PREFS_KEY, '{"paint":"pearl","rim":"bronze","caliper":"yellow"}')
    expect(readPrefs()).toMatchObject({ paint: 'pearl', rim: 'bronze', caliper: 'yellow' })
    localStorage.setItem(PREFS_KEY, '{"paint":"pink","rim":7,"caliper":"pearl"}')
    expect(readPrefs()).toMatchObject({ paint: 'midnight', rim: 'gunmetal', caliper: 'red' })
  })

  it('saves a colour choice', () => {
    setPrefs({ paint: 'red' })
    resetPrefsCache()
    expect(getPrefs().paint).toBe('red')
  })
```

`src/pages/SettingsPage.test.tsx` 第 61 行改为：

```ts
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ scene3d: false, muted: false, introSeen: false, paint: 'midnight', rim: 'gunmetal', caliper: 'red' })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/garage/mods.test.ts src/prefs/prefs.test.ts src/pages/SettingsPage.test.tsx`
Expected: FAIL（找不到 `./mods`；prefs 缺三项）。

- [ ] **Step 3: Implement**

`src/garage/mods.ts`：

```ts
export interface Swatch {
  id: string
  name: string
  hex: string
  chip?: string
}

export type ModPart = 'paint' | 'rim' | 'caliper'

export interface Mods {
  paint: Swatch
  rim: Swatch
  caliper: Swatch
}

export const PAINTS: readonly Swatch[] = [
  { id: 'midnight', name: '午夜黑', hex: '#090909' },
  { id: 'red', name: '赛道红', hex: '#8e1018' },
  { id: 'blue', name: '宝石蓝', hex: '#0e2a6b' },
  { id: 'green', name: '墨绿', hex: '#0f3326' },
  { id: 'champagne', name: '香槟金', hex: '#8a7448' },
  { id: 'pearl', name: '珍珠白', hex: '#cfcfca' },
  { id: 'titanium', name: '钛银', hex: '#6b6e73' },
  { id: 'sunset', name: '落日橙', hex: '#b4410f' },
]

// 轮毂颜色乘在贴图上，hex 是系数，chip 才是看上去的颜色。
export const RIMS: readonly Swatch[] = [
  { id: 'gunmetal', name: '枪灰', hex: '#b3b3b8', chip: '#5a5a60' },
  { id: 'silver', name: '亮银', hex: '#ffffff', chip: '#c4c6ca' },
  { id: 'black', name: '哑黑', hex: '#2a2a2e', chip: '#1d1d20' },
  { id: 'bronze', name: '古铜', hex: '#b07a48', chip: '#7a5530' },
  { id: 'gold', name: '香槟金', hex: '#d8b878', chip: '#a88a52' },
  { id: 'blue', name: '电光蓝', hex: '#6f8fd8', chip: '#34508c' },
]

export const CALIPERS: readonly Swatch[] = [
  { id: 'red', name: '赛道红', hex: '#9e1c22' },
  { id: 'yellow', name: '黄', hex: '#d8a400' },
  { id: 'blue', name: '蓝', hex: '#1b4fa8' },
  { id: 'black', name: '黑', hex: '#16161a' },
  { id: 'orange', name: '橙', hex: '#d2560f' },
  { id: 'gold', name: '金', hex: '#b08a3e' },
]

export const PALETTES: Record<ModPart, readonly Swatch[]> = { paint: PAINTS, rim: RIMS, caliper: CALIPERS }

export function isSwatchId(part: ModPart, id: unknown): id is string {
  return typeof id === 'string' && PALETTES[part].some((swatch) => swatch.id === id)
}

const pick = (part: ModPart, id: string): Swatch => PALETTES[part].find((swatch) => swatch.id === id) ?? PALETTES[part][0]

export function modsFor(choice: Record<ModPart, string>): Mods {
  return { paint: pick('paint', choice.paint), rim: pick('rim', choice.rim), caliper: pick('caliper', choice.caliper) }
}
```

`src/prefs/prefs.ts`：

1. 顶部加 `import { isSwatchId, PALETTES, type ModPart } from '../garage/mods'`。
2. `Prefs` 加三项、`DEFAULT_PREFS` 改为：

```ts
export interface Prefs {
  scene3d: boolean
  muted: boolean
  introSeen: boolean
  paint: string
  rim: string
  caliper: string
}

export const DEFAULT_PREFS: Prefs = {
  scene3d: true,
  muted: false,
  introSeen: false,
  paint: PALETTES.paint[0].id,
  rim: PALETTES.rim[0].id,
  caliper: PALETTES.caliper[0].id,
}
```

3. `readPrefs` 里的 `pick` 与返回值改为：

```ts
    const flag = (key: 'scene3d' | 'muted' | 'introSeen'): boolean => {
      const value = record[key]
      return typeof value === 'boolean' ? value : DEFAULT_PREFS[key]
    }
    const colour = (key: ModPart): string => (isSwatchId(key, record[key]) ? (record[key] as string) : DEFAULT_PREFS[key])
    return {
      scene3d: flag('scene3d'),
      muted: flag('muted'),
      introSeen: flag('introSeen'),
      paint: colour('paint'),
      rim: colour('rim'),
      caliper: colour('caliper'),
    }
```

4. `setPrefs` 的合并循环改为（字段类型不同，不能直接按键赋值）：

```ts
export function setPrefs(patch: Partial<Prefs>): void {
  const previous = getPrefs()
  const next: Prefs = { ...previous }
  for (const key of PREF_KEYS) {
    const value = patch[key]
    if (value !== undefined) Object.assign(next, { [key]: value })
  }
  if (PREF_KEYS.every((key) => next[key] === previous[key])) return
  current = next
  writePrefs(current)
  for (const listener of listeners) listener()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 全部 PASS。`npx tsc -b` 无错误。

- [ ] **Step 5: Commit**

```bash
git add src/garage/mods.ts src/garage/mods.test.ts src/prefs/prefs.ts src/prefs/prefs.test.ts src/pages/SettingsPage.test.tsx
git commit -m "feat(garage): car colour palettes saved in prefs"
```

---

### Task 3: 车上应用颜色

**Files:**
- Create: `src/scene/three/carPaint.ts`、`src/scene/three/carPaint.test.ts`
- Modify: `src/scene/three/Car.tsx`

**Interfaces:**
- Consumes: Task 1 的车身贴图 alpha 遮罩（`body` 材质的 `map`）；Task 2 的 `modsFor`、`Mods`、`Prefs.paint/rim/caliper`、`usePrefs`。
- Produces:
  - `interface CarFinish { paint: { value: Color }; wheel: MeshStandardMaterial | null; caliper: MeshStandardMaterial | null }`
  - `function finishCar(scene: Object3D): CarFinish`（按材质名 `body`、`wheel`、`caliper` 查找；结果缓存在 `scene.userData.finish`，对同一 scene 只挂一次着色器）
  - `function applyMods(finish: CarFinish, mods: Mods): void`

- [ ] **Step 1: Write the failing test**

`src/scene/three/carPaint.test.ts`：

```ts
import { BoxGeometry, Color, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'
import { modsFor } from '../../garage/mods'
import { applyMods, finishCar } from './carPaint'

function car() {
  const scene = new Group()
  const named = <T extends MeshStandardMaterial>(material: T, name: string) => Object.assign(material, { name })
  const body = named(new MeshPhysicalMaterial(), 'body')
  const wheel = named(new MeshStandardMaterial(), 'wheel')
  const caliper = named(new MeshStandardMaterial(), 'caliper')
  for (const material of [body, wheel, caliper]) scene.add(new Mesh(new BoxGeometry(), material))
  return { scene, body, wheel, caliper }
}

const shaderStub = () => ({
  uniforms: {} as Record<string, unknown>,
  fragmentShader: 'uniform vec3 diffuse;\nvoid main() {\n\t#include <map_fragment>\n}',
  vertexShader: '',
})

describe('carPaint', () => {
  it('mixes the paint colour in where the body texture alpha marks paint', () => {
    const { scene, body } = car()
    const finish = finishCar(scene)
    const shader = shaderStub()
    body.onBeforeCompile(shader as never, {} as WebGLRenderer)
    expect(shader.uniforms.uPaint).toBe(finish.paint)
    expect(shader.fragmentShader).toContain('uniform vec3 uPaint;')
    expect(shader.fragmentShader).toContain('diffuseColor.rgb = mix( diffuseColor.rgb, uPaint, sampledDiffuseColor.a );')
    expect(body.customProgramCacheKey()).toBe('car-paint')
  })

  it('sets up a scene only once', () => {
    const { scene } = car()
    expect(finishCar(scene)).toBe(finishCar(scene))
  })

  it('colours the paint, rims and calipers', () => {
    const { scene, wheel, caliper } = car()
    const finish = finishCar(scene)
    applyMods(finish, modsFor({ paint: 'blue', rim: 'silver', caliper: 'yellow' }))
    expect(finish.paint.value.getHex()).toBe(new Color('#0e2a6b').getHex())
    expect(wheel.color.getHex()).toBe(new Color('#ffffff').getHex())
    expect(caliper.color.getHex()).toBe(new Color('#d8a400').getHex())
  })

  it('starts at the factory colours', () => {
    const { scene, wheel, caliper } = car()
    const finish = finishCar(scene)
    applyMods(finish, modsFor({ paint: 'midnight', rim: 'gunmetal', caliper: 'red' }))
    expect(finish.paint.value.getHex()).toBe(new Color('#090909').getHex())
    expect(wheel.color.getHex()).toBe(new Color('#b3b3b8').getHex())
    expect(caliper.color.getHex()).toBe(new Color('#9e1c22').getHex())
  })

  it('tolerates a car without the named materials', () => {
    const finish = finishCar(new Group())
    expect(() => applyMods(finish, modsFor({ paint: 'red', rim: 'black', caliper: 'blue' }))).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scene/three/carPaint.test.ts`
Expected: FAIL（找不到 `./carPaint`）。

- [ ] **Step 3: Implement**

`src/scene/three/carPaint.ts`：

```ts
import { Color, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import type { Mods } from '../../garage/mods'

export interface CarFinish {
  paint: { value: Color }
  wheel: MeshStandardMaterial | null
  caliper: MeshStandardMaterial | null
}

function materialsByName(scene: Object3D): Map<string, MeshStandardMaterial> {
  const found = new Map<string, MeshStandardMaterial>()
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    for (const material of [object.material].flat()) {
      if (material instanceof MeshStandardMaterial) found.set(material.name, material)
    }
  })
  return found
}

export function finishCar(scene: Object3D): CarFinish {
  const cached = scene.userData.finish as CarFinish | undefined
  if (cached) return cached
  const materials = materialsByName(scene)
  const paint = { value: new Color('#090909') }
  const body = materials.get('body')
  if (body) {
    // 车身贴图的 alpha 是构建脚本写入的车漆遮罩；材质不透明，alpha 不参与混合。
    body.onBeforeCompile = (shader) => {
      shader.uniforms.uPaint = paint
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 uPaint;\nvoid main() {')
        .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, uPaint, sampledDiffuseColor.a );')
    }
    body.customProgramCacheKey = () => 'car-paint'
    body.needsUpdate = true
  }
  const finish: CarFinish = { paint, wheel: materials.get('wheel') ?? null, caliper: materials.get('caliper') ?? null }
  scene.userData.finish = finish
  return finish
}

export function applyMods(finish: CarFinish, mods: Mods): void {
  finish.paint.value.set(mods.paint.hex)
  finish.wheel?.color.set(mods.rim.hex)
  finish.caliper?.color.set(mods.caliper.hex)
}
```

`src/scene/three/Car.tsx`：

1. 加 import：

```ts
import { modsFor } from '../../garage/mods'
import { usePrefs } from '../../prefs/prefs'
import { applyMods, finishCar } from './carPaint'
```

2. 在 `const glow = useMemo(...)` 之后加：

```ts
  const finish = useMemo(() => finishCar(scene), [scene])
  const { paint, rim, caliper } = usePrefs()
  useEffect(() => applyMods(finish, modsFor({ paint, rim, caliper })), [finish, paint, rim, caliper])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/scene` 然后 `npm test`、`npx tsc -b`
Expected: 全部 PASS、无类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/scene/three/carPaint.ts src/scene/three/carPaint.test.ts src/scene/three/Car.tsx
git commit -m "feat(scene): paint, rim and caliper colours on the car"
```

---

### Task 4: 改装面板与车库入口

**Files:**
- Create: `src/garage/ModsPanel.tsx`、`src/garage/ModsPanel.test.tsx`
- Modify: `src/pages/HomePage.tsx`、`src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `PALETTES`、`modsFor`、`ModPart`、`Swatch`、`DEFAULT_PREFS`、`setPrefs`、`usePrefs`；`useLoading()`（`src/scene/loading.ts`，返回 `{ kind: '3d' | 'still'; fraction: number }`）、`setLoading`、`resetLoading`。
- Produces: `export function ModsPanel({ onClose }: { onClose: () => void })`，根元素 `role="dialog"`、`aria-label="改装"`。

- [ ] **Step 1: Write the failing tests**

`src/garage/ModsPanel.test.tsx`：

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPrefs, setPrefs } from '../prefs/prefs'
import { ModsPanel } from './ModsPanel'

const group = (name: string) => within(screen.getByRole('group', { name }))

describe('ModsPanel', () => {
  beforeEach(() => localStorage.clear())

  it('shows the three parts with the factory colours picked', () => {
    render(<ModsPanel onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: '改装' })).toHaveFocus()
    expect(group('车漆').getByRole('button', { name: '午夜黑' })).toHaveAttribute('aria-pressed', 'true')
    expect(group('轮毂').getByRole('button', { name: '枪灰' })).toHaveAttribute('aria-pressed', 'true')
    expect(group('卡钳').getByRole('button', { name: '赛道红' })).toHaveAttribute('aria-pressed', 'true')
    expect(group('车漆').getAllByRole('button')).toHaveLength(8)
  })

  it('saves a picked colour and marks it', () => {
    render(<ModsPanel onClose={() => {}} />)
    fireEvent.click(group('车漆').getByRole('button', { name: '宝石蓝' }))
    expect(getPrefs().paint).toBe('blue')
    expect(group('车漆').getByRole('button', { name: '宝石蓝' })).toHaveAttribute('aria-pressed', 'true')
    expect(group('车漆').getByRole('button', { name: '午夜黑' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('宝石蓝', { selector: 'span' })).toBeInTheDocument()
  })

  it('shows rims in their visible colour, not the texture factor', () => {
    render(<ModsPanel onClose={() => {}} />)
    expect(group('轮毂').getByRole('button', { name: '亮银' })).toHaveStyle({ backgroundColor: '#c4c6ca' })
    expect(group('车漆').getByRole('button', { name: '珍珠白' })).toHaveStyle({ backgroundColor: '#cfcfca' })
  })

  it('goes back to the factory colours', () => {
    setPrefs({ paint: 'red', rim: 'bronze', caliper: 'gold' })
    render(<ModsPanel onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '恢复原厂' }))
    expect(getPrefs()).toMatchObject({ paint: 'midnight', rim: 'gunmetal', caliper: 'red' })
  })

  it('closes with the button or Escape', () => {
    const onClose = vi.fn()
    render(<ModsPanel onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
```

`src/pages/HomePage.test.tsx`：

1. import 增加 `import { resetLoading, setLoading } from '../scene/loading'`，并把 `@testing-library/react` 的导入补上 `act`。
2. `beforeEach` 里加 `resetLoading()`。
3. `describe` 末尾加：

```tsx
  it('offers mods once the 3D garage is up', () => {
    renderHome()
    expect(screen.queryByRole('button', { name: '改装' })).not.toBeInTheDocument()
    act(() => setLoading({ kind: '3d', fraction: 1 }))
    const button = screen.getByRole('button', { name: '改装' })
    fireEvent.click(button)
    expect(screen.getByRole('dialog', { name: '改装' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('hides mods when only the still is shown', () => {
    setLoading({ kind: 'still', fraction: 1 })
    renderHome()
    expect(screen.queryByRole('button', { name: '改装' })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/garage/ModsPanel.test.tsx src/pages/HomePage.test.tsx`
Expected: FAIL（找不到 `./ModsPanel`；没有「改装」按钮）。

- [ ] **Step 3: Implement**

`src/garage/ModsPanel.tsx`：

```tsx
import { useEffect, useRef } from 'react'
import { DEFAULT_PREFS, setPrefs, usePrefs } from '../prefs/prefs'
import { modsFor, PALETTES, type ModPart } from './mods'

const ROWS: { part: ModPart; label: string }[] = [
  { part: 'paint', label: '车漆' },
  { part: 'rim', label: '轮毂' },
  { part: 'caliper', label: '卡钳' },
]

export function ModsPanel({ onClose }: { onClose: () => void }) {
  const prefs = usePrefs()
  const current = modsFor(prefs)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => panel.current?.focus(), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="改装"
      tabIndex={-1}
      className="fixed inset-x-0 bottom-0 z-30 max-h-[40dvh] overflow-y-auto border-t border-accent/60 bg-panel/95 px-5 pb-6 pt-4 outline-none"
    >
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <p className="font-display text-xs tracking-[0.35em] text-accent-hi">改装</p>
          <button type="button" onClick={onClose} className="px-2 py-1 text-xs text-muted hover:text-fg">
            关闭
          </button>
        </div>
        {ROWS.map(({ part, label }) => (
          <div key={part} className="mt-3">
            <p className="text-xs text-muted">
              {label} · <span className="text-fg">{current[part].name}</span>
            </p>
            <div role="group" aria-label={label} className="mt-2 flex flex-wrap gap-2">
              {PALETTES[part].map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  aria-label={swatch.name}
                  aria-pressed={current[part].id === swatch.id}
                  onClick={() => setPrefs({ [part]: swatch.id } as Partial<Record<ModPart, string>>)}
                  className={`h-9 w-9 rounded-full border-2 ${current[part].id === swatch.id ? 'border-accent-hi' : 'border-line'}`}
                  style={{ backgroundColor: swatch.chip ?? swatch.hex }}
                />
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPrefs({ paint: DEFAULT_PREFS.paint, rim: DEFAULT_PREFS.rim, caliper: DEFAULT_PREFS.caliper })}
          className="mt-4 border border-line px-4 py-2 text-xs text-muted hover:text-fg"
        >
          恢复原厂
        </button>
      </div>
    </div>
  )
}
```

`src/pages/HomePage.tsx`：

1. 加 import：

```tsx
import { useCallback, useRef, useState } from 'react'
import { ModsPanel } from '../garage/ModsPanel'
import { useLoading } from '../scene/loading'
```

2. 在 `const stats = …` 之后加：

```tsx
  const loading = useLoading()
  const sceneLive = loading.kind === '3d' && loading.fraction === 1
  const [modding, setModding] = useState(false)
  const modsButton = useRef<HTMLButtonElement>(null)
  const closeMods = useCallback(() => {
    setModding(false)
    modsButton.current?.focus()
  }, [])
```

3. 把保险库链接替换为两列（保险库 + 改装），并在 `</section>` 之前渲染面板：

```tsx
        <div className="flex gap-3">
          <Link to="/vault" className="block flex-1 border border-line px-5 py-3 text-sm text-muted hover:text-fg">
            保险库
          </Link>
          {sceneLive && (
            <button
              ref={modsButton}
              type="button"
              onClick={() => setModding(true)}
              className="border border-line px-5 py-3 text-sm text-muted hover:text-fg"
            >
              改装
            </button>
          )}
        </div>
      </div>
      {modding && <ModsPanel onClose={closeMods} />}
    </section>
```

（原来 `</div>` 闭合 `space-y-3` 容器、`</section>` 闭合根元素；替换后结构保持一致。）

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 5: Full verification**

- `npx tsc -b` → 无错误
- `npm run build` → 成功；主入口 JS gzip ≤ 200 KB（报告具体数值），且 `dist/assets` 里主入口文件不含字符串 `onBeforeCompile`（three 代码只在懒加载的 Stage 包里）：`Select-String -Path dist/assets/index-*.js -Pattern onBeforeCompile -Quiet` 应为 `False`。

- [ ] **Step 6: Commit**

```bash
git add src/garage/ModsPanel.tsx src/garage/ModsPanel.test.tsx src/pages/HomePage.tsx src/pages/HomePage.test.tsx
git commit -m "feat(garage): mods panel on the garage page"
```

---

## 控制器收尾（不派给实现子代理）

- 浏览器检查（`http://localhost:5173/`）：等「改装」按钮出现；逐个点车漆 8 色、轮毂 6 色、卡钳 6 色截图；恢复原厂后与改动前观感一致；390×844 竖屏下面板不遮住车身主体。色值不满意只改 `src/garage/mods.ts`（并同步规格表格）。
- 整分支终审、合并 master、询问用户后再推送。
