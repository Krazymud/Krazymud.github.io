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

const ignitionListeners = new Set<Listener>()
let ignitionPending = false

export function setIgnitionPending(pending: boolean): void {
  ignitionPending = pending
}

export function isIgnitionPending(): boolean {
  return ignitionPending
}

export function emitIgnition(): void {
  ignitionPending = false
  for (const listener of ignitionListeners) listener()
}

export function onIgnition(listener: Listener): () => void {
  ignitionListeners.add(listener)
  return () => {
    ignitionListeners.delete(listener)
  }
}
