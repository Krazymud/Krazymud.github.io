# 青庐疾驰环：竖版专用成片设计

日期：2026-10-14  
状态：设计已确认（对话稿 B）  
基线：master 已合并横版 Kling 环 + iPhone contain 全貌（PR #42–#44）

## 1. 问题

窄屏用横版 + `object-contain` 可看全车，但上下静态留白使画面像「嵌套视频」，难与页面融合。

## 2. 目标

1. 新增 **9:16 竖版** 疾驰循环（约 8–12s），构图保证整车入画。  
2. 窄屏播竖版并以 `object-cover` 铺满视口；桌面仍用横版 cover。  
3. 画风 / 车灯 / 路径语义与横版一致；路由淡化与 reduced-motion 契约不变。

## 3. 资产

| 文件 | 用途 |
|------|------|
| `public/sketch/fc-drive-loop-portrait.mp4`（+ webm 可选） | 窄屏循环 |
| `public/sketch/fc-drive-still-portrait.webp` | 窄屏静帧 / reduced-motion |
| 现有 `fc-drive-loop.*` / `fc-drive-still.webp` | 桌面（`sm+`） |

生成：Replicate `kwaivgi/kling-v3-omni-video`，`aspect_ratio: 9:16`，首/尾参考由 K1/K5 竖裁得到。

## 4. 运行时

- 默认 / `<sm`：portrait loop + cover；失败回退 portrait still（或横版 still）。  
- `sm+`：landscape loop + cover。  
- `ROUTE_FADE_MS=300`、home loop / inner still、reduced-motion 仅静帧 — 不变。

## 5. 成功标准

- iPhone：满屏融合 + 整车可读。  
- 桌面：横版行为无回归。  
- 自动化：scene 测试覆盖 portrait / landscape 源选择。
