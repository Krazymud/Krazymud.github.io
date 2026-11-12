// 入场桌上的另外两样：一张信纸（打字机问题 + 空着等客人写的那一行）和一支羽毛笔
import * as THREE from './lib/three.module.js?v=tn9zuj';
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const rnd=(a,b)=>a+Math.random()*(b-a);

export const QUESTION=['If our story','were a film,','what would','it be called?'];

export function makeLetter(w=1.7){
  const PW=900,PH=1180,c=mk(PW,PH),x=c.getContext('2d');
  const g=x.createRadialGradient(PW*.4,PH*.25,50,PW*.5,PH*.5,PH*.8);g.addColorStop(0,'#fbf7ee');g.addColorStop(.7,'#f1e9d8');g.addColorStop(1,'#e2d5bd');
  x.fillStyle=g;x.fillRect(0,0,PW,PH);
  // 纸纤维：细长的浅色划痕 + 一点点斑
  for(let i=0;i<60;i++){const cx=rnd(0,PW),cy=rnd(0,PH),rr=rnd(40,160),gg=x.createRadialGradient(cx,cy,0,cx,cy,rr);gg.addColorStop(0,`rgba(150,120,80,${rnd(.03,.07)})`);gg.addColorStop(1,'rgba(150,120,80,0)');x.fillStyle=gg;x.fillRect(cx-rr,cy-rr,rr*2,rr*2)}
  for(let i=0;i<2600;i++){x.strokeStyle=`rgba(${Math.random()<.5?'120,95,60':'255,255,255'},${rnd(.05,.14)})`;x.lineWidth=rnd(.8,1.8);const a=rnd(0,Math.PI),l=rnd(6,22),px=rnd(0,PW),py=rnd(0,PH);x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}
  x.fillStyle='rgba(120,80,40,.06)';x.fillRect(0,PH*.34,PW,1.5);
  x.fillStyle='#8a5a3a';x.font="400 17px 'JB Mono'";x.textBaseline='alphabetic';
  x.fillText('INSIDE · ONE QUESTION',80,96);x.textAlign='right';x.fillText('FOR TWO',PW-80,96);x.textAlign='left';
  x.fillStyle='#1d140c';x.font="400 46px 'Courier Prime'";
  QUESTION.forEach((l,i)=>{x.globalAlpha=rnd(.82,.95);x.fillText(l,82+rnd(-1,1),240+i*70)});x.globalAlpha=1;
  // 写片名的那一行：一条淡淡的铅笔线
  x.strokeStyle='rgba(90,70,50,.35)';x.lineWidth=2;x.beginPath();x.moveTo(82,720);x.lineTo(PW-82,716);x.stroke();
  x.fillStyle='#8a5a3a';x.font="400 15px 'JB Mono'";x.fillText('TITLE',82,750);
  // 信纸自己告诉客人怎么做：打字机写一句，红铅笔在线下面补一句回车
  x.fillStyle='#1d140c';x.font="400 32px 'Courier Prime'";
  ['Write it on the line.','The book will keep it.'].forEach((l,i)=>{x.globalAlpha=rnd(.8,.92);x.fillText(l,82,560+i*48)});x.globalAlpha=1;
  x.fillStyle='#b0281e';x.font="400 40px 'Reenie'";x.save();x.translate(96,800);x.rotate(-.03);x.fillText('then press enter',0,0);x.restore();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  // 纸边往上微微卷一点
  const h=w*PH/PW,geo=new THREE.PlaneGeometry(w,h,24,32),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const u=p.getX(i)/w+.5,v=p.getY(i)/h+.5;p.setZ(i,.025*Math.pow(Math.abs(u-.5)*2,3)+.03*Math.pow(1-v,4))}
  geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:2,color:'#e8dcc6',roughness:.9,side:THREE.DoubleSide}));
  m.rotation.x=-Math.PI/2;m.castShadow=m.receiveShadow=true;
  // 客人在 TITLE 线上写字：每次整张重画（底稿 + 手写体），返回字尾在纸上的位置，羽毛笔跟过去
  const blank=mk(PW,PH);blank.getContext('2d').drawImage(c,0,0);
  const write=(s,caret)=>{x.drawImage(blank,0,0);let fs=86;x.font=`400 ${fs}px Allura, 'Roll Kai', 'Kaiti SC', KaiTi, serif`;while(fs>40&&x.measureText(s).width>PW-190){fs-=4;x.font=`400 ${fs}px Allura, 'Roll Kai', 'Kaiti SC', KaiTi, serif`}
    x.fillStyle='#24160c';x.textAlign='left';x.fillText(s,92,706);
    if(caret){const cxp=92+x.measureText(s).width+6;x.fillStyle='rgba(36,22,12,.75)';x.fillRect(cxp,640,3,74)}
    t.needsUpdate=true;
    return {u:(92+x.measureText(s).width)/PW,v:690/PH}};
  return {mesh:m,canvas:c,tex:t,write,w,h};
}

// 羽毛笔：羽片用真羽毛照片（img/feather.jpg，Commons 公有领域，黑底），按亮度抠出来贴在一张微微弯的面上；
// 杆子顺着照片里的羽轴接下去，笔尖一小截金属
export function makeQuill(len,photo){
  const X0=220,Y0=50,FW=660,FH=1290,c=mk(FW,FH),x=c.getContext('2d');
  x.drawImage(photo,X0,Y0,FW,FH,0,0,FW,FH);
  const d=x.getImageData(0,0,FW,FH),p=d.data;
  for(let i=0;i<p.length;i+=4){const l=(p[i]*.3+p[i+1]*.55+p[i+2]*.15),a=Math.max(0,Math.min(1,(l-28)/110));
    p[i]=Math.min(255,l*1.08+18);p[i+1]=Math.min(255,l*1.02+12);p[i+2]=Math.min(255,l*.92+4);p[i+3]=a*255}
  x.putImageData(d,0,0);
  const ft=new THREE.CanvasTexture(c);ft.colorSpace=THREE.SRGBColorSpace;ft.anisotropy=8;
  const g=new THREE.Group(),vane=len*.8,vw=vane*FW/FH;
  const vg=new THREE.PlaneGeometry(vw,vane,10,24),pp=vg.attributes.position;
  // 羽片两边往上微微卷（往下卷的话放在纸上会穿进纸里）
  for(let i=0;i<pp.count;i++){const X=pp.getX(i),Y=pp.getY(i);pp.setZ(i,Math.abs(X+vw*.11)*.12+.03*Math.sin((Y/vane+.5)*Math.PI))}
  vg.computeVertexNormals();
  const vm=new THREE.Mesh(vg,new THREE.MeshStandardMaterial({map:ft,color:'#d9d2c6',alphaTest:.12,transparent:true,depthWrite:false,side:THREE.DoubleSide,roughness:.85}));
  // 照片里羽轴在左边 39% 的地方，挪过来对准杆子
  vm.position.set(vw*.11,len*.5-vane*.5+.04,0);vm.castShadow=true;g.add(vm);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.007,.015,len*.42,10),new THREE.MeshStandardMaterial({color:'#efe4cf',roughness:.35}));
  shaft.position.y=-len*.5+len*.21;shaft.castShadow=true;g.add(shaft);
  const nib=new THREE.Mesh(new THREE.ConeGeometry(.015,.12,10),new THREE.MeshStandardMaterial({color:'#b08a4a',metalness:.85,roughness:.3}));nib.rotation.z=Math.PI;nib.position.y=-len/2-.06;g.add(nib);
  g.rotation.x=-Math.PI/2;
  const outer=new THREE.Group();outer.add(g);return outer;
}

// 右上角一小堆卡片和纸条：内容固定，是我们夹在样品里的悄悄话
const NOTE_PX=320;
function paper(w,h,bg,draw,torn){
  const W=Math.round(w*NOTE_PX),H=Math.round(h*NOTE_PX),c=mk(W,H),x=c.getContext('2d');
  x.fillStyle=bg;
  if(torn){x.beginPath();x.moveTo(0,0);x.lineTo(W,0);x.lineTo(W,H);for(let i=W;i>=0;i-=8)x.lineTo(i,H-rnd(0,10));x.closePath();x.fill()}else x.fillRect(0,0,W,H);
  for(let i=0;i<W*H/220;i++){x.fillStyle=`rgba(${Math.random()<.5?'110,85,55':'255,255,255'},${rnd(.03,.07)})`;x.fillRect(rnd(0,W),rnd(0,H),1.4,1.4)}
  draw(x,W,H);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.92,transparent:!!torn,alphaTest:torn?.5:0}));
  m.rotation.x=-Math.PI/2;m.castShadow=m.receiveShadow=true;return m;
}
export function makeNotes(){
  const g=new THREE.Group(),red='#b0281e',ink='#1d140c';
  const notes=[
    // 打字的索引卡：她拍照总是对焦在手上
    {w:1.05,h:.68,x:.05,z:.1,r:-.12,m:paper(1.05,.68,'#f3ead8',(x,W,H)=>{
      x.strokeStyle='rgba(176,40,30,.55)';x.lineWidth=2;x.beginPath();x.moveTo(0,62);x.lineTo(W,62);x.stroke();
      x.strokeStyle='rgba(70,110,160,.25)';x.lineWidth=1.2;for(let y=104;y<H;y+=40){x.beginPath();x.moveTo(0,y);x.lineTo(W,y);x.stroke()}
      x.fillStyle=ink;x.font="400 26px 'Courier Prime'";x.fillText('NOTE TO SELF:',22,48);
      x.font="400 20px 'Courier Prime'";['she focuses on the hands,','never the faces.','so I hold hers.'].forEach((l,i)=>x.fillText(l,22,96+i*40))})},
    // 黄色便利贴，红笔
    {w:.62,h:.62,x:.62,z:-.18,r:.22,m:paper(.62,.62,'#f2d77a',(x,W,H)=>{
      const sh=x.createLinearGradient(0,0,0,40);sh.addColorStop(0,'rgba(120,90,20,.22)');sh.addColorStop(1,'rgba(120,90,20,0)');x.fillStyle=sh;x.fillRect(0,0,W,40);
      x.fillStyle=red;x.textAlign='center';['eat something','warm before','bed.'].forEach((l,i)=>{x.font="400 44px 'Reenie'";const w=x.measureText(l).width;if(w>W-24)x.font=`400 ${Math.floor(44*(W-24)/w)}px 'Reenie'`;x.fillText(l,W/2,62+i*46)});
      x.font="400 30px 'Reenie'";x.fillText('(I checked.)',W/2,H-22)})},
    // 一张票根
    {w:.95,h:.4,x:-.2,z:.62,r:.08,m:paper(.95,.4,'#d9b98a',(x,W,H)=>{
      x.setLineDash([6,6]);x.strokeStyle='rgba(60,35,15,.5)';x.lineWidth=2;x.beginPath();x.moveTo(W*.72,8);x.lineTo(W*.72,H-8);x.stroke();x.setLineDash([]);
      x.fillStyle='#3a2414';x.font="400 15px 'JB Mono'";x.fillText('ADMIT TWO · ROW F · SEAT 17',18,32);
      x.font="italic 600 36px Fraunces";x.fillText('No Return',18,86);
      x.font="400 15px 'JB Mono'";x.fillText('VALID: FOREVER',18,H-18);
      x.save();x.translate(W*.86,H/2);x.rotate(-Math.PI/2);x.textAlign='center';x.font="400 15px 'JB Mono'";x.fillText('Nº 0510',0,5);x.restore()})},
    // 撕下来的一条白纸，花体
    {w:1.1,h:.32,x:.5,z:.48,r:-.2,m:paper(1.1,.32,'#f7f1e6',(x,W,H)=>{
      x.fillStyle=red;x.font="400 58px Allura";x.textAlign='center';x.fillText('Tt, then me.',W/2,H*.68)},true)},
  ];
  notes.forEach((n,i)=>{n.m.position.set(n.x,.004+i*.004,n.z);n.m.rotation.z=n.r;g.add(n.m)});
  return g;
}

// 上一幕手电照到的票根：她生的复古美漫票面，字和 torch-comic 里的一样
export function makeTicket(img,w=.95){
  const W=img.width,H=img.height,c=mk(W,H),x=c.getContext('2d');x.drawImage(img,0,0);
  x.textAlign='center';x.fillStyle='#f4ecd6';x.font="700 15px 'JB Mono'";x.fillText('DARKROOM CINEMA',W/2,H*.36);
  x.font="italic 800 54px Fraunces";x.lineWidth=3;x.strokeStyle='#16100b';x.strokeText('Admit two',W/2,H*.58);x.fillStyle='#f0b81f';x.fillText('Admit two',W/2,H*.58);
  x.fillStyle='#f4ecd6';x.font="400 14px 'JB Mono'";x.fillText('ROW G · 7 & 8',W/2,H*.72);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*H/W),new THREE.MeshStandardMaterial({map:t,alphaTest:.5,roughness:.9}));
  m.rotation.x=-Math.PI/2;m.castShadow=m.receiveShadow=true;return m;
}

// 一次性相机：扁扁的黄盒子正面朝上躺着，圆角，正面贴她生的那张相机图（像外面那层印花纸壳），
// 镜头单独凸出来一截，侧面看得出厚度
export function makeCamera(img,w=.95){
  const W=img.width,H=img.height,c=mk(W,H),x=c.getContext('2d');x.drawImage(img,0,0);
  // 只要黄色机身那一块（去掉白底和网点影子）：按黄色像素量边界
  const d=x.getImageData(0,0,W,H).data;let x0=W,y0=H,x1=0,y1=0;
  for(let y=0;y<H;y+=2)for(let xx=0;xx<W;xx+=2){const i=(y*W+xx)*4;if(d[i+3]>200&&d[i]>170&&d[i+1]>120&&d[i+2]<120){if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(y<y0)y0=y;if(y>y1)y1=y}}
  const cw=x1-x0,ch=y1-y0,f=mk(cw,ch);f.getContext('2d').drawImage(c,x0,y0,cw,ch,0,0,cw,ch);
  const t=new THREE.CanvasTexture(f);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  const h=w*ch/cw,T=.15,s=new THREE.Shape(),r=.06;
  s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
  s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  const geo=new THREE.ExtrudeGeometry(s,{depth:T-.03,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:4,curveSegments:8});
  const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/w+.5,uv.getY(i)/h+.5);
  geo.rotateX(-Math.PI/2);geo.translate(0,.015,0);
  const yellow=new THREE.MeshStandardMaterial({color:'#d9a031',roughness:.55}),face=new THREE.MeshStandardMaterial({map:t,roughness:.5});
  const body=new THREE.Mesh(geo,[face,yellow]);body.castShadow=body.receiveShadow=true;
  const g=new THREE.Group();g.add(body);
  // 镜头：图里镜头中心大约在 (350,290)，外圈半径约 118px
  const lu=(350-x0)/cw,lv=(290-y0)/ch,LR=118/cw*w,lx=(lu-.5)*w,lz=(lv-.5)*h;
  const lt=t.clone();lt.needsUpdate=true;lt.repeat.set(2*LR/w,2*LR/h);lt.offset.set(lu-LR/w,1-lv-LR/h);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(LR,LR*1.04,.05,40),[new THREE.MeshStandardMaterial({color:'#6b4520',roughness:.4,metalness:.3}),new THREE.MeshPhysicalMaterial({map:lt,roughness:.2,clearcoat:1}),new THREE.MeshStandardMaterial({color:'#6b4520'})]);
  barrel.position.set(lx,T+.025,lz);barrel.castShadow=true;g.add(barrel);
  return g;
}
