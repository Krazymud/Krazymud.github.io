import { CAR_PATH, EARLY_FETCHES, STAGE_ASSET_PATHS, TEXTURE_PATHS } from './stageAssets'

const base = import.meta.env.BASE_URL
const triple = ([a, b, c]: [string, string, string]): [string, string, string] => [base + a, base + b, base + c]

export const CAR_URL = base + CAR_PATH

export const TEXTURE_URLS = { floor: triple(TEXTURE_PATHS.floor), wall: triple(TEXTURE_PATHS.wall) }

export const STAGE_ASSETS = STAGE_ASSET_PATHS.map((path) => base + path)

type Listener = (fraction: number) => void
type Fetcher = (url: string) => Promise<Response>

export function takeEarlyFetch(url: string): Promise<Response> {
  const slots = window as unknown as Record<string, Record<string, Promise<Response>> | undefined>
  const early = (slots[EARLY_FETCHES] ??= {})
  const response = early[url]
  if (!response) return fetch(url)
  delete early[url]
  return response
}

const blobs = new Map<string, string>()
let running: Promise<void> | null = null

export function assetUrl(url: string): string {
  return blobs.get(url) ?? url
}

// 进度只在所有文件都报上大小之后才算，免得小文件先到时进度先冲高再回落。
// 服务器压缩传输时读到的是解压后的字节，会比报的大小多，所以每个文件按报的大小封顶。
export async function downloadAll(urls: readonly string[], onProgress: Listener, fetcher: Fetcher = fetch): Promise<Map<string, Blob>> {
  const sizes = new Map<string, number>()
  const received = new Map<string, number>()
  const report = () => {
    if (sizes.size < urls.length) return
    let total = 0
    let loaded = 0
    for (const [url, size] of sizes) {
      total += size
      loaded += Math.min(received.get(url) ?? 0, size)
    }
    if (total > 0) onProgress(loaded / total)
  }
  const files = await Promise.all(
    urls.map(async (url) => {
      const response = await fetcher(url)
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
      sizes.set(url, Number(response.headers.get('content-length')) || 0)
      report()
      const reader = response.body?.getReader()
      if (!reader) return [url, await response.blob()] as const
      const chunks: Uint8Array[] = []
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received.set(url, (received.get(url) ?? 0) + value.byteLength)
        report()
      }
      received.set(url, Number.MAX_SAFE_INTEGER)
      report()
      return [url, new Blob(chunks as BlobPart[], { type: response.headers.get('content-type') ?? '' })] as const
    }),
  )
  return new Map(files)
}

let progress = 0
const listeners = new Set<Listener>()

function setProgress(fraction: number) {
  progress = Math.max(progress, fraction)
  for (const listener of listeners) listener(progress)
}

export function onPrefetchProgress(listener: Listener): () => void {
  listeners.add(listener)
  listener(progress)
  return () => {
    listeners.delete(listener)
  }
}

// 下载失败也照常往下走：加载器会用原地址再试一次。
export function prefetchStageAssets(fetcher: Fetcher = takeEarlyFetch): Promise<void> {
  running ??= downloadAll(STAGE_ASSETS, setProgress, fetcher).then(
    (files) => {
      for (const [url, blob] of files) blobs.set(url, URL.createObjectURL(blob))
      setProgress(1)
    },
    () => {},
  )
  return running
}

export function resetPrefetch(): void {
  for (const url of blobs.values()) URL.revokeObjectURL(url)
  blobs.clear()
  running = null
  progress = 0
}
