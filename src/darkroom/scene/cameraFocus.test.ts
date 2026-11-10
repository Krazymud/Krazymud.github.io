import { describe, expect, it } from 'vitest'
import { anchorForFocus } from './cameraFocus'

describe('anchorForFocus', () => {
  it('desk is above the table', () => {
    expect(anchorForFocus('desk').position[1]).toBeGreaterThan(0)
  })
  it('props have distinct anchors', () => {
    expect(anchorForFocus('envelope')).not.toEqual(anchorForFocus('rolls'))
  })
})
