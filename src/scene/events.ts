type Listener = () => void

function notify(listeners: Set<Listener>): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[events]', error)
    }
  }
}

const nitroListeners = new Set<Listener>()

export function emitNitro(): void {
  notify(nitroListeners)
}

export function onNitro(listener: Listener): () => void {
  nitroListeners.add(listener)
  return () => {
    nitroListeners.delete(listener)
  }
}
