import { createContext, useContext, useEffect } from 'react'

export const ImmersiveContext = createContext<(active: boolean) => void>(() => undefined)

/** Full-screen pages call this so the shell hides its header while they are showing. */
export function useImmersive(active: boolean) {
  const setImmersive = useContext(ImmersiveContext)
  useEffect(() => {
    if (!active) return
    setImmersive(true)
    return () => setImmersive(false)
  }, [active, setImmersive])
}
