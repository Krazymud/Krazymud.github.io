# iOS Portrait Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a small screen the nine-scene film fills the phone with the same light, grain, masks, and three.js render, and a wide desktop keeps the 1600×1000 stage.

**Architecture:** `ROLL.fitStage` in `roll-link.js` decides desk, portrait, or phone-wide from the visible viewport and sets the stage size. `portrait.css` only moves the existing nodes. The three WebGL scenes keep their materials, lights, and pixel ratio, and change canvas size plus camera only while the stage is `portrait`.

**Tech Stack:** Vanilla pages in `public/reel-shell/`, Vitest source tests, three.js already vendored as `lib/three.module.js`.

**Spec:** `docs/superpowers/specs/2026-11-14-ios-portrait-layout-design.md`

## Global Constraints

- Desktop (`k ≥ 0.7`) stays `translate(-50%,-50%) scale(k)` on a 1600×1000 stage. No `portrait` class and no `phonewide` class.
- `k = min(w/1600, h/1000)`. `w` is `min(innerWidth, visualViewport.width)` and `h` is `min(innerHeight, visualViewport.height)`.
- `k < 0.7` and `h ≥ w`: class `portrait`, transform none, stage is the visible viewport.
- `k < 0.7` and `w > h`: class `phonewide`, transform none. The existing `.proj` is cover-scaled and centered. Objects keep their desktop positions.
- Do not add a second DOM, a flat page, or another WebGL context. Do not change materials, lights, tone mapping, exposure, environment, or `ROLL.pr()` (1 / 1.5 / 2).
- Do not preload the next scene on phones. Leave the `LEAN` check in `index.html` alone.
- Do not change the passphrase dialog, the greeting `Good evening. Brought to you by your love.`, or the three song titles.
- Portrait type: body 17px, song 22px Fraunces italic, opening title clamp 40–64px, red handwriting 30px, corners 12px. Hit targets at least 44×44. Colors `#f3e6d2`, `#040302`, `#ee5546`.
- Phone-wide letter and list body at least 16px on screen. Hit targets at least 44×44.
- One scene at a time. The opening filters stay only on the opening document.

## File map

| Path | Responsibility |
|------|----------------|
| `public/reel-shell/roll-link.js` | `ROLL.compact`, `ROLL.view`, `ROLL.fitStage` |
| `public/reel-shell/portrait.css` | Portrait and phone-wide placement of existing nodes |
| `src/darkroom/reel/portraitFit.test.ts` | Runs `ROLL.compact` and checks the nine pages call `fitStage` |
| Nine scene HTML files | Call `fitStage`, link `portrait.css` |
| `public/reel-shell/paper-edit.js` | 17px body and 44px bar when the stage is portrait or phone-wide |
| `rolls.html`, `tray.html`, `book-cover.html` | Canvas size and camera only in portrait |

`wall.html` is not one of the nine scenes. Do not edit it.

---

### Task 1: Viewport decision

**Files:**
- Modify: `public/reel-shell/roll-link.js` (the `window.ROLL={` object, after `pr()`)
- Test: `src/darkroom/reel/portraitFit.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `ROLL.compact(w: number, h: number): boolean`, `ROLL.view(): {w: number, h: number}`, `ROLL.fitStage(stage: HTMLElement): {mode: 'desk'|'portrait'|'phonewide', w: number, h: number, k: number, cover: number, pointer: number}`

- [ ] **Step 1: Write the failing test**

Create `src/darkroom/reel/portraitFit.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function compactFromSource(): (w: number, h: number) => boolean {
  const src = readFileSync(join(process.cwd(), 'public/reel-shell/roll-link.js'), 'utf8')
  const m = src.match(/compact\(w,h\)\{return ([^}]+)\}/)
  if (!m) throw new Error('ROLL.compact missing')
  return new Function('w', 'h', 'return (' + m[1] + ')') as (w: number, h: number) => boolean
}

describe('ROLL.compact', () => {
  const compact = compactFromSource()
  it('is true for phones and a tall iPad', () => {
    expect(compact(390, 844)).toBe(true)
    expect(compact(390, 664)).toBe(true)
    expect(compact(844, 390)).toBe(true)
    expect(compact(820, 1180)).toBe(true)
  })
  it('is false for a desktop and a landscape iPad', () => {
    expect(compact(1440, 900)).toBe(false)
    expect(compact(1180, 820)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: FAIL with `ROLL.compact missing`.

- [ ] **Step 3: Add the three methods**

Inside `window.ROLL={...}`, immediately after `pr()`, add:

```js
  compact(w,h){return Math.min(w/1600,h/1000)<0.7},
  view(){const vv=window.visualViewport;return {w:Math.min(innerWidth,vv?vv.width:innerWidth),h:Math.min(innerHeight,vv?vv.height:innerHeight)}},
  fitStage(stage){
    const {w,h}=this.view(),compact=this.compact(w,h),portrait=compact&&h>=w;
    const k=Math.min(w/1600,h/1000),cover=Math.max(w/1040,h/694);
    stage.classList.toggle('portrait',portrait);
    stage.classList.toggle('phonewide',compact&&w>h);
    if(!compact){
      stage.style.left='50%';stage.style.top='50%';stage.style.width='1600px';stage.style.height='1000px';
      stage.style.transform=`translate(-50%,-50%) scale(${k})`;
    }else{
      stage.style.left='0';stage.style.top='0';stage.style.width=w+'px';stage.style.height=h+'px';stage.style.transform='none';
      stage.style.setProperty('--cover',String(cover));
    }
    const mode=portrait?'portrait':compact?'phonewide':'desk';
    const box={mode,w,h,k,cover,pointer:mode==='desk'?k:mode==='phonewide'?cover:1};
    window.dispatchEvent(new CustomEvent('reel-fit',{detail:box}));
    return box;
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/roll-link.js src/darkroom/reel/portraitFit.test.ts
git commit -m "feat(reel): decide portrait from the visible viewport"
```

---

### Task 2: Every scene uses fitStage

**Files:**
- Create: `public/reel-shell/portrait.css`
- Modify: `opening.html`, `frame-c.html`, `frame-e.html`, `frame-lists.html`, `rolls.html`, `tray.html`, `torch-comic.html`, `book-cover.html`, `credits.html`
- Test: `src/darkroom/reel/portraitFit.test.ts`

**Interfaces:**
- Consumes: `ROLL.fitStage`
- Produces: each scene's `fit` assigns `k = box.pointer` when that file already has `let k`

- [ ] **Step 1: Extend the test**

Add this case to `portraitFit.test.ts`:

```ts
const PAGES = ['opening.html','frame-c.html','frame-e.html','frame-lists.html','rolls.html','tray.html','torch-comic.html','book-cover.html','credits.html']

it('points every scene at fitStage and the portrait sheet', () => {
  for (const page of PAGES) {
    const html = readFileSync(join(process.cwd(), 'public/reel-shell', page), 'utf8')
    expect(html, page).toContain('portrait.css?v=portrait1')
    expect(html, page).toContain('ROLL.fitStage(')
    expect(html, page).not.toContain('innerWidth/1600')
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: FAIL because `opening.html` has no `portrait.css?v=portrait1`.

- [ ] **Step 3: Shared sheet and the nine call sites**

Create `public/reel-shell/portrait.css`:

```css
#stage.portrait,#stage.phonewide{position:absolute}
#stage.portrait .proj{left:12px;top:12px;width:calc(100% - 24px);height:calc(100% - 24px)}
#stage.phonewide .proj{left:50%;top:50%;width:1040px;height:694px;transform:translate(-50%,-50%) scale(var(--cover))}
#stage.portrait .mono,#stage.phonewide .mono{font-size:12px}
```

In each of the nine HTML files, add this line inside `<head>` after the viewport meta:

```html
<link rel="stylesheet" href="portrait.css?v=portrait1">
```

Replace each existing `fit` function. Files that declare `let k` (`frame-e.html`, `frame-lists.html`, `rolls.html`, `tray.html`, `torch-comic.html`) use:

```js
const fit=()=>{const box=ROLL.fitStage(s);k=box.pointer};
```

Files that do not (`opening.html`, `frame-c.html`, `credits.html`, `book-cover.html`) use:

```js
const fit=()=>{ROLL.fitStage(s)};
```

Keep the existing `fit();addEventListener('resize',fit)` line. On the same `resize` listener, also subscribe:

```js
if(window.visualViewport){visualViewport.addEventListener('resize',fit);visualViewport.addEventListener('scroll',fit)}
```

Bump every `roll-link.js?v=vaultcta2` on these nine pages to `roll-link.js?v=portrait1`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts src/darkroom/reel/rollShellLink.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/portrait.css public/reel-shell/*.html src/darkroom/reel/portraitFit.test.ts
git commit -m "feat(reel): size every scene from the visible viewport"
```

---

### Task 3: Opening portrait

**Files:**
- Modify: `public/reel-shell/portrait.css`
- Test: `src/darkroom/reel/portraitFit.test.ts`

**Interfaces:**
- Consumes: `#stage.portrait` from Task 2
- Produces: portrait rules for `.title`, `.mark`, `.strip` inside the opening document

- [ ] **Step 1: Write the failing test**

```ts
it('gives the opening a readable portrait title and cue', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(css).toContain('#stage.portrait .title h1{font-size:clamp(40px,12vw,64px)}')
  expect(css).toContain('#stage.portrait .mark span{font-size:30px}')
  expect(css).toContain('#stage.portrait .mark{min-width:44px;min-height:44px}')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: FAIL on the missing `clamp(40px,12vw,64px)` rule.

- [ ] **Step 3: Append the opening rules**

Append to `portrait.css`:

```css
#stage.portrait .title{left:6%;width:62%;top:16%}
#stage.portrait .title h1{font-size:clamp(40px,12vw,64px)}
#stage.portrait .title .sub{font-size:17px}
#stage.portrait .mark{left:10%;top:46%;width:58%;height:88px;min-width:44px;min-height:44px}
#stage.portrait .mark span{font-size:30px}
#stage.portrait .strip{left:auto;right:3%;width:78px}
#stage.portrait .log{font-size:12px}
```

The opening markup already has `.title h1`, `.mark span`, and `.strip`. Do not add nodes.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/portrait.css src/darkroom/reel/portraitFit.test.ts
git commit -m "feat(reel): stack the opening inside the portrait gate"
```

---

### Task 4: Radio portrait

**Files:**
- Modify: `public/reel-shell/portrait.css`
- Test: `src/darkroom/reel/portraitFit.test.ts`

**Interfaces:**
- Consumes: `#stage.portrait`
- Produces: portrait rules for `.bulb`, `.radio`, `.cord`, `.now .song`

- [ ] **Step 1: Write the failing test**

```ts
it('places the radio under the bulb with a 22px song', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(css).toContain('#stage.portrait .now .song{font-size:22px}')
  expect(css).toContain('#stage.portrait .cord{min-width:44px;min-height:44px}')
  expect(css).toContain('#stage.portrait .radio{left:8%;top:36%;width:74%')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: FAIL on the missing song rule.

- [ ] **Step 3: Append the radio rules**

```css
#stage.portrait .bulb{left:42%}
#stage.portrait .radio{left:8%;top:36%;width:74%;height:auto}
#stage.portrait .radio img{width:100%;height:auto}
#stage.portrait .cord{left:auto;right:4%;top:22%;width:72px;min-width:44px;min-height:44px}
#stage.portrait .now{left:8%;right:8%;top:auto;bottom:7%;width:auto}
#stage.portrait .now .song{font-size:22px;font-family:Fraunces,serif;font-style:italic}
```

Do not edit `dj()`, `static.wav`, or the song strings in `frame-c.html`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts src/darkroom/reel/rollShellLink.test.ts`

Expected: PASS. The greeting test still sees `speechSynthesis` and not `dj2.mp3`.

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/portrait.css src/darkroom/reel/portraitFit.test.ts
git commit -m "feat(reel): stack the radio scene in portrait"
```

---

### Task 5: Letter and list paper

**Files:**
- Modify: `public/reel-shell/portrait.css`
- Modify: `public/reel-shell/paper-edit.js` (the `coarse` bar and `bodyEl` styles, around the bar creation)
- Test: `src/darkroom/reel/portraitFit.test.ts`
- Test: `src/darkroom/reel/paperEdit.test.ts` (existing; keep it passing)

**Interfaces:**
- Consumes: `reel-fit` event from `ROLL.fitStage`, detail `{mode, pointer}`
- Produces: portrait paper column and a 44px bar that does not cover the paper

- [ ] **Step 1: Write the failing test**

```ts
it('keeps the letter body at 17px in portrait and 44px tall buttons', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  const js = readFileSync(join(process.cwd(), 'public/reel-shell/paper-edit.js'), 'utf8')
  expect(css).toContain('#stage.portrait .letter pre{font-size:17px}')
  expect(js).toContain("minHeight = mode ? '44px'")
  expect(js).toContain("reel-fit")
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: FAIL on the missing letter rule.

- [ ] **Step 3: CSS and the bar**

Append:

```css
#stage.portrait .letter{left:16px;top:48px;width:calc(100% - 32px);height:calc(100% - 148px);transform:none}
#stage.portrait .letter pre{font-size:17px;max-height:none}
#stage.portrait .letter .head{font-size:12px}
#stage.portrait .env{left:16px;top:auto;bottom:96px;width:46%;height:auto}
#stage.portrait .tearhint{font-size:30px}
#stage.phonewide .letter pre{font-size:calc(16px / var(--cover))}
```

In `paper-edit.js`, after the bar is built, add:

```js
const fitBar = () => {
  const stage = document.getElementById('stage')
  const mode = stage && (stage.classList.contains('portrait') || stage.classList.contains('phonewide'))
  bar.querySelectorAll('button').forEach((b) => {
    b.style.minHeight = mode ? '44px' : ''
    b.style.fontSize = mode ? '15px' : b.style.fontSize
  })
  if (bodyEl) bodyEl.style.fontSize = stage && stage.classList.contains('portrait') ? '17px' : '15px'
}
addEventListener('reel-fit', fitBar)
```

`bodyEl` exists only for notes. Guard with `if (bodyEl)`.

The coarse bar is already `position:fixed` on `document.body`. Leave that. The portrait paper height `calc(100% - 148px)` leaves the bar's 44px plus padding in the dark under the paper.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts src/darkroom/reel/paperEdit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/portrait.css public/reel-shell/paper-edit.js src/darkroom/reel/portraitFit.test.ts
git commit -m "feat(reel): make the letter and list readable in portrait"
```

---

### Task 6: Roll cans

**Files:**
- Modify: `public/reel-shell/rolls.html` (after the can holders exist, and inside `fit`)
- Test: `src/darkroom/reel/portraitFit.test.ts`

**Interfaces:**
- Consumes: `ROLL.fitStage` return `{mode, pointer}` and the existing `k` used by `local()`
- Produces: portrait can positions and a restored desktop row when `mode` is not `portrait`

- [ ] **Step 1: Write the failing test**

```ts
it('stores both can rows and resizes the portrait canvas', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/rolls.html'), 'utf8')
  expect(html).toContain('const POS_PORT=[[0.15,-1.6],[-0.2,-0.45],[0.2,0.7],[-0.1,1.85]]')
  expect(html).toContain('const POS_DESK=[[-2.5,-.35],[-.75,.95],[1.05,-.75],[2.75,.7]]')
  expect(html).toContain('renderer.setSize(r.width,r.height,false)')
  expect(html).toContain('cam.aspect=r.width/Math.max(1,r.height)')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: FAIL on missing `POS_PORT`.

- [ ] **Step 3: Place the cans and resize the canvas**

`fit()` currently runs before `renderer` exists. Change it to:

```js
let layout3d=null;
const fit=()=>{const box=ROLL.fitStage(s);k=box.pointer;if(layout3d)layout3d(box)};
fit();addEventListener('resize',fit);
if(window.visualViewport){visualViewport.addEventListener('resize',fit);visualViewport.addEventListener('scroll',fit)}
```

After the four holders exist (the loop that sets `holder.userData`), add:

```js
const POS_DESK=[[-2.5,-.35],[-.75,.95],[1.05,-.75],[2.75,.7]];
const POS_PORT=[[0.15,-1.6],[-0.2,-0.45],[0.2,0.7],[-0.1,1.85]];
function placeCans(mode){
  const pos=mode==='portrait'?POS_PORT:POS_DESK;
  cans.forEach((h,i)=>{h.position.set(pos[i][0],h.userData.base.y,pos[i][1]);h.userData.base.copy(h.position)});
}
function dolly(look,points){
  const dir=cam.position.clone().sub(look);let dist=dir.length();dir.normalize();
  const fov=32*Math.PI/180,tanV=Math.tan(fov/2),tanH=tanV*cam.aspect;
  for(let n=0;n<40;n++){
    cam.position.copy(look).addScaledVector(dir,dist);
    const forward=look.clone().sub(cam.position).normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    const up=new THREE.Vector3().crossVectors(right,forward).normalize();
    const ok=points.every(p=>{const rel=p.clone().sub(cam.position),depth=rel.dot(forward);if(depth<=0.2)return false;
      return Math.abs(rel.dot(right)/depth)<tanH*0.9&&Math.abs(rel.dot(up)/depth)<tanV*0.9});
    if(ok)break;dist+=0.35}
  cam.lookAt(look);
}
layout3d=(box)=>{
  const proj=document.querySelector('.proj'),r=proj.getBoundingClientRect();
  if(box.mode==='portrait'){
    renderer.setSize(r.width,r.height,false);cam.aspect=r.width/Math.max(1,r.height);cam.updateProjectionMatrix();
    placeCans('portrait');
    cam.position.set(0,7,5.4);
    dolly(new THREE.Vector3(0,0,.15),POS_PORT.map(([x,z])=>new THREE.Vector3(x,.2,z)).concat([new THREE.Vector3(0,.2,2.4)]));
  }else{
    renderer.setSize(1040,694,false);cam.aspect=1040/694;cam.updateProjectionMatrix();
    placeCans('desk');cam.position.copy(HOME.pos);cam.lookAt(HOME.look);
  }
};
layout3d(ROLL.fitStage(s));
```

Use the real holder array if it is not named `cans`. `userData.base` is already cloned at creation; overwrite it in `placeCans` so a lifted can returns to the portrait spot. Do not change `HOME`, the lamp, or `renderer.setPixelRatio`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/rolls.html src/darkroom/reel/portraitFit.test.ts
git commit -m "feat(reel): gather the four cans for a portrait camera"
```

---

### Task 7: Light table

**Files:**
- Modify: `public/reel-shell/tray.html`
- Test: `src/darkroom/reel/portraitFit.test.ts`

**Interfaces:**
- Consumes: `ROLL.fitStage`, the existing `tray` group, `cam`, `LOOK`
- Produces: portrait canvas size; camera dollies back only until the tray rim fits

- [ ] **Step 1: Write the failing test**

```ts
it('resizes the light table with the portrait frame', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/tray.html'), 'utf8')
  expect(html).toContain("box.mode==='portrait'")
  expect(html).toContain('renderer.setSize(r.width,r.height,false)')
  expect(html).toContain('Box3')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: FAIL on missing `Box3`.

- [ ] **Step 3: Resize after the tray exists**

`fit()` at the top of the module runs before `renderer` exists. Replace it with:

```js
let layout3d=null;
const fit=()=>{const box=ROLL.fitStage(s);k=box.pointer;if(layout3d)layout3d(box)};
fit();addEventListener('resize',fit);
if(window.visualViewport){visualViewport.addEventListener('resize',fit);visualViewport.addEventListener('scroll',fit)}
```

After `tray` and the `?lt` camera branch exist, assign `layout3d`. In portrait:

```js
const deskPos=cam.position.clone(),deskLook=LOOK.clone();
layout3d=(box)=>{
  const r=document.querySelector('.proj').getBoundingClientRect();
  if(box.mode!=='portrait'){
    renderer.setSize(1040,694,false);cam.aspect=1040/694;cam.position.copy(deskPos);cam.lookAt(deskLook);cam.updateProjectionMatrix();return}
  renderer.setSize(r.width,r.height,false);cam.aspect=r.width/Math.max(1,r.height);cam.position.copy(deskPos);cam.lookAt(deskLook);cam.updateProjectionMatrix();
  const box3=new THREE.Box3().setFromObject(tray);
  const corners=[
    new THREE.Vector3(box3.min.x,box3.min.y,box3.min.z),new THREE.Vector3(box3.min.x,box3.min.y,box3.max.z),
    new THREE.Vector3(box3.min.x,box3.max.y,box3.min.z),new THREE.Vector3(box3.min.x,box3.max.y,box3.max.z),
    new THREE.Vector3(box3.max.x,box3.min.y,box3.min.z),new THREE.Vector3(box3.max.x,box3.min.y,box3.max.z),
    new THREE.Vector3(box3.max.x,box3.max.y,box3.min.z),new THREE.Vector3(box3.max.x,box3.max.y,box3.max.z)]
  const look=deskLook.clone(),dir=deskPos.clone().sub(look);let dist=dir.length();dir.normalize();
  const fov=32*Math.PI/180,tanV=Math.tan(fov/2);
  for(let n=0;n<40;n++){
    cam.position.copy(look).addScaledVector(dir,dist);cam.lookAt(look);cam.updateProjectionMatrix();
    const tanH=tanV*cam.aspect,forward=look.clone().sub(cam.position).normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    const up=new THREE.Vector3().crossVectors(right,forward).normalize();
    const ok=corners.every(p=>{const rel=p.clone().sub(cam.position),depth=rel.dot(forward);if(depth<=0.2)return false;
      return Math.abs(rel.dot(right)/depth)<tanH*0.92&&Math.abs(rel.dot(up)/depth)<tanV*0.92});
    if(ok)break;dist+=0.25}
};
```

Copy `deskPos` after the `?lt` camera branch has run, so that branch's position is the one portrait dollies from. Do not change lights or `setPixelRatio`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/tray.html src/darkroom/reel/portraitFit.test.ts
git commit -m "feat(reel): fit the light table into the portrait frame"
```

---

### Task 8: Book cover

**Files:**
- Modify: `public/reel-shell/book-cover.html`
- Test: `src/darkroom/reel/portraitFit.test.ts`

**Interfaces:**
- Consumes: `BW` from `./bc-book.js`, `cam`, `BOOK`
- Produces: portrait look-at on the book, cover about 72% of the frame width

- [ ] **Step 1: Write the failing test**

```ts
it('frames the book cover at 72% of the portrait width', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/book-cover.html'), 'utf8')
  expect(html).toContain('BW/(2*Math.tan(30*Math.PI/360)*cam.aspect*0.72)')
  expect(html).toContain('cam.lookAt(1.15,0,-.1)')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: FAIL on the missing distance formula.

- [ ] **Step 3: Dolly to the cover**

`fit()` runs before `renderer` exists. Replace it with:

```js
let layout3d=null;
const fit=()=>{ROLL.fitStage(s);if(layout3d)layout3d(ROLL.fitStage(s))};
fit();addEventListener('resize',fit);
if(window.visualViewport){visualViewport.addEventListener('resize',fit);visualViewport.addEventListener('scroll',fit)}
```

Calling `fitStage` twice is harmless. After `cam` and the book exist, assign `layout3d`. Portrait branch:

```js
renderer.setSize(r.width,r.height,false);
cam.aspect=r.width/Math.max(1,r.height);
cam.updateProjectionMatrix();
const look=new THREE.Vector3(1.15,0,-.1);
const dist=BW/(2*Math.tan(30*Math.PI/360)*cam.aspect*0.72);
const dir=new THREE.Vector3(.4,7.2,5.4).sub(look).normalize();
cam.position.copy(look).addScaledVector(dir,dist);
cam.lookAt(1.15,0,-.1);
```

Non-portrait branch restores `setSize(1040,694,false)`, `cam.aspect=1040/694`, `cam.position.set(.4,7.2,5.4)`, `cam.lookAt(.4,0,-.15)`. Do not change `makeBook`, the environment map, or the lamps.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/book-cover.html src/darkroom/reel/portraitFit.test.ts
git commit -m "feat(reel): frame the book cover for a tall screen"
```

---

### Task 9: Comic desk

**Files:**
- Modify: `public/reel-shell/portrait.css`
- Modify: `public/reel-shell/torch-comic.html` (the viewBox width only)
- Test: `src/darkroom/reel/portraitFit.test.ts`

**Interfaces:**
- Consumes: existing `#desk` SVG, `IMG_H`, `toDesk`
- Produces: a tall window onto the same drawing; horizontal pan and tap coordinates stay on `toDesk`

The comic is one wide SVG, not separate panels. Portrait does not rebuild the stickers. It shows a tall slice of that drawing and the flashlight still pans across it.

- [ ] **Step 1: Write the failing test**

```ts
it('opens a tall window on the comic desk', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/torch-comic.html'), 'utf8')
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(html).toContain("s.classList.contains('portrait')?IMG_H*(r.width/Math.max(1,r.height)):VW")
  expect(css).toContain('#stage.portrait #desk{width:100%;height:calc(100% - 72px)}')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: FAIL on the missing ternary.

- [ ] **Step 3: Tall viewBox**

Append:

```css
#stage.portrait #desk{width:100%;height:calc(100% - 72px)}
#stage.portrait .arrow span{font-size:18px}
```

Where the pan writes the viewBox (`desk.setAttribute('viewBox', ...)`), the window width becomes:

```js
const r=desk.getBoundingClientRect();
const win=s.classList.contains('portrait')?IMG_H*(r.width/Math.max(1,r.height)):VW;
desk.setAttribute('viewBox',`${vx.toFixed(1)} 0 ${win} ${IMG_H}`);
```

Leave `toDesk` as it is. It already reads `viewBox.baseVal`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/portrait.css public/reel-shell/torch-comic.html src/darkroom/reel/portraitFit.test.ts
git commit -m "feat(reel): show the comic desk through a tall window"
```

---

### Task 10: Credits

**Files:**
- Modify: `public/reel-shell/portrait.css`
- Test: `src/darkroom/reel/portraitFit.test.ts`

**Interfaces:**
- Consumes: `.credits`, `.rollup .name` already in `credits.html`
- Produces: crawl column centered in the portrait gate, names at least 18px

- [ ] **Step 1: Write the failing test**

```ts
it('rolls the credits at a readable size', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(css).toContain('#stage.portrait .credits{left:12%;width:76%;top:8%;bottom:8%}')
  expect(css).toContain('#stage.portrait .rollup .name{font-size:22px}')
  expect(css).toContain('#stage.portrait .thend{left:12%;width:76%}')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts`

Expected: FAIL on the missing credits rule.

- [ ] **Step 3: Append the credits rules**

```css
#stage.portrait .credits{left:12%;width:76%;top:8%;bottom:8%}
#stage.portrait .rollup .name{font-size:22px}
#stage.portrait .rollup .role{font-size:12px}
#stage.portrait .thend{left:12%;width:76%}
#stage.portrait .thend p{font-size:40px}
```

Do not change the credit strings.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts src/darkroom/reel/rollShellLink.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/reel-shell/portrait.css src/darkroom/reel/portraitFit.test.ts
git commit -m "feat(reel): roll the credits inside the portrait gate"
```

---

### Task 11: Measure a phone viewport

**Files:**
- Create: `scripts/portrait-measure.mjs` (local check, not imported by Vitest)

**Interfaces:**
- Consumes: the static files from Tasks 1–10, served from `public/`
- Produces: a pass/fail printout for the spec's phone measurements

- [ ] **Step 1: Write the script**

```js
import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg
const base = process.env.REEL_ORIGIN || 'http://127.0.0.1:50149/reel-shell'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
async function open(path) {
  await page.goto(base + path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  return page.evaluate(() => {
    const s = document.getElementById('stage')
    const proj = document.querySelector('.proj').getBoundingClientRect()
    return { portrait: s.classList.contains('portrait'), phonewide: s.classList.contains('phonewide'), projH: proj.height, innerH: innerHeight }
  })
}
const opening = await open('/opening.html')
if (!opening.portrait || opening.phonewide) throw new Error('opening class ' + JSON.stringify(opening))
if (opening.projH < opening.innerH * 0.7) throw new Error('opening frame short ' + opening.projH)
const cue = await page.evaluate(() => {
  const el = document.querySelector('.mark span')
  const b = document.querySelector('.mark').getBoundingClientRect()
  return { font: parseFloat(getComputedStyle(el).fontSize), w: b.width, h: b.height }
})
if (cue.font < 24 || cue.w < 44 || cue.h < 44) throw new Error('cue ' + JSON.stringify(cue))
await browser.close()
console.log('portrait measure ok', opening, cue)
```

- [ ] **Step 2: Serve `public/` and run it**

If nothing is already listening, start `python3 -m http.server 50149 --bind 127.0.0.1` with cwd `public/`. Do not kill an existing server on that port.

Run: `node scripts/portrait-measure.mjs`

Expected: prints `portrait measure ok` and exits 0.

- [ ] **Step 3: Desk, radio, and letter checks in the same script**

After the opening check, add:

```js
await page.setViewportSize({ width: 1440, height: 900 })
const desk = await open('/opening.html')
if (desk.portrait || desk.phonewide) throw new Error('desk class ' + JSON.stringify(desk))
const scaled = await page.evaluate(() => getComputedStyle(document.getElementById('stage')).transform)
if (!scaled.includes('matrix')) throw new Error('desk transform ' + scaled)

await page.setViewportSize({ width: 390, height: 844 })
await open('/frame-c.html?on')
const song = await page.evaluate(() => {
  const el = document.querySelector('.now .song')
  const cord = document.querySelector('.cord').getBoundingClientRect()
  return { font: parseFloat(getComputedStyle(el).fontSize), w: cord.width, h: cord.height }
})
if (song.font < 20 || song.w < 44 || song.h < 44) throw new Error('radio ' + JSON.stringify(song))

await open('/frame-e.html?open')
const letter = await page.evaluate(() => {
  const pre = document.querySelector('.letter pre')
  const buttons = [...document.querySelectorAll('.pe-bar button')].map((b) => b.getBoundingClientRect())
  const paper = document.querySelector('.letter').getBoundingClientRect()
  const bar = document.querySelector('.pe-bar').getBoundingClientRect()
  return {
    font: pre ? parseFloat(getComputedStyle(pre).fontSize) : 0,
    n: buttons.length,
    inView: buttons.every((b) => b.top >= 0 && b.bottom <= innerHeight && b.height >= 44),
    clear: paper.bottom <= bar.top + 1,
  }
})
if (letter.font < 16 || letter.n < 5 || !letter.inView || !letter.clear) throw new Error('letter ' + JSON.stringify(letter))

for (const path of ['/rolls.html', '/tray.html?lt', '/book-cover.html']) {
  await open(path)
  await page.waitForTimeout(2000)
  const gl = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    const b = c ? c.getBoundingClientRect() : { width: 0, height: 0 }
    return { w: b.width, h: b.height, portrait: document.getElementById('stage').classList.contains('portrait') }
  })
  if (!gl.portrait || gl.w < 300 || gl.h < 500) throw new Error(path + ' canvas ' + JSON.stringify(gl))
}
```

The letter page builds its bar in `paper-edit.js` after `reel-fit`. Wait for `.pe-bar` before reading it: `await page.waitForSelector('.pe-bar')`. The canvas check confirms the portrait frame is large. Can positions, the tray `Box3` dolly, and the book `0.72` distance stay asserted by the source tests in Tasks 6–8.

- [ ] **Step 4: Run the unit tests once more**

Run: `npx vitest run src/darkroom/reel/portraitFit.test.ts src/darkroom/reel/rollShellLink.test.ts src/darkroom/reel/paperEdit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/portrait-measure.mjs
git commit -m "test(reel): measure the portrait opening on a phone viewport"
```
