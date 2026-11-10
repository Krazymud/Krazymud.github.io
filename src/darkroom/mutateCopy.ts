import { copy } from '../config/copy'
import type { MutateResult } from './VaultBridge'

export type EditGate = {
  canEdit: boolean
  tokenSaved: boolean
  tokenError: string | null
  syncing: boolean
  loading: boolean
}

/** Why editing is unavailable right now, or null when it is allowed. */
export function editBlockedMessage(gate: EditGate): string | null {
  if (gate.canEdit) return null
  if (gate.loading) return copy.darkroom.preparing
  if (!gate.tokenSaved) return copy.darkroom.needGate
  if (gate.tokenError) return copy.darkroom.gateDenied
  if (gate.syncing) return copy.darkroom.busy
  return copy.darkroom.preparing
}

/** True when the fix is to fill in (or re-enter) the sync gate in the drawer. */
export function needsGate(gate: EditGate): boolean {
  return !gate.canEdit && !gate.loading && (!gate.tokenSaved || gate.tokenError !== null)
}

export function failureMessage(result: Extract<MutateResult, { ok: false }>, gate: EditGate): string {
  if (gate.tokenError) return copy.darkroom.gateDenied
  switch (result.reason) {
    case 'locked':
      return editBlockedMessage({ ...gate, canEdit: false }) ?? copy.darkroom.needGate
    case 'blob':
      return copy.darkroom.blobFailed
    case 'title':
      return copy.darkroom.badTitle
    case 'date':
      return copy.darkroom.badDate
    default:
      return copy.darkroom.saveFailed
  }
}

export function gateOf(vault: {
  canEdit: boolean
  tokenSaved: boolean
  tokenError: string | null
  syncing: boolean
  loading: boolean
}): EditGate {
  return {
    canEdit: vault.canEdit,
    tokenSaved: vault.tokenSaved,
    tokenError: vault.tokenError,
    syncing: vault.syncing,
    loading: vault.loading,
  }
}
