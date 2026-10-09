export function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process
  if (!stdin.isTTY) {
    return Promise.reject(new Error('请在交互式终端里直接运行，口令不能通过管道或参数传入'))
  }
  stdout.write(question)
  stdin.setRawMode(true)
  stdin.setEncoding('utf8')
  stdin.resume()

  return new Promise((resolve, reject) => {
    let value = ''
    const finish = () => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\n')
    }
    function onData(chunk: string) {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          finish()
          resolve(value)
          return
        }
        if (ch === '\u0003') {
          finish()
          reject(new Error('已取消'))
          return
        }
        if (ch === '\u007f' || ch === '\b') {
          value = [...value].slice(0, -1).join('')
          continue
        }
        value += ch
      }
    }
    stdin.on('data', onData)
  })
}
