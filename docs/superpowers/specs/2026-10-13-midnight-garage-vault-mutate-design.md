# Midnight Garage：网页改保险库与加照片

日期：2026-10-13  
状态：待审阅

上级文档：

- `docs/superpowers/specs/2026-10-09-midnight-garage-vault-design.md`（加密保险库、发布格式）
- `docs/superpowers/specs/2026-10-13-midnight-garage-vault-web-design.md`（网页笔记 / `web.json`；本文在冲突处取代其对「不能改已发布内容」和「只写 web.json」的约定）

两名用户，都在设备上保存 GitHub 令牌。改完后对方刷新或重新解锁即可看到，不必等 GitHub Pages 部署。

## 1. 范围

解锁后的保险库在**已保存令牌**时可：

1. 新建、编辑、删除笔记和清单（含原先由 `vault-src` / `npm run vault` 发布的条目）。
2. 添加照片（含 iPhone 相册里的 HEIC/HEIF），以及删除已有照片。
3. 勾选或取消清单条目（写进清单 blob，不再写 `web.json` 的 `checks`）。

改动写入仓库 `Krazymud/Krazymud.github.io` 的 `master` 分支：`public/vault/vault.json` 与 `public/vault/blobs/*.bin`。不修改 `vault-src/`。

有令牌时，解锁后的**读和写**都走 GitHub API（仓库里的最新树），不依赖 Pages 上的缓存副本。无令牌时仍只读站点上的 `/vault/*`（可能旧），且所有写入停用。

**不做：** 在网页上换口令或轮换 DEK；改 KDF；从网页维护 `vault-src/`；实况照片视频轨；在无令牌时写入。

## 2. 读写路径

### 2.1 读

1. 解锁仍用口令解开 `vault.json` 里的 DEK（文件可先来自站点，以便无令牌只读）。
2. 若有令牌：用 Contents / Git API 再取仓库里最新的 `public/vault/vault.json`，用同一把 DEK 解开清单；之后按需拉取 blob。站点副本只作无令牌回退。
3. 若仓库里仍有可读的 `web.json`，见第 5 节迁移。

### 2.2 写（原子提交）

一次保存可能涉及多个 blob 和新的 `vault.json`。使用 **Git Data API** 一次提交：

1. 读取 `master` 当前 commit SHA 与 base tree。
2. 为每个新或替换的 blob 创建 Git blob；更新 tree（路径在 `public/vault/` 下）。
3. 创建 commit（说明按操作类型固定中文或英文短句，实现时与现有 `content(vault): …` 风格一致即可）。
4. 快进更新 `refs/heads/master`。

若更新引用失败（非快进）：重新拉取最新 `vault.json` 与所需条目，按第 3 节合并后再提交一次。仍失败则保留本机待同步状态，界面显示「还没同步」。

401 / 403 →「令牌不能写这个仓库」。网络或其他错误 →「还没同步」。令牌只发给 `api.github.com`。

大文件（加密后的照片等）走 Git Blob API，不走 Contents API 的 1MB 正文限制。

## 3. 清单与合并

清单形状仍为现有 `VaultManifest`（见上级 vault 设计）。网页新建的笔记 / 清单 / 照片使用稳定 `source`（例如 `web/notes/<uuid>`、`web/lists/<uuid>`、`web/photos/<uuid>`），`hash` 在每次写入时按当前明文内容重算。

每条可编辑记录在内存里带 `updatedAt`（毫秒）；写入 manifest 前用于合并。若不宜改加密清单的对外字段，可将 `updatedAt` 仅存在本机 pending 文档中，提交合并时用「本机 pending vs 远程 manifest」比较；实现计划选定一种并保持测试覆盖。

合并规则（提交冲突重试时，`base` 为仓库最新清单，`incoming` 为本机）：

- **笔记 / 清单：** 同一 `source`：墓碑与正文较新者胜；两边都是正文时较新整份替换（含 blob 字节与元数据）。
- **照片：** 同一 `source` 较新元数据胜；删除用墓碑或从清单移除并记 tombstone 时间；新增只在 incoming 出现则保留。
- **清单勾选：** 改清单 blob 内对应项的 `done`，并更新该清单的合并用时间戳；不再使用 `web.json` 的 `checks`。

不合并同一 blob 的字节级冲突——整条目替换。

本机在提交成功前保留 pending（IndexedDB，可沿用或扩展现有 `vault-web` 存储区）：解开失败的 pending 丢掉且不上传。

## 4. 照片处理（浏览器）

- 输入：`<input type="file" accept="image/*">`，支持 **JPEG、PNG、WebP、HEIC、HEIF**（iPhone 相册）。
- HEIC/HEIF：浏览器内 WASM 解码（与脚本侧 `heic-decode` 同类）；失败提示「这张照片打不开」。
- 处理对齐 `npm run vault`：按方向转正；全图最长边 ≤ 2000（不放大），WebP 质量约 82；缩略图 400×400 居中裁切，WebP 质量约 70；去掉元数据。
- 日期：能读 EXIF 拍摄时间则用，否则本地日历今天；说明默认可空，上传前可改。
- 全图与缩略图各一个随机 32 位十六进制 blob 名，再写入清单。

## 5. `web.json` 迁移

解锁且令牌可用时：若仓库（或本机 pending）仍有可解开的 `web.json`：

1. 将其中的网页笔记 / 清单转为 manifest 条目（赋予稳定 `source`），blob 用 DEK 新加密写入。
2. 将 `checks` 打进对应已发布清单的 blob（按 source + 下标）。
3. 一次 Git 提交写入更新后的 vault，并**删除**仓库中的 `public/vault/web.json`。
4. 之后不再读写 `web.json`。

无令牌时：可继续只读展示站点上的旧 `web.json`（过渡）；有令牌后以 API 上的 vault 为准。

## 6. 界面

- 笔记 / 清单：已发布与新建同一套交互；有令牌且未在同步中时显示「编辑」「删除」。删除两步确认。表单规则与现网一致。
- 照片：网格「加照片」；选图后可确认说明与日期，再同步。删除两步确认。
- **加载锁定：** 新增 / 保存编辑 / 删除（笔记、清单、照片）在 Git 提交结束前，显示「正在同步…」，并禁用新笔记、新清单、加照片、编辑、删除、打勾，防止连点冲突。成功后解除；失败则解除锁定，保留本机改动并显示错误或「还没同步」。
- 令牌 UI 保持：未保存时输入框 +「保存令牌」；已保存时「忘记令牌」。

## 7. 与本地脚本的关系

`npm run vault` / `vault:rekey` 仍只操作 `public/vault/`（及可选的 `vault-src/`）。网页改过仓库里的 `public/vault/` 之后，**以仓库中的加密产物为准**。用过时的 `vault-src` 再跑 `npm run vault` 可能覆盖网页改动；文档与脚本提示中说明这一点。本设计不要求网页回写 `vault-src/`。

## 8. 测试

用假 `fetch`，不接触真实 GitHub。

- 清单合并与墓碑：编辑 / 删除已发布笔记与清单；冲突时重拉再提交一次。
- Git 提交封装：多 blob + `vault.json` 一次 commit；非快进重试；401/403 → 令牌错误。
- 照片管线：JPEG/PNG/WebP 与 mock HEIC 解码 → 尺寸与 WebP 输出；解码失败有提示。
- 界面：有令牌时已发布条目可编辑删除；同步中按钮禁用且出现「正在同步…」；加照片；`web.json` 合并进 vault 后删除远程 `web.json`。
- HEIC 真机作手工抽查，不强制 CI。
