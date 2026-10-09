import { VaultError } from './vaultSource.ts'

export interface KeysResult {
  value: string
  done: 'enter' | 'cancel' | null
}

export function applyKeys(value: string, chunk: string): KeysResult {
  // Arrow keys and other escape sequences arrive as one chunk starting with ESC.
  if (chunk.startsWith('\u001b')) return { value, done: null }
  for (const ch of chunk) {
    if (ch === '\r' || ch === '\n') return { value, done: 'enter' }
    if (ch === '\u0003') return { value, done: 'cancel' }
    if (ch === '\u007f' || ch === '\b') {
      value = [...value].slice(0, -1).join('')
      continue
    }
    if (ch < ' ') continue
    value += ch
  }
  return { value, done: null }
}

export function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process
  if (!stdin.isTTY) {
    return Promise.reject(new VaultError('请在交互式终端里直接运行，口令不能通过管道或参数传入'))
  }
  stdout.write(question)
  stdin.setRawMode(true)
  stdin.setEncoding('utf8')
  stdin.resume()

  return new Promise((resolve, reject) => {
    let value = ''
    const finish = () => {
      stdin.off('data', onData)
      stdin.off('end', onClosed)
      stdin.off('error', onClosed)
      try {
        stdin.setRawMode(false)
      } catch {
        // stdin may already be closed after 'end' or 'error'.
      }
      stdin.pause()
      stdout.write('\n')
    }
    function onData(chunk: string) {
      const result = applyKeys(value, chunk)
      value = result.value
      if (result.done === 'enter') {
        finish()
        resolve(value)
      } else if (result.done === 'cancel') {
        finish()
        reject(new VaultError('已取消'))
      }
    }
    function onClosed() {
      finish()
      reject(new VaultError('输入在按回车之前就结束了'))
    }
    stdin.on('data', onData)
    stdin.on('end', onClosed)
    stdin.on('error', onClosed)
  })
}
