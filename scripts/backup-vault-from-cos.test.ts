import { describe, expect, it } from 'vitest'
import { parseListObjectsXml } from './backup-vault-from-cos.ts'

describe('parseListObjectsXml', () => {
  it('extracts keys and pagination marker', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Contents><Key>vault/vault.json</Key></Contents>
  <Contents><Key>vault/blobs/abc.bin</Key></Contents>
  <IsTruncated>true</IsTruncated>
  <NextMarker>vault/blobs/abc.bin</NextMarker>
</ListBucketResult>`
    const page = parseListObjectsXml(xml)
    expect(page.keys).toEqual(['vault/vault.json', 'vault/blobs/abc.bin'])
    expect(page.truncated).toBe(true)
    expect(page.nextMarker).toBe('vault/blobs/abc.bin')
  })

  it('handles empty listing', () => {
    const page = parseListObjectsXml('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>')
    expect(page.keys).toEqual([])
    expect(page.truncated).toBe(false)
  })
})
