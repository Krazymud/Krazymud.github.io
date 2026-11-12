// 书：真正的一本书。红皮封面压在上面，三边露出米白书页，左边一条圆书脊；绣线浮在皮面上
import * as THREE from './lib/three.module.js?v=tn9zuj';
export const BW=2.25,BD=3.0,FUR=0;
const rnd=(a,b)=>a+Math.random()*(b-a);
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};

function roundRect(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.absarc(x+w-r,y+r,r,-Math.PI/2,0);s.lineTo(x+w,y+h-r);s.absarc(x+w-r,y+h-r,r,0,Math.PI/2);
  s.lineTo(x+r,y+h);s.absarc(x+r,y+h-r,r,Math.PI/2,Math.PI);s.lineTo(x,y+r);s.absarc(x+r,y+r,r,Math.PI,Math.PI*1.5);return s}

// 一块书壳：小圆角，边缘倒一点点圆；正面 uv 铺满 0..1
const BT=.05;
function board(mats){
  const g=new THREE.ExtrudeGeometry(roundRect(BW-.024,BD-.024,.07),{depth:BT-.024,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:4,curveSegments:12});
  const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/BW+.5,uv.getY(i)/BD+.5);
  g.rotateX(-Math.PI/2);g.translate(0,.012,0);
  const m=new THREE.Mesh(g,mats);m.castShadow=m.receiveShadow=true;return m}

export function makeBook({base,thr,thrH},_layers,leather,color='#8a1d1a'){
  const SRGB=THREE.SRGBColorSpace,book=new THREE.Group();
  const bt=new THREE.CanvasTexture(base);bt.colorSpace=SRGB;bt.anisotropy=8;
  // 皮：颜色自己染，皮纹和哑光/亮光交给 Poly Haven 那张皮的法线和粗糙度
  // 不加清漆、不用粗糙度贴图：那样高光太硬，看着像金属；皮纹只留在法线里，整体哑一点软一点
  const L={normalMap:leather.nor,normalScale:new THREE.Vector2(2.2,2.2),roughness:.82};
  // 书壳侧面也不是一块平色：深浅一块一块的，像真皮子
  const sc=mk(512,512),sx=sc.getContext('2d');sx.fillStyle=color;sx.fillRect(0,0,512,512);
  for(let i=0;i<90;i++){const x=rnd(0,512),y=rnd(0,512),r=rnd(20,90),g=sx.createRadialGradient(x,y,0,x,y,r),c=Math.random()<.5?'255,215,185':'30,5,0';g.addColorStop(0,`rgba(${c},${rnd(.05,.12)})`);g.addColorStop(1,`rgba(${c},0)`);sx.fillStyle=g;sx.fillRect(x-r,y-r,r*2,r*2)}
  const st=new THREE.CanvasTexture(sc);st.colorSpace=SRGB;st.wrapS=st.wrapT=THREE.RepeatWrapping;
  // 粗糙度也有起伏：常被摸的地方亮一点
  const rc=mk(256,256),rx=rc.getContext('2d');rx.fillStyle='#d2d2d2';rx.fillRect(0,0,256,256);
  for(let i=0;i<60;i++){const x=rnd(0,256),y=rnd(0,256),r=rnd(10,50),g=rx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(120,120,120,.35)');g.addColorStop(1,'rgba(120,120,120,0)');rx.fillStyle=g;rx.fillRect(x-r,y-r,r*2,r*2)}
  const rt=new THREE.CanvasTexture(rc);L.roughnessMap=rt;L.roughness=.95;
  const skin=new THREE.MeshStandardMaterial({map:st,...L});
  const front=new THREE.MeshStandardMaterial({map:bt,...L});
  const PT=.3;
  const bot=board(skin);book.add(bot);
  // 书页：一层层纸，三边都看得见
  const pc=mk(1024,128),px=pc.getContext('2d');px.fillStyle='#efe4cc';px.fillRect(0,0,1024,128);
  // 书页一张张厚薄不一，边上有点发黄发旧
  for(let y=0;y<128;y+=rnd(.9,2.4)){px.fillStyle=`rgba(130,105,70,${rnd(.05,.3)})`;px.fillRect(0,y,1024,rnd(.4,1))}
  for(let i=0;i<40;i++){const x=rnd(0,1024),w=rnd(30,160),g=px.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'rgba(150,115,60,0)');g.addColorStop(.5,`rgba(150,115,60,${rnd(.04,.12)})`);g.addColorStop(1,'rgba(150,115,60,0)');px.fillStyle=g;px.fillRect(x,0,w,128)}
  {const g=px.createLinearGradient(0,0,0,128);g.addColorStop(0,'rgba(120,90,50,.18)');g.addColorStop(.15,'rgba(120,90,50,0)');g.addColorStop(.85,'rgba(120,90,50,0)');g.addColorStop(1,'rgba(120,90,50,.18)');px.fillStyle=g;px.fillRect(0,0,1024,128)}
  const ptx=new THREE.CanvasTexture(pc);ptx.colorSpace=SRGB;
  const pside=new THREE.MeshStandardMaterial({map:ptx,roughness:.95}),ptop=new THREE.MeshStandardMaterial({color:'#efe4cc',roughness:.95});
  const pages=new THREE.Mesh(new THREE.BoxGeometry(BW-.13,PT,BD-.1),[pside,pside,ptop,ptop,pside,pside]);
  pages.position.set(.025,BT+PT/2,0);pages.castShadow=pages.receiveShadow=true;book.add(pages);
  const top=board([front,skin]);top.position.y=BT+PT;book.add(top);
  const TOP=BT*2+PT;
  // 书脊：半圆一条，把上下两块壳连起来
  const spine=(()=>{const r=TOP/2,sp=new THREE.Mesh(new THREE.CylinderGeometry(r,r,BD-.03,32,1,false,Math.PI,Math.PI),skin);
   sp.rotation.x=Math.PI/2;sp.scale.set(.32,1,1);sp.position.set(-BW/2+.02,r,0);sp.castShadow=true;book.add(sp);return sp})();
  // 绣线：贴在皮面上
  const tt=new THREE.CanvasTexture(thr);tt.colorSpace=SRGB;tt.anisotropy=8;const th=new THREE.CanvasTexture(thrH);th.anisotropy=8;
  const tm=new THREE.MeshStandardMaterial({map:tt,bumpMap:th,bumpScale:3,roughness:.45,metalness:.05,alphaTest:.35});
  const tp=new THREE.Mesh(new THREE.PlaneGeometry(BW,BD),tm);tp.rotation.x=-Math.PI/2;tp.position.y=TOP+.003;tp.receiveShadow=true;book.add(tp);
  return {book,TOP,BT,PT,top,spine,threadPlane:tp,pages,threadTex:tt,threadBump:th,baseTex:bt};
}
