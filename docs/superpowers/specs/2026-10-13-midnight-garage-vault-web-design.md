# Midnight Garage：网页上的保险库笔记和清单

日期：2026-10-13
状态：待审阅

上级文档：`docs/superpowers/specs/2026-10-09-midnight-garage-vault-design.md`。该文档把保险库定为只读；本文只增加网页上的笔记、清单和勾选，并让这些改动加密后提交回仓库。照片、口令、已发布正文的来源都不改。

## 1. 范围

解锁后的保险库里可以：

1. 新建笔记（标题、日期、正文）和清单（标题、若干条目）。
2. 修改或删除网页上新建的笔记和清单；给新建的清单改标题、改条目文字、加条目、删条目。
3. 给已发布的清单和网页新建的清单打勾或取消。
4. 这些改动加密后提交到 `Krazymud/Krazymud.github.io` 的 `master` 分支，路径 `public/vault/web.json`。别的设备在 GitHub Pages 重新部署之后看到。

已发布笔记的正文，以及已发布清单的标题和条目文字，不能在网页上修改或删除。已发布内容仍来自 `vault-src/` 和 `npm run vault`。

**不做：** 同步照片；把网页笔记放进「今日回忆」；把令牌写进仓库或提交说明；在网页上改已发布正文。

## 2. 文件

`public/vault/web.json` 的外壳是明文：

```json
{ "version": 1, "sealed": "<base64>" }
```

`sealed` 用当前保险库数据密钥加密，算法与现有 `encryptJson` 相同。解开后的文档是：

```ts
{
  notes: { id: string; title: string; date: string; body: string; updatedAt: number }[]
  lists: { id: string; title: string; items: { id: string; text: string; done: boolean }[]; updatedAt: number }[]
  checks: { [source: string]: { [index: string]: { done: boolean; updatedAt: number } } }
  tombstones: { notes: { id: string; updatedAt: number }[]; lists: { id: string; updatedAt: number }[] }
}
```

`id` 用 `crypto.randomUUID()`。`updatedAt` 是 `Date.now()` 的毫秒数。`date` 是 `YYYY-MM-DD`。`checks` 的第二层键是条目下标的十进制字符串，例如 `"0"`。`source` 是已发布清单的 `source`，例如 `lists/a.md`。

空文档是四个字段皆空：`notes`、`lists`、`checks` 为空，`tombstones` 的两个数组为空。

## 3. 合并

保存、删除和打勾都把被改记录的 `updatedAt` 设为现在。`merge(base, incoming)` 按 `updatedAt` 合并，不看哪一份来自本机。相等时保留 `base`。提交时 `base` 是仓库里的文档，`incoming` 是本机文档：

- 同一笔记 `id`：墓碑和笔记里较新的那个赢。墓碑较新则笔记不出现；笔记较新则墓碑去掉。两边都是笔记时，较新的 `updatedAt` 整份替换。
- 清单同样整份替换，条目不逐条合并。
- 已发布清单的勾选按 `source` 加下标比较 `updatedAt`，较新的 `done` 赢。
- 只在一边出现的条目保留。

显示时，已发布清单的某一项若在 `checks` 里有未过期的下标，用覆盖的 `done`；否则用源文件里的 `done`。下标大于或等于当前条目数的勾选忽略，不报错。在本地重排已发布清单的条目后，下标会变，勾选可能对到另一行。

网页清单的勾选写在条目的 `done` 上，并更新这份清单的 `updatedAt`。已发布清单的打勾只写 `checks`。

## 4. 同步

解锁后用网站上的 `/vault/web.json` 做显示。文件不存在（404）就从空文档开始。读网站失败时，若本机有尚未推送的文档，仍显示那一份，并标出「还没同步」。

`version` 不是 `1`，或 `sealed` 用当前数据密钥解不开时，界面显示「网页上的笔记打不开」，并且不提交。这样一份文件不会被空文档盖掉。

提交走 GitHub Contents 接口，不用网站上的缓存副本：

1. 读取仓库里的 `public/vault/web.json` 及其 `sha`。仓库里还没有这个文件时，基线是空文档，`sha` 为空。
2. 解开仓库里的文档，与本机当前文档按第 3 节合并。
3. 加密后，以 Contents 接口要求的 base64 提交。提交说明固定为 `content(vault): update web notes`。
4. 返回 409 时，重新读取、再合并、再提交一次。仍失败则留下本机副本，并显示「还没同步」。

令牌无效（401 或 403）时显示「令牌不能写这个仓库」，本机修改仍留着。网络失败同样留下本机副本，下次解锁后再试。

本机副本存在 IndexedDB，数据库 `midnight-garage` 升到版本 2。升级时保留已有的 `vault` 存储区及其 `dek`；新建存储区 `vault-web`，键 `token`（字符串）和 `pending`（整份 `web.json` 文本，其中 `sealed` 已经加密，不再包一层）。锁上保险库只清 `dek`，不清 `vault-web`。下次解锁后，若 `pending` 里的 `sealed` 解不开，就丢掉 `pending`，并且不上传。

没有令牌时，笔记和清单仍可阅读。新建、编辑、删除和打勾停用。`VaultContent` 在标签上方显示令牌输入框和「保存令牌」。已保存时改为「忘记令牌」，点了就删掉 `token`。令牌只发给 `api.github.com`。

写仓库的地址固定为上面的所有者和仓库、`master` 分支、路径 `public/vault/web.json`。

## 5. 界面

笔记标签顶部是「新笔记」，清单标签顶部是「新清单」。一次只打开一个表单；表单开着时，这两个按钮和「编辑」停用。表单有「保存」和「取消」。取消关闭表单，不写文档。

笔记表单：标题、日期、正文。日期默认是浏览器本地时区的今天，不是凌晨 4 点换日的学习日，可以改。标题去掉首尾空白后不能为空。日期必须是真实的 `YYYY-MM-DD`。正文可以为空。保存后的正文用现有的 Markdown 渲染，不启用原始 HTML。

网页新建的笔记卡片上有「编辑」和「删除」。编辑把卡片换成笔记表单，并填入当前内容。删除先变成「确认删除」，旁边有「取消」；再点「确认删除」才删除。收起卡片时，「确认删除」回到「删除」。已发布的笔记没有这两项。

清单表单：标题，以及可以增删的条目。标题规则与笔记相同。只含空白的条目不保存。条目可以一条都没有。每一行的「删除」只从表单里去掉该行，不需要再确认。网页新建的清单可以这样改标题、改条目文字、加条目、删条目，也可以删除整份清单；整份删除用和笔记一样的两步确认。

已发布的清单和新建的清单，展开后每一行都能打勾或取消。已发布清单的文字不能改，也没有删除。打勾后先更新画面，再按第 4 节提交。没提交成功时勾选保持，当前标签内容顶部显示「还没同步」。

没有笔记时仍显示「还没有笔记」，没有清单时仍显示「还没有清单」。新建按钮留在上面。

## 6. 发布脚本

`npm run vault` 不读取、不修改、不删除 `web.json` 和 `web.json.bak`。发布前后这两个文件的字节不变。体积统计仍只算 `vault.json` 和 `blobs/`。

`npm run vault:rekey`：

- 没有 `web.json`，也没有 `web.json.bak` 时，换口令跟现在一样。
- 开始时，若 `web.json` 能用打开 `vault.json` 的那把数据密钥解开，就删掉残留的 `web.json.bak`。若 `web.json` 缺失或解不开，但 `bak` 能解开，先把 `bak` 移回 `web.json`。
- `version` 不是 `1`，或旧密钥解不开，就停止，不写任何文件，并提示「web.json 已损坏，无法更换口令」。
- 先把旧文件改名为 `web.json.bak`，写入用新密钥加密的 `web.json`，再写 `vault.json`。`vault.json` 写好之前失败，就把 `bak` 移回去，并删掉这次写出的新密文。
- `vault.json` 写好之后再删掉 `bak`。

## 7. 测试

`src/vault/web.ts`：空文档、合并、新建、修改、删除、打勾。删除留下墓碑；同一 `id` 较新的整份替换；墓碑比后来的编辑旧时，编辑赢；勾选按条目取较新的；过期下标忽略。

`src/vault/github.ts`：仓库里没有文件时创建；提交用到返回的 `sha`；409 时重新读取并再交一次；401 和 403 变成「令牌不能写这个仓库」。用假的 `fetch`，不接触网络。

`src/vault/webStore.ts`：令牌和 `pending` 与 `dek` 分开存放；清掉 `dek` 后令牌还在；解不开的 `pending` 被丢掉且不上传。

`scripts/lib/vaultCommand.test.ts`：`npm run vault` 不改 `web.json` 和 `web.json.bak` 的字节。换口令覆盖没有 `web.json`、正常重加密、文件损坏时不写任何文件、写入 `vault.json` 之前失败时恢复 `bak`。

界面：新建笔记和清单会进入待提交文档；编辑和确认删除只出现在网页新建的条目上；已发布清单只能打勾；没有令牌时这些操作停用；解不开的 `web.json` 显示「网页上的笔记打不开」，并且不产生提交。
