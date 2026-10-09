import { askHidden } from './lib/prompt.ts'
import { runRekey } from './lib/vaultCommand.ts'
import { VaultError } from './lib/vaultSource.ts'

const OUT_DIR = 'public/vault'

try {
  const oldPassphrase = await askHidden('现在的口令：')
  const newPassphrase = await askHidden('新口令：')
  if ((await askHidden('再输入一遍新口令：')) !== newPassphrase) throw new VaultError('两次输入的新口令不一样')
  const { undeleted } = await runRekey({ outDir: OUT_DIR, oldPassphrase, newPassphrase })
  console.log('口令已更换，内容已用新密钥重新加密。旧口令和所有记住过的设备都不能再打开保险库。')
  if (undeleted.length > 0) {
    console.warn(`警告：${undeleted.length} 个旧密文文件没能删除（下次运行 npm run vault 时会自动清理）：`)
    for (const name of undeleted) console.warn(`  ${OUT_DIR}/${name}`)
  }
  console.log('提交并推送整个 public/vault 后网站才会更新。')
  console.log('注意：已经推送到 git 历史里的旧版本，仍然可以用旧口令打开。')
} catch (error) {
  if (!(error instanceof VaultError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
