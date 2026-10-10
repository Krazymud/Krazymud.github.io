import { describe, expect, it } from 'vitest'
import { DragTracker, inCarBand, isInteractive } from './drag'

describe('DragTracker', () => {
  it('locks onto a horizontal drag and reports each step', () => {
    const tracker = new DragTracker()
    tracker.start(100, 300)
    expect(tracker.move(104, 301)).toBeNull()
    expect(tracker.move(120, 302)).toBe(20)
    expect(tracker.state).toBe('dragging')
    expect(tracker.move(130, 340)).toBe(10)
    expect(tracker.end()).toBe(true)
    expect(tracker.state).toBe('idle')
  })

  it('lets a vertical swipe scroll the page', () => {
    const tracker = new DragTracker()
    tracker.start(100, 300)
    expect(tracker.move(103, 320)).toBeNull()
    expect(tracker.state).toBe('idle')
    expect(tracker.move(200, 320)).toBeNull()
    expect(tracker.end()).toBe(false)
  })
})

describe('inCarBand', () => {
  it('accepts only the middle half of the screen', () => {
    expect(inCarBand(100, 800)).toBe(false)
    expect(inCarBand(400, 800)).toBe(true)
    expect(inCarBand(700, 800)).toBe(false)
  })
})

describe('isInteractive', () => {
  it('spots buttons, links and form controls, including their children', () => {
    document.body.innerHTML = '<a href="/x"><span id="inner">go</span></a><p id="text">hi</p><button id="b">b</button>'
    expect(isInteractive(document.getElementById('inner'))).toBe(true)
    expect(isInteractive(document.getElementById('b'))).toBe(true)
    expect(isInteractive(document.getElementById('text'))).toBe(false)
    expect(isInteractive(null)).toBe(false)
  })

  it('spots disclosure summaries, ARIA links and buttons, and focusable elements', () => {
    document.body.innerHTML = [
      '<details><summary id="summary">more</summary></details>',
      '<div role="link" id="link">go</div>',
      '<div role="button" id="button">go</div>',
      '<div tabindex="0" id="focusable">x</div>',
      '<div tabindex="-1" id="unfocusable">x</div>',
    ].join('')
    expect(isInteractive(document.getElementById('summary'))).toBe(true)
    expect(isInteractive(document.getElementById('link'))).toBe(true)
    expect(isInteractive(document.getElementById('button'))).toBe(true)
    expect(isInteractive(document.getElementById('focusable'))).toBe(true)
    expect(isInteractive(document.getElementById('unfocusable'))).toBe(false)
  })
})
