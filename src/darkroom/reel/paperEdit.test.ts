import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it } from 'vitest'

const script = readFileSync(join(process.cwd(), 'public/reel-shell/paper-edit.js'), 'utf8')

type PaperMsg = {
  roll?: string
  id?: string
  source?: string
  page?: { source?: string; title?: string; body?: string; items?: { text?: string; done?: boolean }[] }
}

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

  it('does not append another blank when 新的一篇 is used on an unsaved blank sheet', async () => {
    const note = boot([])
    open.push(note.dom)
    click(note.win, '新的一篇')
    click(note.win, '新的一篇')
    click(note.win, '下一幕')
    await settle()
    expect(note.saves).toEqual([])
    expect(note.scene).toEqual(['cross'])
    fill(note.win, '只此一篇', '2026-03-01', '正文')
    click(note.win, '上一篇')
    await flushSaves(note)
    expect(field(note.win, '.pe-title')).toBe('只此一篇')
    expect(field(note.win, '.pe-text')).toBe('正文')
    click(note.win, '下一篇')
    await flushSaves(note)
    expect(field(note.win, '.pe-title')).toBe('只此一篇')
    click(note.win, '新的一篇')
    await flushSaves(note)
    expect(note.saves.map((s) => s.page?.title)).toEqual(['只此一篇'])
    expect(field(note.win, '.pe-title')).toBe('')
    click(note.win, '上一篇')
    await flushSaves(note)
    expect(field(note.win, '.pe-title')).toBe('只此一篇')

    const sourced = boot([{ source: 'notes/empty', title: '', date: '', body: '' }])
    open.push(sourced.dom)
    click(sourced.win, '新的一篇')
    await flushSaves(sourced)
    expect(sourced.saves.map((s) => s.page?.source)).toEqual(['notes/empty'])
    expect(field(sourced.win, '.pe-title')).toBe('')
    fill(sourced.win, '新页', '2026-04-01', '有了')
    click(sourced.win, '上一篇')
    await flushSaves(sourced)
    expect(sourced.saves.map((s) => s.page?.title)).toEqual(['', '新页'])
    expect(field(sourced.win, '.pe-title')).toBe('')

    const list = boot([], 'list')
    open.push(list.dom)
    click(list.win, '新的一篇')
    await settle()
    expect(list.saves).toEqual([])
    const titleEl = list.win.document.querySelector('.pe-title')
    if (!titleEl) throw new Error('missing title')
    titleEl.textContent = '买'
    click(list.win, '+')
    const item = list.win.document.querySelector('.pe-list [contenteditable]')
    if (!item) throw new Error('missing item')
    item.textContent = '牛奶'
    click(list.win, '上一篇')
    await flushSaves(list)
    expect(field(list.win, '.pe-title')).toBe('买')
    expect(list.win.document.querySelector('.pe-list [contenteditable]')?.textContent).toBe('牛奶')
    click(list.win, '下一篇')
    await flushSaves(list)
    expect(field(list.win, '.pe-title')).toBe('买')
  })

  it('keeps a list row click when focus leaves the item onto that control', async () => {
    const ctx = boot(
      [
        {
          source: 'lists/l1',
          title: '买',
          items: [
            { text: '牛奶', done: false },
            { text: '面包', done: false },
          ],
        },
        { source: 'lists/l2', title: '另一', items: [{ text: '盐', done: false }] },
      ],
      'list',
    )
    open.push(ctx.dom)

    const row = ctx.win.document.querySelector('.pe-list > div')
    const item = row?.querySelector('[contenteditable]')
    const del = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent === '×')
    if (!row || !item || !del) throw new Error('missing list row controls')
    item.textContent = '酸奶'
    item.dispatchEvent(new ctx.win.Event('input', { bubbles: true }))
    item.dispatchEvent(new ctx.win.FocusEvent('focusout', { bubbles: true, relatedTarget: del }))
    del.click()
    expect([...ctx.win.document.querySelectorAll('.pe-list [contenteditable]')].map((el) => el.textContent)).toEqual(['面包'])
    click(ctx.win, '下一篇')
    await settle()
    await flushSaves(ctx)
    expect(field(ctx.win, '.pe-title')).toBe('另一')
    click(ctx.win, '上一篇')
    await flushSaves(ctx)
    expect([...ctx.win.document.querySelectorAll('.pe-list [contenteditable]')].map((el) => el.textContent)).toEqual(['面包'])

    const toggle = boot(
      [
        {
          source: 'lists/l1',
          title: '买',
          items: [{ text: '牛奶', done: false }],
        },
        { source: 'lists/l2', title: '另一', items: [{ text: '盐', done: false }] },
      ],
      'list',
    )
    open.push(toggle.dom)
    const toggleRow = toggle.win.document.querySelector('.pe-list > div')
    const toggleItem = toggleRow?.querySelector('[contenteditable]')
    const box = toggleRow?.querySelector('button')
    if (!toggleRow || !toggleItem || !box) throw new Error('missing toggle')
    toggleItem.textContent = '酸奶'
    toggleItem.dispatchEvent(new toggle.win.Event('input', { bubbles: true }))
    toggleItem.dispatchEvent(new toggle.win.FocusEvent('focusout', { bubbles: true, relatedTarget: box }))
    box.click()
    expect(toggle.win.document.querySelector('.pe-list button')?.innerHTML ?? '').toContain('✓')
    click(toggle.win, '下一篇')
    await settle()
    await flushSaves(toggle)
    click(toggle.win, '上一篇')
    await flushSaves(toggle)
    expect(toggle.win.document.querySelector('.pe-list [contenteditable]')?.textContent).toBe('酸奶')
    expect(toggle.win.document.querySelector('.pe-list button')?.innerHTML ?? '').toContain('✓')

    const added = boot(
      [
        {
          source: 'lists/l1',
          title: '买',
          items: [{ text: '牛奶', done: false }],
        },
        { source: 'lists/l2', title: '另一', items: [{ text: '盐', done: false }] },
      ],
      'list',
    )
    open.push(added.dom)
    const addItem = added.win.document.querySelector('.pe-list [contenteditable]')
    const addBtn = [...added.win.document.querySelectorAll('button')].find((b) => b.textContent === '+')
    if (!addItem || !addBtn) throw new Error('missing add row')
    addItem.textContent = '酸奶'
    addItem.dispatchEvent(new added.win.Event('input', { bubbles: true }))
    addItem.dispatchEvent(new added.win.FocusEvent('focusout', { bubbles: true, relatedTarget: addBtn }))
    addBtn.click()
    expect([...added.win.document.querySelectorAll('.pe-list [contenteditable]')].map((el) => el.textContent)).toEqual([
      '酸奶',
      '',
    ])
    click(added.win, '下一篇')
    await settle()
    await flushSaves(added)
    click(added.win, '上一篇')
    await flushSaves(added)
    expect([...added.win.document.querySelectorAll('.pe-list [contenteditable]')].map((el) => el.textContent)).toEqual([
      '酸奶',
      '',
    ])
  })
})

async function flushSaves(ctx: { win: Window; saves: PaperMsg[] }) {
  const seen = new Set<string>()
  for (let i = 0; i < 6; i++) {
    await settle()
    const pending = ctx.saves.filter((s) => s.id && !seen.has(s.id))
    if (!pending.length) return
    for (const save of pending) {
      seen.add(save.id!)
      reply(ctx.win, save.id!)
    }
  }
}
