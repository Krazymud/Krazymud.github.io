/// <reference lib="dom" />
import { chromium } from 'playwright'
import { createServer } from 'vite'
import {
  checkNotBlack,
  encodeStill,
  ORIENTATIONS,
  STILL_SCENES,
  stillFileName,
  StillsError,
  writeStills,
  type Orientation,
} from './lib/stills.ts'

const PORT = 5199
const OUT_DIR = 'public/stills'
const READY_TIMEOUT_MS = 120_000
const SETTLE_MS = 500

async function capture(): Promise<{ name: string; data: Uint8Array }[]> {
  const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'warn' })
  await server.listen()
  const base = server.resolvedUrls?.local[0] ?? `http://localhost:${PORT}/`
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const results: { name: string; data: Uint8Array }[] = []
  try {
    for (const scene of STILL_SCENES) {
      for (const orientation of Object.keys(ORIENTATIONS) as Orientation[]) {
        const label = `${scene}-${orientation}`
        const page = await browser.newPage({ viewport: ORIENTATIONS[orientation], deviceScaleFactor: 1 })
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(`${base}__stills?scene=${scene}`)
        await page.waitForFunction(
          () => document.body.dataset.stillReady === 'true' || document.body.dataset.stillError !== undefined,
          null,
          { timeout: READY_TIMEOUT_MS },
        )
        const checkRendered = async () => {
          const failure = await page.evaluate(() => document.body.dataset.stillError)
          if (failure !== undefined || errors.length > 0) {
            throw new StillsError(`${label}：页面渲染失败（${failure ?? errors.join('；')}）`)
          }
        }
        await checkRendered()
        await page.waitForTimeout(SETTLE_MS)
        await checkRendered()
        const png = await page.screenshot({ type: 'png' })
        await checkNotBlack(png, label)
        results.push({ name: stillFileName(scene, orientation), data: await encodeStill(png, label) })
        await page.close()
        console.log(`已截取 ${label}`)
      }
    }
  } finally {
    await browser.close()
    await server.close()
  }
  return results
}

async function main() {
  await writeStills(OUT_DIR, await capture(), (line) => console.log(line))
}

main().catch((error: unknown) => {
  console.error(error instanceof StillsError ? error.message : error)
  process.exitCode = 1
})
