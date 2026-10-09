import { createHash } from 'node:crypto'
import { parse as parseYaml } from 'yaml'
import type { ListItem } from '../../src/vault/types.ts'

export class VaultError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'VaultError'
  }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const PHOTO_RE = /\.(jpe?g|png|webp|heic|heif)$/i
const HEIC_RE = /\.(heic|heif)$/i
const ITEM_RE = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/
const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/

export function isPhotoFile(name: string): boolean {
  return PHOTO_RE.test(name)
}

export function isHeicFile(name: string): boolean {
  return HEIC_RE.test(name)
}

export function sha256Hex(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function splitFrontMatter(file: string, text: string): { data: Record<string, unknown>; body: string } {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const match = FRONT_MATTER_RE.exec(normalized)
  if (!match) return { data: {}, body: normalized }
  let data: unknown
  try {
    data = parseYaml(match[1])
  } catch {
    throw new VaultError(`${file}：开头的 title/date 部分格式不对`)
  }
  if (data !== null && !isRecord(data)) throw new VaultError(`${file}：开头的 title/date 部分格式不对`)
  return { data: data ?? {}, body: match[2] }
}

function requireTitle(file: string, data: Record<string, unknown>): string {
  const title = data.title
  if ((typeof title !== 'string' && typeof title !== 'number') || String(title).trim() === '') {
    throw new VaultError(`${file}：缺少 title`)
  }
  return String(title).trim()
}

function isRealDay(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function requireDate(label: string, value: unknown): string {
  if (typeof value !== 'string' || !DAY_RE.test(value) || !isRealDay(value)) {
    throw new VaultError(`${label}：date 必须是 YYYY-MM-DD 格式`)
  }
  return value
}

export interface ParsedNote {
  title: string
  date: string
  body: string
}

export function parseNote(file: string, text: string): ParsedNote {
  const { data, body } = splitFrontMatter(file, text)
  return { title: requireTitle(file, data), date: requireDate(file, data.date), body: body.trim() }
}

export interface ParsedList {
  title: string
  items: ListItem[]
}

export function parseList(file: string, text: string): ParsedList {
  const { data, body } = splitFrontMatter(file, text)
  const title = requireTitle(file, data)
  const items = body.split('\n').flatMap((line): ListItem[] => {
    const match = ITEM_RE.exec(line)
    return match ? [{ text: match[2], done: match[1] !== ' ' }] : []
  })
  if (items.length === 0) throw new VaultError(`${file}：没有找到「- [ ] 事项」这样的清单行`)
  return { title, items }
}

export interface PhotoOverride {
  caption?: string
  date?: string
}

export interface SourceConfig {
  photos: Record<string, PhotoOverride>
  listOrder: string[]
}

export function parseConfig(text: string | null): SourceConfig {
  if (text === null) return { photos: {}, listOrder: [] }
  let raw: unknown
  try {
    raw = parseYaml(text)
  } catch {
    throw new VaultError('manifest.yaml 不是有效的 YAML')
  }
  if (raw !== null && !isRecord(raw)) throw new VaultError('manifest.yaml 顶层必须是 photos: 和 lists: 两部分')
  const root = raw ?? {}

  const photos: Record<string, PhotoOverride> = {}
  if (root.photos !== undefined && root.photos !== null) {
    if (!isRecord(root.photos)) throw new VaultError('manifest.yaml：photos 下面要写成「文件名: 设置」')
    for (const [name, value] of Object.entries(root.photos)) {
      if (!isRecord(value)) throw new VaultError(`manifest.yaml 里的 ${name}：要写 caption 或 date`)
      const override: PhotoOverride = {}
      if (value.caption !== undefined && value.caption !== null) override.caption = String(value.caption)
      if (value.date !== undefined && value.date !== null) override.date = requireDate(`manifest.yaml 里的 ${name}`, value.date)
      photos[name] = override
    }
  }

  let listOrder: string[] = []
  if (root.lists !== undefined && root.lists !== null) {
    const order = isRecord(root.lists) ? root.lists.order : undefined
    if (!isRecord(root.lists) || (order !== undefined && order !== null && !Array.isArray(order))) {
      throw new VaultError('manifest.yaml：lists.order 必须是文件名列表')
    }
    listOrder = Array.isArray(order) ? order.map(String) : []
  }
  return { photos, listOrder }
}

export function checkConfigRefs(config: SourceConfig, photoNames: string[], listNames: string[]): void {
  for (const name of Object.keys(config.photos)) {
    if (!photoNames.includes(name)) throw new VaultError(`manifest.yaml 提到了不存在的照片：${name}`)
  }
  const seen = new Set<string>()
  for (const name of config.listOrder) {
    if (seen.has(name)) throw new VaultError(`manifest.yaml 的 lists.order 里重复写了清单：${name}`)
    seen.add(name)
    if (!listNames.includes(name)) throw new VaultError(`manifest.yaml 提到了不存在的清单：${name}`)
  }
}

export function sortLists(names: string[], order: string[]): string[] {
  const ranked = order.filter((name) => names.includes(name))
  const rest = names.filter((name) => !order.includes(name)).sort((a, b) => a.localeCompare(b))
  return [...ranked, ...rest]
}
