import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { signedCosRequest, type CosCreds } from '../src/vault/cosAuth.ts'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.bin': 'application/octet-stream',
}

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing ${name}`)
    process.exit(1)
  }
  return value
}

function cacheControl(rel: string): string {
  const base = path.basename(rel)
  if (base === 'index.html' || base === '404.html') return 'no-cache'
  if (rel.includes(`${path.sep}assets${path.sep}`) || rel.includes('/assets/')) {
    return 'public, max-age=31536000, immutable'
  }
  return 'public, max-age=86400'
}

function contentType(rel: string): string {
  const ext = path.extname(rel).toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}

function posixRel(distDir: string, absolutePath: string): string {
  return path.relative(distDir, absolutePath).split(path.sep).join('/')
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)))
    } else if (entry.isFile()) {
      files.push(full)
    }
  }
  return files
}

function purgeUrlList(domain: string | undefined): string[] {
  const fromEnv = process.env.CDN_PURGE_URLS
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (fromEnv?.length) return fromEnv

  const host = domain?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!host) return []
  return [`https://${host}/index.html`, `https://${host}/404.html`]
}

async function maybePurgeCdn(domain: string | undefined): Promise<void> {
  const urls = purgeUrlList(domain)
  if (urls.length === 0) return
  console.log('CDN cache refresh: purge or refresh these URLs after deploy:', urls.join(', '))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryablePut(status: number, body: string): boolean {
  if (status >= 500 || status === 408 || status === 429) return true
  if (status === 400 && body.includes('UserNetworkTooSlow')) return true
  return false
}

/** Upload order: hashed assets + radio music first, HTML, then other, vault last. */
export function uploadOrder(relPaths: string[]): string[] {
  const rank = (rel: string): number => {
    const base = path.posix.basename(rel)
    if (rel.includes('/assets/') || rel.startsWith('assets/')) return 0
    if (rel.includes('/darkroom/music/') || rel.startsWith('darkroom/music/')) return 0
    if (base === 'index.html' || base === '404.html') return 1
    if (rel.startsWith('vault/') || rel.includes('/vault/')) return 3
    return 2
  }
  return [...relPaths].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

/** Fonts, vault, and large media must not block publishing a new index.html. */
export function isOptionalUpload(rel: string): boolean {
  const ext = path.posix.extname(rel).toLowerCase()
  if (ext === '.woff' || ext === '.woff2' || ext === '.bin') return true
  if (ext === '.mp3' || ext === '.mp4' || ext === '.webm' || ext === '.wav') return true
  if (rel.startsWith('fonts/') || rel.includes('/fonts/')) return true
  if (rel.startsWith('vault/') || rel.includes('/vault/')) return true
  if (rel.includes('/darkroom/music/') || rel.startsWith('darkroom/music/')) return true
  return false
}

const HEAD_TIMEOUT_MS = 8_000
const PUT_TIMEOUT_MS = 180_000

export async function putWithRetries(
  put: () => Promise<{ ok: boolean; status: number; statusText: string; text: () => Promise<string> }>,
  key: string,
  options?: { retries?: number; delayMs?: number },
): Promise<void> {
  const retries = options?.retries ?? 5
  const delayMs = options?.delayMs ?? 1500
  let lastError = `PUT ${key} failed`
  for (let attempt = 1; attempt <= retries; attempt++) {
    let retryable = false
    try {
      const response = await put()
      if (response.ok) return
      const text = await response.text().catch(() => '')
      lastError = `PUT ${key} failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`
      retryable = isRetryablePut(response.status, text)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      lastError = `PUT ${key} failed: ${detail}`
      retryable = true
    }
    if (!retryable || attempt === retries) throw new Error(lastError)
    console.warn(`retry ${attempt}/${retries - 1} after ${lastError.slice(0, 120)}`)
    await sleep(delayMs * attempt)
  }
  throw new Error(lastError)
}

/** HEAD miss / network flake → treat as different so we attempt PUT. */
export async function remoteMatchesLocal(
  creds: CosCreds,
  bucket: string,
  region: string,
  key: string,
  localBytes: number,
): Promise<boolean> {
  try {
    const { url, headers } = await signedCosRequest({
      method: 'HEAD',
      bucket,
      region,
      key,
      creds,
    })
    const response = await fetch(url, {
      method: 'HEAD',
      headers,
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
    })
    if (!response.ok) return false
    const remoteLen = response.headers.get('content-length')
    return remoteLen !== null && Number(remoteLen) === localBytes
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.warn(`HEAD ${key} failed (${detail.slice(0, 80)}); will PUT`)
    return false
  }
}

function isHtmlEntry(rel: string): boolean {
  const base = path.posix.basename(rel)
  return base === 'index.html' || base === '404.html'
}

export async function syncCosSite(distDir: string): Promise<void> {
  const bucket = mustEnv('COS_BUCKET')
  const region = mustEnv('COS_REGION')
  const secretId = mustEnv('COS_SECRET_ID')
  const secretKey = mustEnv('COS_SECRET_KEY')
  const prefix = (process.env.COS_SITE_PREFIX ?? 'site').replace(/\/$/, '')
  const cdnDomain = process.env.CDN_DOMAIN

  const creds: CosCreds = { secretId, secretKey }
  const absDist = path.resolve(distDir)
  const files = await walkFiles(absDist)

  if (files.length === 0) {
    throw new Error(`No files under ${absDist}`)
  }

  const rels = uploadOrder(files.map((filePath) => posixRel(absDist, filePath)))

  const failures: string[] = []

  for (const rel of rels) {
    const filePath = path.join(absDist, ...rel.split('/'))
    const key = `${prefix}/${rel}`
    const body = await readFile(filePath)
    const mustPut = isHtmlEntry(rel)
    if (!mustPut && (await remoteMatchesLocal(creds, bucket, region, key, body.byteLength))) {
      console.log(`skip ${key} (same size)`)
      continue
    }
    try {
      await putWithRetries(async () => {
        const { url, headers } = await signedCosRequest({
          method: 'PUT',
          bucket,
          region,
          key,
          creds,
          headers: {
            'cache-control': cacheControl(rel),
            'content-type': contentType(rel),
          },
          body,
        })
        return fetch(url, {
          method: 'PUT',
          headers,
          body,
          signal: AbortSignal.timeout(PUT_TIMEOUT_MS),
        })
      }, key)
      console.log(`uploaded ${key}`)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      // HTML must publish; fonts/vault already optional; soft-fail other assets so
      // a flaky early PUT cannot block index.html (CDN otherwise stays on old build).
      if (mustPut) throw error
      if (isOptionalUpload(rel)) {
        console.warn(`skip optional ${key}: ${detail.slice(0, 160)}`)
      } else {
        console.warn(`skip asset ${key}: ${detail.slice(0, 160)}`)
        failures.push(key)
      }
    }
  }

  await maybePurgeCdn(cdnDomain)
  if (failures.length) {
    throw new Error(
      `COS sync uploaded HTML but failed ${failures.length} required asset(s): ${failures.slice(0, 5).join(', ')}`,
    )
  }
}

async function main(): Promise<void> {
  const dist = process.argv[2] ?? 'dist'
  await syncCosSite(dist)
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
