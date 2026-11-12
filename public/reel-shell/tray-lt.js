// 看片台 + 方形看片放大镜：进暗房先开灯看片子，圈过的那几张再拿去洗
// 1 个单位 ≈ 120mm：台面 300×225mm，一张透明袋装三条 120 反转片，每条三格 6×7
import * as THREE from './lib/three.module.js?v=tn9zuj';
import {dive} from './tray-lt-dive.js?v=tnpltd';

const SRGB=THREE.SRGBColorSpace;
// 一圈圆角矩形的点（逆时针），每个角 n 段
function rrect(hw,hd,r,n=8){const pts=[];
  const arc=(cx,cz,a0)=>{for(let i=0;i<=n;i++){const a=a0+i/n*Math.PI/2;pts.push([cx+Math.cos(a)*r,cz+Math.sin(a)*r,Math.cos(a),Math.sin(a)])}};
  arc(hw-r,-(hd-r),-Math.PI/2);arc(hw-r,hd-r,0);arc(-(hw-r),hd-r,Math.PI/2);arc(-(hw-r),-(hd-r),Math.PI);return pts}
// 沿着一串截面 [半宽, 半深, 圆角, y] 放样成一个筒（不封口）
function loft(rings,n=8){const P=(n+1)*4,pos=[],idx=[];
  rings.forEach(([hw,hd,r,y])=>rrect(hw,hd,r,n).forEach(p=>pos.push(p[0],y,p[1])));
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<P;i++){const a=j*P+i,b=j*P+(i+1)%P,c=a+P,d=b+P;idx.push(a,b,c,b,d,c)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g}
function cap(hw,hd,r,y,up=true){const s=new THREE.Shape();rrect(hw,hd,r).forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));
  const g=new THREE.ShapeGeometry(s);g.rotateX(up?-Math.PI/2:Math.PI/2);if(!up)g.scale(1,1,-1);g.translate(0,y,0);return g}

// 透明袋里的三条片子画成一张图；picks 是被红蜡笔圈起来的格子
export function sheetCanvas(frames,pics,picks=[]){
  const TW=300,TH=225,PX=8,W=TW*PX,H=TH*PX,FW=70,FH=56,STRIP_H=61,GAP=3.5,END=8,STRIP_W=END*2+FW*3+GAP*2,ROW=66,SW=250;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d'),mm=v=>v*PX;
  const tg=g.createRadialGradient(W/2,H/2,0,W/2,H/2,W*.7);tg.addColorStop(0,'#ffffff');tg.addColorStop(1,'#e6ecf2');g.fillStyle=tg;g.fillRect(0,0,W,H);
  const sx=(TW-SW)/2,sy=(TH-(14+ROW*3))/2,cells=[];
  g.fillStyle='#eee7da';g.fillRect(mm(sx),mm(sy),mm(SW),mm(12));
  g.fillStyle='rgba(70,60,50,.85)';g.font=`${mm(7.5)}px Reenie`;g.textBaseline='middle';
  g.fillText('roll 03  ·  far away',mm(sx+6),mm(sy+6.4));g.textAlign='right';g.fillText('E-6  ♡',mm(sx+SW-6),mm(sy+6.4));g.textAlign='left';
  for(let r=0;r<3;r++){const cnt=Math.min(3,frames.length-r*3);if(cnt<=0)break;
    // 张数少就往中间那格袋子放：一条放中间，两条放中下，三条从头放
    const off=Math.ceil(frames.length/3)<3?1:0,y0=sy+14+(r+off)*ROW+(ROW-STRIP_H)/2,x0=(TW-STRIP_W)/2+(r-1)*1.2;
    g.save();g.translate(mm(x0+STRIP_W/2),mm(y0+STRIP_H/2));g.rotate((r-1)*.0035);g.translate(-mm(STRIP_W/2),-mm(STRIP_H/2));
    g.fillStyle='#0b0908';g.fillRect(0,0,mm(END*2+FW*cnt+GAP*(cnt-1)),mm(STRIP_H));
    for(let c=0;c<cnt;c++){const [k,fr,ev]=frames[r*3+c],p=pics[k],fxp=mm(END+c*(FW+GAP)),fyp=mm((STRIP_H-FH)/2);
      g.save();g.beginPath();g.roundRect(fxp,fyp,mm(FW),mm(FH),mm(.6));g.clip();g.filter=`saturate(1.12) contrast(.96) brightness(${.84+ev}) blur(1.3px)`;
      CONTENT.drawCrop(g,p,fr,fxp,fyp,mm(FW),mm(FH));g.restore();
      g.fillStyle='rgba(255,196,120,.85)';g.font=`${mm(1.7)}px "JB Mono"`;g.textBaseline='middle';const n=r*3+c+1;
      g.fillText(`▶${n}`,fxp+mm(3),mm(1.4));if(c===1||cnt===1)g.fillText('REVERSAL 100  RDP',fxp+mm(22),mm(1.4));g.fillText(`${n}A`,fxp+mm(FW-8),mm(STRIP_H-1.4));
      cells.push([(x0+END+c*(FW+GAP)+FW/2)/TW,(y0+STRIP_H/2)/TH])}
    g.restore()}
  g.fillStyle='rgba(228,234,240,.14)';g.fillRect(mm(sx),mm(sy+12),mm(SW),mm(ROW*3+2));
  g.strokeStyle='rgba(40,50,60,.2)';g.lineWidth=mm(.35);g.strokeRect(mm(sx),mm(sy),mm(SW),mm(14+ROW*3));
  g.fillStyle='rgba(60,70,80,.28)';for(let r=0;r<=3;r++)for(let x=sx+1;x<sx+SW;x+=1.6){g.beginPath();g.ellipse(mm(x),mm(sy+14+r*ROW),mm(.45),mm(.3),0,0,7);g.fill()}
  for(const [a,w] of [[.22,40],[.58,22],[.71,60]]){const x=mm(sx+SW*a),sh=g.createLinearGradient(x,0,x+mm(w),0);
    sh.addColorStop(0,'rgba(255,255,255,0)');sh.addColorStop(.5,'rgba(255,255,255,.06)');sh.addColorStop(1,'rgba(255,255,255,0)');
    g.save();g.transform(1,0,-.35,1,mm(40),0);g.fillStyle=sh;g.fillRect(x,mm(sy+12),mm(w),mm(ROW*3+2));g.restore()}
  // 红蜡笔圈：蜡笔是糙的，画两圈不重合，起笔收笔各出一点头
  picks.forEach((i,n)=>{const [u,v]=cells[i],cx=mm(u*TW),cy=mm(v*TH);let s=i*97+13;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
    g.strokeStyle='rgba(205,40,30,.92)';g.lineCap='round';
    for(let pass=0;pass<2;pass++){g.lineWidth=mm(1.3-pass*.4);g.beginPath();const a0=-.6+rnd()*.4,rx=mm(FW*.56+rnd()*3),ry=mm(FH*.6+rnd()*3);
      for(let k=0;k<=48;k++){const a=a0+k/48*(Math.PI*2+.45),w=1+Math.sin(a*3+pass)*.025;const x=cx+Math.cos(a)*rx*w,y=cy+Math.sin(a)*ry*w;k?g.lineTo(x,y):g.moveTo(x,y)}g.stroke()}});
  return {cv,cells,W:TW/120,D:TH/120};
}

export function addLightTable({scene,frames,pics,full,picks,at}){
  const root=new THREE.Group();root.position.copy(at);scene.add(root);
  const {cv,cells,W,D}=sheetCanvas(frames,pics,picks);
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=SRGB;tex.anisotropy=8;
  // 外壳：深灰哑光塑料，四边圆角，上沿一圈斜倒角，台面往里凹一点；后面比前面高一点点，台面朝人斜
  const BW=W/2+.11,BD=D/2+.11,BH=.24,R=.08;
  const shell=new THREE.MeshPhysicalMaterial({color:'#2d2b29',roughness:.48,clearcoat:.35,clearcoatRoughness:.5,envMapIntensity:.8});
  const box=new THREE.Group();box.rotation.x=.045;root.add(box);
  const side=new THREE.Mesh(loft([[BW,BD,R,0],[BW,BD,R,BH-.035],[BW-.012,BD-.012,R-.012,BH-.008],[BW-.035,BD-.035,R-.035,BH],[W/2+.02,D/2+.02,.02,BH],[W/2,D/2,.01,BH-.012]]),shell);
  side.castShadow=side.receiveShadow=true;box.add(side);
  // 扩散板：自己发光，tone mapping 关掉让它是全场最亮
  const diff=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshBasicMaterial({map:tex,toneMapped:false,color:new THREE.Color(1.15,1.15,1.15)}));
  diff.rotation.x=-Math.PI/2;diff.position.y=BH-.012;box.add(diff);
  // 前脸：一个翘板开关（开着，红点露出来），一行丝印
  const front=new THREE.Group();front.position.set(BW-.42,BH*.5,BD+.001);box.add(front);
  const sw=new THREE.Mesh(new THREE.BoxGeometry(.16,.09,.03),new THREE.MeshStandardMaterial({color:'#121110',roughness:.4}));front.add(sw);
  const rock=new THREE.Mesh(new THREE.BoxGeometry(.13,.065,.03),new THREE.MeshPhysicalMaterial({color:'#1b1a19',roughness:.3,clearcoat:.6}));rock.position.z=.018;rock.rotation.x=.18;front.add(rock);
  const dot=new THREE.Mesh(new THREE.PlaneGeometry(.035,.012),new THREE.MeshBasicMaterial({color:'#ff4a2a',toneMapped:false}));dot.position.set(0,.022,.035);dot.rotation.x=.18;front.add(dot);
  {const c=document.createElement('canvas');c.width=512;c.height=64;const x=c.getContext('2d');x.fillStyle='rgba(205,200,190,.75)';x.font="400 26px 'JB Mono'";x.fillText('LIGHT BOX  ·  5000K  ·  CRI 95',4,40);
   const t=new THREE.CanvasTexture(c);t.colorSpace=SRGB;const lab=new THREE.Mesh(new THREE.PlaneGeometry(.95,.12),new THREE.MeshBasicMaterial({map:t,transparent:true}));
   lab.position.set(-BW+.62,BH*.5,BD+.002);box.add(lab)}
  // 小脚 + 后面一根电线拖出画外
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>{const f=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,.03,16),new THREE.MeshStandardMaterial({color:'#0d0c0b',roughness:.9}));f.position.set(a*(BW-.18),-.012,b*(BD-.18));box.add(f)});
  {const pts=[[-BW+.3,.06,-BD],[-BW+.2,.02,-BD-.4],[-BW-.4,.012,-BD-.9],[-BW-1.6,.012,-BD-1.2]].map(p=>new THREE.Vector3(...p));
   const cord=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.018,8),new THREE.MeshStandardMaterial({color:'#121110',roughness:.6}));cord.castShadow=true;box.add(cord)}
  // 台子的光：往上打亮放大镜，往四周在木头上漫一圈冷白
  const up=new THREE.PointLight('#e8f0ff',5,3.2,2);up.position.set(0,BH+.9,0);box.add(up);
  const spillC=document.createElement('canvas');spillC.width=spillC.height=256;{const x=spillC.getContext('2d'),gr=x.createRadialGradient(128,128,40,128,128,128);
    gr.addColorStop(0,'rgba(200,220,255,.55)');gr.addColorStop(.5,'rgba(190,210,255,.16)');gr.addColorStop(1,'rgba(190,210,255,0)');x.fillStyle=gr;x.fillRect(0,0,256,256)}
  const spill=new THREE.Mesh(new THREE.PlaneGeometry(BW*2+1.6,BD*2+1.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(spillC),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.5}));
  spill.rotation.x=-Math.PI/2;spill.position.y=.003;root.add(spill);
  // 台面上方一层很淡的光晕，像屏幕没法真亮过的那点“刺眼”
  const haze=new THREE.Mesh(new THREE.PlaneGeometry(W*1.15,D*1.15),new THREE.MeshBasicMaterial({map:spill.material.map,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.18,toneMapped:false}));
  haze.rotation.x=-Math.PI/2;haze.position.y=BH+.06;box.add(haze);

  // ---- 方形看片放大镜：黑色罩子往上收，底下一圈亮边，顶上眼罩和镜片 ----
  const loupe=new THREE.Group();
  const black=new THREE.MeshPhysicalMaterial({color:'#0b0a0a',roughness:.4,clearcoat:.45,clearcoatRoughness:.3,envMapIntensity:.55});
  const chrome=new THREE.MeshStandardMaterial({color:'#d8d6d2',metalness:1,roughness:.18,envMapIntensity:1.6});
  const L0=.4,L1=.29,LH=.56;
  const hood=new THREE.Mesh(loft([[L0,L0*.92,.05,0],[L0,L0*.92,.05,.035],[L0-.005,L0*.92-.005,.05,.05],[L1+.02,L1*.95+.02,.07,LH-.06],[L1,L1*.95,.06,LH-.02],[L1-.02,L1*.95-.02,.05,LH]]),black);
  hood.castShadow=true;loupe.add(hood);
  const band=new THREE.Mesh(loft([[L0+.006,L0*.92+.006,.052,.0],[L0+.006,L0*.92+.006,.052,.03]]),chrome);loupe.add(band);
  // 顶面：一圈斜的亮边接一个圆眼罩
  const top=new THREE.Mesh(cap(L1-.02,L1*.95-.02,.05,LH),new THREE.MeshStandardMaterial({color:'#0a0909',roughness:.75,envMapIntensity:.25}));loupe.add(top);
  const eye=new THREE.Mesh(new THREE.CylinderGeometry(.085,.1,.08,40,1,true),chrome);eye.position.y=LH+.04;loupe.add(eye);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.085,.016,12,40),new THREE.MeshPhysicalMaterial({color:'#0b0b0b',roughness:.75}));rim.rotation.x=Math.PI/2;rim.position.y=LH+.08;loupe.add(rim);
  // 镜片：透过它看下去是亮的那一格，表面再反一点房间
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.083,48),new THREE.MeshPhysicalMaterial({color:'#000',roughness:.04,clearcoat:1,clearcoatRoughness:.02,envMapIntensity:2,emissive:'#ffffff',emissiveMap:tex,emissiveIntensity:.06}));
  lens.rotation.x=-Math.PI/2;lens.position.y=LH+.07;loupe.add(lens);
  // 镜片里看到的那一格：把贴图的 uv 只取被扣住的那格
  const pickCell=(i)=>{const [u,v]=cells[i];const t=tex.clone();t.needsUpdate=true;const s=.235;t.repeat.set(s*.75,s);t.offset.set(u-s*.375,1-v-s/2);lens.material.emissiveMap=t;lens.material.needsUpdate=true};
  box.add(loupe);
  const place=(i,rot=0)=>{const [u,v]=cells[i];loupe.position.set((u-.5)*W,BH-.012,(v-.5)*D);loupe.rotation.y=rot;pickCell(i)};
  // 红蜡笔：纸卷着的那种，躺在台子右边的木头上
  const pencil=new THREE.Group();
  const paper=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.9,16),new THREE.MeshStandardMaterial({color:'#b8281e',roughness:.8}));paper.rotation.z=Math.PI/2;pencil.add(paper);
  const wax=new THREE.Mesh(new THREE.ConeGeometry(.045,.12,16),new THREE.MeshStandardMaterial({color:'#c42a1f',roughness:.55}));wax.rotation.z=-Math.PI/2;wax.position.x=.51;pencil.add(wax);
  const str=new THREE.Mesh(new THREE.TorusGeometry(.046,.005,6,16),new THREE.MeshStandardMaterial({color:'#e8e0d0',roughness:.9}));str.rotation.y=Math.PI/2;str.position.x=-.2;pencil.add(str);
  pencil.traverse(o=>o.castShadow=true);pencil.position.set(BW+.55,.045,.25);pencil.rotation.y=.5;root.add(pencil);
  // 电源：0 关（扩散板只是一块被安全灯照红的乳白塑料，片子看不清）→ 1 开
  const OFF=new THREE.Color(.1,.045,.035),ON=new THREE.Color(1.15,1.15,1.15);
  function power(k){diff.material.color.copy(OFF).lerp(ON,k);spill.material.opacity=.5*k;haze.material.opacity=.18*k;up.intensity=5*k;
    lens.material.emissiveIntensity=lens.material.emissiveIntensity>.07?lens.material.emissiveIntensity:.06*k}
  function flip(on){rock.rotation.x=on?.18:-.18;dot.visible=on}
  power(1);flip(true);
  let cur=4;const place2=(i,rot)=>{cur=i;place(i,rot)};
  return {root,box,loupe,place:place2,cur:()=>cur,cells,diff,up,front,power,flip,W,D,BH,
    dive:opts=>dive({...opts,loupe,frames,pics:full||pics,cur:()=>cur})};
}

