# Midnight Garage 1.1：保险库开门动画与今日回忆

日期：2026-10-10
状态：已确认

## 1. 范围

1. 今日回忆：保险库打开后，标签页上方一张卡片，优先「那年今天」，否则「今日一张」。
2. 开门动画：全屏圆形金库门（SVG + Motion），每个学习日第一次进入保险库时播放。

不在本版：车辆改装（1.3）、发音自动播放、保险库 3D 场景改动、清单的回忆、车库首页的回忆提示。不改加密格式、manifest 结构和 `npm run vault` 构建脚本。

## 2. 今日回忆

### 2.1 选取规则

纯函数 `todaysMemory(manifest: VaultManifest, today: string): Memory | null`，放在 `src/vault/memory.ts`。`today` 由调用方传 `studyDay(new Date())`（凌晨 4 点换日，与车库仪表一致）。

```ts
type Memory =
  | { kind: 'anniversary'; years: number; item: { type: 'photo'; photo: PhotoEntry; index: number } | { type: 'note'; note: NoteEntry } }
  | { kind: 'daily'; item: { type: 'photo'; photo: PhotoEntry; index: number } }
```

`index` 是该照片在 `manifest.photos` 里的下标，供看图器使用。

1. **那年今天**：照片和笔记中，日期的「月-日」等于今天的「月-日」且年份早于今年的条目。2 月 29 日的条目在非闰年的 2 月 28 日算作那年今天。
   - 照片优先于笔记。
   - 多个候选时取年份最近的；同一年有多个时，用今天日期的稳定哈希在其中挑一个（同一天结果不变）。
   - `years` = 今年 − 条目年份。
2. **今日一张**：没有那年今天时，从全部照片里按今天日期的稳定哈希挑一张（同一天不变，换天大概率变化）。
3. 没有那年今天、也没有照片时返回 `null`，不显示卡片。

哈希用简单的字符串哈希（如 FNV-1a）取模，不需要加密强度。

### 2.2 卡片

`MemoryCard`（`src/vault/components/MemoryCard.tsx`），在 `VaultContent` 里标题行之下、标签栏之上。

- 抬头：那年今天显示「N 年前的今天」，今日一张显示「今日一张」；后面跟条目日期。
- 照片：缩略图（`useBlobUrl(photo.thumb, …)`）+ 说明文字；点击打开现有 `PhotoViewer`，从该照片开始，可左右翻看全部照片。
- 笔记：复用 `NotesTab` 里的笔记卡（导出 `NoteCard`），显示标题与前两行预览，点击就地展开全文。
- 缩略图加载失败时显示「打不开」，与照片网格一致。
- 卡片边框用 `border-accent/60`，跟随保险库主题（金色）。

## 3. 开门动画

### 3.1 外观与时间线

`VaultDoor`（`src/vault/components/VaultDoor.tsx`）：`fixed inset-0` 全屏覆盖层，深色背景，中间一扇圆形金库门（SVG）：外圈金色环、8 根径向锁栓、中心三辐转盘。总时长约 1.6 秒：

1. 0–0.5 s：中心转盘旋转 270°。
2. 0.5–0.8 s：8 根锁栓向内缩回。
3. 0.8–1.6 s：门绕左边缘转开（`perspective` + `rotateY` 到约 −100°），背景同时淡出。
4. 结束后卸载覆盖层，现有 `GoldSweep` 随后播放。

- 开始时播放 `unlock` 音效。
- 点一下覆盖层直接跳到结束。
- 播放期间下层保险库内容 `inert`；覆盖层 `aria-hidden`。
- 减少动态效果时不显示门，内容直接出现（`GoldSweep` 本来就不播）。

### 3.2 何时播放

- 每个学习日第一次进入打开状态时播放一次，无论是手动输入口令还是「记住」后的自动解锁。
- 已播放的学习日存在 `localStorage` 键 `midnight-garage/vault-door-day`，由 `src/vault/doorDay.ts` 读写（`doorPlayedOn(day): boolean`、`markDoorPlayed(day): void`）；存储不可用或值损坏时按「今天还没播」处理，写入失败忽略。
- 音效：现在 `VaultScreen.unlock` 里的 `play('unlock')` 改为：播放开门动画时由门播放；不播放门（当天已播或减少动态效果）的手动解锁仍在解锁时播放。自动解锁且不播门时不播音效（与现在一致）。

### 3.3 组件关系

`VaultScreen` 在进入 `open` 状态时决定 `door: boolean`（未减少动态效果且今天未播），渲染 `VaultContent`，`door` 为真时叠加 `VaultDoor`，决定播放时立即 `markDoorPlayed(today)`（中途离开也不会重播），门结束时移除门；`VaultContent` 新增 `sweep: boolean` 属性控制是否挂载 `GoldSweep`：`VaultScreen` 在门播放期间传 `false`，门结束后传 `true`；不播门时一开始就传 `true`。

## 4. 测试

- `memory.ts`：同月同日命中、跨年取最近年份、同年稳定选择、2 月 29 日规则、照片优先于笔记、今年的条目不算、今日一张同一天稳定且换天会变（构造足够多照片）、空 manifest 返回 null、只有笔记且无那年今天返回 null。
- `doorDay.ts`：未写过返回 false、写后同日 true 次日 false、损坏值、存储抛错。
- `MemoryCard`：两种抬头文字、照片点击打开看图器、笔记卡渲染标题。
- `VaultScreen`：当天首次打开有门（`data-testid="vault-door"`），门结束（或点击跳过）后再进入同一天没有门；减少动态效果不出现门；自动解锁当天首次也有门；手动解锁且不播门时仍调用 `play('unlock')`，播门时只调用一次。
- 控制器浏览器检查：开门动画观感、点击跳过、手机竖屏、保险库主题下卡片样式。

## 5. 风险

- 动画期间下层内容已开始解密缩略图：可接受，门转开时内容正好就绪。
- 哈希挑选让「今日一张」可能连续两天相同：照片少时不可避免，可接受。
