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
    }
  }
  function cloneList(p) {
    return {
      source: p.source || '',
      title: p.title || '',
      items: (p.items || []).map((it) => ({ text: it.text || '', done: !!it.done })),
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
          body: text(bodyEl),
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
        if (isList) pages[idx] = cloneList(page)
        else pages[idx] = cloneNote(page)
      }

      function waitResult(id) {
        return new Promise((resolve) => {
          waits.set(id, resolve)
          setTimeout(() => {
            if (waits.has(id)) {
              waits.delete(id)
              resolve({ ok: false, reason: 'blob' })
            }
          }, 30000)
        })
      }

      function postSave(page) {
        const id = rid()
        const payload = { roll: 'paper-save', kind, id, page }
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
          const fn = waits.get(d.id)
          waits.delete(d.id)
          fn(d)
          return
        }
        if (d.roll === 'vault-content' && d.content && d.content.papers) {
          const incoming = d.content.papers[isList ? 'lists' : 'notes'] || []
          const keep = pages[idx] && pages[idx].source ? pages[idx].source : ''
          pages.splice(
            0,
            pages.length,
            ...(incoming.length ? incoming.map(isList ? cloneList : cloneNote) : [isList ? blankList() : blankNote()]),
          )
          if (keep) {
            const ni = pages.findIndex((p) => p.source === keep)
            if (ni >= 0) idx = ni
          } else if (idx >= pages.length) idx = pages.length - 1
          showPage()
        }
      })

      async function saveCurrent() {
        const page = readPage()
        const { res } = await postSave(page)
        if (!res.ok) {
          setErr(res.reason === 'title' ? '先写标题' : '没写上')
          return false
        }
        writeLocal(page)
        setErr('')
        return true
      }

      bPrev.onclick = async () => {
        if (idx <= 0) return
        if (!(await saveCurrent())) return
        idx--
        showPage()
      }
      bNext.onclick = async () => {
        if (idx >= pages.length - 1) return
        if (!(await saveCurrent())) return
        idx++
        showPage()
      }
      bNew.onclick = async () => {
        if (!(await saveCurrent())) return
        pages.push(isList ? blankList() : blankNote())
        idx = pages.length - 1
        showPage()
      }
      bRip.onclick = async () => {
        const page = pages[idx]
        if (!page.source) {
          if (pages.length > 1) {
            pages.splice(idx, 1)
            if (idx >= pages.length) idx = pages.length - 1
            showPage()
          } else {
            pages[0] = isList ? blankList() : blankNote()
            showPage()
          }
          return
        }
        if (!window.confirm('撕掉这一篇？')) return
        const res = await postDelete(page.source)
        if (!res.ok) {
          setErr('没写上')
          return
        }
        pages.splice(idx, 1)
        if (!pages.length) pages.push(isList ? blankList() : blankNote())
        if (idx >= pages.length) idx = pages.length - 1
        showPage()
      }
      bScene.onclick = async () => {
        if (!(await saveCurrent())) return
        window.ROLL.done('cross')
      }

      addRow.onclick = () => {
        const page = pages[idx]
        if (!page.items) page.items = []
        page.items.push({ text: '', done: false })
        renderListItems(page.items.map((it) => ({ ...it })))
      }

      showPage()
      window.ROLL.prep()
    },
  }
})()
