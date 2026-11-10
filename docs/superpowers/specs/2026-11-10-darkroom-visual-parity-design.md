# 暗房视效对齐设计（对照 A Roll For Two）

**状态：** 已确认（含原 §3.4 全做）  
**日期：** 2026-11-10（Asia/Shanghai）  
**参考站：** https://roll.giadaserena.top/r/4ccf1ac2/（抖音「电子底片」同源体验）  
**逆向摘录：** `/opt/cursor/artifacts/ref-site/reverse-brief.md`

## 1. 目标与非目标

### 目标

在**不拷贝对方私有照片、文案与受版权约束的曲目文件**的前提下，把本站暗房体验对齐到参考站的礼物级观感与完整卷轴体验，包括：

1. **桌面 3D**（rolls / tray / lightbox / viewer / letters）材质、灯光、胶卷罐、底片条、冲印盘、字体与后期。  
2. **多幕卷轴：** 片头 →（可选叙事帧）→ 暗房桌面 → 冲印/灯箱 → 火把漫画 → 书封拼贴 → 片尾字幕。  
3. **拍立得带走**（预览 + ZIP 下载 / 打印页）。  
4. **多曲目背景乐电台**（公开领域或自有授权曲目，可开关/切歌/音量）。

内容数据仍来自本站 **vault**；卷名/帧/笔记映射现有 `rolls` / notes / lists。

### 非目标

- 不原样复制对方 `content.js` 照片、私人书信、曲目音频文件二进制。  
- 不改 vault 加密 / STS / COS 合约。  
- 不引入对方 iframe 壳源码 verbatim；在本站 React SPA 内用等效「幕」状态机实现。  
- 不降级为 2.5D；iPhone 保持全 3D。

## 2. 参考站逆向结论（可验证）

| 层 | 做法 |
|----|------|
| 壳 | 多 iframe 叠幕 + veil 转场；本站改为 React `ReelStage` 状态机 |
| 引擎 | Three.js；程序化几何 + Canvas 贴图；书封另有 glTF 道具（本站优先程序化替代） |
| 调色 | ACES Filmic；暖琥珀安全光；木桌 `#6e4a38` × wood 纹理 |
| 色板 | cream `#f3e6d2` · ink `#040302` · accent `#ee5546` |
| 字体 | Fraunces · Reenie Beanie · JB Mono · Courier |
| 胶卷罐 | 横躺；金属盖/环；绒布出片口；Canvas 卷标 |
| 底片 | 长条负片 Plane + clearcoat + 暖 emissive |
| 冲印盘 | 钢 PBR + 液面 IOR + 镊子 |
| 片头/片尾 | 2D 电影感标题卡 + 竖底片带 + 噪点/bokeh；片尾 rollup 字幕 |
| 火把漫画 | SVG 木桌静物 + 手电筒遮罩扫过显影 |
| 书封 | 3D 皮面书 + 拼贴/票根/羽毛等桌面道具 |
| 拍立得 | 墙选 8 张；正反 JPG；ZIP + 打印页 |
| 电台 | 多曲循环；设置光圈菜单；左下 now-playing |

## 3. 对齐方案

### 3.1 渲染与氛围

- ACES Filmic，exposure ≈ 1.05；背景 `#0b0705`。  
- 暖 Spotlight + 低环境光 + rim；soft shadows。  
- 自备 `public/darkroom/wood.jpg`（及可选 steel/leather 替代纹理）；**禁止**直接提交参考站资源除非确认许可。  
- CSS grain + vignette；`prefers-reduced-motion` 停动画噪点。

### 3.2 道具（程序化）

- 横躺标签胶卷罐（每 vault 卷一个）+ 选卷拉出 3D 负片条 → 现有 FilmStrip/FrameView。  
- 灯箱、钢冲印盘 + 液面 + 镊子、观片器、信封信笺（cream + Courier + 手写红提示）。

### 3.3 字体与 UI 语气

- 自托管 Fraunces / Reenie / mono；暗房中文文案；技数行可用等宽英文 meta。  
- 设置入口：右上「光圈」菜单（音乐 / 音量 / 清晰度 / 灯光 full·simple / 语言可选后置）。

### 3.4 完整卷轴与周边（本期全做）

| 能力 | 本站实现要点 |
|------|----------------|
| 片头 | `OpeningScene`：标题「暗房」、竖底片带用 vault 缩略、手写 CTA 进入下一幕 |
| 叙事帧（可选轻量） | 1–2 幕信笺/日期卡，内容来自 notes 首条或固定文案模板 |
| 暗房桌面 | 现有 R3F 桌面（按 3.1–3.2 抛光） |
| 冲印/灯箱 | tray focus；显影后可进「照片墙」选帧 |
| 火把漫画 | `TorchComicScene`：2D/SVG 桌面静物 + 手电筒遮罩；文案/日期来自 vault note 或配置 |
| 书封拼贴 | `BookCoverScene`：程序化皮书 + 桌面小道具；封面图取 vault 精选帧 |
| 片尾 | `CreditsScene`：rollup；署名可配置，默认「暗房」 |
| 拍立得 | `PolaroidTakeHome`：从墙选 ≤8 帧；正反画布；ZIP + 打印 |
| 电台 | `ReelRadio`：`public/darkroom/music/*` 公开领域曲目 + LICENSE；循环/静音/音量 |

**幕序（默认）：**  
`opening → letters(可选) → desk → trayWall → torch → book → credits`  
幕间黑/白 veil；重幕（desk/tray/book）懒挂载。

## 4. 验收

1. 解锁后先见片头，再进暖光木桌 + 横躺标签罐；观感与参考 `rolls` 同类。  
2. 点卷拉片；帧为本站 vault。  
3. 冲印盘钢+液面；可加图；可从墙进入拍立得带走。  
4. 火把漫画、书封、片尾可完整走通。  
5. 电台可开关、切歌、调音量；曲目有 LICENSE。  
6. iPhone Safari 全 3D 桌面不降级。  
7. Pages 与 `erinamae.site` 同源新构建。

## 5. 风险

| 风险 | 缓解 |
|------|------|
| 版权（纹理/字体/音频/模型） | 只移植算法与参数；资源自备或开源/公有领域 |
| 工期与包体 | 分幕懒加载；Canvas 分辨率封顶；阴影 1024；dpr≤2 |
| 书封 glTF 依赖 | 程序化书+简单道具优先，不强制对方模型 |
| 与编辑 overlay 焦点 | 3D 拉片后仍用现有 HTML overlay 完成读写 |

## 6. 实现顺序

1. 色板/字体/grain + 渲染器灯光木桌。  
2. 横躺罐 + 拉片 + 灯箱/冲印盘抛光。  
3. `ReelStage` 壳 + 片头/片尾。  
4. 火把漫画 + 书封。  
5. 拍立得 + 电台 + 光圈设置。  
6. 对照参考截图视觉验收 + COS/Pages。
