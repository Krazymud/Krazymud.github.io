# 青庐基建：腾讯云 COS + CDN（W2）

日期：2026-10-15  
状态：待审阅  
基线：master（纸墨抛光 #60 已合入）；锦匣仍以 GitHub Pages + `gitVault` 为权威读写  
选型：方案 2（国内加速）+ **W2（COS 为 vault 权威源，GitHub 备份）**

## 1. 目标与非目标

### 目标

1. **A · 国内访问**：静态站（含 lean drive loop 等媒体）经腾讯云 CDN 分发，国内无代理首屏与视频明显快于当前 GitHub Pages / Fastly。
2. **D · 锦匣可写可同步**：多端解锁后可读写笔记 / 清单 / 照片 blob；冲突可感知；不再依赖 GitHub Contents / Git Data API 作为权威写路径。
3. **成本可控**：个人站体量下月费通常可忽略；用流量告警与年包封顶习惯兜底。
4. **可回滚**：主域可在短时间内切回 GitHub Pages；COS 上保留有限版本。

### 非目标

- 不做多云双活、不做海外独立加速栈（境外可继续打到 CDN 境外节点或回源，不单独优化）。
- 不改锦匣客户端加密协议（口令 → DEK、`encryptJson` / blob 密封格式保持）。
- 不把长期密钥或 GitHub PAT 写进前端仓库；不把 vault 明文挂到公共 CDN。
- 本波不重做日课 / SRS / 视觉；不回补与本波无关的锦匣冷开历史 issue（除非迁读写时顺带碰到）。
- 不在未备案时强行把自定义主域切到国内 CDN。

### 成功标准

- 国内无代理打开首页与 drive loop，体感优于当前 Pages。
- 笔记增删改在两台设备间分钟级可见，刷新不丢；冲突时提示重载而非静默覆盖。
- 断网可读已缓存内容；恢复后能再同步。
- 发版后 HTML/带 hash 资产行为正确（无长时间旧壳）。
- 月费用在预设告警内（见 §3.5）；主域 10 分钟内可切回 Pages。

### 已否决路径（摘要）

| 选项 | 否决原因 |
|------|----------|
| 仅压媒体、继续纯 Pages | 不解决国内节点与 vault 写延迟 |
| W1：GitHub 仍为 vault 权威 + CDN 只加速静态 | vault 写仍受 GitHub API / 部署滞后约束 |
| 对象存储直出、不配 CDN | 外网下行更贵且无边缘节点 |

---

## 2. 存储与同步模型

### 2.1 权威边界

| 数据 | 权威源 | 备份 / 镜像 |
|------|--------|-------------|
| 站点静态产物（`dist/`） | COS 公共前缀（经 CDN 读） | Git 仓库源码；过渡期双部署 Pages，稳定后 Pages 仅作回滚备用 |
| 锦匣 `vault.json` + `blobs/*.bin` | **COS 私有前缀** | 异步备份到 GitHub `public/vault/`（非权威） |
| 客户端 DEK / 口令 | 仅浏览器（IndexedDB / 内存），不上云明文 | 无 |

GitHub 上的 `public/vault/` 在切换完成后降级为**备份与灾难恢复**，前端读写不再以 `api.github.com` 为权威。

### 2.2 COS 布局（建议单桶分区）

桶：标准存储，地域优先广州（或已有备案域名就近地域）。

```
cos://<bucket>/
  site/                 # CDN 回源；对外经 CDN，不鼓励 COS 外网直出
    index.html
    assets/...
  vault/                # 私有；仅 STS / 备份角色可读写
    vault.json
    blobs/<hash>.bin
```

单桶 + 前缀策略（本设计默认）。冲突检测用 **`vault.json` 的 ETag / 条件 put**，不另建 revision 文件。桶开启版本控制（保留 7–30 天）。

### 2.3 锦匣读

1. 解锁后用 STS 临时密钥（只读或读写视登录态）从 COS 拉 `vault/vault.json` 与所需 blob。
2. 对象不存在 → 空库（与现「缺 vault.json」语义一致）。
3. 解密失败 / 版本不识别 → 明确错误，**禁止**用空库覆盖远端。
4. 浏览器可对已拉 blob 做本地缓存；写冲突以远端 `vault.json` ETag 为准。

### 2.4 锦匣写（条件写）

1. 本地改完后加密，对 `vault.json` 做 **If-Match 条件 put**（ETag）；新建对象用 If-None-Match 防抢建。
2. 冲突（预条件失败）→ 拉最新、按现有 `merge` 语义合并、再写一次；仍失败则保留本地 pending 并显示「还没同步」。
3. 写成功后：更新本地 tip；**不阻断 UI**。GitHub 备份以**定时 Job 为主**（例如每小时），必要时加写成功后的轻量触发；失败重试 + 告警。
4. 照片等大 blob：先 put blob，再更新 `vault.json` 引用；失败时允许孤儿 blob。本波不做 GC。

### 2.5 与现客户端的关系

- 保留 `encryptJson`、blob 密封、IndexedDB pending、合并与墓碑规则。
- 替换运输层：`gitVault`（GitHub Git Data API）→ `cosVault`（COS SDK / 预签名或临时密钥）。
- 去掉前端长期持有 GitHub PAT 写仓库的硬依赖；备份可用仓库 secret + Actions / 云函数，不经浏览器。

---

## 3. CDN、部署与写路径

### 3.1 读路径（站点）

```
用户 → CDN（自定义域名）→ COS site/ 回源
```

缓存策略：

| 路径 | Cache-Control | 说明 |
|------|---------------|------|
| `index.html`（及无 hash 入口） | `no-cache` | 发版立刻可感知；配合 CDN 刷新 |
| `/assets/*`（带 content hash） | 长缓存（如 1y + immutable） | 文件名变即新对象 |
| 媒体（drive loop 等） | 长缓存；发版改文件名或路径 | 与现 build 产物一致 |

发版后对 HTML / 变更目录做 CDN 刷新（目录刷新或 URL 刷新）。

### 3.2 部署（CI）

现有 `.github/workflows/deploy.yml`：`build` → GitHub Pages。

本波目标形态：

1. `npm ci` → `test` → `build`（不变）。
2. **同步 `dist/` → COS `site/`**（腾讯云密钥仅存 Actions secrets）。
3. 触发 CDN 刷新入口 HTML。
4. **过渡期**仍 deploy Pages，作对照与回滚；稳定后可停 Pages 或留作备用。

### 3.3 写路径（STS）

```
浏览器（已解锁）
  → HTTPS 请求 SCF 签发接口（短时、鉴权）
  → 返回 COS 临时密钥（限 vault/ 前缀、限 TTL、限动作）
  → 浏览器直传 COS（条件写）
  → 定时（为主）GitHub 备份 Job 同步 public/vault/
```

签发接口约束：

- 实现载体固定为 **腾讯云 SCF**（HTTP 访问）；不另引入长驻服务器。
- 不返回永久 SecretId/Key；TTL ≤ 30 分钟。
- CAM 策略仅 `vault/*`；禁止 `site/*` 写。
- 鉴权默认 **方案 A**：与解锁态绑定的短时证明（不落长期服务端用户库）。若实现成本过高，plan 阶段显式降级为方案 B（持有者共享的签发口令 / 邀请码）。
- 速率限制 + 失败审计，防刷 STS。

### 3.4 域名与备案

- 自定义域名走**中国大陆 CDN** 需 ICP 备案。
- 备案完成前：可用腾讯云测试域名做速度验证；主域继续 Pages。
- 备案完成后：主域 CNAME → CDN；HTTPS 证书用腾讯云托管或上传。

### 3.5 费用锚点（决策用，非合同价）

| 项 | 量级 |
|----|------|
| COS 标准存储 | ≈ ¥0.118/GB/月 → 50MB 站点可忽略 |
| CDN 大陆下行（0–2TB） | ¥0.21/GB 刊例 |
| CDN 境内 100GB / 12 月包 | ¥19 刊例；活动常见更低 |
| COS→CDN 回源 | ≈ ¥0.15/GB（命中高则很少） |
| STS / SCF | 个人写入量通常落在免费额度 |

个人站预期：多数月份 CDN ≪ ¥1；买 100GB 年包即可封顶习惯。费用不是本架构否决项。告警建议：CDN 月 5GB、COS 存 1GB。

---

## 4. 迁移与风险

### 4.1 阶段

1. **开户与备案并行**  
   COS 桶、CDN、CAM、SCF 签发；自定义域备案。
2. **旁路验证**  
   CI 双写：Pages + COS；CDN 用测试域验证国内速度与缓存头。
3. **读切主域**  
   主域 CNAME → CDN；保留 Pages 回滚。
4. **Vault 切 W2**  
   前端改 COS 读写；GitHub vault 改为备份；首次迁移：把当前 `public/vault/` 上传 COS 并校验解密。
5. **冻结旧写**  
   确认多端同步后，移除客户端 GitHub 写权威；备份任务保留。

### 4.2 风险

| 风险 | 缓解 |
|------|------|
| 备案未完成 | 过渡期 Pages；测试域验 CDN |
| CDN 缓存旧壳 | HTML no-cache；hash 资产长缓存；发版刷新 |
| STS 权限过大 / 泄露 | 最小前缀、短 TTL、拒匿名写、用量告警 |
| 多端同时写 | 条件写 + 合并重试；失败保留 pending |
| 备份滞后 | 异步重试 + 失败告警；COS 版本控制 7–30 天 |
| 流量盗刷 | 私有 vault 前缀；CDN/COS 告警；流量包习惯 |
| 回滚 | DNS 切回 Pages；COS 版本恢复 |

### 4.3 验收清单

- [ ] 国内无代理：首页 + drive loop 优于 Pages 基线  
- [ ] 两台设备 vault 互相同步；冲突可提示  
- [ ] 断网本地可读缓存；恢复后续传  
- [ ] 发版后入口非长期旧壳  
- [ ] 告警已配；主域可切回 Pages  

---

## 5. 实现边界（供后续 plan 拆任务）

实现计划应覆盖但不在本 spec 展开代码级细节：

1. 腾讯云资源与 secrets 清单（桶、CDN、CAM、SCF、域名）。
2. CI：`dist` → COS + 刷新；过渡双部署。
3. `cosVault` 读写与条件写；`useVaultMutate` 运输层替换；测试从 `gitVault` mock 迁到 COS mock。
4. STS 签发服务与前端换票流程。
5. 一次性迁移脚本：GitHub vault → COS，校验条数与抽样解密。
6. GitHub 备份 Job。
7. 运行手册：发版、回滚、告警、备案状态。

---

## 6. 开放决定（实现计划前锁定）

以下已在设计对话中倾向明确，写入 plan 时不再骑墙：

1. **Vault 权威 = COS（W2）**，GitHub = 备份。  
2. **站点读 = CDN → COS**，不直出 COS 外网下行。  
3. **STS 鉴权默认方案 A**（与解锁态绑定的短时票）；若实现成本过高再降级 B。  
4. **过渡期双部署 Pages + COS**；稳定后停止把 Pages 当主读，可保留作回滚。  
5. **冲突检测 = vault.json ETag 条件写**；备份 = 定时 Job 为主。  
6. **STS 签发 = SCF**。
