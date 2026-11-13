/* Paged notes and lists inside the torn envelope letter. */
(function () {
  function shell() {
    try {
      if (window.parent && window.parent !== window) return window.parent
    } catch (e) {}
    return window.top
  }
  function rid() {
    return 'pe' + Math.random().toString(36).slice(2, 11)
  }
  function cloneNote(p) {
    return {
      source: p.source || '',
      title: p.title || '',
      date: p.date || '',
      body: p.body || '',
      token: p.token || '',
    }
  }
  function cloneList(p) {
    return {
      source: p.source || '',
      title: p.title || '',
      items: (p.items || []).map((it) => ({ text: it.text || '', done: !!it.done })),
      token: p.token || '',
    }
  }
  function blankNote() {
    const since = (window.CONTENT && window.CONTENT.since) || ''
    return { source: '', title: '', date: since, body: '' }
  }
  function blankList() {
    return { source: '', title: '', items: [] }
  }
  function text(el) {
    return (el && el.textContent ? el.textContent : '').trim()
  }
  function noteBody(el) {
    if (!el) return ''
    if (typeof el.innerText === 'string') return el.innerText.trim()
    let out = ''
    const blockRe = /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE)$/i
    const visit = (node) => {
      if (node.nodeType === 3) {
        out += node.textContent || ''
        return
      }
      if (node.nodeType !== 1) return
      const name = node.tagName
      if (name === 'BR') {
        out += '\n'
        return
      }
      const block = blockRe.test(name)
      if (block && out && out.slice(-1) !== '\n') out += '\n'
      for (let i = 0; i < node.childNodes.length; i++) visit(node.childNodes[i])
      if (block && out && out.slice(-1) !== '\n') out += '\n'
    }
    visit(el)
    return out.trim()
  }

  window.PAPER = {
    mount({ kind, root }) {
      const isList = kind === 'list'
      const letter = document.getElementById('letter')
      const nameW = document.getElementById('nameW')
      if (nameW) nameW.textContent = isList ? '清单' : '留言'

      const corners = root.querySelectorAll('.corner')
      if (corners[0]) corners[0].textContent = isList ? '第 4 幕' : '第 3 幕'
      if (corners[1]) corners[1].textContent = isList ? '4 / 9' : '3 / 9'

      const pages = (() => {
        const src =
          (window.CONTENT && window.CONTENT.papers && window.CONTENT.papers[isList ? 'lists' : 'notes']) || []
        if (!src.length) return [isList ? blankList() : blankNote()]
        return src.map(isList ? cloneList : cloneNote)
      })()
      let idx = 0
      const waits = new Map()
      const held = new Map()
      const heldWait = new Map()
      let saving = 0
      let saveFlight = null
      let queuedVault = null

      function clonePage(p) {
        return isList ? cloneList(p) : cloneNote(p)
      }
      function assignPage(target, slot) {
        target.source = slot.source || ''
        target.title = slot.title || ''
        target.token = slot.token || ''
        if (isList) target.items = (slot.items || []).map((it) => ({ text: it.text || '', done: !!it.done }))
        else {
          target.date = slot.date || ''
          target.body = slot.body || ''
        }
      }
      function normItems(items) {
        return (items || [])
          .map((it) => ({ text: (it.text || '').trim(), done: !!it.done }))
          .filter((it) => it.text !== '')
      }
      function samePaper(a, b) {
        if (!a || !b) return false
        if ((a.title || '').trim() !== (b.title || '').trim()) return false
        if (String(a.date || '').trim() !== String(b.date || '').trim()) return false
        if (isList) {
          const ai = normItems(a.items)
          const bi = normItems(b.items)
          if (ai.length !== bi.length) return false
          for (let i = 0; i < ai.length; i++) {
            if (ai[i].text !== bi[i].text || ai[i].done !== bi[i].done) return false
          }
          return true
        }
        return (a.body || '').trim() === (b.body || '').trim()
      }
      function sourceFromResult(res) {
        if (!res) return ''
        if (typeof res.source === 'string' && res.source) return res.source
        if (res.page && typeof res.page.source === 'string' && res.page.source) return res.page.source
        if (typeof res.newId === 'string' && res.newId) return res.newId
        return ''
      }
      function fulfillHeld(token, source) {
        const waiters = heldWait.get(token) || []
        heldWait.delete(token)
        waiters.forEach((fn) => fn(source || ''))
      }
      function waitHeldSource(token) {
        const existing = pages.find((p) => p.token === token && p.source)
        if (existing) return Promise.resolve(existing.source)
        return new Promise((resolve) => {
          const timer = setTimeout(() => resolve(''), 30000)
          const list = heldWait.get(token) || []
          list.push((source) => {
            clearTimeout(timer)
            resolve(source || '')
          })
          heldWait.set(token, list)
        })
      }

      const pageHead = letter.querySelector('.head')
      if (pageHead) pageHead.style.display = 'none'
      const oldPre = document.getElementById('type')
      if (oldPre) oldPre.remove()
      const oldSign = document.getElementById('signW')
      if (oldSign) oldSign.remove()

      const err = document.createElement('div')
      err.className = 'pe-err'
      err.style.cssText =
        'position:absolute;left:40px;right:40px;top:54px;font:400 12px/1.5 "Courier Prime",monospace;color:#d8432f;min-height:1.2em'
      letter.appendChild(err)
      const setErr = (m) => {
        err.textContent = m || ''
      }

      const titleEl = document.createElement('div')
      titleEl.className = 'pe-title'
      titleEl.contentEditable = 'true'
      titleEl.setAttribute('data-placeholder', '标题')
      titleEl.style.cssText =
        'position:absolute;left:40px;right:40px;top:28px;font:600 20px/1.3 Fraunces,serif;color:#3a2510;outline:none;border-bottom:1px dashed rgba(74,46,22,.35);padding-bottom:4px'

      const bodyWrap = document.createElement('div')
      bodyWrap.className = 'pe-body'
      bodyWrap.style.cssText = 'position:absolute;left:40px;right:30px;top:88px;bottom:88px;overflow:auto'

      const dateEl = document.createElement('div')
      dateEl.className = 'pe-date'
      dateEl.contentEditable = 'true'
      dateEl.style.cssText =
        'font:400 10px/1.6 "JB Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#5a3a1c;margin-bottom:10px;outline:none'

      const bodyEl = document.createElement('div')
      bodyEl.className = 'pe-text'
      bodyEl.contentEditable = 'true'
      bodyEl.style.cssText =
        'font:400 15px/1.65 "Courier Prime",monospace;color:#150e08;min-height:120px;outline:none;white-space:pre-wrap'

      const listEl = document.createElement('div')
      listEl.className = 'pe-list'
      listEl.style.cssText = 'display:flex;flex-direction:column;gap:6px'

      const addRow = document.createElement('button')
      addRow.type = 'button'
      addRow.textContent = '+'
      addRow.style.cssText =
        'align-self:flex-start;margin-top:6px;border:1px dashed rgba(74,46,22,.45);background:transparent;color:#4a2e16;font:400 18px/1 "Reenie",cursive;cursor:pointer;padding:2px 12px'

      const bar = document.createElement('div')
      bar.className = 'pe-bar'
      bar.style.cssText =
        'position:absolute;left:24px;right:24px;bottom:18px;display:flex;flex-wrap:wrap;gap:8px 12px;justify-content:center'
      const mkBtn = (label) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.style.cssText =
          'border:0;background:transparent;color:#4a2e16;font:400 11px/1 "JB Mono",monospace;letter-spacing:.08em;cursor:pointer;padding:4px 6px;opacity:.85'
        b.onmouseenter = () => {
          b.style.opacity = '1'
        }
        b.onmouseleave = () => {
          b.style.opacity = '.85'
        }
        return b
      }
      const bPrev = mkBtn('上一篇')
      const bNext = mkBtn('下一篇')
      const bNew = mkBtn('新的一篇')
      const bRip = mkBtn('撕掉')
      const bScene = mkBtn('下一幕')
      ;[bPrev, bNext, bNew, bRip, bScene].forEach((b) => bar.appendChild(b))

      if (isList) {
        bodyWrap.appendChild(listEl)
        bodyWrap.appendChild(addRow)
      } else {
        bodyWrap.appendChild(dateEl)
        bodyWrap.appendChild(bodyEl)
      }
      letter.appendChild(titleEl)
      letter.appendChild(bodyWrap)
      letter.appendChild(bar)

      function renderListItems(items) {
        listEl.innerHTML = ''
        items.forEach((it, i) => {
          const row = document.createElement('div')
          row.style.cssText = 'display:flex;align-items:center;gap:8px'
          const box = document.createElement('button')
          box.type = 'button'
          box.style.cssText =
            'width:14px;height:14px;border:1px solid #4a2e16;background:transparent;cursor:pointer;flex:none;padding:0;position:relative'
          if (it.done) {
            box.innerHTML = '<span style="position:absolute;left:-1px;top:-10px;font:400 18px/1 Reenie,cursive;color:#d8432f">✓</span>'
          }
          box.onclick = () => {
            it.done = !it.done
            renderListItems(items)
          }
          const txt = document.createElement('div')
          txt.contentEditable = 'true'
          txt.setAttribute('contenteditable', 'true')
          txt.textContent = it.text
          txt.style.cssText =
            'flex:1;font:400 15px/1.5 "Courier Prime",monospace;color:#150e08;outline:none;border-bottom:1px dotted rgba(74,46,22,.25);min-height:1.4em'
          txt.addEventListener('input', () => {
            it.text = txt.textContent || ''
          })
          const del = document.createElement('button')
          del.type = 'button'
          del.textContent = '×'
          del.style.cssText =
            'border:0;background:transparent;color:#d8432f;font:400 16px/1 sans-serif;cursor:pointer;opacity:.7;padding:0 4px'
          del.onclick = () => {
            items.splice(i, 1)
            renderListItems(items)
          }
          row.append(box, txt, del)
          listEl.appendChild(row)
        })
      }

      function collectListItems() {
        const items = []
        listEl.querySelectorAll(':scope > div').forEach((row) => {
          const txt = row.querySelector('[contenteditable]')
          const box = row.querySelector('button')
          const done = !!(box && box.innerHTML.indexOf('✓') >= 0)
          items.push({ text: text(txt), done })
        })
        return items
      }

      function readPage() {
        const page = pages[idx]
        if (isList) {
          return {
            source: page.source || '',
            title: text(titleEl),
            items: collectListItems(),
          }
        }
        return {
          source: page.source || '',
          title: text(titleEl),
          date: text(dateEl),
          body: noteBody(bodyEl),
        }
      }

      function showPage() {
        setErr('')
        const page = pages[idx]
        titleEl.textContent = page.title || ''
        if (isList) renderListItems(page.items.map((it) => ({ ...it })))
        else {
          dateEl.textContent = page.date || ''
          bodyEl.textContent = page.body || ''
        }
        letter.classList.add('done')
      }

      function writeLocal(page) {
        const cur = pages[idx]
        if (!cur) return
        const next = clonePage(page)
        next.token = cur.token || page.token || ''
        if (!next.source && cur.source) next.source = cur.source
        assignPage(cur, next)
      }

      function locate(page) {
        if (!page) return -1
        const at = pages.indexOf(page)
        if (at >= 0) return at
        if (page.token) {
          const ti = pages.findIndex((p) => p.token === page.token)
          if (ti >= 0) return ti
        }
        if (page.source) {
          const si = pages.findIndex((p) => p.source === page.source)
          if (si >= 0) return si
        }
        return -1
      }

      function removePage(page) {
        const at = pages.indexOf(page)
        if (at < 0) return
        pages.splice(at, 1)
        if (!pages.length) {
          pages.push(isList ? blankList() : blankNote())
          idx = 0
        } else if (idx > at) idx--
        else if (idx >= pages.length) idx = pages.length - 1
        showPage()
      }

      function applyVault(incomingRaw) {
        if (pages[idx]) writeLocal(readPage())
        const incoming = (incomingRaw || []).map(clonePage)
        const current = pages[idx]
        const claimed = new Set()
        const keepLocal = new Set()
        const owned = new Set()
        pages.forEach((p) => {
          if (p.source) owned.add(p.source)
        })
        pages.forEach((lp) => {
          if (lp.source) return
          const probe = lp.token && held.has(lp.token) ? held.get(lp.token) : lp
          const mi = incoming.findIndex(
            (rp, i) => !claimed.has(i) && rp.source && !owned.has(rp.source) && samePaper(probe, rp),
          )
          if (mi < 0) return
          lp.source = incoming[mi].source
          owned.add(lp.source)
          claimed.add(mi)
          if (!samePaper(lp, incoming[mi])) keepLocal.add(lp)
          if (lp.token) {
            const token = lp.token
            held.delete(token)
            fulfillHeld(token, lp.source)
          }
        })
        const next = []
        const placed = new Set()
        incoming.forEach((rp) => {
          if (!rp.source || next.some((p) => p.source === rp.source)) return
          const li = pages.findIndex((lp, i) => !placed.has(i) && lp.source === rp.source)
          if (li >= 0) {
            placed.add(li)
            const lp = pages[li]
            if (!keepLocal.has(lp)) {
              const fresh = clonePage(rp)
              fresh.token = lp.token || ''
              assignPage(lp, fresh)
            }
            lp.token = ''
            next.push(lp)
          } else next.push(clonePage(rp))
        })
        pages.forEach((lp, i) => {
          if (placed.has(i)) return
          if (lp.source && !lp.token) return
          next.push(lp)
        })
        if (!next.length) next.push(isList ? blankList() : blankNote())
        let nextIdx = 0
        if (current) {
          const ni = next.indexOf(current)
          if (ni >= 0) nextIdx = ni
          else if (current.source) {
            const si = next.findIndex((p) => p.source === current.source)
            if (si >= 0) nextIdx = si
          }
        }
        if (nextIdx >= next.length) nextIdx = next.length - 1
        pages.splice(0, pages.length, ...next)
        idx = nextIdx
        showPage()
      }

      function takeVault(incoming) {
        if (saving) {
          queuedVault = incoming
          return
        }
        applyVault(incoming)
      }

      function waitResult(id) {
        return new Promise((resolve) => {
          let timer
          const finish = (res) => {
            if (!waits.has(id)) return
            waits.delete(id)
            clearTimeout(timer)
            resolve(res)
          }
          waits.set(id, finish)
          timer = setTimeout(() => finish({ ok: false, reason: 'blob' }), 30000)
        })
      }

      function postSave(page) {
        const id = rid()
        const clean = isList
          ? { source: page.source || '', title: page.title || '', items: page.items || [] }
          : { source: page.source || '', title: page.title || '', date: page.date || '', body: page.body || '' }
        const payload = { roll: 'paper-save', kind, id, page: clean }
        try {
          shell().postMessage(payload, '*')
        } catch (e) {}
        return waitResult(id).then((res) => ({ res, page, id }))
      }

      function postDelete(source) {
        const id = rid()
        const payload = { roll: 'paper-delete', kind, id, source: source || '' }
        try {
          shell().postMessage(payload, '*')
        } catch (e) {}
        return waitResult(id)
      }

      addEventListener('message', (e) => {
        const d = e.data
        if (!d) return
        if (d.roll === 'paper-result' && d.id && waits.has(d.id)) {
          waits.get(d.id)(d)
          return
        }
        if (d.roll === 'vault-content' && d.content && d.content.papers) {
          takeVault(d.content.papers[isList ? 'lists' : 'notes'] || [])
        }
      })

      function saveCurrent() {
        if (saveFlight) return saveFlight
        saveFlight = performSave().finally(() => {
          saveFlight = null
        })
        return saveFlight
      }

      async function performSave() {
        const target = pages[idx]
        if (!target) return false
        const page = readPage()
        let token = target.token || ''
        if (!page.source && token && held.has(token)) {
          const snap = held.get(token)
          const merged = clonePage(page)
          merged.token = token
          assignPage(target, merged)
          if (samePaper(snap, merged)) {
            setErr('')
            return true
          }
          const source = await waitHeldSource(token)
          if (!pages.includes(target)) return false
          if (!source) {
            setErr('没写上')
            return false
          }
          page.source = source
          target.source = source
        }

        const hadSource = !!page.source
        saving++
        try {
          const { res } = await postSave(page)
          if (!pages.includes(target)) return false
          if (!res.ok) {
            setErr(res.reason === 'title' ? '先写标题' : '没写上')
            return false
          }
          const hinted = sourceFromResult(res)
          if (hinted) page.source = hinted
          if (!hadSource) {
            if (!token) token = rid()
            if (!page.source) held.set(token, clonePage(page))
            else held.delete(token)
          } else if (token) held.delete(token)
          if (!page.source && target.source && samePaper(target, page)) {
            page.source = target.source
            if (token) held.delete(token)
          }
          if (!pages.includes(target)) return false
          const slot = clonePage(page)
          slot.token = hadSource ? target.token || '' : token
          assignPage(target, slot)
          setErr('')
          return true
        } finally {
          saving--
          if (saving === 0 && queuedVault) {
            const incoming = queuedVault
            queuedVault = null
            applyVault(incoming)
          }
        }
      }

      bPrev.onclick = async () => {
        const page = pages[idx]
        if (!page || pages.indexOf(page) <= 0) return
        if (!(await saveCurrent())) return
        const at = locate(page)
        if (at <= 0) return
        idx = at - 1
        showPage()
      }
      bNext.onclick = async () => {
        const page = pages[idx]
        if (!page || pages.indexOf(page) >= pages.length - 1) return
        if (!(await saveCurrent())) return
        const at = locate(page)
        if (at < 0 || at >= pages.length - 1) return
        idx = at + 1
        showPage()
      }
      bNew.onclick = async () => {
        const page = pages[idx]
        if (!page) return
        if (!(await saveCurrent())) return
        const at = locate(page)
        if (at < 0) return
        idx = at
        pages.push(isList ? blankList() : blankNote())
        idx = pages.length - 1
        showPage()
      }
      bRip.onclick = async () => {
        const page = pages[idx]
        if (!page) return
        if (saveFlight) await saveFlight
        if (!page.source && page.token && held.has(page.token)) {
          if (!window.confirm('撕掉这一篇？')) return
          const source = await waitHeldSource(page.token)
          if (!source) {
            setErr('没写上')
            return
          }
          const res = await postDelete(source)
          if (!res.ok) {
            setErr('没写上')
            return
          }
          held.delete(page.token)
          const at = pages.includes(page) ? pages.indexOf(page) : pages.findIndex((p) => p.source === source)
          if (at >= 0) removePage(pages[at])
          return
        }
        if (!page.source) {
          if (page.token) {
            held.delete(page.token)
            fulfillHeld(page.token, '')
          }
          if (pages.includes(page)) removePage(page)
          return
        }
        if (!window.confirm('撕掉这一篇？')) return
        const source = page.source
        const res = await postDelete(source)
        if (!res.ok) {
          setErr('没写上')
          return
        }
        const at = pages.includes(page) ? pages.indexOf(page) : pages.findIndex((p) => p.source === source)
        if (at >= 0) removePage(pages[at])
      }
      bScene.onclick = async () => {
        const page = pages[idx]
        if (!page) return
        if (!(await saveCurrent())) return
        if (locate(page) < 0) return
        window.ROLL.done('cross')
      }

      addRow.onclick = () => {
        const page = pages[idx]
        if (!page) return
        page.items = collectListItems()
        page.items.push({ text: '', done: false })
        renderListItems(page.items.map((it) => ({ ...it })))
      }

      showPage()
      window.ROLL.prep()
    },
  }
})()
