# Qinglu COS + CDN runbook

Console checklist for dual-deploying `dist/` to Tencent COS (`site/`) with CDN origin. Do not store secrets in this repo.

## 1. COS bucket

- Create a **standard** storage bucket (e.g. region `ap-guangzhou`).
- Enable **versioning**.
- Add a lifecycle rule to expire noncurrent versions after **7–30 days**.

## 2. Prefix layout

| Prefix   | Access              | Purpose                          |
|----------|---------------------|----------------------------------|
| `site/`  | Public via CDN      | Static site (`dist/` mirror)     |
| `vault/` | Private (STS later) | Encrypted vault blobs + manifest |

## 3. CAM user for CI (site sync only)

Create a CAM sub-user or use API keys scoped for GitHub Actions:

- Allow: `cos:PutObject`, `cos:DeleteObject`, `cos:ListBucket` on **`site/*`** only (bucket + prefix).
- Deny or omit write access to `vault/*`.
- Plan a **separate** backup role later for `vault/*` (not used by site sync).

## 4. CDN

- Origin: the COS bucket; origin path **`/site`** (or equivalent prefix mapping to `site/` objects).
- Domain: custom hostname or Tencent **test domain** during validation.
- Enable **HTTPS** (managed or uploaded certificate).
- Cache: set CDN to respect origin `Cache-Control`, or add a rule to **not cache** `index.html` / `404.html` (origin sends `no-cache`).

## 5. ICP / DNS

- A **custom mainland domain** on Tencent CDN requires **ICP filing**.
- Until filing is done: use the CDN test domain for speed checks; keep **GitHub Pages as primary DNS** for the public site.

## 6. GitHub Actions (dual deploy)

COS sync is **off by default** so Pages deploy never depends on Tencent credentials.

| Type | Name | Purpose |
|------|------|---------|
| **Variable** | `COS_SYNC_ENABLED` | Set to `true` to run the `Sync dist to COS` step after build. GitHub does not allow `secrets` in step `if:`; use this flag instead. |
| Secret | `COS_SECRET_ID` | CAM SecretId (required when sync enabled) |
| Secret | `COS_SECRET_KEY` | CAM SecretKey |
| Secret | `COS_BUCKET` | Bucket name |
| Secret | `COS_REGION` | Region (e.g. `ap-guangzhou`) |
| Secret | `CDN_PURGE_URLS` | Optional comma-separated URLs to log after sync |
| **Variable** | `COS_SITE_PREFIX` | Optional; object prefix under bucket (default `site`) |
| **Variable** | `CDN_DOMAIN` | Optional hostname; used to derive purge URL hints when `CDN_PURGE_URLS` is unset |

**CDN purge:** The sync script only **logs** recommended purge URLs (from `CDN_PURGE_URLS` or derived from `CDN_DOMAIN`). Operators refresh CDN cache manually in the console until automated Tencent CDN API purge is implemented.

**Stale objects:** Sync uploads and overwrites keys present in `dist/`; it does **not** delete COS objects removed from the site. Prune/lifecycle for deleted paths is deferred.

## 7. Alarms

- CDN traffic: alert around **5 GB/month**.
- COS storage: alert around **1 GB**.

## 8. Rollback

- Point DNS / CNAME back to **GitHub Pages**.
- COS `site/` remains as a stale mirror until the next successful sync; versioning supports object-level recovery if needed.

## Local sync

```bash
export COS_SECRET_ID=… COS_SECRET_KEY=… COS_BUCKET=… COS_REGION=…
npm run build
npm run sync:cos
```

Without credentials the script exits non-zero (`Missing COS_BUCKET`, etc.) and does not upload. Sync does not remove objects that no longer exist in `dist/`.

## 9. Browser vault client (Vite public env)

The encrypted vault transport reads **public** build-time variables (no secrets in the bundle). Set these in `.env` / CI when building a COS-backed vault:

| Variable | Purpose |
|----------|---------|
| `VITE_COS_BUCKET` | COS bucket name (same bucket as site sync; objects under `vault/` prefix) |
| `VITE_COS_REGION` | Region (e.g. `ap-guangzhou`) |
| `VITE_STS_ISSUER_URL` | HTTPS endpoint that mints short-lived STS credentials for browser `PutObject` / `GetObject` on `vault/*` |

`cosConfig.ts` maps these to `COS_VAULT_CONFIG` (`vaultPrefix` is fixed to `vault`). STS issuance and CAM scoping for `vault/*` are separate from the CI site-sync CAM user in section 3.

## 10. SCF STS issuer (`scf/sts-issuer`)

Browser clients POST `{ "gate": "<sync gate>" }` to `VITE_STS_ISSUER_URL` and receive short-lived COS credentials scoped to `vault/*` only.

### CAM for STS parent keys

Create a CAM user (or use a sub-account) whose API keys are stored **only** in SCF environment variables—not in GitHub or the static site bundle:

- Allow `sts:AssumeRole` / `sts:GetFederationToken` as required by `qcloud-cos-sts` for the configured policy (see Tencent STS docs for your account).
- The inline policy in `index.js` allows only `cos:GetObject`, `cos:PutObject`, `cos:HeadObject` on the `STS_RESOURCE` ARN below.

### Build and deploy

```bash
cd scf/sts-issuer
npm install --omit=dev
zip -r ../sts-issuer.zip index.js node_modules package.json
```

Upload `scf/sts-issuer.zip` to a **Node.js** SCF function (handler `index.main_handler`). Expose via **API Gateway** (POST) or **Function URL**; set `VITE_STS_ISSUER_URL` to that HTTPS URL.

### SCF environment variables

| Variable | Purpose |
|----------|---------|
| `STS_GATE` | Shared sync gate secret; must match the value users enter in the vault UI |
| `COS_SECRET_ID` | Parent CAM SecretId for STS |
| `COS_SECRET_KEY` | Parent CAM SecretKey |
| `STS_RESOURCE` | Full CAM resource ARN for `vault/*`, e.g. `qcs::cos:ap-guangzhou:uid/<APPID>:<bucket>/vault/*` |
| `CORS_ORIGIN` | Site origin allowed by CORS (e.g. `https://your.cdn.domain`); use `*` only for smoke tests |

### Responses

| Status | Body | Meaning |
|--------|------|---------|
| 200 | `{ secretId, secretKey, sessionToken, startTime, expiredTime }` | Temp creds (30 min default) |
| 401 | `{ "error": "gate" }` | Wrong or missing gate |
| 429 | `{ "error": "rate" }` | Per-IP in-memory rate limit (resets per instance) |

After deploy, verify with curl (replace URL and gate):

```bash
curl -sS -X POST "$STS_ISSUER_URL" -H 'Content-Type: application/json' -d '{"gate":"YOUR_GATE"}'
```
