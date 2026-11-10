import { describe, expect, it } from 'vitest'
import { copy } from './copy'

describe('copy', () => {
  it('exposes 暗房 naming without 青庐 chrome', () => {
    expect(copy.siteName).toBe('暗房')
    expect(copy.nav).toEqual({ home: '暗房', unlock: '启封', lock: '锁上' })
    expect(JSON.stringify(copy)).not.toMatch(/青庐|日课|锦匣|案头/)
  })

  it('exposes letter and reel CTA strings', () => {
    expect(copy.darkroom.reelContinue).toBe('继续')
    expect(copy.darkroom.reelSkip).toBe('略过')
    expect(copy.darkroom.letterBlankNote).toBe('空白信纸')
    expect(copy.darkroom.letterStampNote).toBe('来信')
  })
})
