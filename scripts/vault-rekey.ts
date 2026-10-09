import { askHidden } from './lib/prompt.ts'
import { runRekey } from './lib/vaultCommand.ts'
import { VaultError } from './lib/vaultSource.ts'

const OUT_DIR = 'public/vault'

try {
  const oldPassphrase = await askHidden('现在的口令：')
  const newPassphrase = await askHidden('新口令：')
  if ((await askHidden('再输入一遍新口令：')) !== newPassphrase) throw new VaultError('两次输入的新口令不一样')
  await runRekey({ outDir: OUT_DIR, oldPassphrase, newPassphrase })
  console.log('口令已更换。提交并推送 public/vault/vault.json 后生效。')
} catch (error) {
  if (!(error instanceof VaultError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
