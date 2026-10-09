import { askHidden } from './lib/prompt.ts'
import { runVault, SIZE_WARNING_BYTES, vaultExists } from './lib/vaultCommand.ts'
import { VaultError } from './lib/vaultSource.ts'

const SOURCE_DIR = 'vault-src'
const OUT_DIR = 'public/vault'

try {
  let passphrase: string
  if (vaultExists(OUT_DIR)) {
    passphrase = await askHidden('保险库口令：')
  } else {
    console.log('第一次创建保险库。口令至少 16 个字符（空格也算，连续的空格算一个）。')
    passphrase = await askHidden('设置口令：')
    if ((await askHidden('再输入一遍：')) !== passphrase) throw new VaultError('两次输入的口令不一样')
  }

  const result = await runVault({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, passphrase, log: (line) => console.log(line) })
  console.log(`照片 ${result.photos} 张，笔记 ${result.notes} 篇，清单 ${result.lists} 个`)
  console.log(
    `新写入 ${result.written} 个密文文件，删除 ${result.removed} 个；${OUT_DIR} 共 ${(result.totalBytes / 1024 / 1024).toFixed(1)} MB`,
  )
  if (result.totalBytes > SIZE_WARNING_BYTES) {
    console.warn('警告：保险库超过 300 MB。GitHub Pages 站点上限约 1 GB，考虑删减照片。')
  }
} catch (error) {
  if (!(error instanceof VaultError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
