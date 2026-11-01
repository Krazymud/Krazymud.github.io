const STS = require('qcloud-cos-sts')

/** @type {Map<string, { count: number; windowStart: number }>} */
const rateByIp = new Map()

const RATE_WINDOW_MS = 60_000
const RATE_MAX_PER_WINDOW = 30

function clientIp(event) {
  const headers = event.headers || event.headerParameters || {}
  const forwarded =
    headers['x-forwarded-for'] ||
    headers['X-Forwarded-For'] ||
    headers['x-real-ip'] ||
    headers['X-Real-Ip']
  if (forwarded) {
    return String(forwarded).split(',')[0].trim()
  }
  const ctx = event.requestContext || {}
  return ctx.sourceIp || ctx.identity?.sourceIp || 'unknown'
}

function rateLimited(ip) {
  const now = Date.now()
  let entry = rateByIp.get(ip)
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    entry = { count: 0, windowStart: now }
    rateByIp.set(ip, entry)
  }
  entry.count += 1
  return entry.count > RATE_MAX_PER_WINDOW
}

function requestOrigin(event) {
  const headers = event.headers || event.headerParameters || {}
  return headers.origin || headers.Origin || ''
}

/** CORS_ORIGIN: `*`, one origin, or comma-separated allowlist. */
function corsHeaders(event) {
  const configured = (process.env.CORS_ORIGIN || '*').trim()
  const origin = String(requestOrigin(event) || '')
  let allow = configured
  if (configured !== '*') {
    const allowed = configured.split(',').map((part) => part.trim()).filter(Boolean)
    allow = allowed.includes(origin) ? origin : allowed[0] || '*'
  }
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function jsonResponse(event, statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(event),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  }
}

exports.main_handler = async (event) => {
  const method =
    event.httpMethod || event.requestContext?.http?.method || event.method || 'POST'
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(event),
      body: '',
    }
  }

  let body
  try {
    body =
      typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {}
  } catch {
    return jsonResponse(event, 400, { error: 'body' })
  }

  if (body.gate !== process.env.STS_GATE) {
    return jsonResponse(event, 401, { error: 'gate' })
  }

  const ip = clientIp(event)
  if (rateLimited(ip)) {
    return jsonResponse(event, 429, { error: 'rate' })
  }

  let credential
  try {
    credential = await new Promise((resolve, reject) => {
      STS.getCredential(
        {
          secretId: process.env.COS_SECRET_ID,
          secretKey: process.env.COS_SECRET_KEY,
          durationSeconds: 1800,
          policy: {
            version: '2.0',
            statement: [
              {
                action: [
                  'name/cos:GetObject',
                  'name/cos:PutObject',
                  'name/cos:HeadObject',
                ],
                effect: 'allow',
                resource: [process.env.STS_RESOURCE],
              },
            ],
          },
        },
        (err, data) => (err ? reject(err) : resolve(data)),
      )
    })
  } catch {
    return jsonResponse(event, 500, { error: 'sts' })
  }

  return jsonResponse(event, 200, {
    secretId: credential.credentials.tmpSecretId,
    secretKey: credential.credentials.tmpSecretKey,
    sessionToken: credential.credentials.sessionToken,
    startTime: credential.startTime,
    expiredTime: credential.expiredTime,
  })
}
