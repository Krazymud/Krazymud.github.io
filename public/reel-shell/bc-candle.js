// 桌上的一根蜡烛：黄铜烛台 + 奶白蜡 + 几道蜡泪 + 烛芯 + 会晃的火苗 + 一盏跟着闪的暖灯。
// show() 以后先慢慢浮现出来，再"噗"地点着；之后火苗一直轻轻晃。指南针那页用，烧纸那一步也会用它。
import * as THREE from './lib/three.module.js?v=tn9zuj';
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const PI=Math.PI;

// 火苗贴图：上尖下圆的一滴，芯是白黄，外面橙红，边缘透明
function flameTex(){const W=128,H=256,c=mk(W,H),x=c.getContext('2d');
  const drop=(sc,col)=>{x.save();x.translate(W/2,H*.72);x.scale(sc,sc);x.beginPath();x.moveTo(0,-H*.66);x.bezierCurveTo(W*.34,-H*.3,W*.34,H*.14,0,H*.16);x.bezierCurveTo(-W*.34,H*.14,-W*.34,-H*.3,0,-H*.66);x.closePath();x.fillStyle=col;x.fill();x.restore()};
  x.filter='blur(6px)';drop(1,'rgba(255,120,30,.55)');x.filter='blur(4px)';drop(.75,'rgba(255,190,80,.85)');x.filter='blur(3px)';drop(.45,'rgba(255,245,210,1)');
  // 底部一点蓝
  x.filter='blur(5px)';x.fillStyle='rgba(90,120,255,.35)';x.beginPath();x.ellipse(W/2,H*.84,W*.13,H*.05,0,0,PI*2);x.fill();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}

export function makeCandle({x=0,z=0,h=.55}={}){
  const g=new THREE.Group();g.position.set(x,0,z);
  const brass=new THREE.MeshStandardMaterial({color:'#b8873a',metalness:.85,roughness:.35});
  const wax=new THREE.MeshStandardMaterial({color:'#f1e7d3',roughness:.55,transparent:true});
  // 烛台：一个浅碟子 + 一圈边 + 中间托座 + 侧边一个指环把手
  const dish=new THREE.Mesh(new THREE.CylinderGeometry(.24,.27,.025,40),brass);dish.position.y=.0125;
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.255,.012,10,48),brass);rim.rotation.x=PI/2;rim.position.y=.03;
  const cup=new THREE.Mesh(new THREE.CylinderGeometry(.1,.085,.07,32),brass);cup.position.y=.06;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.06,.012,10,24),brass);ring.position.set(.3,.03,0);ring.rotation.x=PI/2;
  const holder=new THREE.Group();holder.add(dish,rim,cup,ring);g.add(holder);
  // 蜡：一根圆柱，顶上略凹；几道蜡泪从顶上流下来
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.075,.08,h,32),wax);body.position.y=.09+h/2;
  const drips=[];for(let i=0;i<5;i++){const a=i/5*PI*2+Math.random()*.6,L=.06+Math.random()*.16,d=new THREE.Mesh(new THREE.CapsuleGeometry(.013,L,4,8),wax);
    d.position.set(Math.cos(a)*.078,.09+h-L/2-.01,Math.sin(a)*.078);drips.push(d)}
  const wick=new THREE.Mesh(new THREE.CylinderGeometry(.004,.005,.05,6),new THREE.MeshStandardMaterial({color:'#1c140e',roughness:.9}));wick.position.y=.09+h+.02;
  const candle=new THREE.Group();candle.add(body,...drips,wick);g.add(candle);
  [dish,rim,cup,ring,body,...drips].forEach(m=>{m.castShadow=true;m.receiveShadow=true});
  // 火苗：一张总朝着镜头的贴片，叠加发光；外面再一层大一点的光晕
  const fm=new THREE.SpriteMaterial({map:flameTex(),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true});
  const flame=new THREE.Sprite(fm);flame.center.set(.5,.2);flame.position.y=.09+h+.03;g.add(flame);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:(()=>{const c=mk(128,128),x=c.getContext('2d'),gr=x.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,190,110,.5)');gr.addColorStop(1,'rgba(255,150,60,0)');x.fillStyle=gr;x.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t})(),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  halo.position.y=flame.position.y+.06;g.add(halo);
  const light=new THREE.PointLight('#ffae5a',0,4,2);light.position.y=flame.position.y+.08;g.add(light);
  // 吹灭以后冒的一缕烟：软软的灰色一团，往上飘、变大、变淡
  const smk=new THREE.Sprite(new THREE.SpriteMaterial({map:(()=>{const c=mk(64,64),x=c.getContext('2d'),gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(200,195,190,.6)');gr.addColorStop(1,'rgba(200,195,190,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t})(),transparent:true,depthWrite:false,opacity:0}));
  smk.visible=false;g.add(smk);
  // 慢慢浮现 → 点着；blow() 吹灭
  let shownAt=0,lit=0,blownAt=0;const parts=[holder,candle];
  const setFade=k=>{wax.opacity=k;brass.transparent=k<1;brass.opacity=k;parts.forEach(p=>p.visible=k>.01)};
  setFade(0);flame.visible=halo.visible=false;
  function show(now){if(!shownAt)shownAt=now}
  function blow(now){if(!blownAt)blownAt=now}
  function hide(){shownAt=0;lit=0;blownAt=0;smk.visible=false;setFade(0);flame.visible=halo.visible=false;light.intensity=0}
  function update(now){if(!shownAt)return;const t=(now-shownAt)/1000;
    setFade(Math.min(1,t/1.4));
    // 1.6 秒后点着：火苗从一点点长到正常大小
    lit=Math.max(0,Math.min(1,(t-1.6)/.5));
    // 吹灭：火苗往一边一歪、缩没了；烛芯上冒一缕烟，两秒半散掉
    if(blownAt){const b=(now-blownAt)/1000;lit*=Math.max(0,1-b/.35);flame.material.rotation=-.5*Math.min(1,b/.2);
      const sk=b/2.6;smk.visible=sk<1;if(sk<1){smk.position.set(Math.sin(b*3)*.03,flame.position.y+.05+sk*.55,0);smk.scale.setScalar(.08+sk*.35);smk.material.opacity=Math.sin(Math.min(1,sk*1.4)*Math.PI)*.5}}
    flame.visible=halo.visible=lit>0;
    const fl=1+.08*Math.sin(now*.017)+.05*Math.sin(now*.031+1)+.04*(Math.random()-.5);
    flame.scale.set(.09*lit*(2-fl),.26*lit*fl,1);if(!blownAt)flame.material.rotation=.04*Math.sin(now*.011);
    halo.scale.setScalar(.55*lit*(.95+.05*fl));light.intensity=1.4*lit*fl}
  return {group:g,show,hide,blow,update,flame,get out(){return !!blownAt}};
}
