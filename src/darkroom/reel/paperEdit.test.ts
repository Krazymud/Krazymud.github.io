import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it } from 'vitest'

const script = readFileSync(join(process.cwd(), 'public/reel-shell/paper-edit.js'), 'utf8')

type PaperMsg = { roll?: string; id?: string; source?: string; page?: { source?: string; title?: string; body?: string } }

function boot(notes: Record<string, unknown>[]) {
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
  win.CONTENT = { since: '2026-01-01', papers: { notes, lists: [] } }
  win.ROLL = { prep() {}, done() {} }
  win.confirm = () => true
  win.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as PaperMsg
    if (!data || data.roll === 'paper-result' || data.roll === 'vault-content') return
    const copy = JSON.parse(JSON.stringify(data)) as PaperMsg
    if (data.roll === 'paper-save') saves.push(copy)
    if (data.roll === 'paper-delete') deletes.push(copy)
  })
  vm.runInContext(script, dom.getInternalVMContext())
  win.PAPER.mount({ kind: 'note', root: win.document.getElementById('root')! })
  return { win, saves, deletes, dom }
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
})
