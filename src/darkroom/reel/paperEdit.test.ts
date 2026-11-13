import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it } from 'vitest'

const script = readFileSync(join(process.cwd(), 'public/reel-shell/paper-edit.js'), 'utf8')

type PaperMsg = { roll?: string; id?: string; source?: string; page?: { source?: string; title?: string; body?: string } }

function boot(records: Record<string, unknown>[], kind: 'note' | 'list' = 'note') {
  const dom = new JSDOM(
    `<!doctype html><body>
      <div id="root"><div class="corner"></div><div class="corner"></div>
        <div id="letter"><div class="head"></div></div>
        <div id="nameW"></div>
      </div>
    </body>`,
    { url: 'http://localhost/', runScripts: 'dangerously' },
  )
  const win = dom.window as unknown as Window & {
    CONTENT: unknown
    ROLL: { prep: () => void; done: (fx: string) => void }
    PAPER: { mount: (opts: { kind: string; root: Element }) => void }
    confirm: () => boolean
  }
  const saves: PaperMsg[] = []
  const deletes: PaperMsg[] = []
  const scene: string[] = []
  win.CONTENT = {
    since: '2026-01-01',
    papers: {
      notes: kind === 'note' ? records : [],
      lists: kind === 'list' ? records : [],
    },
  }
  win.ROLL = {
    prep() {},
    done(fx: string) {
      scene.push(fx)
    },
  }
  win.confirm = () => true
  win.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as PaperMsg
    if (!data || data.roll === 'paper-result' || data.roll === 'vault-content') return
    const copy = JSON.parse(JSON.stringify(data)) as PaperMsg
    if (data.roll === 'paper-save') saves.push(copy)
    if (data.roll === 'paper-delete') deletes.push(copy)
  })
  vm.runInContext(script, dom.getInternalVMContext())
  win.PAPER.mount({ kind, root: win.document.getElementById('root')! })
  return { win, saves, deletes, dom, scene }
}

function click(win: Window, label: string) {
  const btn = [...win.document.querySelectorAll('button')].find((b) => b.textContent === label)
  if (!btn) throw new Error(`missing ${label}`)
  ;(btn as HTMLButtonElement).click()
}

function fill(win: Window, title: string, date: string, body: string) {
  const titleEl = win.document.querySelector('.pe-title')
  const dateEl = win.document.querySelector('.pe-date')
  const bodyEl = win.document.querySelector('.pe-text')
  if (!titleEl || !dateEl || !bodyEl) throw new Error('paper fields missing')
  titleEl.textContent = title
  dateEl.textContent = date
  bodyEl.textContent = body
}

function field(win: Window, sel: string) {
  return win.document.querySelector(sel)?.textContent ?? ''
}

function status(win: Window) {
  return win.document.querySelector('.pe-err')?.textContent ?? ''
}

function blur(win: Window, sel: string) {
  const el = win.document.querySelector(sel)
  if (!el) throw new Error(`missing ${sel}`)
  el.dispatchEvent(new win.Event('focusout', { bubbles: true }))
}

async function settle() {
  await new Promise((r) => setTimeout(r, 30))
}

function reply(win: Window, id: string) {
  win.postMessage({ roll: 'paper-result', id, ok: true }, '*')
}

function vault(win: Window, notes: Record<string, unknown>[]) {
  win.postMessage({ roll: 'vault-content', content: { since: '2026-01-01', papers: { notes, lists: [] } } }, '*')
}

const open: { close: () => void }[] = []

afterEach(() => {
  while (open.length) {
    const dom = open.pop()
    dom?.window.close()
  }
})

describe('paper-edit saves', () => {
  it('posts one sourceless paper-save when another action starts during that save', async () => {
    const ctx = boot([
      { source: '', title: '新', date: '2026-03-01', body: 'draft' },
      { source: 'notes/old', title: '旧', date: '2020-01-01', body: 'keep' },
    ])
    open.push(ctx.dom)
    click(ctx.win, '新的一篇')
    click(ctx.win, '下一篇')
    click(ctx.win, '下一幕')
    click(ctx.win, '撕掉')
    await settle()
    expect(ctx.saves).toHaveLength(1)
    expect(ctx.saves[0]?.page?.source).toBe('')
    expect(ctx.saves[0]?.page?.title).toBe('新')
    reply(ctx.win, ctx.saves[0]!.id!)
    await settle()
    expect(ctx.saves).toHaveLength(1)
    expect(field(ctx.win, '.pe-title')).toBe('旧')
    expect(field(ctx.win, '.pe-text')).toBe('keep')
    expect(ctx.deletes).toEqual([])
    vault(ctx.win, [
      { source: 'notes/old', title: '旧', date: '2020-01-01', body: 'keep' },
      { source: 'notes/new', title: '新', date: '2026-03-01', body: 'draft' },
    ])
    await settle()
    expect(ctx.saves).toHaveLength(1)
    expect(ctx.deletes.map((d) => d.source)).toEqual(['notes/new'])
    reply(ctx.win, ctx.deletes[0]!.id!)
    await settle()
    expect(field(ctx.win, '.pe-title')).toBe('旧')
    expect(field(ctx.win, '.pe-text')).toBe('keep')
    click(ctx.win, '下一篇')
    await settle()
    expect(ctx.saves).toHaveLength(2)
    expect(ctx.saves[1]?.page?.source).toBe('notes/old')
    reply(ctx.win, ctx.saves[1]!.id!)
    await settle()
    expect(field(ctx.win, '.pe-title')).toBe('')
  })

  it('does not let a new empty note adopt a source already on an older note', async () => {
    const ctx = boot([
      { source: '', title: '同', date: '2026-01-01', body: '' },
      { source: 'notes/old', title: '同', date: '2026-01-01', body: '' },
    ])
    open.push(ctx.dom)
    vault(ctx.win, [{ source: 'notes/old', title: '同', date: '2026-01-01', body: '' }])
    await settle()
    click(ctx.win, '撕掉')
    await settle()
    expect(ctx.deletes).toEqual([])
    expect(field(ctx.win, '.pe-title')).toBe('同')
    click(ctx.win, '撕掉')
    await settle()
    expect(ctx.deletes.map((d) => d.source)).toEqual(['notes/old'])
    reply(ctx.win, ctx.deletes[0]!.id!)
    await settle()
  })

  it('keeps line breaks when the note body has br elements', async () => {
    const ctx = boot([{ source: '', title: '', date: '2026-01-01', body: '' }])
    open.push(ctx.dom)
    const titleEl = ctx.win.document.querySelector('.pe-title')
    const dateEl = ctx.win.document.querySelector('.pe-date')
    const bodyEl = ctx.win.document.querySelector('.pe-text')
    if (!titleEl || !dateEl || !bodyEl) throw new Error('paper fields missing')
    titleEl.textContent = '段'
    dateEl.textContent = '2026-03-01'
    bodyEl.innerHTML = '第一句。<br>第二句。'
    click(ctx.win, '下一幕')
    await settle()
    expect(ctx.saves).toHaveLength(1)
    expect(ctx.saves[0]?.page?.body).toBe('第一句。\n第二句。')
  })

  it('deletes a saved note after vault-content supplies the source', async () => {
    const ctx = boot([{ source: '', title: '', date: '2026-01-01', body: '' }])
    open.push(ctx.dom)
    fill(ctx.win, '夜', '2026-03-01', '风')
    click(ctx.win, '下一幕')
    await settle()
    expect(ctx.saves).toHaveLength(1)
    expect(ctx.saves[0]?.page?.source).toBe('')
    reply(ctx.win, ctx.saves[0]!.id!)
    await settle()
    click(ctx.win, '撕掉')
    await settle()
    expect(field(ctx.win, '.pe-title')).toBe('夜')
    expect(ctx.deletes).toEqual([])
    vault(ctx.win, [{ source: 'notes/n1', title: '夜', date: '2026-03-01', body: '风' }])
    await settle()
    expect(ctx.deletes.map((d) => d.source)).toEqual(['notes/n1'])
    reply(ctx.win, ctx.deletes[0]!.id!)
    await settle()
    expect(field(ctx.win, '.pe-title')).toBe('')
  })

  it('empty note reaches done without a paper-save', async () => {
    const ctx = boot([])
    open.push(ctx.dom)
    click(ctx.win, '下一幕')
    await settle()
    expect(ctx.saves).toEqual([])
    expect(ctx.scene).toEqual(['cross'])
  })

  it('empty list reaches done without a paper-save', async () => {
    const ctx = boot([], 'list')
    open.push(ctx.dom)
    click(ctx.win, '下一幕')
    await settle()
    expect(ctx.saves).toEqual([])
    expect(ctx.scene).toEqual(['cross'])
  })

  it('a body with an empty title stays and the status is 先写标题', async () => {
    const ctx = boot([])
    open.push(ctx.dom)
    fill(ctx.win, '', '2026-01-01', '有正文')
    click(ctx.win, '下一幕')
    await settle()
    expect(status(ctx.win)).toBe('先写标题')
    expect(ctx.scene).toEqual([])
    expect(field(ctx.win, '.pe-text')).toBe('有正文')
    expect(ctx.saves).toEqual([])
  })

  it('leaves an empty note for the next one without a paper-save', async () => {
    const ctx = boot([
      { source: '', title: '', date: '2026-01-01', body: '' },
      { source: 'notes/old', title: '旧', date: '2020-01-01', body: 'keep' },
    ])
    open.push(ctx.dom)
    click(ctx.win, '下一篇')
    await settle()
    expect(ctx.saves).toEqual([])
    expect(field(ctx.win, '.pe-title')).toBe('旧')
  })

  it('still saves a note that already has a source', async () => {
    const ctx = boot([{ source: 'notes/n1', title: '', date: '2026-01-01', body: '' }])
    open.push(ctx.dom)
    click(ctx.win, '下一幕')
    await settle()
    expect(ctx.saves).toHaveLength(1)
    expect(ctx.saves[0]?.page?.source).toBe('notes/n1')
    expect(ctx.scene).toEqual([])
  })

  it('saves when focus leaves a field that changed', async () => {
    const ctx = boot([{ source: '', title: '', date: '2026-01-01', body: '' }])
    open.push(ctx.dom)
    fill(ctx.win, '题', '2026-03-01', '正文')
    blur(ctx.win, '.pe-text')
    await settle()
    expect(ctx.saves).toHaveLength(1)
    expect(ctx.saves[0]?.page?.title).toBe('题')
    expect(ctx.saves[0]?.page?.body).toBe('正文')
  })

  it('does not post paper-save when a blank field blurs', async () => {
    const ctx = boot([])
    open.push(ctx.dom)
    blur(ctx.win, '.pe-title')
    blur(ctx.win, '.pe-date')
    blur(ctx.win, '.pe-text')
    await settle()
    expect(ctx.saves).toEqual([])
  })

  it('shows 先写标题 when focus leaves a body with an empty title', async () => {
    const ctx = boot([])
    open.push(ctx.dom)
    fill(ctx.win, '', '2026-01-01', '有字')
    blur(ctx.win, '.pe-text')
    await settle()
    expect(ctx.saves).toEqual([])
    expect(status(ctx.win)).toBe('先写标题')
    expect(ctx.scene).toEqual([])
  })

  it('shows 先写标题 when a list item blurs with an empty title', async () => {
    const ctx = boot([], 'list')
    open.push(ctx.dom)
    click(ctx.win, '+')
    const item = ctx.win.document.querySelector('.pe-list [contenteditable]')
    if (!item) throw new Error('missing item')
    item.textContent = '牛奶'
    item.dispatchEvent(new ctx.win.Event('focusout', { bubbles: true }))
    await settle()
    expect(ctx.saves).toEqual([])
    expect(status(ctx.win)).toBe('先写标题')
  })

  it('does not post twice when blur and the scene button both save', async () => {
    const ctx = boot([{ source: '', title: '', date: '2026-01-01', body: '' }])
    open.push(ctx.dom)
    fill(ctx.win, '题', '2026-03-01', '正文')
    blur(ctx.win, '.pe-text')
    click(ctx.win, '下一幕')
    await settle()
    expect(ctx.saves).toHaveLength(1)
    expect(ctx.saves[0]?.page?.title).toBe('题')
  })

  it('does not save again when focus leaves an unchanged field', async () => {
    const ctx = boot([{ source: 'notes/n1', title: '题', date: '2026-03-01', body: '正文' }])
    open.push(ctx.dom)
    blur(ctx.win, '.pe-title')
    blur(ctx.win, '.pe-date')
    blur(ctx.win, '.pe-text')
    await settle()
    expect(ctx.saves).toEqual([])
  })
})
