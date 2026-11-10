import { useEffect, useState } from 'react'
import { useDarkroomVault } from '../VaultBridge'

export function useBlobUrl(name: string | null, type = 'image/jpeg'): string | null {
  const { readBlob } = useDarkroomVault()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!name) return
    let alive = true
    let created: string | null = null
    readBlob(name).then(
      (bytes) => {
        if (!alive) return
        created = URL.createObjectURL(new Blob([bytes as BlobPart], { type }))
        setUrl(created)
      },
      () => undefined,
    )
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
      setUrl(null)
    }
  }, [name, readBlob, type])
  return url
}
