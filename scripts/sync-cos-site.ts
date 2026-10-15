import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
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

  for (const filePath of files) {
    const rel = posixRel(absDist, filePath)
    const key = `${prefix}/${rel}`
    const body = await readFile(filePath)
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

    const response = await fetch(url, { method: 'PUT', headers, body })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`PUT ${key} failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`)
    }
    console.log(`uploaded ${key}`)
  }

  await maybePurgeCdn(cdnDomain)
}

async function main(): Promise<void> {
  const dist = process.argv[2] ?? 'dist'
  await syncCosSite(dist)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
