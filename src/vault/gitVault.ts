import { toBase64 } from './crypto'
import { GITHUB_WEB, GitHubWriteError, SYNC_PENDING, TOKEN_DENIED, githubApiHeaders, readRemote } from './github'
import type { VaultFile } from './types'

export const VAULT_JSON_PATH = 'public/vault/vault.json'
export const WEB_JSON_PATH = 'public/vault/web.json'

const REPO_BASE = `https://api.github.com/repos/${GITHUB_WEB.owner}/${GITHUB_WEB.repo}`

export class GitHubRefNotFastForwardError extends Error {
  constructor() {
    super('ref not fast-forward')
    this.name = 'GitHubRefNotFastForwardError'
  }
}

function assertOk(response: Response, denied: boolean): void {
  if (response.status === 401 || response.status === 403) throw new GitHubWriteError(TOKEN_DENIED)
  if (!response.ok) throw new GitHubWriteError(denied ? TOKEN_DENIED : SYNC_PENDING)
}

async function apiJson<T>(
  fetchImpl: typeof fetch,
  token: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetchImpl(url, {
    ...init,
    headers: githubApiHeaders(token, init?.body !== undefined),
  })
  assertOk(response, false)
  return (await response.json()) as T
}

// The JSON contents response leaves `content` empty for files over 1 MB; the raw media type does not.
async function readRawFile(fetchImpl: typeof fetch, token: string, path: string, ref: string): Promise<Uint8Array> {
  const headers = githubApiHeaders(token, false)
  headers.set('Accept', 'application/vnd.github.raw')
  const response = await fetchImpl(`${REPO_BASE}/contents/${path}?ref=${encodeURIComponent(ref)}`, {
    headers,
    cache: 'no-store',
  })
  assertOk(response, false)
  return new Uint8Array(await response.arrayBuffer())
}

export async function readVaultFile(
  fetchImpl: typeof fetch,
  token: string,
): Promise<{ file: VaultFile; commitSha: string }> {
  const ref = await apiJson<{ object: { sha: string } }>(
    fetchImpl,
    token,
    `${REPO_BASE}/git/ref/heads/${GITHUB_WEB.branch}`,
    { cache: 'no-store' },
  )
  const commitSha = ref.object.sha
  const bytes = await readRawFile(fetchImpl, token, VAULT_JSON_PATH, commitSha)
  try {
    return { file: JSON.parse(new TextDecoder().decode(bytes)) as VaultFile, commitSha }
  } catch {
    throw new GitHubWriteError(SYNC_PENDING)
  }
}

export async function readWebFileText(fetchImpl: typeof fetch, token: string): Promise<string | null> {
  return (await readRemote(fetchImpl, token)).text
}

export function readBlobFile(
  fetchImpl: typeof fetch,
  token: string,
  blobName: string,
  ref: string = GITHUB_WEB.branch,
): Promise<Uint8Array> {
  // Prefer the commit SHA the vault.json was read from so Contents matches the manifest
  // even when the branch tip or CDN has not caught up yet.
  return readRawFile(fetchImpl, token, `public/vault/blobs/${blobName}.bin`, ref)
}

async function createBlob(fetchImpl: typeof fetch, token: string, bytes: Uint8Array): Promise<string> {
  const body = await apiJson<{ sha: string }>(fetchImpl, token, `${REPO_BASE}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: toBase64(bytes), encoding: 'base64' }),
  })
  return body.sha
}

export async function commitVaultUpdate(options: {
  fetch: typeof fetch
  token: string
  message: string
  vaultFile: VaultFile
  /** The commit `vaultFile` was built from; the ref update fails with 422 if the branch moved past it. */
  parentSha: string
  blobs: Record<string, Uint8Array>
  deleteWebJson?: boolean
}): Promise<string> {
  const { fetch: fetchImpl, token, message, vaultFile, parentSha, blobs, deleteWebJson } = options

  const commit = await apiJson<{ tree: { sha: string } }>(
    fetchImpl,
    token,
    `${REPO_BASE}/git/commits/${parentSha}`,
  )
  const baseTree = commit.tree.sha

  const vaultBytes = new TextEncoder().encode(JSON.stringify(vaultFile))
  const vaultBlobSha = await createBlob(fetchImpl, token, vaultBytes)

  const treeEntries: { path: string; mode: string; type: string; sha: string | null }[] = [
    { path: VAULT_JSON_PATH, mode: '100644', type: 'blob', sha: vaultBlobSha },
  ]

  for (const [name, bytes] of Object.entries(blobs)) {
    const sha = await createBlob(fetchImpl, token, bytes)
    treeEntries.push({
      path: `public/vault/blobs/${name}.bin`,
      mode: '100644',
      type: 'blob',
      sha,
    })
  }

  if (deleteWebJson) {
    treeEntries.push({ path: WEB_JSON_PATH, mode: '100644', type: 'blob', sha: null })
  }

  const tree = await apiJson<{ sha: string }>(fetchImpl, token, `${REPO_BASE}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTree, tree: treeEntries }),
  })

  const newCommit = await apiJson<{ sha: string }>(fetchImpl, token, `${REPO_BASE}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [parentSha],
    }),
  })

  const patchResponse = await fetchImpl(`${REPO_BASE}/git/refs/heads/${GITHUB_WEB.branch}`, {
    method: 'PATCH',
    headers: githubApiHeaders(token, true),
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  })
  if (patchResponse.status === 401 || patchResponse.status === 403) {
    throw new GitHubWriteError(TOKEN_DENIED)
  }
  if (patchResponse.status === 422) throw new GitHubRefNotFastForwardError()
  if (!patchResponse.ok) throw new GitHubWriteError(SYNC_PENDING)
  return newCommit.sha
}
