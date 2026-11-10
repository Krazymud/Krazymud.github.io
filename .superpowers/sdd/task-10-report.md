# Task 10 report
- Props rebuilt as code-driven meshes (src/darkroom/scene/DeskScene.tsx): wax-sealed envelope, 3 metal film canisters with labels, lightbox with emissive panel + local point light, lacquered tray with rim/liquid, viewer with lens; spot light with shadows + hemisphere light; Canvas `shadows` on. No binary assets added.
- THREE_CJS_DEPRECATED fixed in vite.config.ts (test.alias fiber -> ESM build, server.deps.inline for fiber/drei/three).
- Also silenced the intentional "web.json 可能落后" stderr in scripts/lib/vaultCommand.test.ts (spy on stderr). Full suite output is clean: 47 files / 327 tests pass.
- tsc -b clean, npm run build OK.
- Smoke: headless Chrome (swiftshader WebGL) render of DeskScene+CameraRig via temp harness (removed): /opt/cursor/artifacts/darkroom-{desk,lightbox,rolls}.png. Full unlock->desk not run (vault passphrase unavailable); no real iPhone.
- iPhone operator checklist: the brief's 8 items (cold load 启封 only, unlock->3D desk, open letters + edit persists, rolls/frame, tray add photo, sync gate/strip, lock, reduced-motion lerp) still need manual Safari pass; watch shadow cost (one 1024 spotlight shadow, dpr<=2).
