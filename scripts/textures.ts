import { mkdir } from 'node:fs/promises'
import { runTextures, TextureError } from './lib/textures.ts'
import { texturesConfig } from './textures.config.ts'

const SOURCE_DIR = 'assets-src/textures'
const OUT_DIR = 'public/textures'

try {
  await mkdir(OUT_DIR, { recursive: true })
  const results = await runTextures({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, jobs: texturesConfig, log: (line) => console.log(line) })
  const total = results.reduce((sum, result) => sum + result.bytes, 0)
  console.log(`已写入 ${OUT_DIR}（${results.length} 张，共 ${(total / 1024).toFixed(1)} KB）`)
} catch (error) {
  if (!(error instanceof TextureError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
