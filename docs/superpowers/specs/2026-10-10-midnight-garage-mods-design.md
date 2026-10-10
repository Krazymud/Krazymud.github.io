# Midnight Garage 1.3：车辆改装（车漆、轮毂、卡钳）

日期：2026-10-10
状态：已确认

## 1. 范围

在车库页给 3D 车换颜色：车漆、轮毂、刹车卡钳三项，各用一组预设色。不设解锁条件，全部直接可选；选择保存在本机。

不在本版：车牌文字、尾灯颜色、自由取色、解锁机制、静态图（`Still`）跟随换色、赛道与保险库场景里的换色入口（这两处车的颜色跟随同一份偏好，但不提供面板）、镜头构图变化。

## 2. 色板

`src/garage/mods.ts`，纯数据，不引入 three。每项 `{ id, name, hex }`，`hex` 为 sRGB。第一项是原厂色。

| 部位 | id / 名称 / 色值 |
|---|---|
| 车漆 `PAINTS` | `midnight` 午夜黑 `#090909`、`red` 赛道红 `#8e1018`、`blue` 宝石蓝 `#0e2a6b`、`green` 墨绿 `#0f3326`、`champagne` 香槟金 `#8a7448`、`pearl` 珍珠白 `#cfcfca`、`titanium` 钛银 `#6b6e73`、`sunset` 落日橙 `#b4410f` |
| 轮毂 `RIMS` | `gunmetal` 枪灰 `#b3b3b8`、`silver` 亮银 `#ffffff`、`black` 哑黑 `#2a2a2e`、`bronze` 古铜 `#b07a48`、`gold` 香槟金 `#d8b878`、`blue` 电光蓝 `#6f8fd8` |
| 卡钳 `CALIPERS` | `red` 赛道红 `#9e1c22`、`yellow` 黄 `#d8a400`、`blue` 蓝 `#1b4fa8`、`black` 黑 `#16161a`、`orange` 橙 `#d2560f`、`gold` 金 `#b08a3e` |

原厂色与现有模型一致：车漆基色是构建脚本的 `PAINT_BASE`（9/255 = `#090909`）；卡钳是 `#9E1C22`；轮毂的颜色是乘在贴图上的系数，原厂系数为线性 `[0.45, 0.45, 0.48]`，即 sRGB `#b3b3b8`，所以轮毂各色都按「系数」理解（`#ffffff` 即贴图原色）。除原厂项外的色值为初版，浏览器检查时可按观感微调（只改 `mods.ts`）。

轮毂色值是系数，直接当色块显示会失真，所以色板条目可带可选的显示色 `chip`（面板色块用 `chip ?? hex`）。轮毂的 `chip`：枪灰 `#5a5a60`、亮银 `#c4c6ca`、哑黑 `#1d1d20`、古铜 `#7a5530`、香槟金 `#a88a52`、电光蓝 `#34508c`。

`modsFor(prefs)` 把偏好里的 id 解析成三项色板条目；未知 id 回落到原厂项。

## 3. 偏好

`src/prefs/prefs.ts` 的 `Prefs` 新增 `paint: string`、`rim: string`、`caliper: string`，默认分别为 `midnight`、`gunmetal`、`red`。读取时值不是字符串或不在对应色板里就用默认值；写入沿用现有 `setPrefs`。设置页不加入口。

## 4. 车漆遮罩（构建脚本）

车身贴图 `body_base` 由 RGB 改为 RGBA：alpha = 255 表示车漆像素，0 表示其他（含车牌区域）。判定沿用 `isPaint` 与车牌矩形优先的规则，和现在把车漆像素压成 `PAINT_BASE` 的条件完全一致。车牌合成后再接上 alpha 通道，缩放与 WebP 编码时保留 alpha。`body` 材质仍是不透明（`OPAQUE`），所以 alpha 不影响现有渲染；`wheel` 材质也引用这张贴图，同样不受影响。

改完后用本地 `assets-src` 重跑 `npm run car`，提交新的 `public/models/car.glb`（不得超过配置里的 `maxBytes` 3 MB）。不改车型几何、其他材质、尺寸与对齐。

## 5. 运行时换色（`src/scene/three/`）

- 车身：`body` 材质加 `onBeforeCompile`，在 `map_fragment` 之后执行 `diffuseColor.rgb = mix(diffuseColor.rgb, uPaint, sampledDiffuseColor.a)`；`uPaint` 是线性颜色 uniform，换色只改 uniform，不重新编译。设置 `customProgramCacheKey` 以免与其他材质共用程序。
- 轮毂：`wheel` 材质 `color` 设为所选色（线性）。
- 卡钳：`caliper` 材质 `color` 设为所选色。
- `Car.tsx` 通过 `usePrefs()` 读取偏好、`modsFor` 解析，偏好变化时立即应用。材质按名称（`body`、`wheel`、`caliper`）查找。
- 原厂选择下渲染结果与现在一致（车漆 `#090909` 与 `PAINT_BASE` 相同）。

## 6. 改装面板（车库页）

- 车库页（`HomePage`）在 3D 场景就绪时（`useLoading()` 为 `{ kind: '3d', fraction: 1 }`）显示「改装」按钮；静态图模式或加载中不显示。
- 点击后从底部弹出面板 `ModsPanel`（`src/garage/ModsPanel.tsx`）：标题「改装」、关闭按钮；三行「车漆」「轮毂」「卡钳」，每行一组圆形色块按钮，`aria-label` 为色名，`aria-pressed` 标出当前选择，下方显示当前色名；底部「恢复原厂」把三项设回默认。
- 点色块调用 `setPrefs`，车立即变色；面板不遮挡车身主体（面板高度不超过视口下方约 40%），不改镜头。
- Esc 或点关闭收起面板；面板为 `role="dialog"`、`aria-label="改装"`，打开时焦点移到面板，收起后回到「改装」按钮。
- 手机竖屏下色块一行放得下（约 36 px，间距 8 px），放不下时换行。

## 7. 测试

- 构建脚本：`convertAtlas` 输出的 alpha 只在车漆像素为 255，车牌区域和非车漆像素为 0；`buildBodyTextures` 产出的 `baseColor` 解码后有 4 个通道。
- `mods.ts`：三组 id 不重复、原厂项在首位、`modsFor` 对未知 id 回落。
- 偏好：默认值、合法 id 读回、非法值回落、旧数据（没有这三个键）读成默认。
- `ModsPanel`：显示三行与当前选择、点击色块写入偏好、「恢复原厂」、Esc 关闭。
- `HomePage`：3D 就绪时有「改装」按钮，静态图模式没有。
- 浏览器检查：逐色查看车漆、轮毂、卡钳效果；原厂选择与改动前一致；手机 390×844 下面板与车的位置。

## 8. 风险

- WebP 有损压缩会让车漆边缘的 alpha 略有过渡：边缘处颜色自然混合，可接受。
- 重建 `car.glb` 依赖本地 `assets-src`（不入库）：只能在本机执行，已确认存在。
- 浅色车漆（珍珠白）在暗场景下可能偏灰：浏览器检查时调整色值。
