import { describe, expect, it } from 'vitest'
import { cosObjectUrl, signedCosRequest } from './cosAuth'

const fixtureCreds = {
  secretId: 'AKIDEXAMPLE',
  secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
}
const fixtureTime = new Date('2020-03-01T00:00:00.000Z')

describe('cosObjectUrl', () => {
  it('builds the virtual-host style URL', () => {
    expect(cosObjectUrl('mybucket-1250000000', 'ap-guangzhou', 'vault/vault.json')).toBe(
      'https://mybucket-1250000000.cos.ap-guangzhou.myqcloud.com/vault/vault.json',
    )
  })
})

describe('signedCosRequest', () => {
  it('signs GET with a deterministic Authorization header', async () => {
    const { url, headers } = await signedCosRequest({
      method: 'GET',
      bucket: 'mybucket-1250000000',
      region: 'ap-guangzhou',
      key: 'vault/vault.json',
      creds: fixtureCreds,
      signingTime: fixtureTime,
    })

    expect(url).toBe(
      'https://mybucket-1250000000.cos.ap-guangzhou.myqcloud.com/vault/vault.json',
    )
    expect(headers.get('x-amz-date')).toBe('20200301T000000Z')
    expect(headers.get('x-amz-content-sha256')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(headers.get('Authorization')).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20200301/ap-guangzhou/cos/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=f67a1d01de34119fd76e97ff17aaa2024b42e9c54ffa81fd14db530f155a7c24',
    )
  })

  it('signs PUT with payload hash and extra headers', async () => {
    const { headers } = await signedCosRequest({
      method: 'PUT',
      bucket: 'mybucket-1250000000',
      region: 'ap-guangzhou',
      key: 'vault/vault.json',
      creds: fixtureCreds,
      body: 'hello',
      headers: { 'content-type': 'application/json' },
      signingTime: fixtureTime,
    })

    expect(headers.get('x-amz-content-sha256')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('Authorization')).toMatch(/^AWS4-HMAC-SHA256 /)
  })

  it('signs HEAD like an empty-body read', async () => {
    const get = await signedCosRequest({
      method: 'GET',
      bucket: 'mybucket-1250000000',
      region: 'ap-guangzhou',
      key: 'vault/vault.json',
      creds: fixtureCreds,
      signingTime: fixtureTime,
    })
    const head = await signedCosRequest({
      method: 'HEAD',
      bucket: 'mybucket-1250000000',
      region: 'ap-guangzhou',
      key: 'vault/vault.json',
      creds: fixtureCreds,
      signingTime: fixtureTime,
    })

    expect(head.headers.get('Authorization')).not.toBe(get.headers.get('Authorization'))
    expect(head.headers.get('x-amz-content-sha256')).toBe(get.headers.get('x-amz-content-sha256'))
  })

  it('includes x-cos-security-token when session credentials are used', async () => {
    const { headers } = await signedCosRequest({
      method: 'GET',
      bucket: 'mybucket-1250000000',
      region: 'ap-guangzhou',
      key: 'vault/vault.json',
      creds: { ...fixtureCreds, sessionToken: 'session-token-abc' },
      signingTime: fixtureTime,
    })

    expect(headers.get('x-cos-security-token')).toBe('session-token-abc')
    expect(headers.get('Authorization')).toContain('SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-cos-security-token')
  })
})
