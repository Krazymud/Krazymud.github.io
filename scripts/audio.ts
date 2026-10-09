import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import { audioConfig } from './audio.config.ts'
import { AudioError, runAudio } from './lib/audio.ts'

const SOURCE_DIR = 'assets-src/audio'
const OUT_DIR = 'public/audio'

const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string | null
const run = promisify(execFile)

try {
  if (!ffmpeg) throw new AudioError('ffmpeg-static 没有为这个平台提供 ffmpeg')
  await mkdir(OUT_DIR, { recursive: true })
  const results = await runAudio({
    sourceDir: SOURCE_DIR,
    outDir: OUT_DIR,
    clips: audioConfig,
    encode: async (args) => {
      await run(ffmpeg, args)
    },
    log: (line) => console.log(line),
  })
  const total = results.reduce((sum, result) => sum + result.bytes, 0)
  console.log(`已写入 ${OUT_DIR}（${results.length} 个，共 ${(total / 1024).toFixed(1)} KB）`)
} catch (error) {
  if (!(error instanceof AudioError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
