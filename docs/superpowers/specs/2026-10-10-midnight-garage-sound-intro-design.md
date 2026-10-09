# Midnight Garage 开场与音效 设计（计划 3B）

状态：待确认

上级文档：`docs/superpowers/specs/2026-10-09-midnight-garage-design.md` 第 5.3、6.2 节；`docs/superpowers/specs/2026-10-10-midnight-garage-scene-design.md`（3D 场景，本文不改其行为，只加一个加载进度回调和一个点火事件）。

## 1. 目标

- 首次访问时，用一块转速表显示加载进度；转满后她点「点火」，听到点火声，车灯亮起，进入车库。
- 在关键时刻播放真实录音音效：点火、轰油、解锁。
- 顶部导航有静音开关，默认有声，状态保存在本地。

**不做：** 背景音乐；随转速变化的连续引擎声；音量滑块；再次观看开场的入口。

## 2. 音效素材

### 2.1 来源

全部来自 Freesound，授权均为 CC0（已在各自页面核实）。源文件放在 `assets-src/audio/`（不提交）。

| 输出名 | 源 | 截取 | 用途 |
|---|---|---|---|
| `ignition` | Freesound #659560「Ferrari start up and drive off」，作者 EwanPenman11 | 约 20.0–28.5 秒（启动、怠速、一下轰油），首尾淡入淡出 | 点火 |
| `rev` | Freesound #478756「Supercar rev」，作者 richwise | 约 6 秒处起的一次完整轰油，约 2.5 秒 | 轰鸣 |
| `blip` | 同上 #478756 | 一次短促轰油，约 1.2 秒 | 短轰油 |
| `unlock` | Freesound #396448「Car Lock」，作者 hz37 | 全段（0.6 秒） | 解锁 |

具体截取的起止秒数在实施时按响度包络和试听确定，写在 `scripts/audio.config.ts` 里。

### 2.2 处理脚本

新增 `npm run audio`（`scripts/audio.ts`），用开发依赖 `ffmpeg-static` 调用 ffmpeg：

1. 按配置截取片段，首尾加短淡入淡出（避免爆音）。
2. 转单声道，响度统一（`loudnorm`，目标约 −16 LUFS；`unlock` 可单独设低一些）。
3. 输出 MP3（96 kbps，44.1 kHz）到 `public/audio/<name>.mp3`，覆盖前先写临时文件再改名。
4. 每个文件不超过 150 KB，四个合计不超过 250 KB；超过则报错。
5. 源文件缺失时给出中文提示，说明应放在哪里。

输出文件提交到仓库；`public/audio/** -text` 写进 `.gitattributes`。

## 3. 声音模块（`src/audio/`）

使用 Web Audio API，不引入第三方库。

- `unlockAudio()`：在用户手势里调用。首次调用时创建（或恢复）`AudioContext`，并开始下载、解码四个音效（之后复用）。
- `play(name)`：`name` 为 `'ignition' | 'rev' | 'blip' | 'unlock'`。
  - 静音时什么也不做。
  - 还没有任何用户手势（`AudioContext` 不存在）时什么也不做。
  - 该音效还没解码完时，等它解码完再播放；但如果等待超过 1.5 秒，就放弃这次播放（声音晚到比没有更糟）。
  - 同一个音效再次播放时，先停掉上一次。
  - 任何错误（浏览器不支持、下载失败、解码失败）都静默吞掉，只在开发模式下 `console.warn`。
- `stopAll()`：立即停止所有正在播放的声音（静音时调用）。
- 全站在任意一次点击或按键时调用一次 `unlockAudio()`（在 `Layout` 根元素上监听 `pointerdown` 和 `keydown`，只触发一次）。
- 页面隐藏（切到后台）时调用 `stopAll()`。

主包体积：声音模块很小，直接进主包；音频文件只在第一次手势后才下载。

## 4. 偏好

`src/prefs/prefs.ts` 的 `Prefs` 增加两个字段：

| 字段 | 默认 | 含义 |
|---|---|---|
| `muted` | `false` | 是否静音 |
| `introSeen` | `false` | 是否已经看过开场（点过「点火」） |

读取时对每个字段单独校验类型，坏值回退默认值（与现有 `scene3d` 一致）。

## 5. 静音开关

- 位置：顶部导航最右边，在「设置」之后，一个喇叭图标按钮。
- `aria-label`：有声时为「静音」，静音时为「取消静音」；`aria-pressed` 反映静音状态。
- 点击切换 `muted` 并保存；切到静音时调用 `stopAll()`。

## 6. 播放位置

| 时机 | 音效 |
|---|---|
| 开场点「点火」 | `ignition` |
| 保险库按住 START 完成、提交口令时 | `ignition` |
| 口令正确、保险库打开时 | `unlock` |
| 赛道连对达到 5 或 10（氮气） | `rev` |
| 首页点「出发」进入赛道 | `blip` |
| 完成今天的 20 个词，出现本圈总结时 | `rev` |

口令错误时不播放 `unlock`（点火声照常已经响过）。

## 7. 开场

### 7.1 何时出现

同时满足才出现：`introSeen` 为 `false`，且当前页面是车库首页 `/`。从其他页面直接打开（例如分享的链接）不出现，也不标记为已看过。她点「点火」后才把 `introSeen` 设为 `true`。

### 7.2 画面

- 全屏覆盖层（压在 3D 场景和界面之上），深色背景，中间是一块转速表：0 到 8（×1000 rpm）的刻度，红区从 7 开始，一根指针。
- 指针角度 = 加载进度 × 满量程。转速表下方显示百分比。
- 加载完成后，转速表下方出现「点火」按钮（圆形，与保险库 START 风格一致）。
- 覆盖层用中文文案，字体沿用现有设计。

### 7.3 加载进度

- 3D 模式：进度分两段——3D 代码块下载完成计 30%；之后 `car.glb` 等资源的加载进度占剩余 70%。为此 `StageProps` 增加可选回调 `onProgress(fraction: number)`，`Stage` 内部用 drei 的 `useProgress` 上报（只在 `src/scene/three/` 内使用 drei）。`SceneHost` 把两段合成一个 0–1 的进度，通过一个小的进度仓库（`src/scene/loading.ts`，订阅式，与 `events.ts` 风格一致）发布给开场组件。
- 静帧模式（不支持 WebGL 2、关闭了 3D、性能不足或加载失败）：进度在约 1.2 秒内平滑走到 100%。
- 3D 中途失败转为静帧时，进度直接走到 100%。
- 「减少动态效果」：指针不做动画，直接显示当前进度；转满后同样出现「点火」。
- 最短显示 1.5 秒，避免一闪而过；加载超过 8 秒仍未完成时，「点火」按钮照样出现，加载在后台继续。

### 7.4 点火之后

1. 调用 `unlockAudio()` 并 `play('ignition')`。
2. 发出 `ignition` 事件（`src/scene/events.ts` 新增 `emitIgnition` / `onIgnition`，与 `emitNitro` 同风格）。
3. 3D 车辆监听该事件：开场组件决定显示时，先调用 `events.ts` 新增的 `setIgnitionPending(true)`（模块级标记，`isIgnitionPending()` 读取；`emitIgnition()` 会把它清回 `false`）；车辆挂载时若标记为真，车灯（发光材质）保持熄灭；收到事件后在约 0.8 秒内闪两下再常亮。没有开场的访问，车灯一开始就是常亮（与现在一致）。
4. 覆盖层在约 0.6 秒内淡出后卸载；设置 `introSeen = true`。
5. 「减少动态效果」时不闪烁，车灯直接亮，覆盖层直接消失。

### 7.5 失败

开场组件本身不依赖 3D；3D 失败只会让进度直接走满。声音播放失败不影响开场流程。

## 8. 鸣谢

设置页「鸣谢」增加一行：音效来自 Freesound（CC0）：EwanPenman11「Ferrari start up and drive off」、richwise「Supercar rev」、hz37「Car Lock」，各自链接到原页面。

## 9. 测试

- 单元测试：
  - 偏好：`muted`、`introSeen` 的默认值、坏值回退、保存。
  - 声音模块（用假的 `AudioContext`）：手势前 `play` 不出声；静音时不出声；解码失败静默；超过 1.5 秒未就绪放弃；同名再次播放会停掉上一次；`stopAll` 停掉全部。
  - 进度仓库：两段进度合成正确；静帧模式走满。
  - 开场：`introSeen` 为真或不在首页时不出现；进度满后出现「点火」；点「点火」后播放 `ignition`、发出 `ignition` 事件、写入 `introSeen`；8 秒兜底。
  - 静音开关：切换、`aria-pressed`、静音时调用 `stopAll`。
  - 各播放位置：保险库、氮气、出发、本圈总结各自调用了正确的 `play`。
  - 音频脚本：截取参数校验、体积上限、源文件缺失的提示（纯函数部分）。
- 浏览器检查：清空本地存储后走一遍开场；静音开关；保险库解锁；赛道连对 5 个。
- 主包不得引入 `three`；主包（gzip）仍小于 200 KB。
