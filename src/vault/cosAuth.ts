export type CosCreds = { secretId: string; secretKey: string; sessionToken?: string }

const ALGORITHM = 'AWS4-HMAC-SHA256'
const COS_SERVICE = 'cos'
const EMPTY_PAYLOAD_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const textEncoder = new TextEncoder()

export type SignedCosRequestOptions = {
  method: string
  bucket: string
  region: string
  key: string
  creds: CosCreds
  headers?: Record<string, string>
  body?: Uint8Array | string
  query?: Record<string, string>
  /** Fixed clock for deterministic tests */
  signingTime?: Date
}

export function cosObjectUrl(bucket: string, region: string, key: string): string {
  const path = key.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  return `https://${bucket}.cos.${region}.myqcloud.com/${path}`
}

export async function signedCosRequest(
  options: SignedCosRequestOptions,
): Promise<{ url: string; headers: Headers }> {
  const {
    method,
    bucket,
    region,
    key,
    creds,
    headers: extraHeaders = {},
    body,
    query = {},
    signingTime = new Date(),
  } = options

  const host = `${bucket}.cos.${region}.myqcloud.com`
  const amzDate = formatAmzDate(signingTime)
  const dateStamp = amzDate.slice(0, 8)

  const bodyBytes = body === undefined ? undefined : toBytes(body)
  const payloadHash =
    bodyBytes === undefined ? EMPTY_PAYLOAD_HASH : await sha256Hex(bodyBytes)

  const headerMap: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...normalizeHeaderKeys(extraHeaders),
  }
  if (creds.sessionToken) {
    headerMap['x-cos-security-token'] = creds.sessionToken
  }

  const canonicalUri = canonicalObjectPath(key)
  const canonicalQuery = canonicalQueryString(query)
  const { canonicalHeaders, signedHeaders } = canonicalHeaderBlock(headerMap)

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${COS_SERVICE}/aws4_request`
  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = await deriveSigningKey(creds.secretKey, dateStamp, region, COS_SERVICE)
  const signature = hex(await hmacSha256(signingKey, stringToSign))

  const authorization = `${ALGORITHM} Credential=${creds.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const outHeaders = new Headers()
  for (const [name, value] of Object.entries(headerMap)) {
    if (name === 'host') continue
    outHeaders.set(name, value)
  }
  outHeaders.set('Authorization', authorization)

  const url = appendQuery(cosObjectUrl(bucket, region, key), query)

  return { url, headers: outHeaders }
}

function normalizeHeaderKeys(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    out[name.toLowerCase()] = value
  }
  return out
}

function canonicalObjectPath(key: string): string {
  if (!key) return '/'
  const segments = key.split('/').map((segment) => uriEncode(segment))
  return `/${segments.join('/')}`
}

function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function canonicalQueryString(query: Record<string, string>): string {
  const pairs = Object.keys(query)
    .sort()
    .map((key) => `${uriEncode(key)}=${uriEncode(query[key] ?? '')}`)
  return pairs.join('&')
}

function appendQuery(url: string, query: Record<string, string>): string {
  const qs = canonicalQueryString(query)
  return qs ? `${url}?${qs}` : url
}

function canonicalHeaderBlock(headers: Record<string, string>): {
  canonicalHeaders: string
  signedHeaders: string
} {
  const names = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort()
  const lines = names.map((name) => `${name}:${trimHeaderValue(headers[name])}`)
  return {
    canonicalHeaders: `${lines.join('\n')}\n`,
    signedHeaders: names.join(';'),
  }
}

function trimHeaderValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function formatAmzDate(date: Date): string {
  const iso = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return iso
}

function toBytes(data: string | Uint8Array): Uint8Array {
  return typeof data === 'string' ? textEncoder.encode(data) : data
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toBytes(data))
  return hex(new Uint8Array(digest))
}

async function hmacSha256(key: Uint8Array | string, data: string | Uint8Array): Promise<Uint8Array> {
  const keyBytes = typeof key === 'string' ? textEncoder.encode(key) : key
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, toBytes(data))
  return new Uint8Array(signature)
}

async function deriveSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<Uint8Array> {
  const kDate = await hmacSha256(textEncoder.encode(`AWS4${secretKey}`), dateStamp)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}
