# 暗房壳层一比一复刻（不含私人内容）

**状态：** 实施中  
**日期：** 2026-11-11（Asia/Shanghai）  
**参考源：** `/opt/cursor/artifacts/ref-site/scenes/{opening,rolls,rolls-enter,tray,tray-lt,torch-comic,book-cover,credits}.html`  
**线上参考：** https://roll.giadaserena.top/r/4ccf1ac2/

## 1. 范围

### 做（一比一）

- 片头/启封放映机格子：尺寸感、胶片带齿孔滚动、beam/zap/grain/vignette、字体角色、cream/ink/red
- 桌面 3D：ACES、相机 HOME、木桌、暖灯参数、横躺罐几何与标签版式、负片片基/齿孔/clearcoat/emissive
- 冲印盘：拉丝不锈钢 PBR（ambientCG Metal009 CC0）、液面 IOR≈1.33、木柄镊子
- 壳层 HUD：光圈菜单右上、电台左下、cream 色板；去浅色 Tailwind 残留
- 火把/书封/片尾：结构与色板对齐（文案可用「暗房」占位）

### 不做

- 不拷贝对方 `content.js` 私人照片、书信正文、私人日期/署名、受版权曲目二进制
- 不改 vault 加密 / STS / COS 合约
- 留言、清单、照片仍来自本站 vault；壳层在无内容时用程序化占位

## 2. 参数锚点（摘自参考源）

| 项 | 值 |
|----|----|
| CSS vars | cream `#f3e6d2` · ink `#040302` · red `#ee5546` |
| 场景底 | `#0b0705` |
| ACES exposure | rolls `1.05` · tray `1.1` |
| 相机 | FOV 32 · pos `(0,7,5.4)` · look `(0,0,.15)` |
| 木桌 | wood map × `#6e4a38` · roughness `.85` |
| 环境光 | `#ffcfa0` · `.18` |
| 射灯 | `#ffd2a0` · intensity `140` · shadow radius `6` |
| 负片 emissive | `#5a2008` · intensity `.35` |
| 罐标签 | Fraunces italic 名 + `ROLL nn · ISO · 24 EXP` |

## 3. 验收

1. 未输入口令的首屏观感对齐 opening 放映卡（非浅色表单）。  
2. 解锁后桌面罐/片/盘/镊与参考同类，非灰盒。  
3. HUD 位置与色板正确；无 `text-fg` 浅色残留。  
4. 私人照片/信/清单仍仅 vault 注入。
