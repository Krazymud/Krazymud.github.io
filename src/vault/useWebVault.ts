import { useEffect, useRef, useState } from 'react'
import type { VaultKey } from './crypto'
import { GitHubWriteError, syncWebFile, TOKEN_DENIED } from './github'
import type { FetchBytes } from './repo'
import {
  deleteWebList,
  deleteWebNote,
  emptyWebDoc,
  mergeWebDocs,
  openWebFile,
  saveWebList,
  saveWebNote,
  sealWebFile,
  togglePublishedCheck,
  toggleWebListItem,
  WebFileError,
  type WebClock,
  type WebDoc,
  type WebList,
  type WebNote,
} from './web'
import { loadPendingDoc, loadSyncedDoc, type WebStore } from './webStore'

interface NoteDraft {
  id?: string
  title: string
  date: string
  body: string
}

interface ListDraft {
  id?: string
  title: string
  items: { id?: string; text: string; done: boolean }[]
}

type Editor = { kind: 'note'; draft: NoteDraft } | { kind: 'list'; draft: ListDraft }
type Phase = 'loading' | 'ready' | 'broken'

export function useWebVault(options: {
  dek: VaultKey
  fetchBytes: FetchBytes
  store: WebStore | null
  webFetch: typeof fetch
  clock: WebClock
}) {
  const { dek, fetchBytes, store, webFetch, clock } = options
  const [doc, setDoc] = useState<WebDoc>(emptyWebDoc())
  const [phase, setPhase] = useState<Phase>('loading')
  const [unsynced, setUnsynced] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const docRef = useRef(doc)
  const tokenRef = useRef<string | null>(null)
  const brokenRef = useRef(false)
  const unsyncedRef = useRef(false)
  const alive = useRef(true)
  const tail = useRef(Promise.resolve())
  const persistTail = useRef(Promise.resolve())
  const persistGen = useRef(0)
  const generation = useRef(0)
  const clockRef = useRef(clock)
  const storeRef = useRef(store)
  const fetchRef = useRef(webFetch)
  const dekRef = useRef(dek)
  clockRef.current = clock
  storeRef.current = store
  fetchRef.current = webFetch
  dekRef.current = dek

  function markUnsynced(value: boolean) {
    unsyncedRef.current = value
    setUnsynced(value)
  }

  function rememberPending(next: WebDoc): Promise<void> {
    const current = storeRef.current
    if (!current) return Promise.resolve()
    const gen = ++persistGen.current
    const sealed = sealWebFile(dekRef.current, next)
    const run = persistTail.current.then(async () => {
      try {
        const text = await sealed
        if (persistGen.current !== gen) return
        await current.savePending(text)
      } catch {
        if (!alive.current || persistGen.current !== gen) return
        markUnsynced(true)
      }
    })
    const done = run.then(
      () => undefined,
      () => undefined,
    )
    persistTail.current = done
    return done
  }

  async function send(next: WebDoc, persisted: Promise<void> = Promise.resolve()) {
    await persisted
    const current = storeRef.current
    const saved = tokenRef.current
    if (!current || !saved || brokenRef.current) return
    try {
      const result = await syncWebFile({
        fetch: fetchRef.current,
        token: saved,
        local: next,
        dek: dekRef.current,
      })
      if (!alive.current || docRef.current !== next) return
      const gen = persistGen.current
      const cleared = persistTail.current.then(async () => {
        if (!alive.current || docRef.current !== next || persistGen.current !== gen) return false
        await current.saveSynced(result.text)
        await current.clearPending()
        return alive.current && docRef.current === next && persistGen.current === gen
      })
      persistTail.current = cleared.then(
        () => undefined,
        () => undefined,
      )
      if (!(await cleared)) return
      docRef.current = result.doc
      setDoc(result.doc)
      markUnsynced(false)
      setTokenError(null)
    } catch (error) {
      if (!alive.current) return
      if (error instanceof WebFileError) {
        brokenRef.current = true
        setPhase('broken')
        return
      }
      markUnsynced(true)
      setTokenError(error instanceof GitHubWriteError && error.message === TOKEN_DENIED ? TOKEN_DENIED : null)
    }
  }

  function enqueue(next: WebDoc, persisted: Promise<void> = Promise.resolve()) {
    const run = tail.current.then(() => send(next, persisted))
    tail.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  function commit(next: WebDoc) {
    docRef.current = next
    setDoc(next)
    const persisted = rememberPending(next)
    void enqueue(next, persisted)
  }

  function publish(next: WebDoc) {
    setEditor(null)
    commit(next)
  }

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    const id = ++generation.current
    void (async () => {
      const current = store
      const savedToken = current ? await current.loadToken() : null
      if (generation.current !== id) return
      const open = (text: string) => openWebFile(dek, text)
      const pendingDoc = current ? await loadPendingDoc(current, open) : null
      if (generation.current !== id) return
      const syncedDoc = current ? await loadSyncedDoc(current, open) : null
      if (generation.current !== id) return
      let remote: WebDoc | null = null
      let broken = false
      let siteFailed = false
      try {
        const bytes = await fetchBytes('web.json')
        if (generation.current !== id) return
        if (bytes === null) remote = emptyWebDoc()
        else {
          try {
            remote = await openWebFile(dek, new TextDecoder().decode(bytes))
          } catch (error) {
            if (!(error instanceof WebFileError)) throw error
            broken = true
          }
        }
      } catch {
        siteFailed = true
      }
      if (generation.current !== id) return
      tokenRef.current = savedToken
      setToken(savedToken)
      brokenRef.current = broken
      if (broken) {
        const view = pendingDoc ?? emptyWebDoc()
        docRef.current = view
        setDoc(view)
        markUnsynced(pendingDoc !== null)
        setPhase('broken')
        return
      }
      const siteDoc = remote ?? emptyWebDoc()
      const remembered = syncedDoc ? mergeWebDocs(siteDoc, syncedDoc) : siteDoc
      const view = pendingDoc ? mergeWebDocs(remembered, pendingDoc) : remembered
      docRef.current = view
      setDoc(view)
      setPhase('ready')
      if (pendingDoc && !savedToken) markUnsynced(true)
      if (siteFailed && pendingDoc) markUnsynced(true)
      if (pendingDoc && savedToken) await enqueue(view)
    })()
    return () => {
      generation.current += 1
    }
  }, [dek, fetchBytes, store])

  const canEdit = phase === 'ready' && token !== null

  function beginNote(note?: WebNote) {
    if (!canEdit || editor) return
    setEditor({
      kind: 'note',
      draft: note
        ? { id: note.id, title: note.title, date: note.date, body: note.body }
        : { title: '', date: clockRef.current.today(), body: '' },
    })
  }

  function beginList(list?: WebList) {
    if (!canEdit || editor) return
    setEditor({
      kind: 'list',
      draft: list
        ? {
            id: list.id,
            title: list.title,
            items: list.items.map((item) => ({ id: item.id, text: item.text, done: item.done })),
          }
        : { title: '', items: [] },
    })
  }

  return {
    doc,
    loading: phase === 'loading',
    broken: phase === 'broken',
    unsynced,
    tokenError,
    tokenSaved: token !== null,
    canEdit,
    editor,
    saveToken: async (value: string) => {
      const current = storeRef.current
      const next = value.trim()
      if (!current || next === '' || phase === 'loading') return
      await current.saveToken(next)
      tokenRef.current = next
      setToken(next)
      setTokenError(null)
      if (unsyncedRef.current && !brokenRef.current) await enqueue(docRef.current)
    },
    forgetToken: async () => {
      const current = storeRef.current
      if (!current) return
      tokenRef.current = null
      setToken(null)
      setTokenError(null)
      setEditor(null)
      await current.forgetToken()
    },
    beginNote,
    beginList,
    cancelEdit: () => setEditor(null),
    saveNote: (input: { title: string; date: string; body: string }) => {
      if (!canEdit || tokenRef.current === null) return
      if (editor?.kind !== 'note') return
      const result = saveWebNote(docRef.current, { id: editor.draft.id, ...input }, clockRef.current)
      if (result.ok) publish(result.doc)
    },
    saveList: (input: { title: string; items: { id?: string; text: string; done: boolean }[] }) => {
      if (!canEdit || tokenRef.current === null) return
      if (editor?.kind !== 'list') return
      const result = saveWebList(docRef.current, { id: editor.draft.id, ...input }, clockRef.current)
      if (result.ok) publish(result.doc)
    },
    deleteNote: (id: string) => {
      if (canEdit && tokenRef.current !== null) publish(deleteWebNote(docRef.current, id, clockRef.current.now()))
    },
    deleteList: (id: string) => {
      if (canEdit && tokenRef.current !== null) publish(deleteWebList(docRef.current, id, clockRef.current.now()))
    },
    togglePublished: (source: string, index: number, done: boolean) => {
      if (canEdit && tokenRef.current !== null) commit(togglePublishedCheck(docRef.current, source, index, done, clockRef.current.now()))
    },
    toggleWebItem: (listId: string, itemId: string) => {
      if (canEdit && tokenRef.current !== null) commit(toggleWebListItem(docRef.current, listId, itemId, clockRef.current.now()))
    },
  }
}
