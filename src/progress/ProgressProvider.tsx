import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { emptyProgress, getStorage, loadProgress, saveProgress, type ProgressData } from './store'

interface ProgressContextValue {
  data: ProgressData
  update: (fn: (data: ProgressData) => ProgressData) => void
  saveFailed: boolean
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [storage] = useState(getStorage)
  const [data, setData] = useState(() => (storage ? loadProgress(storage) : emptyProgress()))
  const [saveFailed, setSaveFailed] = useState(storage === null)

  useEffect(() => {
    setSaveFailed(!(storage && saveProgress(storage, data)))
  }, [storage, data])

  const value = useMemo(() => ({ data, update: setData, saveFailed }), [data, saveFailed])
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext)
  if (!value) throw new Error('useProgress must be used inside ProgressProvider')
  return value
}
