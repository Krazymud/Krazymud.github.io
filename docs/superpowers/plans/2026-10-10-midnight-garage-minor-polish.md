# Midnight Garage：小问题清理计划

> 执行方式：superpowers:subagent-driven-development，分支 `feature/minor-polish`。

**目标：** 清掉 Plan 3A / 3B 各任务审查记下的 Minor 问题（来源：`.superpowers/sdd/minor-findings.md`），不改变任何既定的视觉和交互设计。

**通用规则（每个任务都适用）：**

- 每一条先核实是否仍然存在（代码可能已经改过）。已不存在的，在报告里写「已修复于 <commit/文件:行>」。
- 行为修复走 TDD：先写能失败的测试，看它因预期原因失败，再修。纯测试补充的条目，写完测试确认它能抓到问题（临时改坏实现看它失败，再还原）。
- 某条如果修起来会改变已确认的设计、需要大改结构、或理由不成立，不要修，在报告「未修」一节写明原因。
- 不改镜头构图、灯光数值、配色、音频剪辑点。
- 每个任务一个提交，提交信息用任务标题给的那句。
- 全部检查：`npx vitest run`、`npx tsc -b`、`npx tsc -p tsconfig.node.json --noEmit`；碰到 `scripts/` 或构建的任务再跑 `npm run build`。

**明确不做：** 拖动首帧含滑动阈值（计划要求）、spec-gloss 用原始值（用户决定保留）、`useGLTF` 卸载不清缓存（有意为之）、各取景偏差（用户决定不调构图）、历史提交信息、画质档 2 无抗锯齿、氮气与圈尾的 rev 互相打断（设计如此）、drei `useProgress` 是全局进度（可接受）、用户本机 npm `devdir` 警告（环境问题，非仓库）。

---

### Task 1: 偏好、事件与场景工具函数的健壮性

提交信息：`fix: harden prefs, scene events and scene math helpers`

1. `src/prefs/prefs.ts`：`setPrefs` 传入 `undefined` 值时不要写进存储；值没变化时不通知订阅者。测试补：非对象 JSON（如 `"5"`、`null`、`[]`）走默认值；「与进度分开保存」的用例断言进度键未被改动。
2. `src/scene/events.ts`：`emitNitro` 对监听者快照迭代，单个监听者抛错不影响其他监听者（开发环境 `console.warn`，测试里 spy 并断言）。`emitIgnition` 同样处理。
3. `supportsWebGL2`（所在文件自行查找）：补成功路径与缓存的测试，并导出仅供测试的重置函数。
4. `sceneFor`：`/vaulted` 这类路径不能被当成 vault，按路径段匹配。补「settings 的目标与 garage 相同」的断言（若设计如此）。
5. `framedCamera`：相机与目标重合时不能产生 NaN（返回合理的回退值），补测试。
6. `guardStep` / `sweepX` / `unionBounds`：非有限输入（NaN、Infinity）不产生 NaN 传播；`unionBounds([])` 返回明确结果（空包围盒或抛错，择一并测试）。补 `fps === MIN_FPS` 边界测试。
7. `src/scene/loading.ts`：`resetLoading()` 通知订阅者。`src/scene/SceneHost.tsx`：3D 关掉再打开时，资源进度最大值重置。
8. `yawQuaternion` 在 π 附近的测试改成能发现符号翻转的角度。

### Task 2: 3D 运行时与交互的健壮性

提交信息：`fix: harden 3D runtime, drag input and scene host`

1. `src/scene/hooks.ts`：`MediaQueryList.addEventListener` 不存在时回退到 `addListener`/`removeListener`；补 hooks 测试（减少动态效果、可见性等现有 hook）。
2. 拖动输入（查找 `isInteractive`、`dragBy`、flick 速度相关文件）：
   - `isInteractive` 补 `summary`、`[role=link]`、`[role=button]`、`[tabindex]:not([tabindex="-1"])`。
   - `dragBy` 在未拖动状态下忽略。
   - `pointercancel` / `lostpointercapture` 时结束拖动，避免卡住。
   - flick 速度：dt 极小时不产生尖峰（设最小 dt 或基于时间窗口）。
   - 惯性速度低于阈值时归零。
   - 补边界测试：反向 flick、FLICK_WINDOW 边界、holdYaw 另一方向。
3. `webglcontextlost` 监听器在卸载时移除，且总是调用最新的 `onFail`。`Stage.test` 不再在用例间共享同一个 canvas。SceneHost 的「重新打开 3D」测试改成在没有修复时会失败（假 Stage 卸载时模拟 context loss 触发 `onFail`）。
4. `src/scene/three/Studio.tsx` 两个连续的 `if (key.current)` 合并。
5. 氮气条件在 TrialScreen 与 NitroFlash 里重复：抽成一个共享判断。补 combo 10 测试；测试里的 `off()` 放进 `finally`。
6. `Layout` className 结尾多余空格（若还在）。
7. 3D 文件里调用已弃用的 `THREE.Clock`（若是我们代码触发）改用替代 API。

### Task 3: 构建脚本的健壮性

提交信息：`fix: harden model, stills and audio build scripts`

1. 车牌：`plateText` 写入 SVG 前做 XML 转义；补测试。
2. 规则匹配：正则带 `g`/`y` 标志时 `.test()` 有状态，构造时去掉这些标志或改用不受影响的匹配；补测试。死规则检查不把已删除网格算作命中；补「删除优先」「先到规则优先」测试。
3. 错误类：拒绝路径的测试断言具体错误类（`CarError`、`StillsError`、`AudioError`）。
4. `findSource`：只把 ENOENT 当作「找不到」，其他错误抛出。多个候选模型文件时明确报错而不是随便挑一个。
5. 写文件失败时清理残留 `.tmp`（car / stills / audio 三处）。logger 在 `io.read` 之前设置。
6. stills：页面稳定等待期间发生的页面错误要再检查一次。
7. audio：`validateClips` 拒绝非有限数；补「总量超限」与「第二段失败时清理第一段的临时文件」测试；输出目录里不在配置中的旧 `.mp3` 删除（补测试）。
8. 4× 量化导致的 TEXCOORD_0 越界警告：若可通过调整量化参数或预先夹取消除且不改变外观则修，否则写入「未修」。

### Task 4: 声音、开场与外壳的收尾

提交信息：`fix: polish sound, intro and app shell`

1. `src/audio/sound.test.ts`：`afterEach` 里 `vi.restoreAllMocks()`，去掉行内 `mockRestore`；补 `stopAll` 后内部表清空、`fetch` 返回非 ok 的测试。`resetSound` 关闭旧的 AudioContext（`close` 存在时）。
2. 静音时不预加载：`unlockAudio` 在静音状态下只建上下文不拉取音频；取消静音时开始加载。补测试。
3. `src/intro/Intro.tsx`：可点火或正在淡出后停止 50 ms 计时器。补减少动态效果路径（即时填满、0 ms 完成）与双击只点火一次的测试。
4. 静音按钮：`aria-label` 固定为「静音」，状态只靠 `aria-pressed` 表达；更新相关测试。补 Layout 测试：`visibilitychange` 到 hidden 调用 `stopAll`；静音时调用 `stopAll`；pointerdown / click / keydown 调用 `unlockAudio`。
5. `HomePage.test.tsx`：补已完成一圈时点「看结算」不播放声音的测试。
6. `SettingsPage.test.tsx`：`beforeEach` 里调用 `resetPrefsCache`。3D 开关从裸 checkbox 改为有样式的开关（保持 `role="switch"`、可访问名和现有测试语义）。
7. 3B 用例名「turns … sound on」改成直接描述 `muted: false`。

### Task 5: 测试输出降噪

提交信息：`test: quiet the test run`

1. `THREE_CJS_DEPRECATED`：找到哪个 node 环境测试经 CJS `require('three')` 引入，改成 ESM 导入或在 vitest 配置里让该依赖走 ESM（`server.deps.inline` 等），使警告消失。
2. jsdom 性能提示、`HydrateFallback` 提示、`THREE.Clock` 弃用提示：能在仓库内消除的消除（例如为路由补 `HydrateFallback`、调整 vitest 环境配置），不能的写入「未修」。
3. `npm` 报 jsdom `EBADENGINE`：确认 jsdom 版本对 Node 24 的 engines 要求；若升级到兼容的精确版本不破坏测试则升级，否则写入「未修」。
4. 完成后整个 `npx vitest run` 的输出不应再有 stderr 警告（除用户本机 npm `devdir` 外）。
