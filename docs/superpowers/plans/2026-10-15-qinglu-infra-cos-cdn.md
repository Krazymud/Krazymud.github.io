# 青庐 COS + CDN（W2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the static site on Tencent COS behind CDN for China reads, and move vault authority to private COS with SCF-issued STS writes (GitHub becomes backup), per `docs/superpowers/specs/2026-10-15-qinglu-infra-cos-cdn-design.md`.

**Architecture:** Dual-deploy `dist/` to GitHub Pages and COS `site/` (CDN origin). Browser vault transport switches from `gitVault` (GitHub Git Data API) to `cosVault` (COS REST + ETag conditional put). SCF HTTP function mints short-lived STS credentials after a shared gate secret check (spec §6.3 降级 B — no server-side DEK). A scheduled Actions job mirrors `vault/` from COS back to `public/vault/`.

**Tech Stack:** Existing Vite/React/Vitest stack; Node 24 in CI; Tencent COS REST (SigV4 via small helper, no browser SDK); SCF (Node.js); GitHub Actions secrets; `coscli` or REST in CI for site sync.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-15-qinglu-infra-cos-cdn-design.md` (approved).
- Do not change vault client encryption (`encryptJson` / blob seal / DEK / passphrase).
- Do not put long-lived Tencent or GitHub secrets in the frontend bundle or git tree.
- Vault objects stay under private `vault/` — never public CDN.
- Site reads go CDN → COS; never bill COS 外网下行 for normal users.
- Conflict detection = `vault.json` ETag If-Match; backup = hourly Actions job (primary).
- STS issuer = SCF; auth = **方案 B 签发口令** (plan-locked 降级 per spec §6.3); TTL ≤ 30 minutes; CAM only `vault/*`.
- Transition: keep Pages deploy until vault cutover is proven; then Pages is rollback-only.
- UI copy Chinese; unit tests use fake `fetch`, never hit real COS/GitHub/SCF.
- Feature branch `cursor/qinglu-infra-cos-cdn-*-8bae` (continue this PR branch or spawn task branches off it); PR to `master`.
- **Phase A (Tasks 1–2) may merge alone** for China static speed before vault cutover.

## File map

| Path | Role |
|------|------|
| `scripts/sync-cos-site.ts` | Upload `dist/` → COS `site/` with Cache-Control; purge CDN HTML |
| `scripts/migrate-vault-to-cos.ts` | One-shot: `public/vault/` → COS `vault/` |
| `scripts/backup-vault-from-cos.ts` | COS `vault/` → write files for commit / local check |
| `scf/sts-issuer/index.js` | SCF handler: gate → STS credentials JSON |
| `scf/sts-issuer/package.json` | SCF deps (`qcloud-cos-sts` or `@tencent-sdk/security-token-service`) |
| `src/vault/cosConfig.ts` | Bucket/region/STS URL/public site constants (non-secret) |
| `src/vault/cosAuth.ts` | Build COS SigV4 headers for temp creds (pure helpers) |
| `src/vault/cosAuth.test.ts` | Deterministic signing fixtures |
| `src/vault/cosVault.ts` | `readVaultFile` / `readBlobFile` / `putVaultUpdate` with ETag |
| `src/vault/cosVault.test.ts` | Fake fetch: read/put/conflict |
| `src/vault/stsTicket.ts` | Exchange gate → temp creds; cache until near expiry |
| `src/vault/stsTicket.test.ts` | Fake STS endpoint |
| `src/vault/useVaultMutate.ts` | Swap `gitVault` + GitHub token for `cosVault` + STS |
| `src/vault/useVaultMutate.test.tsx` | Update mocks to COS/STS |
| `src/vault/webStore.ts` | Persist gate secret key (reuse `token` key or rename to `syncGate`) |
| `src/vault/components/VaultContent.tsx` |「同步口令」UI replacing GitHub PAT |
| `src/vault/components/VaultContent.test.tsx` | Gate + sync copy |
| `src/vault/gitVault.ts` | Keep for backup scripts / transition; stop calling from mutate after cutover |
| `.github/workflows/deploy.yml` | After build: sync COS + refresh CDN; keep Pages |
| `.github/workflows/vault-backup.yml` | Hourly: pull COS vault → commit `public/vault/` if changed |
| `docs/runbooks/qinglu-cos-cdn.md` | Console setup, secrets, ICP, rollback, alarms |

---

### Task 1: Runbook + site sync script + dual deploy CI

**Files:**
- Create: `docs/runbooks/qinglu-cos-cdn.md`
- Create: `scripts/sync-cos-site.ts`
- Modify: `.github/workflows/deploy.yml`
- Modify: `package.json` (add `"sync:cos": "tsx scripts/sync-cos-site.ts"`)

**Interfaces:**
- Consumes: env `COS_SECRET_ID`, `COS_SECRET_KEY`, `COS_BUCKET`, `COS_REGION`, `CDN_DOMAIN` (optional purge), `COS_SITE_PREFIX` default `site`
- Produces: `syncCosSite(distDir: string): Promise<void>` uploading every file under `dist/` to `site/` with:
  - `index.html` / `404.html` → `Cache-Control: no-cache`
  - hashed `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`
  - other → `Cache-Control: public, max-age=86400`

- [ ] **Step 1: Write the runbook (console checklist, no secrets)**

Create `docs/runbooks/qinglu-cos-cdn.md` covering:

1. Create COS bucket (standard, region e.g. `ap-guangzhou`), enable versioning (7–30 day lifecycle).
2. Prefixes: `site/` (CDN origin), `vault/` (private).
3. CAM user for CI: `cos:PutObject`/`DeleteObject`/`ListBucket` on `site/*` only; separate backup role later for `vault/*`.
4. CDN: origin = COS bucket, host = custom or test domain; HTTPS; ignore cache for `index.html` or rely on `no-cache`.
5. ICP note: custom mainland domain needs filing; until then use CDN test domain + keep Pages as primary DNS.
6. GitHub Actions secrets list: `COS_SECRET_ID`, `COS_SECRET_KEY`, `COS_BUCKET`, `COS_REGION`, `CDN_PURGE_URLS` or API creds for refresh.
7. Alarms: CDN traffic 5GB/month, COS storage 1GB.
8. Rollback: point DNS/CNAME back to GitHub Pages.

- [ ] **Step 2: Implement `scripts/sync-cos-site.ts`**

Use Node 24 + `fetch` + the same SigV4 helper that Task 3 will formalize in `src/vault/cosAuth.ts` — for this task, put a minimal duplicate signer in the script **or** import from `src/vault/cosAuth.ts` once Task 3 exists. Prefer: **do Task 3 first if implementing in one branch**, otherwise inline a minimal PUT signer here and delete duplication in Task 3.

Minimal behavior:

```ts
// scripts/sync-cos-site.ts
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const dist = process.argv[2] ?? 'dist'
const bucket = mustEnv('COS_BUCKET')
const region = mustEnv('COS_REGION')
const prefix = (process.env.COS_SITE_PREFIX ?? 'site').replace(/\/$/, '')

function cacheControl(rel: string): string {
  const base = path.basename(rel)
  if (base === 'index.html' || base === '404.html') return 'no-cache'
  if (rel.includes(`${path.sep}assets${path.sep}`) || rel.includes('/assets/')) {
    return 'public, max-age=31536000, immutable'
  }
  return 'public, max-age=86400'
}

// walk dist, PUT each object to `${prefix}/${rel}` with Cache-Control + Content-Type
// then optional CDN purge of index.html / 404.html
```

- [ ] **Step 3: Wire deploy workflow**

After `npm run build` and before/after Pages artifact upload, add a step that runs only when secrets exist:

```yaml
      - name: Sync dist to COS
        if: ${{ secrets.COS_SECRET_ID != '' }}
        env:
          COS_SECRET_ID: ${{ secrets.COS_SECRET_ID }}
          COS_SECRET_KEY: ${{ secrets.COS_SECRET_KEY }}
          COS_BUCKET: ${{ secrets.COS_BUCKET }}
          COS_REGION: ${{ secrets.COS_REGION }}
        run: npx tsx scripts/sync-cos-site.ts dist
```

Keep existing Pages deploy steps unchanged.

- [ ] **Step 4: Dry-run locally without secrets**

Run: `npm run sync:cos` without env  
Expected: process exits non-zero with clear `Missing COS_BUCKET` (or similar), no upload.

- [ ] **Step 5: Commit**

```bash
git add docs/runbooks/qinglu-cos-cdn.md scripts/sync-cos-site.ts .github/workflows/deploy.yml package.json
git commit -m "feat(infra): dual-deploy dist to COS site prefix"
```

---

### Task 2: COS SigV4 helper (shared by site sync + cosVault)

**Files:**
- Create: `src/vault/cosAuth.ts`
- Create: `src/vault/cosAuth.test.ts`
- Modify: `scripts/sync-cos-site.ts` to import from `src/vault/cosAuth.ts`

**Interfaces:**
- Consumes: temp or long-lived `secretId`, `secretKey`, optional `sessionToken`
- Produces:
  - `export type CosCreds = { secretId: string; secretKey: string; sessionToken?: string }`
  - `export function cosObjectUrl(bucket: string, region: string, key: string): string`
  - `export async function signedCosRequest(options: { method: string; bucket: string; region: string; key: string; creds: CosCreds; headers?: Record<string, string>; body?: Uint8Array | string; query?: Record<string, string> }): Promise<{ url: string; headers: Headers }>`  
    Headers must include `Authorization` (and `x-cos-security-token` when sessionToken set) suitable for `fetch(url, { method, headers, body })`.

- [ ] **Step 1: Write failing fixture test**

```ts
import { describe, expect, it } from 'vitest'
import { cosObjectUrl } from './cosAuth'

describe('cosObjectUrl', () => {
  it('builds the virtual-host style URL', () => {
    expect(cosObjectUrl('mybucket-1250000000', 'ap-guangzhou', 'vault/vault.json')).toBe(
      'https://mybucket-1250000000.cos.ap-guangzhou.myqcloud.com/vault/vault.json',
    )
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/vault/cosAuth.test.ts`  
Expected: FAIL module not found / export missing.

- [ ] **Step 3: Implement URL + signing**

Implement AWS SigV4 for COS (Tencent documents this as兼容签名). Keep the helper small; cover at least PUT/GET/HEAD. Prefer well-known algorithm steps over copying a whole SDK.

Add a second test that locks a golden Authorization header for fixed credentials, timestamp, and payload hash (inject clock / date header).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/vault/cosAuth.test.ts`  
Expected: PASS.

- [ ] **Step 5: Point `sync-cos-site.ts` at the helper; commit**

```bash
git add src/vault/cosAuth.ts src/vault/cosAuth.test.ts scripts/sync-cos-site.ts
git commit -m "feat(infra): shared COS SigV4 helper"
```

---

### Task 3: `cosVault` read / conditional put

**Files:**
- Create: `src/vault/cosConfig.ts`
- Create: `src/vault/cosVault.ts`
- Create: `src/vault/cosVault.test.ts`

**Interfaces:**
- Consumes: `CosCreds` + `signedCosRequest` from `cosAuth.ts`; `VaultFile` from `types.ts`; error strings from `github.ts` (`TOKEN_DENIED`, `SYNC_PENDING`) **or** new `VaultTransportError` — prefer reusing `GitHubWriteError` renamed later; for this task export:

```ts
export class CosConflictError extends Error {
  constructor() {
    super('cos precondition failed')
    this.name = 'CosConflictError'
  }
}

export type CosVaultConfig = {
  bucket: string
  region: string
  vaultPrefix: string // 'vault'
}

export async function readVaultFile(options: {
  fetch: typeof fetch
  creds: CosCreds
  config: CosVaultConfig
}): Promise<{ file: VaultFile; etag: string | null }>

export async function readBlobFile(options: {
  fetch: typeof fetch
  creds: CosCreds
  config: CosVaultConfig
  blobName: string
}): Promise<Uint8Array>

export async function putVaultUpdate(options: {
  fetch: typeof fetch
  creds: CosCreds
  config: CosVaultConfig
  vaultFile: VaultFile
  /** null means object must not exist (If-None-Match: *) */
  etag: string | null
  blobs: Record<string, Uint8Array>
}): Promise<{ etag: string }>
```

`putVaultUpdate` order: upload each blob key `vault/blobs/<name>.bin` (overwrite OK), then PUT `vault/vault.json` with `If-Match: etag` or `If-None-Match: *`. On 412 → `CosConflictError`.

- [ ] **Step 1: Write failing tests with fake fetch**

```ts
import { describe, expect, it, vi } from 'vitest'
import { CosConflictError, putVaultUpdate, readVaultFile } from './cosVault'

const config = { bucket: 'b-125', region: 'ap-guangzhou', vaultPrefix: 'vault' }
const creds = { secretId: 'AKIDtest', secretKey: 'secret', sessionToken: 'tok' }

describe('readVaultFile', () => {
  it('returns null etag object body as VaultFile', async () => {
    const file = { version: 1, kdf: {}, wrap: '', manifest: '' }
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(file), { status: 200, headers: { ETag: '"abc"' } }),
    )
    const result = await readVaultFile({ fetch: fetchImpl as unknown as typeof fetch, creds, config })
    expect(result.etag).toBe('abc')
    expect(result.file).toEqual(file)
  })

  it('treats 404 as empty vault file shape for callers to interpret', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }))
    await expect(
      readVaultFile({ fetch: fetchImpl as unknown as typeof fetch, creds, config }),
    ).rejects.toMatchObject({ name: 'CosNotFoundError' })
  })
})

describe('putVaultUpdate', () => {
  it('raises CosConflictError on 412 for vault.json', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('vault.json')) return new Response('', { status: 412 })
      return new Response('', { status: 200, headers: { ETag: '"b1"' } })
    })
    await expect(
      putVaultUpdate({
        fetch: fetchImpl as unknown as typeof fetch,
        creds,
        config,
        vaultFile: { version: 1, kdf: {} as never, wrap: '', manifest: '' },
        etag: 'old',
        blobs: { a: new Uint8Array([1]) },
      }),
    ).rejects.toBeInstanceOf(CosConflictError)
  })
})
```

Adjust empty-vault behavior to match how `useVaultMutate` loads today: if site returns missing vault, empty manifest path stays in `repo.ts`. For COS authority after cutover, `readVaultFile` should throw a typed `CosNotFoundError` and mutate treats it like empty remote + `etag: null`.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/vault/cosVault.test.ts`

- [ ] **Step 3: Implement `cosConfig.ts` + `cosVault.ts`**

```ts
// src/vault/cosConfig.ts
export const COS_VAULT_CONFIG = {
  bucket: import.meta.env.VITE_COS_BUCKET as string,
  region: import.meta.env.VITE_COS_REGION as string,
  vaultPrefix: 'vault',
} as const

export const STS_ISSUER_URL = import.meta.env.VITE_STS_ISSUER_URL as string
```

Document required Vite env in runbook (public bucket name / region / STS URL only).

- [ ] **Step 4: Tests PASS; commit**

```bash
git add src/vault/cosConfig.ts src/vault/cosVault.ts src/vault/cosVault.test.ts
git commit -m "feat(vault): COS transport with ETag conditional put"
```

---

### Task 4: SCF STS issuer + `stsTicket` client

**Files:**
- Create: `scf/sts-issuer/index.js`
- Create: `scf/sts-issuer/package.json`
- Create: `src/vault/stsTicket.ts`
- Create: `src/vault/stsTicket.test.ts`
- Modify: `docs/runbooks/qinglu-cos-cdn.md` (deploy SCF, env vars)

**Interfaces:**

SCF request/response:

```ts
// POST body: { gate: string }
// 200: { secretId, secretKey, sessionToken, startTime, expiredTime }
// 401: { error: 'gate' }
// 429: { error: 'rate' }
```

```ts
// src/vault/stsTicket.ts
export type StsCreds = CosCreds & { expiredTime: number } // unix seconds

export async function fetchStsTicket(options: {
  fetch: typeof fetch
  issuerUrl: string
  gate: string
}): Promise<StsCreds>

export function ticketValid(creds: StsCreds, nowSec: number, skewSec?: number): boolean
// true if expiredTime > nowSec + (skewSec ?? 120)
```

CAM policy for the role assumed by STS: allow `name/cos:GetObject`, `PutObject`, `HeadObject` on `qcs::cos:REGION:uid/APPID:BUCKET/vault/*` only.

- [ ] **Step 1: Client tests with fake issuer**

```ts
import { describe, expect, it, vi } from 'vitest'
import { fetchStsTicket, ticketValid } from './stsTicket'

describe('fetchStsTicket', () => {
  it('returns temp creds on 200', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        secretId: 'a',
        secretKey: 'b',
        sessionToken: 'c',
        startTime: 1,
        expiredTime: 1000,
      }),
    )
    const creds = await fetchStsTicket({
      fetch: fetchImpl as unknown as typeof fetch,
      issuerUrl: 'https://example.com/sts',
      gate: 'secret',
    })
    expect(creds.sessionToken).toBe('c')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/sts',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('ticketValid', () => {
  it('rejects tickets inside the skew window', () => {
    expect(ticketValid({ secretId: '', secretKey: '', expiredTime: 500 }, 400, 120)).toBe(false)
    expect(ticketValid({ secretId: '', secretKey: '', expiredTime: 600 }, 400, 120)).toBe(true)
  })
})
```

- [ ] **Step 2: Implement client; implement SCF handler**

SCF handler sketch (`scf/sts-issuer/index.js`):

```js
const STS = require('qcloud-cos-sts')

exports.main_handler = async (event) => {
  const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {}
  if (body.gate !== process.env.STS_GATE) {
    return { statusCode: 401, body: JSON.stringify({ error: 'gate' }) }
  }
  // optional simple in-memory rate limit per source IP
  const credential = await new Promise((resolve, reject) => {
    STS.getCredential(
      {
        secretId: process.env.COS_SECRET_ID,
        secretKey: process.env.COS_SECRET_KEY,
        durationSeconds: 1800,
        policy: {
          version: '2.0',
          statement: [
            {
              action: ['name/cos:GetObject', 'name/cos:PutObject', 'name/cos:HeadObject'],
              effect: 'allow',
              resource: [process.env.STS_RESOURCE], // full qcs ARN for vault/*
            },
          ],
        },
      },
      (err, data) => (err ? reject(err) : resolve(data)),
    )
  })
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN },
    body: JSON.stringify({
      secretId: credential.credentials.tmpSecretId,
      secretKey: credential.credentials.tmpSecretKey,
      sessionToken: credential.credentials.sessionToken,
      startTime: credential.startTime,
      expiredTime: credential.expiredTime,
    }),
  }
}
```

Runbook: deploy zip to SCF, API gateway or function URL, set env, CORS to site origin.

- [ ] **Step 3: Vitest PASS; commit**

```bash
git add scf/sts-issuer src/vault/stsTicket.ts src/vault/stsTicket.test.ts docs/runbooks/qinglu-cos-cdn.md
git commit -m "feat(vault): SCF STS issuer and browser ticket helper"
```

---

### Task 5: `useVaultMutate` transport cutover

**Files:**
- Modify: `src/vault/useVaultMutate.ts`
- Modify: `src/vault/useVaultMutate.test.tsx`
- Modify: `src/vault/webStore.ts` (gate persistence; keep `loadToken`/`saveToken` API names **or** add `loadGate`/`saveGate` aliases that use the same IDB key — pick aliases and update UI)
- Modify: `src/vault/components/VaultContent.tsx` + tests — copy「同步口令」/「忘记口令」, stop saying GitHub 令牌

**Interfaces:**
- Consumes: `fetchStsTicket`, `ticketValid`, `readVaultFile`, `readBlobFile`, `putVaultUpdate`, `CosConflictError`, `CosNotFoundError`
- Produces: same public hook API (`saveNote`, `syncing`, `unsynced`, …) but:
  - `token` state means **gate secret** (rename internal refs to `gate` in this task)
  - `baseShaRef` → `baseEtagRef: string | null`
  - `push` uses `putVaultUpdate`; conflict → rebase via `readVaultFile` + `mergeWorking` once (same as today’s NFF retry)
  - On hydrate, blob read order: site `fetchBytes` first, then COS `readBlobFile`
  - Stop calling `commitVaultUpdate` / `readVaultFile` from `gitVault.ts`
  - Error copy: gate 401 → `令牌不能写这个仓库` **change to** `同步口令不对` (update constant in `github.ts` or move to `vaultErrors.ts`)

- [ ] **Step 1: Update unit tests to mock COS + STS**

Replace `vi.mock('./gitVault')` with mocks of `./cosVault` and `./stsTicket`. Port existing cases:

- enables editing after gate saved and syncs remote first
- retries once after `CosConflictError`
- site blob hydrate still works
- bad gate surfaces new error string

- [ ] **Step 2: Run tests — FAIL on old GitHub assumptions**

Run: `npx vitest run src/vault/useVaultMutate.test.tsx src/vault/components/VaultContent.test.tsx`

- [ ] **Step 3: Implement cutover in `useVaultMutate.ts`**

Core push loop shape:

```ts
async function push(start: WorkingVault, gate: string): Promise<WorkingVault> {
  let creds = await ensureTicket(gate) // fetchStsTicket or cached
  let local = start
  if (baseEtagRef.current === undefined) {
    /* treat CosNotFoundError as emptyWorking + etag null */
  }
  let retried = false
  for (;;) {
    const vaultFile = await sealVaultFile(dekRef.current, local, fileRef.current)
    try {
      const { etag } = await putVaultUpdate({
        fetch: fetchRef.current,
        creds,
        config: COS_VAULT_CONFIG,
        vaultFile,
        etag: baseEtagRef.current,
        blobs: referencedBlobs(local),
      })
      fileRef.current = vaultFile
      baseEtagRef.current = etag
      return { ...emptyWorking(local.manifest), dirtyBlobs: referencedBlobs(local) }
    } catch (error) {
      if (!(error instanceof CosConflictError)) throw error
      if (retried) throw new GitHubWriteError(SYNC_PENDING)
      retried = true
      local = await rebaseFromCos(local, creds)
      adopt(local)
      await persist(local)
    }
  }
}
```

- [ ] **Step 4: UI copy + tests PASS**

Run: `npx vitest run src/vault`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vault/useVaultMutate.ts src/vault/useVaultMutate.test.tsx src/vault/webStore.ts src/vault/components/VaultContent.tsx src/vault/components/VaultContent.test.tsx src/vault/github.ts
git commit -m "feat(vault): sync through COS STS instead of GitHub API"
```

---

### Task 6: Migration script GitHub vault → COS

**Files:**
- Create: `scripts/migrate-vault-to-cos.ts`
- Modify: `docs/runbooks/qinglu-cos-cdn.md` (migration section)
- Modify: `package.json` (`"vault:migrate-cos": "tsx scripts/migrate-vault-to-cos.ts"`)

**Interfaces:**
- Reads local `public/vault/vault.json` + `public/vault/blobs/*.bin`
- Uploads to COS `vault/` with long-lived CI creds (not STS)
- Verifies: HEAD each object; re-download `vault.json` and compare bytes
- Refuses to overwrite if remote `vault.json` exists unless `--force`

- [ ] **Step 1: Implement script with `--dry-run` listing keys**

```ts
// --dry-run prints: vault/vault.json, vault/blobs/<n>.bin counts
// default: upload, then verify byte equality on vault.json
```

- [ ] **Step 2: Dry-run against repo fixtures**

Run: `npm run vault:migrate-cos -- --dry-run`  
Expected: lists current `public/vault` objects; exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-vault-to-cos.ts package.json docs/runbooks/qinglu-cos-cdn.md
git commit -m "feat(infra): migrate public/vault to COS"
```

---

### Task 7: Hourly GitHub backup from COS

**Files:**
- Create: `scripts/backup-vault-from-cos.ts`
- Create: `.github/workflows/vault-backup.yml`
- Modify: `package.json` (`"vault:backup-cos": "tsx scripts/backup-vault-from-cos.ts"`)
- Modify: runbook

**Interfaces:**
- Download COS `vault/vault.json` + all `vault/blobs/*` into `public/vault/`
- Workflow: `schedule: cron: '0 * * * *'` + `workflow_dispatch`
- If `git status` shows changes under `public/vault/`, commit as `content(vault): backup from cos` and push with `contents: write` (use `GITHUB_TOKEN` or existing pattern)
- If COS unreachable, fail the job (alert via Actions email)

- [ ] **Step 1: Script downloads to a temp dir and syncs into `public/vault/`**

Delete local blob files not present remotely only when `--prune` passed; default leave extras (safer).

- [ ] **Step 2: Workflow file**

```yaml
name: Vault backup from COS
on:
  schedule:
    - cron: '0 * * * *'
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci --ignore-scripts
      - env:
          COS_SECRET_ID: ${{ secrets.COS_SECRET_ID }}
          COS_SECRET_KEY: ${{ secrets.COS_SECRET_KEY }}
          COS_BUCKET: ${{ secrets.COS_BUCKET }}
          COS_REGION: ${{ secrets.COS_REGION }}
        run: npx tsx scripts/backup-vault-from-cos.ts
      - name: Commit if changed
        run: |
          if git diff --quiet -- public/vault; then
            echo 'No vault changes'
          else
            git config user.name 'github-actions[bot]'
            git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
            git add public/vault
            git commit -m 'content(vault): backup from cos'
            git push
          fi
```

- [ ] **Step 3: Commit**

```bash
git add scripts/backup-vault-from-cos.ts .github/workflows/vault-backup.yml package.json docs/runbooks/qinglu-cos-cdn.md
git commit -m "feat(infra): hourly COS vault backup to GitHub"
```

---

### Task 8: Cutover verification + mark spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-qinglu-infra-cos-cdn-design.md` status → `已实现` (only after real cutover evidence)
- Modify: `docs/runbooks/qinglu-cos-cdn.md` acceptance checklist results

**Interfaces:** none (ops)

- [ ] **Step 1: Phase A acceptance (can be earlier)**

With CDN test domain: load homepage + drive loop from China network (or document proxy-less check). Confirm `index.html` response headers include `no-cache` or CDN ignore-cache rule.

- [ ] **Step 2: Phase B acceptance**

1. `npm run vault:migrate-cos` (live secrets, once).
2. Unlock vault on device A with sync gate; edit note; unlock device B; see edit.
3. Concurrent edit → one device sees「还没同步」or successful merge after retry — no silent loss.
4. Confirm GitHub `public/vault/` updates within ~1h via backup workflow (or run `workflow_dispatch`).
5. Confirm browser never calls `api.github.com` for vault writes (devtools).

- [ ] **Step 3: DNS**

When ICP ready: CNAME to CDN; keep Pages as emergency target documented in runbook.

- [ ] **Step 4: Mark spec + commit**

```bash
git add docs/superpowers/specs/2026-10-15-qinglu-infra-cos-cdn-design.md docs/runbooks/qinglu-cos-cdn.md
git commit -m "docs(qinglu): mark COS+CDN infra spec implemented"
```

---

## Plan self-review (author)

| Spec requirement | Task |
|------------------|------|
| CDN → COS site reads, cache headers, dual deploy | 1, 2 |
| Vault authority COS, ETag conditional put | 3, 5 |
| STS via SCF, TTL/prefix limits | 4 |
| GitHub backup async | 7 |
| Migration + rollback/alarms runbook | 1, 6, 8 |
| No crypto protocol change | Global + Task 5 |
| 方案 B gate (降级) | 4, 5 |
| Cost alarms | 1 runbook |

**Explicit non-goals left out:** multi-cloud, vault GC, scheme A DEK-bound proof, stopping Pages in the same PR as first COS sync.
