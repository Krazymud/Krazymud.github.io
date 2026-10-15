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

## 6. GitHub Actions secrets

| Secret            | Purpose                                      |
|-------------------|----------------------------------------------|
| `COS_SECRET_ID`   | CAM SecretId for site sync                   |
| `COS_SECRET_KEY`  | CAM SecretKey for site sync                  |
| `COS_BUCKET`      | Bucket name                                  |
| `COS_REGION`      | Bucket region (e.g. `ap-guangzhou`)        |
| `CDN_PURGE_URLS`  | Optional comma-separated URLs to refresh after deploy |
| (optional)        | Tencent CDN API credentials if automating purge beyond `CDN_PURGE_URLS` |

Optional workflow env (not always secrets): `COS_SITE_PREFIX` (default `site`), `CDN_DOMAIN` (used to derive purge URLs when `CDN_PURGE_URLS` is unset).

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

Without credentials the script exits non-zero and does not upload.
