import { UnlockPanel } from '../../vault/components/UnlockPanel'

interface UnlockGateProps {
  canRemember: boolean
  onUnlock: (passphrase: string, remember: boolean) => Promise<boolean>
}

/** Full-bleed cinematic unlock — first viewport matches darkroom title card, not a light form. */
export function UnlockGate(props: UnlockGateProps) {
  return <UnlockPanel {...props} />
}
