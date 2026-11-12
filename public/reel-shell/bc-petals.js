// 05 数花瓣：右页用和纸胶带贴着一朵压干的雏菊（Commons「20160116Bellis perennis1.jpg」CC0 照片，抠好存成 img/daisy/daisy-pressed.webp），
// 客人捏住一片花瓣往外扯（点一下也行），它撕下来打着旋飘到左页下半截堆着；左页红铅笔一行一行记 loves me / loves me not，
// 最后一片永远是 loves me，写完红笔把它圈起来。
import * as THREE from './lib/three.module.js?v=tn9zuj';
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const ctex=c=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t};
const PI=Math.PI,rnd=(a,b)=>a+Math.random()*(b-a);

// 抠好的图 1024×1024：花心在正中，花瓣尖大约半径 488，花心圆半径大约 108
const IC=512,TIP=490,BASE=114,DISC=118,FALL=.8;

// img 抠好的雏菊；x,z 花心在书里的位置，y 纸面高度；size 花多宽；left 左页范围；n 分成几瓣
export function makePetals(img,{x,y,z,size=1.45,left,n=21,spin=.12}){
  const g=new THREE.Group();g.position.set(0,y,0);
  const fg=new THREE.Group();fg.position.set(x,0,z);fg.rotation.y=spin;g.add(fg);
  const k=size/(TIP*2);
  // 一片花瓣：转成尖朝上，按楔形裁出来（画布底边 = 半径 BASE，顶上 = 半径 TIP）
  const PH=TIP-BASE,hw=PI/n,PWpx=Math.ceil(2*TIP*Math.tan(hw))+24;
  const petalCanvas=i=>{const a=(i+.5)/n*PI*2,c=mk(PWpx,PH),q=c.getContext('2d');q.translate(PWpx/2,TIP);
    q.beginPath();q.moveTo(0,0);q.arc(0,0,TIP+40,-PI/2-hw-.015,-PI/2+hw+.015);q.closePath();q.clip();q.rotate(-PI/2-a);q.drawImage(img,-IC,-IC);return {c,a}};
  const geo=new THREE.PlaneGeometry(PWpx*k,PH*k).translate(0,(BASE+PH/2)*k,0).rotateX(-PI/2);
  const petals=[];
  for(let i=0;i<n;i++){const {c,a}=petalCanvas(i);
    const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:ctex(c),transparent:true,alphaTest:.25,roughness:.85,side:THREE.DoubleSide}));
    m.rotation.y=-(a+PI/2);m.position.y=.002+(i%2)*.0004;m.receiveShadow=true;m.userData={i,a,c,pulled:false};fg.add(m);petals.push(m)}
  // 花心：一块圆，盖在花瓣根上
  const disc=(()=>{const D=DISC*2,c=mk(D,D),q=c.getContext('2d');q.beginPath();q.arc(DISC,DISC,DISC,0,PI*2);q.clip();q.drawImage(img,DISC-IC,DISC-IC);
    const m=new THREE.Mesh(new THREE.CircleGeometry(DISC*k,48).rotateX(-PI/2),new THREE.MeshStandardMaterial({map:ctex(c),transparent:true,roughness:.9}));m.position.y=.004;m.castShadow=true;fg.add(m);return {m,c}})();
  // 花底下压着的一行铅笔字：I counted the petals before I pressed it.（一直被花挡着，圈完最后那句才显出来）
  const secret=(()=>{const c=mk(1024,1024),q=c.getContext('2d');q.fillStyle='rgba(70,58,48,.85)';q.textAlign='center';q.font="400 78px 'Reenie'";
    q.save();q.translate(512,512);q.rotate(-.04);q.fillText('I counted the petals',0,-150);q.fillText('before I pressed it.',0,215);q.restore();
    const m=new THREE.Mesh(new THREE.PlaneGeometry(size,size).rotateX(-PI/2),new THREE.MeshBasicMaterial({map:ctex(c),transparent:true,opacity:0,depthWrite:false}));m.position.y=.0012;m.rotation.y=-spin;fg.add(m);return {m,c}})();
  // 两条和纸胶带
  const tapeC=(()=>{const c=mk(256,80),q=c.getContext('2d');q.fillStyle='rgba(224,203,170,.78)';q.fillRect(0,0,256,80);q.fillStyle='rgba(255,255,255,.12)';for(let i=0;i<40;i++)q.fillRect(rnd(0,256),rnd(0,80),rnd(4,30),1);
    q.globalCompositeOperation='destination-out';for(const ex of [0,256]){for(let yy=0;yy<80;yy+=6){q.beginPath();q.moveTo(ex,yy);q.lineTo(ex+(ex?-1:1)*rnd(3,9),yy+3);q.lineTo(ex,yy+6);q.fill()}}return c})();
  const tapes=[[-.5,.5,.75],[.52,-.46,.68]].map(([tx,tz,tr])=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(.36,.11).rotateX(-PI/2),new THREE.MeshStandardMaterial({map:ctex(tapeC),transparent:true,roughness:.7,depthWrite:false}));
    m.position.set(tx,.006,tz);m.rotation.y=tr;m.renderOrder=3;fg.add(m);return m});

  // ---- 左页：红铅笔记的那一列列字（一张透明的纸面），扯下来的花瓣堆在下半截 ----
  const L=left,LW=L.x1-L.x0,LD=L.z1-L.z0,CW=900,CH=1200;
  const listC=mk(CW,CH),lx=listC.getContext('2d'),listT=ctex(listC);
  const list=new THREE.Mesh(new THREE.PlaneGeometry(LW,LD).rotateX(-PI/2),new THREE.MeshBasicMaterial({map:listT,transparent:true,depthWrite:false}));
  list.position.set((L.x0+L.x1)/2,.003,(L.z0+L.z1)/2);g.add(list);
  // 专属设置 text 换了这两句（11.05 送朋友：are we still friends? / maybe not）：编号跟在前面，整句对不上，所以在这里先换
const word=i=>{const w=(n-i)%2===0?'loves me':'loves me not';return window.ROLL?.cx?ROLL.cx(w):w};   // 第 i 片（从 1 数）；最后一片 i=n 永远是 loves me
  // 一栏 300 宽：放不下就这一行缩字（圈圈也按同样的字量）
  const fit=t=>{lx.font="400 48px 'Reenie'";const w=lx.measureText(t).width;if(w>280)lx.font=`400 ${Math.floor(48*280/w)}px 'Reenie'`;return Math.min(w,280)};
  const ROWS=11,cell=i=>{const c=Math.floor((i-1)/ROWS),r=(i-1)%ROWS;return {x:310+c*300,y:200+r*66}};
  const lines=[];let circleAt=0,listUntil=0;
  function drawList(now){lx.clearRect(0,0,CW,CH);let busy=false;lx.fillStyle=lx.strokeStyle='#a8231a';lx.font="400 48px 'Reenie'";lx.lineWidth=1.3;lx.textAlign='left';
    for(const ln of lines){const p=cell(ln.i),t=Math.min(1,(now-ln.t0)/550);if(t<1)busy=true;if(t<=0)continue;
      const w=fit(ln.text);lx.save();lx.translate(p.x,p.y);lx.rotate(ln.rot);lx.beginPath();lx.rect(-4,-50,(w+8)*t,70);lx.clip();lx.fillText(ln.text,0,0);lx.strokeText(ln.text,0,0);lx.restore()}
    // 最后那句写完：红笔绕它圈两圈（一笔画出来）
    // 还没到点的时候什么都不画（计时是负数会往反方向先画出一圈）
    if(circleAt&&now<circleAt)busy=true;
    if(circleAt&&now>=circleAt){const t=Math.min(1,(now-circleAt)/900);if(t<1)busy=true;const p=cell(n),w=fit(n+'. '+word(n));
      lx.save();lx.translate(p.x+w/2,p.y-16);lx.lineWidth=3.2;lx.lineCap='round';lx.beginPath();const A=PI*2*1.15*t;
      for(let s=0;s<=60;s++){const u=s/60*A,rr=1+.05*Math.sin(u*3);const px=Math.cos(u-2.4)*(w/2+26)*rr,py=Math.sin(u-2.4)*42*rr+u*1.2;s?lx.lineTo(px,py):lx.moveTo(px,py)}lx.stroke();lx.restore()}
    listT.needsUpdate=true;return busy}
  // 花瓣落的地方：左页下半截，一片压一片
  // 落点：整张左页打一张 4×6 的格子，每格抖一抖，洗乱；飘到字上也没关系
  const slots=(()=>{const a=[];for(let r=0;r<6;r++)for(let c=0;c<4;c++)a.push([.15+c*.235+rnd(-.06,.06),.12+r*.14+rnd(-.04,.04)]);
    // 最后那句圈起来的 loves me（第二列第 10 行，大约 u .66–.97、v .6–.72）留出来：落进那一块的挪到它上面或下面
    for(const p of a)if(p[0]>.56&&p[1]>.52&&p[1]<.8)p[1]=p[1]<.66?.48:.86;
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a})();
  const spot=()=>{const [u,v]=slots.shift()||[rnd(.1,.3),rnd(.15,.85)];return new THREE.Vector3(L.x0+LW*u,0,L.z0+LD*v)};

  // ---- 手：捏住一片往外扯，扯够了就撕下来；只点一下也撕 ----
  const plane=new THREE.Plane(),hit=new THREE.Vector3(),loc=new THREE.Vector3(),C=new THREE.Vector3();
  const pagePoint=ray=>{g.updateMatrixWorld(true);const o=g.getWorldPosition(new THREE.Vector3());plane.set(new THREE.Vector3(0,1,0),-(o.y+.004));return ray.ray.intersectPlane(plane,hit)?g.worldToLocal(loc.copy(hit)):null};
  let hold=null,count=0;const falling=[];
  // 这片花瓣朝外的方向（g 里）
  const outDir=m=>new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),m.rotation.y+fg.rotation.y);
  function down(ev,ray){if(!g.visible)return false;const hs=ray.intersectObjects(petals.filter(m=>!m.userData.pulled),false);if(!hs.length)return false;
    const m=hs[0].object,p=pagePoint(ray);if(!p)return false;hold={m,p0:p.clone(),pull:0,dir:outDir(m)};return true}
  function move(ev,ray){if(!hold)return;const p=pagePoint(ray);if(!p)return;const d=p.clone().sub(hold.p0);hold.pull=Math.max(0,d.dot(hold.dir));
    // 拽着的时候花瓣跟着往外滑一点、翘起来一点，拽过 .14 就撕下来
    const m=hold.m,s=Math.min(hold.pull,.14);m.position.set(0,.002+s*.25,0).addScaledVector(hold.dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0),-fg.rotation.y),s*.6);
    if(hold.pull>.14){tear(m,performance.now());hold=null}}
  function up(){if(!hold)return;const h=hold;hold=null;if(h.pull<.03)tear(h.m,performance.now());else{h.m.position.set(0,.002,0)}}
  const over=ray=>{if(!g.visible)return null;return ray.intersectObjects(petals.filter(m=>!m.userData.pulled),false).length?'grab':null};
  function tear(m,now){if(m.userData.pulled)return;m.userData.pulled=true;count++;
    // 从花上挪到 g 里，世界位置不变，然后飘
    g.attach(m);m.castShadow=true;const u=m.userData;u.from=m.position.clone();u.rot0=m.rotation.y;u.to=spot();u.to.y=.006+count*.0007;u.t0=now;u.yaw=rnd(0,PI*2);
    // 落点是花瓣中间：从落点往回退半片（落下来缩到 .6，压干的散瓣看着小一点）
    {const len=(BASE+PH/2)*k*FALL;u.to.x+=Math.sin(u.yaw)*len;u.to.z+=Math.cos(u.yaw)*len}u.sway=rnd(.15,.3);u.spin=rnd(-5,5);falling.push(m);
    lines.push({i:count,text:count+'. '+word(count),t0:now+500,rot:rnd(-.03,.03)});listUntil=now+1150;if(count===n){circleAt=now+1300;listUntil=now+2300}}
  // ---- 画到纸上（翻走前把右页剩下的花印到这页纸上，跟着纸翻走） ----
  function drawOn(x2,W,H,{px,pz,pw,pd}){// px,pz：纸左上角在书里的坐标；pw,pd：纸的宽深
    const sx=W/pw,sz=H/pd,cx=(x+0-px)*sx,cz=(z-pz)*sz,sc=k*sx;
    x2.save();x2.translate(cx,cz);
    if(secret.m.material.opacity>0){x2.save();x2.globalAlpha=secret.m.material.opacity;x2.drawImage(secret.c,-size/2*sx,-size/2*sz,size*sx,size*sz);x2.restore()}
    x2.rotate(-spin);x2.shadowColor='rgba(40,25,10,.3)';x2.shadowBlur=10;x2.shadowOffsetY=4;
    for(const m of petals){if(m.userData.pulled)continue;const u=m.userData;x2.save();x2.rotate(u.a+PI/2);x2.drawImage(u.c,-PWpx/2*sc,-TIP*sc,PWpx*sc,PH*sc);x2.restore()}
    x2.drawImage(disc.c,-DISC*sc,-DISC*sc,DISC*2*sc,DISC*2*sc);x2.shadowColor='transparent';
    for(const t of tapes){x2.save();x2.translate(t.position.x*sx,t.position.z*sz);x2.rotate(-t.rotation.y);x2.drawImage(tapeC,-.18*sx,-.055*sz,.36*sx,.11*sz);x2.restore()}
    x2.restore()}

  let last=0;
  function update(now){if(!g.visible){last=now;return false}if(last&&now<last)return false;last=now;let busy=!!hold;
    for(let i=falling.length-1;i>=0;i--){const m=falling[i],u=m.userData,t=(now-u.t0)/1700;if(t>=1){m.position.copy(u.to);m.rotation.set(0,u.yaw,0);m.scale.setScalar(FALL);falling.splice(i,1);continue}busy=true;
      // 先被扯得往上一扬，再打着旋飘下来，左右晃
      m.scale.setScalar(1-(1-FALL)*Math.min(1,t*1.5));const e=t*t*(3-2*t),lift=Math.sin(Math.min(1,t*1.4)*PI)*.55;m.position.lerpVectors(u.from,u.to,e);m.position.y+=lift;m.position.x+=Math.sin(t*PI*3)*u.sway*(1-t);
      const rx=Math.sin(t*9)*.7*(1-t),rz=Math.cos(t*7)*.5*(1-t);m.rotation.set(rx,u.rot0+(u.yaw-u.rot0)*e+u.spin*(1-t)*t,rz);
      m.position.y+=TIP*k*m.scale.x*(Math.abs(Math.sin(rx))+Math.abs(Math.sin(rz)))}
    // 圈完一秒多，花底下那行字慢慢显出来
    if(circleAt&&now>circleAt+1100&&secret.m.material.opacity<1){secret.m.material.opacity=Math.min(1,(now-circleAt-1100)/1600);busy=true}
    // 字只在写的那一会儿重画
    if(now<listUntil+50){drawList(now);busy=true}
    return busy}
  return {group:g,flower:fg,list,down,move,up,over,update,drawOn,get count(){return count},
    // 调试：一下子全扯下来
    _pullAll(){const now=performance.now();petals.filter(m=>!m.userData.pulled).forEach((m,i)=>tear(m,now+i*0))},get done(){return count>=n},get holding(){return !!hold}};
}
