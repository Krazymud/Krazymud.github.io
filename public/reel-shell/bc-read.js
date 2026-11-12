// 翻书：封面绕书脊翻开，六张会弯的纸一张张往左翻，翻完书合上、台灯灭，read it again 再亮
import * as THREE from './lib/three.module.js?v=tn9zuj';
import {makeSheet,pageCanvas} from './bc-turn.js?v=tnco2z';
import {makeCandle} from './bc-candle.js?v=tnd9hs';

// 六页先空着，铅笔写它以后放什么
const NAMES=['collage','pop-up','map','compass','petals','library card'];
const pencil=(lines,big)=>(x,W,H)=>{x.fillStyle='rgba(70,58,48,.72)';x.textAlign='center';
  x.font="400 76px 'Reenie'";x.fillText(big,W/2,H*.48);x.font="400 20px 'JB Mono'";lines.forEach((l,i)=>x.fillText(l,W/2,H*.48+52+i*24))};

export function setupReading(c){
  const {book,parts,extras,BW,BD,cam,frameEl,cv,hint,lamp,go}=c,{top,threadPlane,pages,spine,TOP,BT,PT}=parts;
  const HX=-BW/2+.02;
  // 封面：书脊那根轴上挂一个支点，封面上的东西都挂到支点下面一起翻
  const pivot=new THREE.Group();pivot.position.set(HX,TOP-BT/2,0);book.add(pivot);book.updateMatrixWorld(true);
  [top,threadPlane,...extras].forEach(o=>pivot.attach(o));
  // 前半本书：跟右边那摞一样厚的一块书页，合着时和右边重在一起看不见；封面翻开它跟着翻过去垫在左边，
  // 之后左页都落在它上面，跟右页一样高（不然横跨两页的东西左边会悬空）
  // 翻过去的纸绕自己的根（书里 x=LX0）转，落在 LX0-宽 到 LX0；左边这摞也对齐到那里，不多出一截
  const PWd=BW-.13,LX0=.025-PWd/2,LC=LX0-PWd/2;
  {const lb=new THREE.Mesh(pages.geometry,pages.material.slice());lb.position.copy(pages.position);lb.position.x=2*HX-LC;lb.castShadow=lb.receiveShadow=true;book.add(lb);pivot.attach(lb)}
  // 封面里面是一张衬纸（合着的时候朝下，翻开以后朝上）
  {const t=pageCanvas((x,W,H)=>{x.strokeStyle='rgba(122,36,32,.18)';x.lineWidth=2;for(let i=-H;i<W;i+=38){x.beginPath();x.moveTo(i,0);x.lineTo(i+H,H);x.stroke()}
     x.fillStyle='rgba(80,70,60,.5)';x.textAlign='center';x.font="400 46px 'Reenie'";x.fillText(window.CUSTOM?.belongs||'this book belongs to the two of us',W/2,H*.5);c.leftArt?.[0]?.(x,W,H)},{spineLeft:false});
   // 不用再左右翻：封面翻过来以后衬纸本来就是正的
   const ep=new THREE.Mesh(new THREE.PlaneGeometry(BW-.13,BD-.1),new THREE.MeshStandardMaterial({map:t,roughness:.95}));
   ep.rotation.x=Math.PI/2;ep.rotation.z=Math.PI;ep.position.set(HX-LC,-BT/2-PT-.002,0);pivot.add(ep)}
  const coverDrop=TOP-BT;
  // 书脊跟着封面一起放平：翻开以后它压在两页中间底下，只剩一道矮矮的弧
  const spH=spine.scale.z,spY=spine.position.y;
  const setCover=p=>{p=Math.max(0,Math.min(1,p));pivot.rotation.z=Math.PI*p;pivot.position.y=TOP-BT/2-coverDrop*p*p;
    const f=1-.88*p;spine.scale.z=spH*f;spine.position.y=spY*f};

  // 六张纸：叠在书芯上面，最上面那张先翻
  const yTop=BT+PT,PW=BW-.13,PD=BD-.1,PX=.025-(BW-.13)/2,N=NAMES.length,sheets=[];
  for(let i=0;i<N;i++){
    // 做好的页用真内容，没做的先铅笔占位
    const f=pageCanvas(c.pageArt?.[i]||pencil([`page ${String(i+1).padStart(2,'0')} · right`],NAMES[i]));
    // 左页：做好的页放便签（这一页怎么玩），没做的先铅笔占位
    const b=pageCanvas(c.leftArt?.[i+1]||pencil([i<N-1?`page ${String(i+2).padStart(2,'0')} · left`:'last page'],i<N-1?NAMES[i+1]:'fin.'),{spineLeft:false});
    const s=makeSheet(PW,PD,f,b);s.front=f;s.back=b;const y=yTop+.003+(N-1-i)*.0016;s.group.position.set(PX,y,0);book.add(s.group);
    // 有互动的页（拼贴页）：碎片浮在纸上，纸平躺着的时候才能碰
    if(c.pageLive?.[i])s.live=c.pageLive[i]({group:s.group,tex:f,PW,PD});
    s.drop=y-(BT+PT+.004+i*.0016);sheets.push(s);
  }
  // 02 立体书：书缝上立着的东西（bc-popup.js），只在第二页摊开的时候出来
  const pop=c.popup?.({x:PX+PW/2,y:yTop+.0097,scale:.84});if(pop){pop.group.visible=false;book.add(pop.group)}
  // 03 地图（bc-map.js）：折好的一小叠压在右页上，客人拖开以后横跨两页；px 是书里一个单位在屏幕上多少像素
  const map=c.map?.({x:HX,y:yTop+.012,px:()=>{const a=toScreen(HX,TOP,0),b=toScreen(HX+1,TOP,0);return Math.max(20,b.x-a.x)}});if(map){map.group.visible=false;book.add(map.group)}
  // 04 指南针（bc-compass.js）：放在右页，指针指着左页那张照片（leftPoint 把左页画布上的 u,v 换成书里坐标）
  const leftPoint=(u,v)=>new THREE.Vector3(PX-PW+u*PW,yTop,-PD/2+v*PD);
  // 照片从左页 (.5,.4) 开始，能在两页上拖（离边留一点）
  // 指南针那页：书右边桌上慢慢亮起一根蜡烛（指针坏了以后拖过去烧碎片）
  const candle=c.compass?makeCandle({x:PX+PW+.38,z:-.25}):null;if(candle)book.add(candle.group);
  const compass=c.compass?.({candle,stowAt:{x:PX+PW+.78,z:.5},x:PX+PW/2-.08,y:yTop+.01,z:.45,size:1.2,spin:.3,start:leftPoint(.5,.36),bounds:{x0:PX-PW+.35,x1:PX+PW-.35,z0:-PD/2+.4,z1:PD/2-.4},left:{x0:PX-PW,x1:PX,z0:-PD/2,z1:PD/2},right:{x:PX+PW*.81,z:-PD/2+PD*.14}});
  if(compass){compass.group.visible=false;book.add(compass.group)}
  // 06 借书卡（bc-card.js）：口袋贴在右页，卡插在里面；盖完章插回去，书自己合上
  const libcard=c.card?.({locked:!!c.reel,cam,hint:s=>{if(s){hint.textContent=s;hint.classList.remove('gone')}else hint.classList.add('gone')},y:yTop+.004,right:{x0:PX,x1:PX+PW,z0:-PD/2,z1:PD/2},left:{x0:PX-PW,x1:PX,z0:-PD/2,z1:PD/2},onDone:()=>{if(state==='reading'&&cur===6&&!anim){bigWords(true);setTimeout(()=>{if(state==='reading'&&cur===6&&!anim)closeBook()},2600)}}});
  // 卡插回口袋：书上方慢慢浮出一行大字，合书的时候还在，read it again 的时候退下去
  const big=document.createElement('div');big.textContent=c.endWords||'Our love has no due date.';
  big.style.cssText="position:absolute;left:0;right:0;top:11%;text-align:center;font:400 70px/1.2 'IM Fell',serif;color:#f3e6d2;letter-spacing:.02em;text-shadow:0 0 18px rgba(255,200,140,.45),0 2px 10px rgba(0,0,0,.7);opacity:0;transition:opacity 2.2s ease,letter-spacing 4s ease;pointer-events:none;z-index:4";
  frameEl.appendChild(big);
  function bigWords(on){big.style.opacity=on?1:0;big.style.letterSpacing=on?'.06em':'.02em'}
  if(libcard){libcard.setShow(false,false);book.add(libcard.group)}
  // 06 放映机（bc-reel.js）：站在书顶上正中的桌上，片子铺满摊开的两页（书缝那道折痕就让它在）；放完卡从口袋里冒出来
  const RH=PD*.96,RW=RH*4/3;
  const reel=c.reel?.({at:{x:HX,z:-PD/2-1.0},screen:{x0:HX-RW/2,x1:HX+RW/2,z0:-RH/2,z1:RH/2,y:yTop+.03},lamp,lampOn:c.lampOn,dim:c.dim,onEnd:()=>libcard?.unlock()});
  if(reel)book.add(reel.group);
  // 05 数花瓣（bc-petals.js）：压干的雏菊贴在右页，扯下的花瓣飘到左页下半截，左页上半截红笔记
  const petals=c.petals?.({x:PX+PW/2,y:yTop+.006,z:.12,left:{x0:PX-PW,x1:PX,z0:-PD/2,z1:PD/2}});if(petals){petals.group.visible=false;book.add(petals.group)}
  // 最后一张翻完，右边露出书芯最后一页
  pages.material[2]=new THREE.MeshStandardMaterial({map:pageCanvas(pencil(['close the book'],'the end, for now')),roughness:.95});

  // 0 是封面，1..N 是纸
  const items=[{set:setCover},...sheets.map(s=>({set:p=>s.set(p,s.drop)}))];
  const P=items.map(()=>0);
  let lastNudge=0,popMoving=false,state='closed',cur=0,drag=null,anim=null,endAt=0,lightOn=1,lifting=false;
  const W=new THREE.Vector3();
  const toScreen=(x,y,z)=>{W.set(x,y,z);book.localToWorld(W);W.project(cam);const r=cv.getBoundingClientRect();return {x:r.left+(W.x+1)/2*r.width,y:r.top+(1-W.y)/2*r.height}};
  const spreadShot=()=>{const p=book.localToWorld(new THREE.Vector3(HX,0,.1)),l=book.localToWorld(new THREE.Vector3(HX,.2,-.1));return {p:p.clone().add(new THREE.Vector3(0,5.9,3.1)),l}};

  // 立体书那页：平时也是俯视；客人点 F17 那两个人，镜头沉下去坐进那个位子，拽纸条开幕；再点一下站起来
  let seated=false,tabHold=null;
  const sit=()=>{seated=true;hint.classList.add('gone');const s=pop.seatShot();go(s.p,s.l,2200);
    setTimeout(()=>{if(seated&&pop.open<.5){hint.textContent='pull the tab';hint.classList.remove('gone')}},2300)};
  const stand=()=>{seated=false;hint.classList.add('gone');const s=spreadShot();go(s.p,s.l,1800)};
  // 指南针那页镜头往后退一点、往右挪，把桌上的蜡烛也框进来
  const compShot=()=>{const p=book.localToWorld(new THREE.Vector3(HX+.45,0,.25)),l=book.localToWorld(new THREE.Vector3(HX+.45,.2,-.05));return {p:p.clone().add(new THREE.Vector3(0,6.7,3.5)),l}};
  // 借书卡那页镜头往后退、往上抬，把书顶上那头的放映机也框进来
  const reelShot=()=>{const p=book.localToWorld(new THREE.Vector3(HX,0,-.55)),l=book.localToWorld(new THREE.Vector3(HX,.2,-.75));return {p:p.clone().add(new THREE.Vector3(0,7.4,3.7)),l}};
  const shotFor=n=>compass&&n===4?compShot():reel&&n===6?reelShot():spreadShot();
  const ready=()=>{state='ready';hint.textContent='open it';hint.classList.remove('gone')};
  const startTurn=()=>{if(cur===0&&state==='ready'){state='reading';hint.classList.add('gone');c.onOpen&&c.onOpen();const s=spreadShot();go(s.p,s.l,1800);lamp.target.position.copy(s.l)}};
  const finish=(to)=>{anim={i:cur,from:P[cur],to,t0:performance.now(),ms:to?520:280}};

  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
  const rayAt=ev=>{const r=cv.getBoundingClientRect();ndc.set((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,cam);return ray};
  // 现在摊开在右边、能碰的那一页
  const livePage=()=>{const s=sheets[cur-1];return s?.live?.live?s.live:null};
  let cardHold=false,petHold=false,compHold=false,liveHold=null,mapHold=false,mapHint=false;
  // 3D 的东西不在的时候印回纸上。以前一切换就整张纸重画、整张重传显卡，翻页松手那一下会顿住；
  // 现在每张要印的纸备两张贴图：干净的一张、印好的一张，切换只换贴图。印好的那张趁东西停着没人动的时候先画好、先传上去
  const R=c.renderer;
  function baker(s,side,draw){if(!s)return null;const live=s[side],mat=s.group.children[side==='front'?0:1].material;let base=null,plain=null,on=null,dirty=true,quiet=0;
    const init=()=>{if(base)return;const cv2=live.image;base=document.createElement('canvas');base.width=cv2.width;base.height=cv2.height;base.getContext('2d').drawImage(cv2,0,0);
      plain=new THREE.CanvasTexture(base);['colorSpace','anisotropy','wrapS','wrapT'].forEach(k=>plain[k]=live[k]);plain.repeat.copy(live.repeat);R&&R.initTexture(plain)};
    const paint=()=>{init();const cv2=live.image,x=cv2.getContext('2d');x.drawImage(base,0,0);draw(x,cv2.width,cv2.height);live.needsUpdate=true;R&&R.initTexture(live);dirty=false};
    return {set(v){init();if(v===on)return;on=v;if(v&&dirty)paint();mat.map=v?live:plain},
      // 3D 的在动就记一笔；停了半秒还没印，就趁这会儿印好
      tick(now,busy){if(on!==false)return;if(busy){dirty=true;quiet=now;return}if(dirty&&now-quiet>500)paint()},
      touch(now){if(on===false){dirty=true;quiet=now}}}}
  let leftBaked=null,cardBaked=null,petBaked=null,mapBaked=null;
  const mapBk=map&&baker(sheets[2],'front',(x,W,H)=>{// 地图那一叠在书里的位置：x 从书缝到书缝+一折宽，z 是整个地图高；换成这页纸画布上的像素
    const kx=W/PW,kz=H/PD,x0=(HX-PX)*kx,w=map.pw*kx,h=map.h*kz,y0=(PD-map.h)/2*kz;
    x.save();x.shadowColor='rgba(40,25,10,.35)';x.shadowBlur=14;x.shadowOffsetX=4;x.shadowOffsetY=6;x.drawImage(map.cover,x0,y0,w,h);x.restore()});
  // 3D 的花不在的时候（还没翻到 / 已经翻走），右页剩下的花印在这页纸上，跟着纸翻
  const petBk=petals&&baker(sheets[4],'front',(x,W,H)=>petals.drawOn(x,W,H,{px:PX,pz:-PD/2,pw:PW,pd:PD}));
  // 借书卡那页左页（第 5 张纸的背面）：3D 的日期章、催还单不在的时候印回纸上，合书时跟着纸走
  const leftBk=libcard&&baker(sheets[4],'back',(x,W,H)=>libcard.drawLeft(x,W,H,{px:PX-PW,pz:-PD/2,pw:PW,pd:PD}));
  const cardBk=libcard&&baker(sheets[5],'front',(x,W,H)=>libcard.drawOn(x,W,H,{px:PX,pz:-PD/2,pw:PW,pd:PD}));
  function bakeMap(on){if(!mapBk||mapBaked===on)return;mapBaked=on;mapBk.set(on)}
  function bakePetals(on){if(!petBk||petBaked===on)return;petBaked=on;petBk.set(on)}
  function bakeLeft(on){if(!leftBk||leftBaked===on)return;leftBaked=on;leftBk.set(on)}
  function bakeCard(on){if(!cardBk||cardBaked===on)return;cardBaked=on;cardBk.set(on)}
  // 松手：可能刚点了花瓣、盖了章，3D 那份变了，等它停下来再重新印
  const touchBk=()=>{const t=performance.now();[mapBk,petBk,leftBk,cardBk].forEach(b=>b&&b.touch(t))};
  frameEl.addEventListener('pointerdown',ev=>{
    // 串成一卷时合上以后底下并排两句（read it again / roll the credits），只有点 read it again 才重读；单独打开时点哪都重读
    if(state==='end'){if(!api.endChoice)replay();return}
    if(state!=='ready'&&state!=='reading')return;if(anim||cur>=items.length)return;
    // 立体书：坐着的时候只能拽纸条，别处点一下就站起来；没坐的时候点 F17 坐进去
    if(pop&&cur===2){const r=rayAt(ev);
      if(seated){if(pop.hitTab(r)){tabHold={y0:ev.clientY,k0:pop.open,moved:false};pop.hold(true);hint.classList.add('gone');frameEl.setPointerCapture?.(ev.pointerId)}else stand();return}
      if(pop.hitSeat(r)){sit();return}}
    // 指南针那页：拖照片
    if(compass&&cur===4&&compass.down(ev,rayAt(ev))){compHold=true;frameEl.setPointerCapture?.(ev.pointerId);return}
    // 放映机：点一下放片子；放着的时候别的都不碰（也不翻页）
    if(reel&&cur===6){if(reel.playing)return;if(reel.down(ev,rayAt(ev)))return}
    // 借书卡：抽卡、点日期章
    if(libcard&&cur===6&&libcard.down(ev,rayAt(ev))){cardHold=true;frameEl.setPointerCapture?.(ev.pointerId);return}
    // 卡在眼前、催还单在飞的时候，别处点了也不翻页
    // 最后一页翻不过去：借书卡放回口袋以后书会自己合上。客人想硬翻，就提醒他现在该做哪一步
    if(libcard&&cur===6){if(!libcard.story&&!reel?.playing){const ph=libcard._test.ph;
      hint.textContent=reel&&!reel.watched?'play the film first.':ph==='back'?'put the card back first.':ph==='pocket'?'pull the card.':'';
      const msg=hint.textContent;if(msg){hint.classList.remove('gone');clearTimeout(lastNudge);lastNudge=setTimeout(()=>{if(hint.textContent===msg)hint.classList.add('gone')},2600)}}return}
    // 数花瓣：捏花瓣
    if(petals&&cur===5&&petals.down(ev,rayAt(ev))){petHold=true;frameEl.setPointerCapture?.(ev.pointerId);return}
    // 地图：拖开某一折、点图钉
    if(map&&cur===3&&map.down(ev,rayAt(ev))){mapHold=true;frameEl.setPointerCapture?.(ev.pointerId);return}
    // 按在页上的碎片上：捏碎片，不翻页
    const lp=livePage();if(lp&&lp.down(ev,rayAt(ev))){liveHold=lp;frameEl.setPointerCapture?.(ev.pointerId);return}
    // 只有按在右半边（书脊右边）才算捏住了纸
    const h=toScreen(HX,TOP,0),e=toScreen(HX+BW,TOP,0);if(ev.clientX<h.x)return;
    // 地图没点过图钉、指南针还没拨坏，都翻不过去，跟最后一页一样提醒他（11.02 她朋友没转坏就翻走了）
    const need=map&&cur===3&&!map.pinned?'tap a pin':compass&&cur===4&&!compass.broke?'open it. move the photo. flick the needle.':'';
    if(need){hint.textContent=need;hint.classList.remove('gone');clearTimeout(lastNudge);lastNudge=setTimeout(()=>{if(hint.textContent===need)hint.classList.add('gone')},3200);return}
    // 地图摊着的时候，只有按在右下角那一块才算要翻页（不然想点图钉点偏了，地图就收起来了）
    if(map&&cur===3&&!map.folded){const a=toScreen(HX+BW,TOP,BD/2),b=toScreen(HX+BW,TOP,-BD/2),top=Math.min(a.y,b.y),bot=Math.max(a.y,b.y);
      if(ev.clientX<h.x+(e.x-h.x)*.72||ev.clientY<top+(bot-top)*.72)return}
    startTurn();drag={x0:ev.clientX,pw:Math.max(40,e.x-h.x),p0:P[cur]};frameEl.setPointerCapture?.(ev.pointerId);
    // 地图还摊着：先让它自己收回去，收好了这一下拖才开始翻页
    if(map&&cur===3&&!map.folded){map.foldAll();drag.waitMap=true}
    // 指南针那页：先合盖、把指南针收到桌上（蜡烛顺手吹灭），收好了这一下拖才开始翻页
    if(compass&&cur===4&&!compass.stowed){compass.stow();drag.waitComp=true}});
  frameEl.addEventListener('pointermove',ev=>{if(liveHold){liveHold.move(ev,rayAt(ev));return}
    // 往下拽纸条：拽 140 像素差不多全开
    if(mapHold){map.move(ev);return}
    if(compHold){compass.move(ev,rayAt(ev));return}
    if(petHold){petals.move(ev,rayAt(ev));return}
    if(cardHold){libcard.move(ev,rayAt(ev));return}
    if(libcard&&cur===6&&!drag){frameEl.style.cursor=libcard.over(rayAt(ev))||'default'}
    if(reel&&cur===6&&!drag){const o=reel.over(rayAt(ev));if(o)frameEl.style.cursor=o}
    if(petals&&cur===5&&!drag){frameEl.style.cursor=petals.over(rayAt(ev))||'default'}
    if(compass&&cur===4&&!drag){frameEl.style.cursor=compass.over(rayAt(ev))||'default'}
    if(map&&cur===3&&!drag){frameEl.style.cursor=map.over(rayAt(ev))||'default'}
    if(tabHold){const d=ev.clientY-tabHold.y0;if(Math.abs(d)>4)tabHold.moved=true;pop.drag(tabHold.k0+d/140);return}
    if(pop&&cur===2&&!drag){const r=rayAt(ev);frameEl.style.cursor=seated?(pop.hitTab(r)?'grab':'default'):(pop.hitSeat(r)?'pointer':'default')}
    {const lp=livePage();if(!drag&&lp)frameEl.style.cursor='default'}
    if(drag?.waitMap){if(map.folded)drag.waitMap=false;drag.x0=ev.clientX;return}
    if(drag?.waitComp){if(compass.stowed)drag.waitComp=false;drag.x0=ev.clientX;return}
    if(!drag)return;P[cur]=Math.max(0,Math.min(1,drag.p0+(drag.x0-ev.clientX)/(drag.pw*1.7)));items[cur].set(P[cur])});
  const up=()=>{touchBk();if(liveHold){liveHold.up();liveHold=null;return}
    if(mapHold){map.up();mapHold=false;return}
    if(compHold){compass.up();compHold=false;return}
    if(petHold){petals.up();petHold=false;return}
    if(cardHold){libcard.up();cardHold=false;return}
    // 松手：拽过一小半就自己拉开，没拽动（只点了一下）也拉开；拽回去了就合上
    if(tabHold){const t=tabHold;tabHold=null;pop.hold(false);pop.goal=!t.moved||pop.open>.3?1:0;
      // 幕开了，过一会儿红字告诉客人点一下就能站起来
      if(pop.goal===1)setTimeout(()=>{if(seated){hint.textContent='stand up';hint.classList.remove('gone')}},3200);return}if(!drag)return;drag=null;finish(P[cur]>.28?1:0)};
  frameEl.addEventListener('pointerup',up);frameEl.addEventListener('pointercancel',up);

  // 直接翻到第 n 张纸前面（?page=n 看某一页用）
  function jump(n){n=Math.max(1,Math.min(items.length-1,n));state='reading';hint.classList.add('gone');c.onOpen&&c.onOpen();
    for(let i=0;i<n;i++){P[i]=1;items[i].set(1)}cur=n;if(compass&&n>=5)compass.stowNow();const s=shotFor(n);go(s.p,s.l,1200);lamp.target.position.copy(s.l)}
  function replay(){state='closed';bigWords(false);hint.classList.add('gone');lightOn=1;lamp.intensity=c.lampOn;go(c.bookShot.p,c.bookShot.l,1400);setTimeout(ready,1500)}

  const ease=k=>1-Math.pow(1-k,3);
  function update(now){
    if(anim){const k=Math.min(1,(now-anim.t0)/anim.ms);
      if(anim.all){const n=anim.from.length;anim.from.forEach((f,i)=>{const st=(n-1-i)*.11,kk=Math.max(0,Math.min(1,(k-st)/(1-.11*(n-1)))),e=kk<.5?4*kk*kk*kk:1-Math.pow(-2*kk+2,3)/2;P[i]=f*(1-e);items[i].set(P[i])})}
      else{P[anim.i]=anim.from+(anim.to-anim.from)*ease(k);items[anim.i].set(P[anim.i])}
      if(k>=1){const a=anim;anim=null;
        if(a.all){state='end';endAt=now}
        else if(a.to===1){cur++;if(cur>=items.length)setTimeout(closeBook,1400);
          else if((compass&&(cur===4||cur===5))||(reel&&cur===6)){const s=shotFor(cur);go(s.p,s.l,1400);lamp.target.position.copy(s.l)}}}}
    // 没人碰的时候，只有封面的角自己轻轻翘一下，告诉客人可以翻；里面的纸不动，等人自己去翻
    else if(!drag&&(state==='reading'||state==='ready')&&cur===0){const t=(now/1000)%3.2,lift=t<.9?Math.sin(t/.9*Math.PI)*.03:0;
      // 角不翘的时候不用每帧重算这张纸
      if(lift>0||lifting)items[cur].set(P[cur]+lift);lifting=lift>0}
    if(pop){
      // 立体书跟着书页走：翻进这页时，纸一竖过书缝它就平躺着露出来，先立起来再从对折撑开，纸落平它正好展平；
      // 翻走时倒过来，合上、躺平，再被那页盖走
      const sm=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};let lean=0,fold=Math.PI;
      if(cur===1){const p=P[1];
        // 纸还没竖过书缝的时候，它只能在纸让出来的高度里抬头（折起来的贺卡左边就在右页中线上，离书脊 D 远）
        const D=PX+PW/2-HX,room=a=>Math.asin(Math.min(1,.75*D*Math.sin(a)/pop.height))/(Math.PI/2);
        const l50=room(Math.PI*.5);lean=p<.5?room(Math.PI*p):l50+(1-l50)*sm((p-.5)/.25);
        fold=Math.PI*(1-sm((p-.5)/.5))}
      else if(cur===2){const t=1-sm(P[2]/.2);lean=sm(t/.5);fold=Math.PI*(1-sm((t-.3)/.7))}
      pop.group.visible=(cur===1&&P[1]>.01)||(cur===2&&P[2]<.2);pop.setLean(lean);pop.setFold(fold,0);if(pop.update())popMoving=true;else popMoving=false;
      // 翻走了就把幕布合回去，下次来还是合着的
      if(cur!==2&&pop.open>0&&!pop.group.visible)pop.reset()}
    // 折好的地图平躺在右页上：翻进来时早早就在（被翻的纸盖着），翻走时那页一抬就收掉
    if(map){const show=(cur===2&&P[2]>.02)||(cur===3&&P[3]===0);
      // 3D 地图不在的时候，收好的那一小叠印在第三页右页上，跟着纸弯、跟着纸翻走；3D 的出来就擦掉
      if(show!==map.group.visible||mapBaked===null){map.group.visible=show;bakeMap(!show)}{const b=map.update(now);if(b)popMoving=true;mapBk.tick(now,b)}
      // 线画完了客人还没点过图钉：红字提示 tap a pin
      const want=cur===3&&map.needHint;if(want!==mapHint){mapHint=want;if(want){hint.textContent='tap a pin';hint.classList.remove('gone')}else hint.classList.add('gone')}}
    if(compass){if(compass.stowed&&cur<4)compass.unstow();
      compass.group.visible=(cur===3&&P[3]>.5)||(cur===4&&P[4]<.5);if(compass.update(now))popMoving=true;
      // 收到桌上的指南针和吹灭的蜡烛，翻到下一页也还在桌上
      compass.body.visible=compass.stowed?(cur===4||cur===5):true;
      if(cur===4||cur===5)candle.show(now);else if(!(cur===3&&P[3]>.5))candle.hide();candle.update(now)}
    // 花：翻进这页时纸一动它就在（被翻的纸盖着），翻走时纸一动就印回纸上；左页的字和落下的花瓣跟左页走
    if(petals){const fShow=(cur===4&&P[4]>0)||(cur===5&&P[5]===0),lShow=(cur===4&&P[4]>.5)||(cur===5&&P[5]<.5);
      if(fShow!==petals.flower.visible||petBaked===null){petals.flower.visible=fShow;bakePetals(!fShow)}
      petals.group.visible=fShow||lShow;petals.list.visible=lShow;{const b=petals.update(now);if(b)popMoving=true;petBk.tick(now,b)}}
    // 借书卡：右页的口袋和卡跟右页走（不在就印回纸上），左页的日期章跟左页走
    if(libcard){const rS=(cur===5&&P[5]>0)||(cur===6&&P[6]===0),lS=(cur===5&&P[5]>.5)||(cur===6&&P[6]<.5);
      if(rS!==libcard.rightShown||cardBaked===null)bakeCard(!rS);libcard.setShow(rS,lS);if(lS===!!leftBaked||leftBaked===null)bakeLeft(!lS);
      // 放片子的时候日期章先收起来，不然它在光里是一大块黑影
      if(reel?.playing)libcard.stamper.visible=false;{const b=libcard.update(now);if(b)popMoving=true;cardBk.tick(now,b);leftBk.tick(now,b)}}
    // 放映机：翻进最后一页（纸翻过一半）就站在桌上，离开就收起、片子停
    if(reel){reel.setShow(cur===6||(cur===5&&P[5]>.5)||state==='end'||!!anim?.all);if(reel.update(now))popMoving=true}
    // 纸平躺在右边、没在翻的时候碎片才浮起来；一翻就画回纸上
    sheets.forEach((s,i)=>{if(!s.live)return;s.live.setLive(state==='reading'&&cur===i+1&&P[i+1]===0&&!anim);s.live.update(now)});
    // 合上以后台灯慢慢灭，再亮出 read it again
    if(state==='end'){const k=Math.min(1,(now-endAt)/1200);lamp.intensity=c.lampOn*(1-k);
      if(k>=1&&hint.classList.contains('gone')){hint.textContent='read it again';hint.classList.remove('gone')}}
  }
  function closeBook(){go(c.bookShot.p,c.bookShot.l,1600);anim={all:true,from:P.slice(),t0:performance.now(),ms:2600};cur=0}
  // busy：有纸在动，页面据此决定这一帧要不要重画影子
  // _peek：调试用，把第 i 张停在 p（看翻到一半的样子）
  const api={endChoice:false,replay:()=>{if(state==='end')replay()},_peek(i,p){P[i]=p;items[i].set(p)},ready,jump,update,sheets,pop,compass,petals,libcard,reel,get cur(){return cur},get anim(){return anim},get state(){return state},get busy(){return !!(anim||drag||lifting||tabHold||popMoving||mapHold)}};
  return api;
}
