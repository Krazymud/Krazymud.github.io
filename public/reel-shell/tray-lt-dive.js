// 钻进放大镜：镜头贴着那个小黑眼推下去，全黑，停半拍，那一格从中间亮开铺满屏幕
import * as THREE from './lib/three.module.js?v=tn9zuj';

const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,easeIn=t=>t*t*t;

// 放大镜里看到的那一格：不要片边，只要画面
// frames 里每格是 [照片, 那一格的内容（带客人的裁切）, 曝光]；看片台的格子是横的 70×56
function slideCanvas([k,fr,ev],pics){
  const p=pics[k],r=CONTENT.cropRect(fr,p.width,p.height,70/56),W=Math.min(2400,Math.round(r.sw)),H=Math.round(W*56/70),c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  // 放大镜里看的就是原片，只留一点点透光的亮（以前饱和度 +42%、对比 +18%，她说跟原片不像）
  g.filter=`saturate(1.04) contrast(1.03) brightness(${1.02+ev})`;g.drawImage(p,r.sx,r.sy,r.sw,r.sh,0,0,W,H);
  return c;
}

const CSS=`
.ltv{position:fixed;inset:0;z-index:50;background:#000;opacity:0;pointer-events:none;transition:opacity .9s ease-in;overflow:hidden;cursor:zoom-out}
.ltv.dark{opacity:1;pointer-events:auto}
.ltv .drift{position:absolute;inset:0;display:grid;place-items:center}
/* 照片保持自己的比例，不要黑片边；四边软软地化进黑里 */
.ltv .pic{grid-area:1/1;width:min(92vw,calc(90vh*70/56));aspect-ratio:70/56;
  -webkit-mask-image:linear-gradient(to right,transparent,#000 4%,#000 96%,transparent),linear-gradient(to bottom,transparent,#000 5%,#000 95%,transparent);-webkit-mask-composite:source-in;
  mask-image:linear-gradient(to right,transparent,#000 4%,#000 96%,transparent),linear-gradient(to bottom,transparent,#000 5%,#000 95%,transparent);mask-composite:intersect}
.ltv canvas{width:100%;height:100%;display:block}
/* 先是暗的、略大，像眼睛刚贴上去还没适应；慢慢亮透、收回原大 */
.ltv .pic{opacity:0;filter:blur(34px) brightness(.8);transform:scale(1.25);transition:opacity .8s ease-out,filter 2.8s cubic-bezier(.25,.6,.15,1) .25s,transform 3.4s cubic-bezier(.25,.6,.15,1) .1s}
.ltv.lit .pic{opacity:1;filter:blur(0) brightness(1);transform:scale(1)}
/* 眼睛在放大镜里会轻轻晃：整张极慢地漂 */
.ltv.lit .drift{animation:ltdrift 14s ease-in-out infinite alternate}
@keyframes ltdrift{0%{transform:translate(0,0) scale(1)}50%{transform:translate(-.6vw,.4vh) scale(1.012)}100%{transform:translate(.5vw,-.3vh) scale(1.006)}}
.ltv .vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 105% at 50% 50%,transparent 58%,rgba(0,0,0,.72) 100%)}
.ltv .gr{position:absolute;inset:0;pointer-events:none;opacity:.08;mix-blend-mode:overlay;animation:ltgr .3s steps(3) infinite;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.3' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")}
@keyframes ltgr{33%{background-position:30px 60px}66%{background-position:-50px 20px}}
.ltv .back{position:absolute;right:30px;bottom:22px;font:400 30px Reenie,cursive;color:#ee5546;opacity:0;transition:opacity 1s}
.ltv.lit .back{opacity:.85;transition-delay:2.6s}`;

export function dive({cam,LOOK,canvas,frameEl,loupe,frames,pics,cur,noClick,onIn,onOut}){
  const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
  const ov=document.createElement('div');ov.className='ltv';
  ov.innerHTML='<div class="drift"><div class="pic"></div></div><div class="vig"></div><div class="gr"></div><div class="back">tap to look up.</div>';
  document.body.appendChild(ov);
  const ray=new THREE.Raycaster(),nd=new THREE.Vector2();let busy=false,home=null;
  const hit=e=>{const b=canvas.getBoundingClientRect();nd.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(nd,cam);return ray.intersectObject(loupe,true).length>0};
  if(!noClick)frameEl.addEventListener('pointermove',e=>{if(!busy)canvas.style.cursor=hit(e)?'zoom-in':''});
  // 镜头和看的点一起插值；tray 每帧会 cam.lookAt(LOOK)，所以改 LOOK 就行
  function fly(to,toLook,toFov,dur,ez,onT){const p0=cam.position.clone(),l0=LOOK.clone(),f0=cam.fov,t0=performance.now();
    return new Promise(res=>{(function step(){const t=Math.min(1,(performance.now()-t0)/dur),e=ez(t);
      cam.position.lerpVectors(p0,to,e);LOOK.lerpVectors(l0,toLook,e);cam.fov=f0+(toFov-f0)*e;cam.updateProjectionMatrix();cam.lookAt(LOOK);onT&&onT(t);
      t<1?requestAnimationFrame(step):res()})()})}
  const lens=loupe.children.find(o=>o.geometry?.type==='CircleGeometry'),glow=k=>{lens.material.emissiveIntensity=k};
  const eyeAt=()=>loupe.localToWorld(new THREE.Vector3(0,.63,0));
  async function goIn(){busy=true;canvas.style.cursor='';home={p:cam.position.clone(),l:LOOK.clone(),f:cam.fov};const eye=eyeAt(),i=cur();
    ov.querySelector('.pic').replaceChildren(slideCanvas(frames[i],pics));
    // 一：挪到放大镜正上方，往下看
    await fly(eye.clone().add(new THREE.Vector3(0,1.5,.35)),eye,30,1500,ease);
    // 二：贴着镜片推进去，镜片里的光越来越亮；推到一半，那团光直接化开成糊着的照片，不黑场
    ov.style.transition='opacity .7s ease-in-out';
    await fly(eye.clone().add(new THREE.Vector3(0,.09,.012)),eye,22,1100,easeIn,t=>{glow(.06+t*t*1.6);if(t>.5&&!ov.classList.contains('lit'))ov.classList.add('dark','lit')});
    setTimeout(()=>{busy=false;onIn&&onIn()},2600)}
  // 出来跟进去反着走：照片先糊回一团光，镜头从镜片里退到放大镜上方，光慢慢暗下去，再回到原来的位置
  async function goOut(){busy=true;const eye=eyeAt(),out=t=>1-Math.pow(1-t,3);
    cam.position.copy(eye).add(new THREE.Vector3(0,.09,.012));LOOK.copy(eye);cam.fov=22;cam.updateProjectionMatrix();cam.lookAt(LOOK);glow(1.66);
    ov.classList.remove('lit');await new Promise(r=>setTimeout(r,450));
    ov.style.transition='opacity 1s ease-in-out';ov.classList.remove('dark');
    await fly(eye.clone().add(new THREE.Vector3(0,1.5,.35)),eye,30,1300,out,t=>glow(.06+(1-t)*(1-t)*1.6));
    await fly(home.p,home.l,home.f,1500,ease);busy=false;onOut&&onOut()}
  if(!noClick)frameEl.addEventListener('click',e=>{if(busy||!hit(e))return;e.stopImmediatePropagation();goIn()},true);
  ov.addEventListener('click',()=>{if(!busy)goOut()});
  return {goIn,goOut,hit,busy:()=>busy,fly};
}
