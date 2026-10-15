import { useEffect, useState } from 'react'

export type ReadBlob = (name: string) => Promise<Uint8Array<ArrayBuffer>>

export type BlobUrl = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'failed' }
export type BlobText = { status: 'loading' } | { status: 'ready'; text: string } | { status: 'failed' }

const LOADING = { status: 'loading' } as const

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

// Photos added on Safari are PNG (it cannot encode webp) while the manifest carries no format.
function contentType(bytes: Uint8Array, requested: string): string {
  if (!requested.startsWith('image/')) return requested
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b) ? 'image/png' : requested
}

export function useBlobUrl(name: string, read: ReadBlob, type: string): BlobUrl {
  const [result, setResult] = useState<{ name: string; value: BlobUrl }>({ name, value: LOADING })

  useEffect(() => {
    let alive = true
    let url: string | null = null
    read(name).then(
      (bytes) => {
        if (!alive) return
        url = URL.createObjectURL(new Blob([bytes], { type: contentType(bytes, type) }))
        setResult({ name, value: { status: 'ready', url } })
      },
      () => alive && setResult({ name, value: { status: 'failed' } }),
    )
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [name, read, type])

  return result.name === name ? result.value : LOADING
}

export function useBlobText(name: string, read: ReadBlob): BlobText {
  const [result, setResult] = useState<{ name: string; value: BlobText }>({ name, value: LOADING })

  useEffect(() => {
    let alive = true
    read(name).then(
      (bytes) => alive && setResult({ name, value: { status: 'ready', text: new TextDecoder().decode(bytes) } }),
      () => alive && setResult({ name, value: { status: 'failed' } }),
    )
    return () => {
      alive = false
    }
  }, [name, read])

  return result.name === name ? result.value : LOADING
}
