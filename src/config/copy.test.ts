import { describe, expect, it } from 'vitest'
import { copy } from './copy'

describe('copy', () => {
  it('exposes 青庐 naming and greetings', () => {
    expect(copy.siteName).toBe('青庐')
    expect(copy.nav).toEqual({ home: '青庐', trial: '日课', vault: '锦匣', settings: '案头' })
    expect(copy.home.eyebrow).toBe('又见')
    expect(copy.home.hello('婉婉儿')).toBe('婉婉儿，安')
    expect(copy.home.together(3)).toBe('相伴第 3 天')
    expect(copy.vault.unseal).toBe('启封')
  })
})
