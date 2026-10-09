# Midnight Garage · 加密保险库设计文档

日期：2026-10-09
状态：待审阅
上级文档：`docs/superpowers/specs/2026-10-09-midnight-garage-design.md` 第 5 节。本文细化并在冲突处取代第 5 节。

## 1. 目标和完成标准

在 `/vault` 提供一个用口令加密的只读空间，展示真实照片、笔记和清单。

1. 输入正确口令后，能看到照片网格、笔记和清单；口令错误时提示「口令不对」。
2. 公开仓库里只有 `public/vault/vault.json` 和随机命名的密文文件，除了密文文件的数量和大小，看不出任何原始内容或文件名。
3. 勾选「在这台设备上记住」后，再次打开 `/vault` 直接进入；点「锁上」后需要重新输入口令。
4. 新增几张照片后重新运行脚本，只有新照片产生新的密文文件，旧密文文件不变。
5. 开启「减少动态效果」时，所有功能照常可用。

**不做：** 引擎声、3D 柜门和镜头动画（计划 3）；在网页上编辑内容；实况照片的视频部分；JPG、PNG、WebP、HEIC 以外的图片格式。

## 2. 内容来源 `vault-src/`

整个目录写进 `.gitignore`，绝不提交。

| 路径 | 内容 | 元数据 |
|---|---|---|
| `photos/*.{jpg,jpeg,png,webp,heic,heif}` | 照片（扩展名不区分大小写） | 日期取 EXIF 拍摄时间，读不到就用文件修改时间；标题默认为空 |
| `notes/*.md` | 笔记，正文为 Markdown | 文件开头的 front matter：`title`（必填）、`date`（必填，`YYYY-MM-DD`） |
| `lists/*.md` | 清单，每行 `- [x] 文字` 或 `- [ ] 文字` | front matter：`title`（必填） |
| `manifest.yaml`（可选） | 照片补充信息和排序 | 见下 |

`manifest.yaml` 格式：

```yaml
photos:
  IMG_0001.jpg:
    caption: 第一次去海边
    date: 2024-05-20   # 可选，覆盖自动读到的日期
lists:
  order: [bucket-list.md, movies.md]   # 可选；未列出的按文件名排在后面
```

遇到不支持的图片格式、缺少必填 front matter、`manifest.yaml` 里提到不存在的文件时，脚本报出具体文件名并退出，不写任何输出。

## 3. 发布格式 `public/vault/`

- `vault.json`（明文 JSON）：

```json
{
  "version": 1,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<base64, 16 字节>" },
  "wrappedKey": "<base64: IV(12) + AES-GCM(KEK, DEK 原始 32 字节)>",
  "manifest": "<base64: IV(12) + AES-GCM(DEK, 内容清单 JSON)>"
}
```

- `blobs/<32 位随机十六进制>.bin`：`IV(12 字节) + AES-GCM 密文`，每个文件独立随机 IV。照片原图、缩略图、每篇笔记、每个清单各一个文件。

**内容清单（加密）：**

```ts
interface VaultManifest {
  photos: { caption: string; date: string; width: number; height: number; thumb: string; full: string; source: string; hash: string }[]
  notes: { title: string; date: string; blob: string; source: string; hash: string }[]
  lists: { title: string; blob: string; source: string; hash: string }[]
}
```

`source` 是源文件相对路径，`hash` 是源文件内容（笔记和清单含 front matter）的 SHA-256，仅用于判断能否沿用旧密文；照片的说明和日期每次都按当前 `manifest.yaml` 和 EXIF 重新生成，改说明不会触发重新加密照片；两者都在加密的清单里，不对外暴露。笔记的 blob 内容是笔记正文 Markdown；清单的 blob 内容是 `{ items: { text: string; done: boolean }[] }`。

## 4. 加密

- 共用模块 `src/vault/crypto.ts`，只使用 `globalThis.crypto.subtle`，浏览器和 Node 24 共用。
- 口令 →（PBKDF2-SHA256，600,000 次，16 字节随机盐）→ KEK（AES-GCM 256）。
- DEK：随机 256 位 AES-GCM 密钥；用 KEK 以 AES-GCM 加密其原始字节存为 `wrappedKey`。
- 浏览器解包时以**不可导出**方式导入 DEK。
- 口令要求：至少 16 个字符，或至少 4 个以空格分隔的词；否则拒绝。

## 5. 本地脚本

### 5.1 `npm run vault`

1. 在终端隐藏回显地输入口令。`vault.json` 不存在时要求输入两遍并检查强度；存在时输入一遍，用它解开旧 DEK 和旧清单，解不开就报「口令不对」并退出。
2. 扫描 `vault-src/`，为每项计算 `hash`。
3. 对每项：旧清单里有相同 `source` 和 `hash` 时沿用旧的 blob 名；否则重新处理并加密，写入新的随机 blob 名。
4. 照片处理（`sharp`）：按 EXIF 方向转正；最长边缩到 2000 像素（不放大），转 WebP（质量 82）；缩略图为 400×400 居中裁切的 WebP（质量 70）；输出不保留任何元数据。日期用 `exifr` 在处理前读取（支持 HEIC）。
   - HEIC/HEIF：先用 `heic-decode`（libheif 的 WebAssembly 版本，无需系统组件）解码主图为 RGBA 像素（libheif 已按容器里的旋转信息转正），再作为原始像素交给 `sharp`，后续步骤相同。解码较慢（每张约 1–3 秒），处理时逐张打印进度。实况照片只取静态图。
5. 删除 `blobs/` 下不再被清单引用的文件。
6. 写入新的 `vault.json`（沿用原盐和 DEK）。
7. 打印照片、笔记、清单数量，新增和删除的 blob 数，`public/vault/` 总大小；超过 300 MB 时打印警告。

### 5.2 `npm run vault:rekey`

输入旧口令解开 DEK，再输入两遍新口令（检查强度），用新随机盐派生新 KEK 重新包装 DEK，只改写 `vault.json` 的 `kdf` 和 `wrappedKey`。

## 6. 浏览器端

### 6.1 解锁页

- 口令输入框；圆形「一键启动」按钮需按住约 1 秒，外圈香槟金进度环随之转满；在输入框按回车直接提交。
- 「在这台设备上记住」勾选框，默认勾选。
- 派生密钥期间按钮显示「点火中…」。
- 口令错误：面板左右抖动一次，显示「口令不对」。口令正确：香槟金光扫过后进入内容界面。
- 减少动态效果时去掉抖动、扫光和长按（改为点击即提交）。

### 6.2 记住设备

- 勾选时把不可导出的 DEK `CryptoKey` 存进 IndexedDB（库 `midnight-garage`，存储区 `vault`，键 `dek`）。不保存口令。
- 进入 `/vault` 时先尝试用存储的 DEK 解开清单；失败（例如换过口令或重新生成过保险库）则删除存储的 DEK，显示解锁页。
- 「锁上」按钮：删除 IndexedDB 里的 DEK，清空内存中的 DEK 和已解密内容，回到解锁页。

### 6.3 内容界面

- 顶部三个标签「照片 / 笔记 / 清单」，当前标签存在查询参数 `tab`（默认 `photos`）。
- **照片**：三列方形缩略图网格，按日期从新到旧，按月分组（小标题如「2024 年 5 月」）。解锁后一次性下载并解密全部缩略图。点开全屏查看，此时才下载并解密原图；支持左右滑动、方向键和 Esc，下方显示说明和日期。
- **笔记**：按日期从新到旧的卡片，显示日期、标题和正文前两行；点开显示全文，用 `react-markdown` 渲染（不启用原始 HTML）。
- **清单**：每个清单一张卡片，显示「已完成 N / M」；点开显示逐项勾选状态，只读。
- 卸载保险库界面或锁上时，`URL.revokeObjectURL` 释放所有解密出的图片地址。

### 6.4 错误处理

| 情况 | 处理 |
|---|---|
| `vault.json` 返回 404 | 显示「保险库还是空的」占位页 |
| `vault.json` 下载失败（其他错误） | 显示「保险库暂时打不开」和重试按钮 |
| 口令错误 | 抖动并提示「口令不对」 |
| 记住的 DEK 失效 | 自动清除，显示解锁页 |
| 单个 blob 下载或解密失败 | 该项显示灰色占位，其余正常 |
| IndexedDB 不可用 | 「在这台设备上记住」勾选框隐藏，每次都需输入口令 |

## 7. 代码模块

| 文件 | 职责 |
|---|---|
| `src/vault/crypto.ts` | base64、口令强度检查、派生 KEK、生成/包装/解包 DEK、加解密字节和 JSON |
| `src/vault/types.ts` | `VaultFile`、`VaultManifest`、`ListContent` |
| `src/vault/repo.ts` | 下载 `vault.json` 和 blob，解密清单和 blob |
| `src/vault/keyStore.ts` | IndexedDB 存取 DEK |
| `src/vault/VaultScreen.tsx` 及 `components/` | 解锁页、标签页、照片网格和查看器、笔记、清单 |
| `scripts/lib/vaultSource.ts` | 扫描 `vault-src/`、解析 front matter、清单、`manifest.yaml`、计算哈希（纯函数为主） |
| `scripts/lib/photo.ts` | `heic-decode` 解码 HEIC、`sharp` 处理照片、`exifr` 读日期 |
| `scripts/lib/vaultBuild.ts` | 增量构建：给定源、旧清单、DEK，产出新清单、要写和要删的 blob |
| `scripts/lib/prompt.ts` | 隐藏回显的口令输入 |
| `scripts/vault.ts`、`scripts/vault-rekey.ts` | 命令行入口 |

新增依赖：`sharp`、`heic-decode`、`exifr`、`yaml`（解析 `manifest.yaml` 和 front matter）为开发依赖；`react-markdown` 为运行时依赖。

## 8. 测试

- **加密**：往返还原；错误口令必然失败；同一明文两次加密 IV 和密文都不同；`rekey` 后新口令可解、旧口令不可解、清单不变。
- **口令强度**：边界值（15/16 个字符，3/4 个词）。
- **源解析**：front matter、清单勾选、`manifest.yaml` 覆盖、缺字段和引用不存在文件时报错。
- **增量构建**：第二次构建未变项沿用 blob 名；修改项换新 blob；删除项列入待删。
- **照片**：输出长边 ≤ 2000、缩略图 400×400、输出无 EXIF/GPS（测试中用 `sharp` 生成带 GPS 的小图）。HEIC 分支通过注入解码函数测试「原始像素 → WebP」这条路径；`sharp` 无法生成 HEIC，所以真实 HEIC 文件放在手动验收里验证。
- **界面**（jsdom，用 `fake-indexeddb` 和测试内生成的小保险库）：正确口令进入照片栏；错误口令提示；勾选记住后重新挂载直接进入；锁上回到解锁页；单个 blob 损坏只影响该项；`vault.json` 404 显示空占位。
- **手动验收**：用示例内容（含至少一张 iPhone 拍的 HEIC 竖拍照片）跑一遍 `npm run vault`，确认 HEIC 方向正确、日期正确；在手机上解锁、看照片、看笔记、锁上。

## 9. 发布流程（人工）

1. 把内容放进 `vault-src/`。
2. `npm run vault`，输入口令。
3. 提交 `public/vault/` 并推送。
4. 线下告诉她口令。

**风险：** 仓库公开，任何人都能下载 `vault.json` 离线猜口令；安全性取决于口令强度。推荐 4–5 个不相关的词或一句只有你们知道的长句。
