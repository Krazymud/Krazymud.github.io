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

// Pages / GitHub Contents can miss a just-committed blob once; stick on failed forever after that.
const READ_RETRY_DELAYS_MS = [0, 200, 500]

export function useBlobUrl(name: string, read: ReadBlob, type: string): BlobUrl {
  const [result, setResult] = useState<{ name: string; value: BlobUrl }>({ name, value: LOADING })

  useEffect(() => {
    let alive = true
    let url: string | null = null
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = () => {
      read(name).then(
        (bytes) => {
          if (!alive) return
          url = URL.createObjectURL(new Blob([bytes], { type: contentType(bytes, type) }))
          setResult({ name, value: { status: 'ready', url } })
        },
        () => {
          if (!alive) return
          attempt += 1
          if (attempt < READ_RETRY_DELAYS_MS.length) {
            timer = setTimeout(run, READ_RETRY_DELAYS_MS[attempt])
            return
          }
          setResult({ name, value: { status: 'failed' } })
        },
      )
    }
    timer = setTimeout(run, READ_RETRY_DELAYS_MS[0])

    return () => {
      alive = false
      if (timer !== undefined) clearTimeout(timer)
      if (url) URL.revokeObjectURL(url)
    }
  }, [name, read, type])

  return result.name === name ? result.value : LOADING
}

export function useBlobText(name: string, read: ReadBlob): BlobText {
  const [result, setResult] = useState<{ name: string; value: BlobText }>({ name, value: LOADING })

  useEffect(() => {
    let alive = true
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = () => {
      read(name).then(
        (bytes) => alive && setResult({ name, value: { status: 'ready', text: new TextDecoder().decode(bytes) } }),
        () => {
          if (!alive) return
          attempt += 1
          if (attempt < READ_RETRY_DELAYS_MS.length) {
            timer = setTimeout(run, READ_RETRY_DELAYS_MS[attempt])
            return
          }
          setResult({ name, value: { status: 'failed' } })
        },
      )
    }
    timer = setTimeout(run, READ_RETRY_DELAYS_MS[0])

    return () => {
      alive = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [name, read])

  return result.name === name ? result.value : LOADING
}
