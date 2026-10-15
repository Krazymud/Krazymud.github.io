#!/usr/bin/env node
/**
 * Re-fetch self-hosted paper fonts into public/fonts/.
 *
 * LXGW WenKai Lite Regular: official release ships TTF only; convert to woff2.
 * Source Serif 4 latin 400: copy from @fontsource/source-serif-4 (install temporarily).
 */
import { execSync } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fontsDir = resolve(root, 'public/fonts')
const tmp = resolve(root, '.tmp-font-fetch')

const WENKAI_TAG = 'v1.522'
const WENKAI_TTF_URL = `https://github.com/lxgw/LxgwWenKai-Lite/releases/download/${WENKAI_TAG}/LXGWWenKaiLite-Regular.ttf`

mkdirSync(fontsDir, { recursive: true })
mkdirSync(tmp, { recursive: true })

console.log('Downloading LXGW WenKai Lite Regular…')
execSync(`curl -fsSL "${WENKAI_TTF_URL}" -o "${tmp}/LXGWWenKaiLite-Regular.ttf"`, { stdio: 'inherit' })

console.log('Converting to woff2 (requires: pip install fonttools brotli)…')
execSync(
  `python3 -c "from fontTools.ttLib import TTFont; f=TTFont('${tmp}/LXGWWenKaiLite-Regular.ttf'); f.flavor='woff2'; f.save('${fontsDir}/lxgw-wenkai-regular.woff2')"`,
  { stdio: 'inherit', cwd: root },
)

console.log('Installing @fontsource/source-serif-4 (temporary)…')
execSync('npm install --no-save @fontsource/source-serif-4', { stdio: 'inherit', cwd: root })

const serifSrc = resolve(
  root,
  'node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2',
)
copyFileSync(serifSrc, resolve(fontsDir, 'source-serif-4-latin-400.woff2'))

rmSync(tmp, { recursive: true, force: true })
console.log('Done. Fonts in public/fonts/')
