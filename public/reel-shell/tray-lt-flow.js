// 看片台这一段怎么走：按开关 → 灯管闪两下亮 → 点盒子钻进去看 → 出来拖盒子去看别的圈过的 → 去洗
// 每一步一句红铅笔提示带个弯箭头，点过就收；字都在 HINT 里，以后换中文改这里
import * as THREE from './lib/three.module.js?v=tn9zuj';

const HINT={switch:'lights on.',loupe:'take a closer look.',another:'try another one.',print:"now, let's print them"};
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

const CSS=`
.lth{position:absolute;left:0;top:0;width:200px;height:120px;pointer-events:none;opacity:0;transition:opacity .8s;font:400 30px/1 'Reenie',cursive;color:#ff6e5c;text-shadow:0 0 8px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.8);z-index:5}
.lth svg{filter:drop-shadow(0 0 4px rgba(0,0,0,.85))}
.lth.on{opacity:1;animation:lthnudge 1.6s ease-in-out 1.2s infinite}
@keyframes lthnudge{50%{translate:-5px -4px}}
.lth span{position:absolute;left:70px;top:54px;white-space:nowrap;transform:rotate(-6deg)}
/* 指着画面下沿的东西时整个倒过来：箭头从上往下指，字在上面 */
.lth.up svg{transform:scaleY(-1)}
.lth.up span{top:-2px;transform:rotate(4deg)}
.lth svg{position:absolute;left:0;top:0;width:90px;height:70px;overflow:visible}
.lth path{fill:none;stroke:#ff6e5c;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:140;stroke-dashoffset:140;transition:stroke-dashoffset .8s ease-out .3s}
.lth.on path{stroke-dashoffset:0}
.ltgo{position:absolute;right:70px;bottom:62px;font:400 44px/1 'Reenie',cursive;color:#ff6e5c;text-shadow:0 0 10px rgba(0,0,0,.9);transform:rotate(-5deg);opacity:0;pointer-events:none;transition:opacity 1.2s;cursor:pointer;z-index:5}
.ltgo.on{opacity:1;pointer-events:auto}
.ltgo svg{display:block;width:calc(100% + 10px);height:14px;margin:2px 0 0 -4px;overflow:visible}
.ltgo path{fill:none;stroke:#ee5546;stroke-linecap:round;stroke-dasharray:260;stroke-dashoffset:260;transition:stroke-dashoffset .9s cubic-bezier(.6,.05,.3,1) .9s,stroke-width .3s}
.ltgo.on path{stroke-dashoffset:0}
.ltgo:hover path{stroke-width:3.4}`;

export function flow({lt,cam,LOOK,canvas,frameEl,picks,trayView,onDone}){
  const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
  const h=document.createElement('div');h.className='lth';
  h.innerHTML='<svg viewBox="0 0 90 70"><path filter="url(#pencil2)" d="M74 58 C 60 50, 40 44, 22 26 C 18 22, 15 18, 12 12 M12 12 L 13 26 M12 12 L 25 15"/></svg><span></span>';frameEl.appendChild(h);
  const go=document.createElement('div');go.className='ltgo';
  go.innerHTML=`${HINT.print} →<svg viewBox="0 0 200 14" preserveAspectRatio="none"><path filter="url(#pencil)" stroke-width="2.6" d="M2 8 C 30 5.5, 58 9.5, 92 7.2 S 150 5.8, 176 8.4 S 194 7.6, 198 6.2"/></svg>`;frameEl.appendChild(go);
  // 提示箭头的尖儿钉在场景里的一个点上，每帧跟着镜头投到画面上
  let anchor=null,up=false;const _v=new THREE.Vector3();
  function hint(key,at,u=false){anchor=at;up=u;h.classList.toggle('up',u);h.querySelector('span').textContent=HINT[key]||'';h.classList.remove('on');if(key)requestAnimationFrame(()=>h.classList.add('on'))}
  const hide=()=>{anchor=null;h.classList.remove('on')};
  (function follow(){if(anchor){_v.copy(anchor());_v.project(cam);h.style.transform=`translate(${(_v.x+1)/2*1040-10}px,${(1-_v.y)/2*694-(up?62:8)}px)`}requestAnimationFrame(follow)})();
  const atSwitch=()=>lt.front.localToWorld(new THREE.Vector3(.02,-.02,.03));
  const atLoupe=()=>lt.loupe.localToWorld(new THREE.Vector3(.12,.5,.1));
  const atCell=i=>()=>{const [u,v]=lt.cells[i];return lt.box.localToWorld(new THREE.Vector3((u-.5)*lt.W+.18,lt.BH,(v-.5)*lt.D+.12))};

  let on=false,done=false,drag=null;const seen=new Set();
  const ctl=lt.dive({cam,LOOK,canvas,frameEl,noClick:true,
    onIn:()=>seen.add(lt.cur()),
    onOut:()=>{const next=picks.find(i=>!seen.has(i)&&i!==lt.cur());next!=null?hint('another',atCell(next)):hide();if(seen.size>=Math.min(3,picks.length))go.classList.add('on')}});
  // 一开始灯是关的
  lt.power(0);lt.flip(false);hint('switch',atSwitch,true);

  // 灯管：啪一下亮、灭，又闪一下，再慢慢亮满
  function turnOn(){on=true;lt.flip(true);hide();
    const seq=[[0,.9],[60,0],[150,.7],[210,.05],[480,.5],[540,.1],[700,1]];seq.forEach(([t,k])=>setTimeout(()=>lt.power(k),t));
    // 灯亮满了，箭头指着放大镜：她朋友不知道它能点（11.02）
    setTimeout(()=>{if(!seen.size&&!ctl.busy())hint('loupe',atLoupe)},1100);
}

  const ray=new THREE.Raycaster(),nd=new THREE.Vector2(),plane=new THREE.Plane(),_p=new THREE.Vector3();
  const aim=e=>{const b=canvas.getBoundingClientRect();nd.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(nd,cam)};
  const onSwitch=e=>{aim(e);return ray.intersectObject(lt.front,true).length>0};
  // 拖盒子：射线打在台面那一层平面上，换回台子自己的坐标，夹在台面里
  function tableAt(e){aim(e);const n=new THREE.Vector3(0,1,0).transformDirection(lt.box.matrixWorld),o=lt.box.localToWorld(new THREE.Vector3(0,lt.BH,0));
    plane.setFromNormalAndCoplanarPoint(n,o);if(!ray.ray.intersectPlane(plane,_p))return null;return lt.box.worldToLocal(_p.clone())}
  const busy=()=>done||ctl.busy();
  frameEl.addEventListener('pointermove',e=>{
    if(drag){const p=tableAt(e);if(!p)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;
      if(drag.moved){lt.loupe.position.x=Math.max(-lt.W/2+.3,Math.min(lt.W/2-.3,p.x-drag.dx));lt.loupe.position.z=Math.max(-lt.D/2+.25,Math.min(lt.D/2-.25,p.z-drag.dz));canvas.style.cursor='grabbing'}return}
    if(busy())return;canvas.style.cursor=!on&&onSwitch(e)?'pointer':on&&ctl.hit(e)?'grab':''},true);
  frameEl.addEventListener('pointerdown',e=>{if(busy())return;
    if(!on){if(onSwitch(e)){e.stopImmediatePropagation();turnOn()}return}
    if(ctl.hit(e)){e.stopImmediatePropagation();const p=tableAt(e)||lt.loupe.position;drag={x:e.clientX,y:e.clientY,moved:false,dx:p.x-lt.loupe.position.x,dz:p.z-lt.loupe.position.z};frameEl.setPointerCapture?.(e.pointerId)}},true);
  frameEl.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;canvas.style.cursor='';
    if(!d.moved){hide();ctl.goIn();return}
    hide();
    // 松手：滑到最近的那一格上扣好
    let best=0,bd=1e9;lt.cells.forEach(([u,v],i)=>{const dd=Math.hypot((u-.5)*lt.W-lt.loupe.position.x,(v-.5)*lt.D-lt.loupe.position.z);if(dd<bd){bd=dd;best=i}});
    const [u,v]=lt.cells[best],x0=lt.loupe.position.x,z0=lt.loupe.position.z,t0=performance.now();
    (function slide(){const t=Math.min(1,(performance.now()-t0)/260),k=1-Math.pow(1-t,3);lt.loupe.position.x=x0+((u-.5)*lt.W-x0)*k;lt.loupe.position.z=z0+((v-.5)*lt.D-z0)*k;
      t<1?requestAnimationFrame(slide):lt.place(best,lt.loupe.rotation.y)})()},true);
  // 这一段没走完之前，点击不往下漏给显影盘
  frameEl.addEventListener('click',e=>{if(!done&&!go.contains(e.target))e.stopImmediatePropagation()},true);
  go.addEventListener('click',async e=>{e.stopPropagation();if(done||ctl.busy())return;done=true;go.classList.remove('on');hide();canvas.style.cursor='';
    await ctl.fly(trayView.pos,trayView.look,cam.fov,2400,ease);onDone&&onDone()});
  return {ctl};
}
