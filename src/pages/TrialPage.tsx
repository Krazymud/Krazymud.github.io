import { LoadError } from '../trial/components/LoadError'
import { TrialScreen } from '../trial/TrialScreen'
import { useWordSource } from '../trial/useWordSource'

export function TrialPage() {
  const { state, retry } = useWordSource()
  if (state.status === 'loading') return <p className="text-center text-sm text-muted">正在加载词库…</p>
  if (state.status === 'error') return <LoadError onRetry={retry} />
  return <TrialScreen source={state.source} />
}
