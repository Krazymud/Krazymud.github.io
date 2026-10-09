type Listener = () => void

const nitroListeners = new Set<Listener>()

export function emitNitro(): void {
  for (const listener of nitroListeners) listener()
}

export function onNitro(listener: Listener): () => void {
  nitroListeners.add(listener)
  return () => {
    nitroListeners.delete(listener)
  }
}
