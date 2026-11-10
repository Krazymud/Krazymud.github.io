import { UnlockPanel } from '../../vault/components/UnlockPanel'

interface UnlockGateProps {
  canRemember: boolean
  onUnlock: (passphrase: string, remember: boolean) => Promise<boolean>
}

export function UnlockGate(props: UnlockGateProps) {
  return (
    <main className="mx-auto w-full max-w-md px-4">
      <UnlockPanel {...props} />
    </main>
  )
}
