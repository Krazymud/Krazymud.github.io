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

function jsonResponse(statusCode, body, extraHeaders = {}) {
  const cors = process.env.CORS_ORIGIN || '*'
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': cors,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  }
}

exports.main_handler = async (event) => {
  const method =
    event.httpMethod || event.requestContext?.http?.method || event.method || 'POST'
  if (method === 'OPTIONS') {
    const cors = process.env.CORS_ORIGIN || '*'
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': cors,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    }
  }

  let body
  try {
    body =
      typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {}
  } catch {
    return jsonResponse(400, { error: 'body' })
  }

  if (body.gate !== process.env.STS_GATE) {
    return jsonResponse(401, { error: 'gate' })
  }

  const ip = clientIp(event)
  if (rateLimited(ip)) {
    return jsonResponse(429, { error: 'rate' })
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
    return jsonResponse(500, { error: 'sts' })
  }

  return jsonResponse(200, {
    secretId: credential.credentials.tmpSecretId,
    secretKey: credential.credentials.tmpSecretKey,
    sessionToken: credential.credentials.sessionToken,
    startTime: credential.startTime,
    expiredTime: credential.expiredTime,
  })
}
