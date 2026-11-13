# Darkroom Scenes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After one vault passphrase, this device remembers the key and the film shows a textured English radio greeting, paged editable notes and lists, four full photo rolls, and Chinese UI.

**Architecture:** The React host keeps the unlocked vault session and the iframe shell only displays it. Letter edits travel as `postMessage` and call the existing `saveNote` / `saveList` / `deleteNote` / `deleteList`. The iframe key ignores note and list hashes so a save does not restart the film.

**Tech Stack:** Vite, React 19, Vitest, the vendored `public/reel-shell/` pages, Web Speech API plus the shell's existing Web Audio bed.

**Spec:** `docs/superpowers/specs/2026-11-13-darkroom-scenes-design.md`

## Global Constraints

- Passphrase is the existing vault passphrase. A successful unlock always saves the key when a key store exists. There is no remember checkbox.
- A saved key that still unwraps the vault skips the gate. A missing vault file shows the empty notice and does not mount the film.
- Notes, lists, and photos never ask for a second passphrase.
- Do not add the top-left lock or mute buttons back. The error-state 锁上 button may stay.
- Radio greeting text is exactly `Good evening. Brought to you by your love.` Do not play `dj2.mp3` for it.
- Browsers do not expose speechSynthesis samples to AudioContext. Play the utterance at rate `0.96` and pitch `0.85` with the lower steady English voice when one exists, and run the existing static lead plus hiss/crackle bed in parallel. That is the texture.
- Opening button text is exactly `宝宝，往下看`.
- Roll names, in order, are exactly `初显`, `曝光`, `聚焦`, `冲洗`.
- Envelope labels are exactly `留言` and `清单`. `names.both` stays `暗房`.
- Song titles, in playlist order, are exactly `《吉诺佩蒂》第一首 · 萨蒂`, `《月光》· 德彪西`, `《夜曲》作品 37 之 1 · 肖邦`.
- Fonts ship in the repo. Do not fetch fonts from a third party at page load.
- User-authored note, list, and caption text is shown unchanged.

## File map

| Path | Responsibility |
|------|----------------|
| `src/darkroom/DarkroomApp.tsx` | Always save the unwrapped key |
| `src/vault/components/UnlockPanel.tsx` | Remove the remember checkbox |
| `src/darkroom/reel/vaultToReelContent.ts` | Rolls, radio copy, `papers` |
| `src/darkroom/reel/playlist.ts` | Chinese track titles |
| `src/darkroom/reel/ReelShellHost.tsx` | Stable iframe plus paper messages |
| `public/reel-shell/paper-edit.js` | Pager, fields, save and delete messages |
| `public/reel-shell/frame-e.html` | Notes paper |
| `public/reel-shell/frame-lists.html` | Lists paper |
| `public/reel-shell/frame-c.html` | Greeting, voice, song line |
| `public/reel-shell/index.html` | Scene order and default language |
| `public/reel-shell/zh.js` | Chinese strings, including `index.html` |
| `public/reel-shell/roll-link.js` | Brush font face |
| `public/reel-shell/rolls.html` | Frame count and viewer caption |
| `public/reel-shell/static.wav` | Tuning noise |
| `public/reel-shell/font/LXGWWenKai-Regular.woff2` | Body Chinese |
| `public/reel-shell/font/MaShanZheng-Regular.ttf` | Script Chinese |

---

### Task 1: Remember the key

**Files:**
- Modify: `src/darkroom/DarkroomApp.tsx`
- Modify: `src/vault/components/UnlockPanel.tsx`
- Test: `src/darkroom/DarkroomApp.test.tsx`

**Interfaces:**
- Consumes: `makeTestVault().dek`, `KeyStore.save(key)`
- Produces: unlock always calls `store.save(session.dek)` when `store` is non-null. The checkbox label `在这台设备上记住` is gone.

- [ ] **Step 1: Write the failing test**

Add to `src/darkroom/DarkroomApp.test.tsx`:

```tsx
it('saves the key after unlock and shows no remember checkbox', async () => {
  const vault = await makeTestVault()
  const keyStore = {
    load: vi.fn(async () => null),
    save: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  }
  render(<DarkroomApp fetchBytes={vault.fetchBytes} keyStore={keyStore} webStore={null} />)
  expect(screen.queryByText('在这台设备上记住')).toBeNull()
  await enter(TEST_PASSPHRASE)
  expect(await screen.findByTestId('darkroom-ready')).toBeInTheDocument()
  expect(keyStore.save).toHaveBeenCalledTimes(1)
  expect(keyStore.save).toHaveBeenCalledWith(vault.dek)
})

it('opens the film when the saved key still unwraps the vault', async () => {
  const vault = await makeTestVault()
  const keyStore = {
    load: vi.fn(async () => vault.dek),
    save: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  }
  render(<DarkroomApp fetchBytes={vault.fetchBytes} keyStore={keyStore} webStore={null} />)
  expect(await screen.findByTestId('darkroom-ready')).toBeInTheDocument()
  expect(screen.queryByLabelText('口令')).toBeNull()
})
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/darkroom/DarkroomApp.test.tsx`

Expected: FAIL because the checkbox is still rendered, or `save` is not called when the checkbox path is not taken.

- [ ] **Step 3: Implement**

In `DarkroomApp.tsx`, replace the save line with:

```tsx
if (store) await store.save(session.dek).catch(() => undefined)
```

In `UnlockPanel.tsx`, delete the `{canRemember && (` checkbox block (the label whose text is `在这台设备上记住`). Leave `onUnlock(passphrase, remember && canRemember)` as it is; the host no longer consults `remember`.

- [ ] **Step 4: Re-run**

Run: `npx vitest run src/darkroom/DarkroomApp.test.tsx src/vault/components/UnlockPanel.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/darkroom/DarkroomApp.tsx src/vault/components/UnlockPanel.tsx src/darkroom/DarkroomApp.test.tsx
git commit -m "fix(darkroom): always remember the vault key on this device"
```

---

### Task 2: Map rolls, radio copy, and papers

**Files:**
- Modify: `src/darkroom/reel/vaultToReelContent.ts`
- Modify: `src/darkroom/reel/playlist.ts`
- Modify: `public/reel-shell/index.html` (the `MUSIC` titles only)
- Test: `src/darkroom/reel/vaultToReelContent.test.ts`
- Test: `src/darkroom/reel/playlist.test.ts`

**Interfaces:**
- Consumes: `ReelContentInput`
- Produces: `vaultToReelContent()` returns `rolls` length 4, each `frames` length `Math.max(1, photos.length)`, names `初显` `曝光` `聚焦` `冲洗`, every frame `line` equal to that photo's caption (empty when the photo has none). `radio.dj` is `Good evening. Brought to you by your love.` `radio.song` is `《吉诺佩蒂》第一首 · 萨蒂`. `papers.notes` and `papers.lists` are the full vault records. An empty side is one blank page: `{ source: '', title: '', date: since, body: '' }` or `{ source: '', title: '', items: [] }`. `names.both` stays `暗房`. `DEFAULT_PLAYLIST` titles come from `SHELL_SONG_TITLES`. `credits` uses Chinese chrome and the name `暗房`.

- [ ] **Step 1: Write the failing test**

Replace the `builds 4×8 rolls` expectations that require 8 frames and the list title as the roll name. Add:

```ts
import { SHELL_SONG_TITLES } from './playlist'

it('puts every photo on every roll and names the rolls by play', () => {
  const photos = [
    photo({ hash: 'a', date: '2026-03-01', caption: '海' }),
    photo({ hash: 'b', date: '2026-04-02', caption: '' }),
    photo({ hash: 'c', date: '2026-05-03', caption: '山' }),
  ]
  const urls = Object.fromEntries(photos.map((p) => [p.hash, { photo: `blob:${p.hash}`, thumb: `blob:${p.hash}t`, full: `blob:${p.hash}f` }]))
  const content = vaultToReelContent({
    photos,
    notes: [{ entry: { title: '信', date: '2026-03-01', blob: 'n1', source: 'notes/n1', hash: 'n1' }, text: '你好' }],
    lists: [{ entry: { title: '想做的事', blob: 'l1', source: 'lists/l1', hash: 'l1' }, content: { items: [{ text: '冲一张', done: false }] } }],
    urls,
  })
  expect(content.rolls.map((r) => r.name)).toEqual(['初显', '曝光', '聚焦', '冲洗'])
  for (const roll of content.rolls) {
    expect(roll.frames).toHaveLength(3)
    expect(roll.frames.map((f) => f.line)).toEqual(['海', '', '山'])
  }
  expect(content.rolls[2].frames[0].line).toBe('海')
  expect(content.radio.dj).toBe('Good evening. Brought to you by your love.')
  expect(content.radio.song).toBe(SHELL_SONG_TITLES.satie)
  expect(content.papers.notes[0]).toMatchObject({ source: 'notes/n1', title: '信', body: '你好' })
  expect(content.papers.lists[0].items).toEqual([{ text: '冲一张', done: false }])
  expect(content.names.both).toBe('暗房')
})

it('offers one blank page when notes or lists are empty', () => {
  const content = vaultToReelContent({ photos: [], notes: [], lists: [], urls: {} })
  expect(content.rolls[0].frames).toHaveLength(1)
  expect(content.rolls[0].frames[0].photo).toBe('img/blank-frame.svg')
  expect(content.papers.notes).toEqual([{ source: '', title: '', date: content.since, body: '' }])
  expect(content.papers.lists).toEqual([{ source: '', title: '', items: [] }])
})
```

In `playlist.test.ts`, pair each existing `src` with its Chinese title. Add a filesystem test that `public/reel-shell/index.html` contains the same three titles. Export:

```ts
export const SHELL_SONG_TITLES = {
  satie: '《吉诺佩蒂》第一首 · 萨蒂',
  debussy: '《月光》· 德彪西',
  chopin: '《夜曲》作品 37 之 1 · 肖邦',
} as const
```

`radio.song` is `SHELL_SONG_TITLES.satie`, because the shell starts on Satie. `DEFAULT_PLAYLIST` keeps its current src order (Satie, Chopin, Debussy) and takes titles from `SHELL_SONG_TITLES`. Also set `credits` to Chinese chrome. The music row keeps `{song}` so the shell can fill the playing title. Every name row is `暗房`:

```ts
credits: [
  ['big', '一卷<em>两个人</em>'],
  ['role', '导演'], ['name', '暗房'],
  ['role', '主演'], ['name', '你<em>和</em>我'],
  ['ph', -3], ['ph', 4],
  ['role', '拍摄器材'], ['name', '一台胶片机'],
  ['role', '冲洗于'], ['name', '暗房'],
  ['role', '音乐'], ['name', '<em>{song}</em>'],
  ['ph', 2], ['ph', -4],
  ['role', '出品'], ['name', '暗房'],
  ['role', '特别感谢'], ['name', '每一张拍糊了的'],
  ['red', '下一卷见'],
]
```

Assert `JSON.stringify(content.credits)` does not contain `Directed by` or `A Roll`. User-authored note text is not part of `credits`.

Also replace the fixed English fallbacks in this same return value: torch caption fallback `最后一张`, ticket `place` `暗房`, `admit` `两位`, book byline `暗房的一卷`. Do not translate text that came from a note, list, or caption.

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/darkroom/reel/vaultToReelContent.test.ts src/darkroom/reel/playlist.test.ts`

Expected: FAIL on roll length, names, `papers`, and English song titles.

- [ ] **Step 3: Implement**

In `vaultToReelContent.ts`:

```ts
const ROLL_NAMES = ['初显', '曝光', '聚焦', '冲洗'] as const

const framesFor = (photos: PhotoEntry[], urls: ReelPhotoUrls) => {
  if (!photos.length) {
    return [{ photo: 'img/blank-frame.svg', thumb: 'img/blank-frame.svg', full: 'img/blank-frame.svg', date: '', line: '' }]
  }
  return photos.map((photo, i) => frameFromPhoto(photo, urls, i, photo.caption || ''))
}
```

Build `rolls` with `ROLL_NAMES.map((name) => ({ name, dates: '', place: '', frames: framesFor(photos, input.urls) }))`. Do not substitute note or list text into `line`.

```ts
papers: {
  notes: input.notes.length
    ? input.notes.map(({ entry, text }) => ({ source: entry.source, title: entry.title, date: entry.date, body: text }))
    : [{ source: '', title: '', date: since, body: '' }],
  lists: input.lists.length
    ? input.lists.map(({ entry, content }) => ({ source: entry.source, title: entry.title, items: content.items ?? [] }))
    : [{ source: '', title: '', items: [] }],
},
radio: {
  dj: 'Good evening. Brought to you by your love.',
  song: '《吉诺佩蒂》第一首 · 萨蒂',
},
```

Add `public/reel-shell/img/blank-frame.svg`: a 36×52 rectangle filled `#c4a574` with no letters.

Update the `MUSIC` titles in `public/reel-shell/index.html` to the three Chinese strings, still pointing at the same mp3 files. Update `playlist.ts` the same way. Keep `letter` built as it is today so older tests that only check `content.letter` still pass; stop asserting the 220-character cap as the only way notes are shown. The paged paper is `papers`, not `letter`.

- [ ] **Step 4: Re-run**

Run: `npx vitest run src/darkroom/reel/vaultToReelContent.test.ts src/darkroom/reel/playlist.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/darkroom/reel/vaultToReelContent.ts src/darkroom/reel/vaultToReelContent.test.ts src/darkroom/reel/playlist.ts src/darkroom/reel/playlist.test.ts public/reel-shell/index.html public/reel-shell/img/blank-frame.svg
git commit -m "feat(darkroom): map full rolls, papers, and the radio greeting"
```

---

### Task 3: Paper messages without reloading the film

**Files:**
- Modify: `src/darkroom/reel/ReelShellHost.tsx`
- Test: `src/darkroom/reel/ReelShellHost.test.tsx` (create)

**Interfaces:**
- Consumes: `useDarkroomVault().saveNote`, `deleteNote`, `saveList`, `deleteList`. Each returns `Promise<MutateResult>` where `MutateResult` is `{ ok: true } | { ok: false; reason: 'title' | 'date' | 'blob' | 'locked' }`.
- Produces: iframe `key` is the photo hash list only. Incoming messages:

```ts
{ roll: 'paper-save', kind: 'note', id: string, page: { source: string, title: string, date: string, body: string } }
{ roll: 'paper-save', kind: 'list', id: string, page: { source: string, title: string, items: { text: string, done: boolean }[] } }
{ roll: 'paper-delete', kind: 'note' | 'list', id: string, source: string }
```

Outgoing:

```ts
{ roll: 'paper-result', id: string, ok: boolean, reason?: 'title' | 'date' | 'blob' | 'locked' }
```

Empty `source` is omitted so `saveNote` allocates one. `paper-delete` with an empty `source` replies `{ ok: true }` and does not call delete.

- [ ] **Step 1: Write the failing test**

Create `src/darkroom/reel/ReelShellHost.test.tsx`. Mock `useDarkroomVault` to return two photos, one note, `loading: false`, `readBlob` resolving a body, and `saveNote` / `saveList` / `deleteNote` / `deleteList` as `vi.fn()`. Render the host. Assert the iframe `key` does not change when the mock note hash changes and the photo hashes do not. Dispatch a `MessageEvent` on `window`:

```ts
window.dispatchEvent(new MessageEvent('message', {
  data: { roll: 'paper-save', kind: 'note', id: 'p1', page: { source: 'notes/n1', title: '夜', date: '2026-03-01', body: '风' } },
}))
```

Expect `saveNote` called with `{ source: 'notes/n1', title: '夜', date: '2026-03-01', body: '风' }`. When `saveNote` resolves `{ ok: false, reason: 'title' }`, expect `iframe.contentWindow.postMessage` to have been called with `{ roll: 'paper-result', id: 'p1', ok: false, reason: 'title' }`.

Mock `HTMLIFrameElement.prototype.contentWindow` if jsdom leaves it null: define a `postMessage` spy before render.

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/darkroom/reel/ReelShellHost.test.tsx`

Expected: FAIL because the host ignores `paper-save` and the iframe key includes note hashes.

- [ ] **Step 3: Implement**

Pull `saveNote`, `deleteNote`, `saveList`, `deleteList` from `useDarkroomVault()`. Set payload key to `photos.map((p) => p.hash).join(',') || 'empty'`. After `setPayload`, if the iframe is already loaded, call `pushContent()` from an effect on `payload.json`.

Add a `message` listener:

```tsx
if (data?.roll === 'paper-save' && data.kind === 'note') {
  const page = data.page
  const result = await saveNote({
    source: page.source || undefined,
    title: page.title,
    date: page.date,
    body: page.body,
  })
  win?.postMessage({ roll: 'paper-result', id: data.id, ok: result.ok, reason: result.ok ? undefined : result.reason }, '*')
}
```

Same for `list` via `saveList`, and for `paper-delete` via `deleteNote` / `deleteList`. Ignore messages whose `source` event origin is not the iframe window when `contentWindow` exists.

- [ ] **Step 4: Re-run**

Run: `npx vitest run src/darkroom/reel/ReelShellHost.test.tsx src/darkroom/DarkroomApp.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/darkroom/reel/ReelShellHost.tsx src/darkroom/reel/ReelShellHost.test.tsx
git commit -m "feat(darkroom): save paper edits without reloading the film"
```

---

### Task 4: Radio voice, static, and the song line

**Files:**
- Create: `public/reel-shell/static.wav`
- Modify: `public/reel-shell/frame-c.html`
- Modify: `public/reel-shell/roll-link.js` (quiet audio decode failures)
- Test: `src/darkroom/reel/rollShellLink.test.ts`

**Interfaces:**
- Consumes: `CONTENT.radio.dj`, `CONTENT.radio.song`, shell `tracks` messages `{ roll:'tracks', list: string[], cur: number }`
- Produces: `radio()` does not call `decodeAudioData` on a missing buffer. `djt` is filled from `CONTENT.radio.dj`. `#songT` follows `list[cur]`.

- [ ] **Step 1: Write the failing test**

Append to `src/darkroom/reel/rollShellLink.test.ts`:

```ts
it('speaks the vault greeting and does not play dj2.mp3', () => {
  const html = readFileSync('public/reel-shell/frame-c.html', 'utf8')
  expect(html).toContain('speechSynthesis')
  expect(html).toContain("playbackRate = 0.96")
  expect(html).not.toMatch(/DJSRC|dj2\.mp3/)
  expect(html).toContain('static.wav')
  expect(existsSync('public/reel-shell/static.wav')).toBe(true)
})

it('sets the song line from the track list', () => {
  const html = readFileSync('public/reel-shell/frame-c.html', 'utf8')
  expect(html).toContain("songT.textContent = d.list[d.cur]")
})
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/darkroom/reel/rollShellLink.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement**

Download static from the example repo:

```bash
curl -fsSL -o public/reel-shell/static.wav \
  https://raw.githubusercontent.com/blackpeng21-lang/a-roll-for-two/main/static.wav
file public/reel-shell/static.wav
```

Expected: `WAVE audio`.

In `frame-c.html`, delete `DJSRC` and the `dj` buffer load. Keep the static bed from the current `radio()` (highpass is not applied to a missing voice buffer). Add:

```js
function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => /^en(-|_)/i.test(v.lang))
  return voices.find((v) => /male|david|daniel|alex/i.test(v.name)) || voices[0] || null
}
function speak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return }
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.96
    u.pitch = 0.85
    const voice = pickVoice()
    if (voice) u.voice = voice
    u.onend = resolve
    u.onerror = resolve
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  })
}
```

Start `speak(DJ)` when the static lead ends (`t0 + lead`), where `DJ` is `CONTENT.radio.dj`. Wrap `radio()` so a failed `decodeAudioData` resolves the bed as silent and still resolves `speak`. Do not rethrow into the scene error handler.

In the `tracks` handler, after setting `sideNo`, add `document.getElementById('songT').textContent = d.list[d.cur] || ''`.

In `roll-link.js`, extend `QUIET` to `/NotAllowedError|AbortError|ResizeObserver|EncodingError|decodeAudioData/`.

- [ ] **Step 4: Re-run**

Run: `npx vitest run src/darkroom/reel/rollShellLink.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/static.wav public/reel-shell/frame-c.html public/reel-shell/roll-link.js src/darkroom/reel/rollShellLink.test.ts
git commit -m "fix(reel): speak the radio greeting over static"
```

---

### Task 5: Paged notes and lists

**Files:**
- Create: `public/reel-shell/paper-edit.js`
- Modify: `public/reel-shell/frame-e.html`
- Create: `public/reel-shell/frame-lists.html`
- Modify: `public/reel-shell/index.html` (`SCENES` and the `at:2` warm index)
- Test: `src/darkroom/reel/rollShellLink.test.ts`

**Interfaces:**
- Consumes: `CONTENT.papers.notes` and `CONTENT.papers.lists` from Task 2. `paper-result` from Task 3.
- Produces: `window.PAPER.mount({ kind: 'note' | 'list', root })`. Scene order is `opening.html`, `frame-c.html`, `frame-e.html`, `frame-lists.html`, `rolls.html?enter=bag`, `tray.html?lt`, `torch-comic.html`, `book-cover.html`, `credits.html`.

- [ ] **Step 1: Write the failing test**

```ts
it('inserts the lists scene and does not auto-advance the letter', () => {
  const index = readFileSync('public/reel-shell/index.html', 'utf8')
  expect(index).toContain("'frame-e.html','frame-lists.html','rolls.html?enter=bag'")
  const letter = readFileSync('public/reel-shell/frame-e.html', 'utf8')
  expect(letter).toContain('paper-edit.js')
  expect(letter).not.toContain("ROLL.done('cross')")
  const lists = readFileSync('public/reel-shell/frame-lists.html', 'utf8')
  expect(lists).toContain("kind: 'list'")
  expect(lists).toContain('paper-edit.js')
})
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/darkroom/reel/rollShellLink.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement**

Write `public/reel-shell/paper-edit.js` with `PAPER.mount`. Behavior:

- Read `CONTENT.papers.notes` or `CONTENT.papers.lists`.
- After the existing tear `open()`, show the current page instead of calling `type()`.
- Note page: contenteditable title, date (`input type=date` is too chrome-like; use a text line), and body. List page: contenteditable title and one row per item with a done toggle, a delete control, and an add-row control.
- Envelope `#nameW` is `留言` or `清单`.
- Corners: notes `第 3 幕` and `3 / 9`. Lists `第 4 幕` and `4 / 9`.
- Buttons whose text is exactly `上一篇`, `下一篇`, `新的一篇`, `撕掉`, `下一幕`.
- `下一篇` / `上一篇` / `下一幕` call save first. Save posts `{ roll:'paper-save', kind, id, page }` and waits for `paper-result` with that `id`. `ok: false` and `reason: 'title'` sets a line `先写标题` and does not change page. Any other `ok: false` sets `没写上` and does not change page.
- `撕掉` asks `window.confirm('撕掉这一篇？')` before `{ roll:'paper-delete' }`. A blank unsaved page (`source === ''`) is dropped locally without a message.
- `新的一篇` appends a blank page only after the current page saves.
- `下一幕` calls `ROLL.done('cross')` only after a successful save.
- Listen for `{ roll:'vault-content' }` and replace `pages` from the new `CONTENT.papers`, keeping the current index when it still exists.

In `frame-e.html`, remove `fitLetter`, `type`, and the `ROLL.done('cross')` timer. On `open()`, call `PAPER.mount({ kind: 'note' })`. Load `paper-edit.js` after `content.js`.

Copy `frame-e.html` to `frame-lists.html` and mount `{ kind: 'list' }`.

In `index.html`:

```js
const SCENES=['opening.html','frame-c.html','frame-e.html','frame-lists.html','rolls.html?enter=bag','tray.html?lt','torch-comic.html','book-cover.html','credits.html'];
```

Scene indexes become opening 0, radio 1, notes 2, lists 3, rolls 4, tray 5, torch 6, book 7, credits 8. Set `HEAVY` and `SAYS_READY` to `new Set([4, 5, 7])`. Warm ranges become `{at:0,to:4}`, `{at:3,to:5}`, `{at:5,to:7}`.

- [ ] **Step 4: Re-run**

Run: `npx vitest run src/darkroom/reel/rollShellLink.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/paper-edit.js public/reel-shell/frame-e.html public/reel-shell/frame-lists.html public/reel-shell/index.html src/darkroom/reel/rollShellLink.test.ts
git commit -m "feat(reel): page notes and lists without auto-advance"
```

---

### Task 6: Roll length and the viewer caption

**Files:**
- Modify: `public/reel-shell/rolls.html`
- Test: `src/darkroom/reel/rollShellLink.test.ts`

**Interfaces:**
- Consumes: `CONTENT.rolls[i].frames`, `frames[i].line`, `frames[i].date` from Task 2.
- Produces: `N` is `Math.max(1, CONTENT.rolls[0].frames.length)`. The viewer overlay uses `f.line` only, which is the caption. The plate text is `聚焦`, not `far away`.

- [ ] **Step 1: Write the failing test**

```ts
it('sizes the rolls to the vault and captions the viewer from the frame line', () => {
  const html = readFileSync('public/reel-shell/rolls.html', 'utf8')
  expect(html).toContain('CONTENT.rolls[0].frames.length')
  expect(html).not.toContain("fillText('far away'")
  expect(html).toContain("fillText('聚焦'")
  expect(html).toContain('第 5 幕')
})
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/darkroom/reel/rollShellLink.test.ts`

Expected: FAIL on `const N=8` and `far away`.

- [ ] **Step 3: Implement**

Replace `const N=8` with:

```js
const N=Math.max(1, (CONTENT.rolls[0]&&CONTENT.rolls[0].frames.length)||1), S=N+1
```

Leave `STYLE` play order as `pull`, `light`, `viewer`, `sheet`. That keeps 冲洗 as the roll whose circles go to the tray. In the contact-sheet drawing, replace the hardcoded `4*CW` width with `cols = Math.min(4, N)` and `Math.ceil(N / cols)` rows. The viewer caption builder already writes `f.date` and `f.line`; leave that, and do not append note text. Change the plate `fillText('far away'` to `fillText('聚焦'` and `SLIDE VIEWER · No.3` to `聚焦`. Set the corner to `第 5 幕`.

- [ ] **Step 4: Re-run**

Run: `npx vitest run src/darkroom/reel/rollShellLink.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/rolls.html src/darkroom/reel/rollShellLink.test.ts
git commit -m "feat(reel): show every photo on the four named rolls"
```

---

### Task 7: Chinese UI and the two fonts

**Files:**
- Modify: `public/reel-shell/zh.js`
- Modify: `public/reel-shell/index.html`
- Modify: `public/reel-shell/opening.html`
- Modify: `public/reel-shell/frame-c.html`
- Modify: `public/reel-shell/tray.html`
- Modify: `public/reel-shell/wall.html`
- Modify: `public/reel-shell/torch-comic.html`
- Modify: `public/reel-shell/book-cover.html`
- Modify: `public/reel-shell/roll-link.js`
- Create: `public/reel-shell/font/LXGWWenKai-Regular.woff2`
- Create: `public/reel-shell/font/MaShanZheng-Regular.ttf`
- Test: `src/darkroom/reel/rollShellLink.test.ts`

**Interfaces:**
- Consumes: the shell's existing `zh.js` replacer, which keys dictionaries by `location.pathname` filename.
- Produces: default language `zh` when `localStorage['aroll.lang']` is unset. `index.html` uses the same dictionary currently stored under `roll.html`. Opening text `宝宝，往下看`. Corners: radio `第 2 幕` `2 / 9`, tray `第 6 幕`, wall `第 6 幕`, torch `第 7 幕`, book `第 8 幕`. Fonts `ZH Kai` and `ZH Brush` load from the two new files. Reenie and Allura map to `ZH Brush`. Everything else maps to `ZH Kai`.

- [ ] **Step 1: Write the failing test**

```ts
it('defaults to Chinese and uses the two local faces', () => {
  const zh = readFileSync('public/reel-shell/zh.js', 'utf8')
  expect(zh).toContain("lang = localStorage.getItem('aroll.lang') || 'zh'")
  expect(zh).toContain("'index.html'")
  expect(zh).toContain('宝宝，往下看')
  const link = readFileSync('public/reel-shell/roll-link.js', 'utf8')
  expect(link).toContain('font/LXGWWenKai-Regular.woff2')
  expect(link).toContain('font/MaShanZheng-Regular.ttf')
  expect(link).toContain('ZH Brush')
  const opening = readFileSync('public/reel-shell/opening.html', 'utf8')
  expect(opening).toContain('宝宝，往下看')
  expect(opening).not.toContain('roll it, darling')
})
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/darkroom/reel/rollShellLink.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement**

Download fonts (OFL). Reject the 258964-byte placeholder:

```bash
curl -fsSL -o public/reel-shell/font/MaShanZheng-Regular.ttf \
  https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf
curl -fsSL -L -o public/reel-shell/font/LXGWWenKai-Regular.woff2 \
  https://github.com/lxgw/LxgwWenKai/releases/download/v1.511/LXGWWenKai-Regular.woff2
wc -c public/reel-shell/font/MaShanZheng-Regular.ttf public/reel-shell/font/LXGWWenKai-Regular.woff2
```

Expected: each file is larger than 1000000 bytes. If the LXGW tag does not contain that asset name, open `https://api.github.com/repos/lxgw/LxgwWenKai/releases/latest` and download the asset whose name is `LXGWWenKai-Regular.woff2`.

In `zh.js`, change the initial read to `let lang='zh'; try{lang=localStorage.getItem('aroll.lang')||'zh'}catch(e){}`. Copy the `roll.html` dictionary onto a new `'index.html'` key and add the three song titles there if they are not already covered. Add `'opening.html': { 'roll it, darling': '宝宝，往下看' }` only if the HTML still contains the English; Task 7 also replaces the HTML text, so the dictionary entry stays as a second line of defense.

In `roll-link.js`, replace the inline `ZH Kai` face so its `src` is `font/LXGWWenKai-Regular.woff2`. Add a second face:

```js
@font-face{font-family:'ZH Brush';src:url(font/MaShanZheng-Regular.ttf) format('truetype');unicode-range:U+2E80-9FFF,U+3000-303F,U+FF00-FFEF}
```

In `zh.js` `fonts`, map `/Reenie|Allura|Sacramento|Corinthia|Ephesis|Herr Von|Mrs Saint/i` to `ZH Brush`, and the default `/./` to `ZH Kai`. Include `ZH Brush` in the `document.fonts.load` lists next to `ZH Kai`.

Replace these exact corner strings in the HTML files:

| File | From | To |
|------|------|----|
| `opening.html` | `roll it, darling` | `宝宝，往下看` |
| `frame-c.html` | `Scene 02 — The darkroom` | `第 2 幕 · 暗房` |
| `frame-c.html` | `02 / 24` | `2 / 9` |
| `frame-c.html` | `KODAK GOLD 200 ▸ 9 ▸ 9A ▸ 10` | `第9格 ▸ 第9A格 ▸ 第10格` |
| `frame-c.html` | `▸ 11 ▸ 11A ▸ 12 ▸ 12A` | `第11格 ▸ 第11A格 ▸ 第12格 ▸ 第12A格` |
| `frame-c.html` | `KODAK GOLD 200 ▸ 13 ▸ 13A` | `第13格 ▸ 第13A格` |
| `frame-c.html` | `▸ 14 ▸ 14A ▸ 15` | `第14格 ▸ 第14A格 ▸ 第15格` |
| `tray.html` | `Scene 05 — The tray` | `第 6 幕 · 显影盘` |
| `wall.html` | `Scene 06 — The wall` | `第 6 幕 · 照片墙` |
| `torch-comic.html` | `Scene 07 · The torch` | `第 7 幕 · 手电筒` |
| `book-cover.html` | `Scene 08 — The book` | `第 8 幕 · 书` |

Bump `window.FILM_V` in `index.html` to `scenes1` so the shell cache key changes.

- [ ] **Step 4: Re-run**

Run: `npx vitest run src/darkroom/reel/rollShellLink.test.ts src/darkroom/reel/vaultToReelContent.test.ts src/darkroom/DarkroomApp.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/zh.js public/reel-shell/index.html public/reel-shell/opening.html public/reel-shell/frame-c.html public/reel-shell/tray.html public/reel-shell/wall.html public/reel-shell/torch-comic.html public/reel-shell/book-cover.html public/reel-shell/roll-link.js public/reel-shell/font/LXGWWenKai-Regular.woff2 public/reel-shell/font/MaShanZheng-Regular.ttf src/darkroom/reel/rollShellLink.test.ts
git commit -m "feat(reel): show the shell in Chinese with kai and brush faces"
```
