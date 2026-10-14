import { describe, expect, it } from 'vitest'
import { sceneFor } from './poses'

describe('sceneFor', () => {
  it('maps routes to scene keys', () => {
    expect(sceneFor('/')).toBe('garage')
    expect(sceneFor('/vault')).toBe('vault')
    expect(sceneFor('/trial')).toBe('track')
    expect(sceneFor('/settings')).toBe('settings')
    expect(sceneFor('/vault/extra')).toBe('vault')
  })
})
