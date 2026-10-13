import type { VaultKey } from './crypto'
import { fromBase64, toBase64 } from './crypto'
import { emptyWebDoc, mergeWebDocs, openWebFile, sealWebFile, WebFileError, type WebDoc } from './web'

export const GITHUB_WEB = {
  owner: 'Krazymud',
  repo: 'Krazymud.github.io',
  branch: 'master',
  path: 'public/vault/web.json',
} as const

export const WEB_COMMIT_MESSAGE = 'content(vault): update web notes'
export const TOKEN_DENIED = '令牌不能写这个仓库'
export const SYNC_PENDING = '还没同步'

export class GitHubWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubWriteError'
  }
}

const CONTENTS = `https://api.github.com/repos/${GITHUB_WEB.owner}/${GITHUB_WEB.repo}/contents/${GITHUB_WEB.path}`

export function githubApiHeaders(token: string, jsonBody: boolean): Headers {
  const result = new Headers({
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  })
  if (jsonBody) result.set('Content-Type', 'application/json')
  return result
}

function decodeContent(content: string): string {
  return new TextDecoder().decode(fromBase64(content.replace(/\s/g, '')))
}

async function readRemote(
  fetchImpl: typeof fetch,
  token: string,
): Promise<{ text: string | null; sha: string | null }> {
  const response = await fetchImpl(`${CONTENTS}?ref=${GITHUB_WEB.branch}`, {
    headers: githubApiHeaders(token, false),
    cache: 'no-store',
  })
  if (response.status === 404) return { text: null, sha: null }
  if (response.status === 401 || response.status === 403) throw new GitHubWriteError(TOKEN_DENIED)
  if (!response.ok) throw new GitHubWriteError(SYNC_PENDING)
  const body = (await response.json()) as { sha?: string; content?: string }
  if (!body.sha || !body.content) throw new GitHubWriteError(SYNC_PENDING)
  return { text: decodeContent(body.content), sha: body.sha }
}

async function putRemote(
  fetchImpl: typeof fetch,
  token: string,
  text: string,
  sha: string | null,
): Promise<'ok' | 'conflict'> {
  const response = await fetchImpl(CONTENTS, {
    method: 'PUT',
    headers: githubApiHeaders(token, true),
    body: JSON.stringify({
      message: WEB_COMMIT_MESSAGE,
      content: toBase64(new TextEncoder().encode(text)),
      branch: GITHUB_WEB.branch,
      ...(sha ? { sha } : {}),
    }),
  })
  if (response.status === 409 || response.status === 422) return 'conflict'
  if (response.status === 401 || response.status === 403) throw new GitHubWriteError(TOKEN_DENIED)
  if (!response.ok) throw new GitHubWriteError(SYNC_PENDING)
  return 'ok'
}

async function mergedText(
  fetchImpl: typeof fetch,
  token: string,
  local: WebDoc,
  dek: VaultKey,
): Promise<{ text: string; doc: WebDoc; sha: string | null }> {
  const remote = await readRemote(fetchImpl, token)
  const base = remote.text === null ? emptyWebDoc() : await openWebFile(dek, remote.text)
  const doc = mergeWebDocs(base, local)
  return { text: await sealWebFile(dek, doc), doc, sha: remote.sha }
}

export async function syncWebFile(options: {
  fetch: typeof fetch
  token: string
  local: WebDoc
  dek: VaultKey
}): Promise<{ text: string; doc: WebDoc }> {
  const { fetch: fetchImpl, token, local, dek } = options
  try {
    let next = await mergedText(fetchImpl, token, local, dek)
    let result = await putRemote(fetchImpl, token, next.text, next.sha)
    if (result === 'conflict') {
      next = await mergedText(fetchImpl, token, local, dek)
      result = await putRemote(fetchImpl, token, next.text, next.sha)
      if (result === 'conflict') throw new GitHubWriteError(SYNC_PENDING)
    }
    return { text: next.text, doc: next.doc }
  } catch (error) {
    if (error instanceof GitHubWriteError || error instanceof WebFileError) throw error
    throw new GitHubWriteError(SYNC_PENDING)
  }
}
