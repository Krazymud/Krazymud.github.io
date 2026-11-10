import { copy } from '../../config/copy'
import { needsGate, type EditGate } from '../mutateCopy'

export function EditNotice({ message, gate, onNeedGate }: { message: string | null; gate: EditGate; onNeedGate?: () => void }) {
  if (!message) return null
  return (
    <p data-testid="edit-blocked" className="dr-panel dr-warn mb-2 flex flex-wrap items-center gap-2 px-2 py-2 text-xs">
      {message}
      {needsGate(gate) && onNeedGate && (
        <button type="button" onClick={onNeedGate} className="dr-btn px-2 py-1">
          {copy.darkroom.openSync}
        </button>
      )}
    </p>
  )
}
