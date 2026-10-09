// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyKeys } from './prompt.ts'

describe('applyKeys', () => {
  it('appends typed and pasted text', () => {
    expect(applyKeys('ab', 'c 冰岛')).toEqual({ value: 'abc 冰岛', done: null })
  })

  it('finishes on Enter and ignores anything after it', () => {
    expect(applyKeys('ab', 'c\rxyz')).toEqual({ value: 'abc', done: 'enter' })
    expect(applyKeys('ab', '\n')).toEqual({ value: 'ab', done: 'enter' })
  })

  it('cancels on Ctrl+C', () => {
    expect(applyKeys('ab', '\u0003')).toEqual({ value: 'ab', done: 'cancel' })
  })

  it('deletes one character per Backspace, including Chinese and emoji', () => {
    expect(applyKeys('冰岛😀', '\u007f')).toEqual({ value: '冰岛', done: null })
    expect(applyKeys('ab', '\b\b\b')).toEqual({ value: '', done: null })
  })

  it('ignores control characters, Ctrl+D and escape sequences', () => {
    expect(applyKeys('ab', '\u0004\t\u0001c')).toEqual({ value: 'abc', done: null })
    expect(applyKeys('ab', '\u001b[A')).toEqual({ value: 'ab', done: null })
    expect(applyKeys('ab', '\u001b')).toEqual({ value: 'ab', done: null })
  })
})
