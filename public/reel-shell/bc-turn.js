// 会弯的书页：一张纸，左边钉在书脊上，往左翻过去的时候纸是弯的（离书脊越远翻得越快），落到左边
import * as THREE from './lib/three.module.js?v=tn9zuj';
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const rnd=(a,b)=>a+Math.random()*(b-a);

// 一面纸：米白底 + 纤维 + 靠书脊那边一点阴影；draw 往上画东西（骨架阶段只写铅笔字）
export function pageCanvas(draw,{spineLeft=true}={}){
  const W=900,H=1200,c=mk(W,H),x=c.getContext('2d');
  x.fillStyle='#f1e6cf';x.fillRect(0,0,W,H);
  for(let i=0;i<50;i++){const cx=rnd(0,W),cy=rnd(0,H),r=rnd(60,200),g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,`rgba(150,120,80,${rnd(.02,.05)})`);g.addColorStop(1,'rgba(150,120,80,0)');x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2)}
  for(let i=0;i<1600;i++){x.strokeStyle=`rgba(${Math.random()<.5?'120,95,60':'255,255,255'},${rnd(.04,.1)})`;x.lineWidth=rnd(.6,1.4);const a=rnd(0,Math.PI),l=rnd(5,16),px=rnd(0,W),py=rnd(0,H);x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}
  const g=x.createLinearGradient(spineLeft?0:W,0,spineLeft?70:W-70,0);g.addColorStop(0,'rgba(90,60,30,.22)');g.addColorStop(1,'rgba(90,60,30,0)');x.fillStyle=g;x.fillRect(0,0,W,H);
  draw&&draw(x,W,H);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

// w 宽（从书脊到外边），d 深；原点在书脊，纸往 +x 铺开。set(p) 翻到 p（0 没翻，1 翻完落在左边）
export function makeSheet(w,d,front,back,{seg=48,stiff=0}={}){
  const geo=new THREE.PlaneGeometry(w,d,seg,1);geo.rotateX(-Math.PI/2);geo.translate(w/2,0,0);
  const pos=geo.attributes.position,base=Float32Array.from(pos.array);
  const g=new THREE.Group();
  const mf=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:front,roughness:.92,side:THREE.FrontSide}));
  const mb=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:back,roughness:.92,side:THREE.BackSide}));
  // 背面贴图要左右翻过来（翻到左边以后才读得正）
  back.wrapS=THREE.RepeatWrapping;back.repeat.x=-1;
  mf.castShadow=mf.receiveShadow=mb.receiveShadow=true;g.add(mf,mb);
  const cols=seg+1,ys=new Float32Array(cols),xs=new Float32Array(cols);
  function set(p,drop=0){
    p=Math.max(0,Math.min(1,p));
    // 书脊那头慢、外边那头快：外边的角度比根部多一截，中间连成一条弧
    const lead=stiff?0:Math.sin(Math.PI*p)*.95;
    const base0=Math.PI*p;
    let x=0,y=0;xs[0]=0;ys[0]=0;
    for(let i=1;i<cols;i++){const s=i/(cols-1),phi=Math.min(Math.PI,base0+lead*Math.pow(s,1.4)),ds=w/(cols-1);
      x+=Math.cos(phi)*ds;y+=Math.sin(phi)*ds;xs[i]=x;ys[i]=y}
    const dy=-drop*p*p;
    for(let i=0;i<pos.count;i++){const bx=base[i*3],c=Math.round(bx/w*(cols-1));pos.setX(i,xs[c]);pos.setY(i,ys[c]+dy)}
    pos.needsUpdate=true;geo.computeVertexNormals();
  }
  set(0);
  return {group:g,set};
}
