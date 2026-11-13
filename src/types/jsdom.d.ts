declare module 'jsdom' {
  import type { Context } from 'node:vm'

  export class JSDOM {
    readonly window: Window & typeof globalThis
    constructor(html?: string, options?: { url?: string; runScripts?: 'dangerously' | 'outside-only' })
    getInternalVMContext(): Context
    close(): void
  }
}
