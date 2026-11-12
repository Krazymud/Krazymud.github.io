// 03 地图：一张折成四折的老地图（1910 Chinese Empire and Japan，George Philip & Son，Commons 公有领域）
// 四折从左到右 P1..P4，P3 的左边压在书缝上，一直平躺在右页。翻到这页时整张折成一小叠压在 P3 上：
// P4 往左扣在 P3 上，P2 往右扣在最上面（背面印着封皮），P1 夹在 P2 正面底下。
// 客人一折一折拖开：先把封皮（P2）拖到左页，再把 P4 往右拖开，再把 P1 往左拖开；过一半松手自己落下，不够就弹回去。
// 全摊平以后红笔从第一处开始一段一段画虚线，画到一处就钉下一颗图钉、写上地名；最后多走一截停在 where to next?。
// 点图钉，那里的拍立得从地图上翻起来，再点一下躺回去。
import * as THREE from './lib/three.module.js?v=tn9zuj';
const rnd=(a,b)=>a+Math.random()*(b-a);
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const ctex=c=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t};
const PI=Math.PI;

// 地图正面：扫描图 + 做旧（泛黄、边缘深、霉斑、折痕磨白）。红线和地名另画在一层上，好一点点画出来
function mapFace(img){const W=img.width,H=img.height,c=mk(W,H),x=c.getContext('2d');
  x.drawImage(img,0,0);
  x.globalCompositeOperation='multiply';x.fillStyle='rgba(233,207,156,.45)';x.fillRect(0,0,W,H);
  const g=x.createRadialGradient(W/2,H/2,H*.4,W/2,H/2,W*.75);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(140,95,40,.55)');x.fillStyle=g;x.fillRect(0,0,W,H);
  for(let i=0;i<40;i++){const fx=rnd(0,W),fy=rnd(0,H),r=rnd(10,60),gg=x.createRadialGradient(fx,fy,0,fx,fy,r);gg.addColorStop(0,'rgba(150,100,40,.25)');gg.addColorStop(1,'rgba(150,100,40,0)');x.fillStyle=gg;x.fillRect(fx-r,fy-r,r*2,r*2)}
  x.globalCompositeOperation='source-over';
  // 折痕：四折竖线 + 中间一道横线，磨得发白，一边带一道暗
  const crease=(x0,y0,x1,y1)=>{x.lineCap='round';x.strokeStyle='rgba(255,250,235,.55)';x.lineWidth=7;x.beginPath();x.moveTo(x0,y0);x.lineTo(x1,y1);x.stroke();
    x.strokeStyle='rgba(90,60,25,.25)';x.lineWidth=2;x.beginPath();x.moveTo(x0+4,y0+4);x.lineTo(x1+4,y1+4);x.stroke()};
  for(let k=1;k<4;k++)crease(W*k/4,0,W*k/4,H);crease(0,H/2,W,H/2);
  return c}
// 红笔那一层：画到 t（0..段数），整数部分是画完的段，小数部分是正在画的那段画到哪
function routeLayer(W,H,places,next){const c=mk(W,H),x=c.getContext('2d'),P=places.map(p=>[p.u*W,p.v*H]),end=[next.u*W,next.v*H],pts=[...P,end];
  // 每段是一条微微弯的二次曲线；先取样成折线，画一部分时按取样点截
  const segs=pts.slice(1).map((p,i)=>{const q=pts[i],m=[(p[0]+q[0])/2+(p[1]-q[1])*.18,(p[1]+q[1])/2-(p[0]-q[0])*.18],s=[];
    for(let k=0;k<=40;k++){const t=k/40;s.push([(1-t)*(1-t)*q[0]+2*t*(1-t)*m[0]+t*t*p[0],(1-t)*(1-t)*q[1]+2*t*(1-t)*m[1]+t*t*p[1]])}return s});
  const k=W/2310,ink='#b0281e';
  // 地名自己找位置：钉子右上、左上、右下、左下挨个试，挑跟别的地名、图钉、where to next? 撞得最少的（客人给了 lx/ly 就用客人的）
  x.font=`400 ${104*k}px 'Reenie'`;
  const hitR=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
  const avoid=[...P.map(([px,py])=>[px-30*k,py-30*k,px+30*k,py+30*k]),[end[0]-260*k,end[1]-150*k,end[0]+260*k,end[1]+40*k]];
  const LW=W*.3,labels=places.map((p,i)=>{const [px,py]=P[i],tw=Math.min(LW,x.measureText(p.name).width);   // 地名最宽占图的三成，再长横向压（11.03）
    const cands=p.lx!=null?[[p.lx*k,(p.ly??-30)*k]]:[[40*k,-30*k],[-40*k,-30*k],[40*k,95*k],[-40*k,95*k]];
    let best=null;for(const [dx,dy] of cands){const x0=dx<0?px+dx-tw:px+dx,r=[x0,py+dy-80*k,x0+tw,py+dy+20*k];
      const score=avoid.filter((a,j)=>j!==i&&hitR(r,a)).length+(r[0]<0||r[2]>W?3:0);if(!best||score<best.score)best={dx,dy,r,score}}
    avoid.push(best.r);return best});
  const draw=t=>{x.clearRect(0,0,W,H);x.strokeStyle=ink;x.lineWidth=7*k;x.setLineDash([24*k,16*k]);x.lineCap='round';x.beginPath();x.moveTo(pts[0][0],pts[0][1]);
    segs.forEach((s,i)=>{const f=Math.max(0,Math.min(1,t-i));const n=Math.round(f*40);for(let j=1;j<=n;j++)x.lineTo(s[j][0],s[j][1])});x.stroke();x.setLineDash([]);
    // 地名：线到了才写
    x.fillStyle=x.strokeStyle='#a8231a';x.lineWidth=2.5*k;x.font=`400 ${104*k}px 'Reenie'`;
    places.forEach((p,i)=>{if(t<i)return;const [px,py]=P[i],{dx,dy}=labels[i];x.textAlign=dx<0?'right':'left';x.strokeText(p.name,px+dx,py+dy,LW);x.fillText(p.name,px+dx,py+dy,LW)});
    if(t>=segs.length){x.strokeStyle=ink;x.lineWidth=5*k;x.beginPath();x.arc(end[0],end[1],34*k,0,PI*2);x.stroke();
      x.fillStyle=x.strokeStyle='#a8231a';x.lineWidth=2.5*k;x.textAlign='center';x.font=`400 ${100*k}px 'Reenie'`;x.strokeText('where to next?',end[0],end[1]-60*k);x.fillText('where to next?',end[0],end[1]-60*k)}};
  return {c,draw,n:segs.length}}
// 地图背面：旧纸；P2 背面印着封皮（整张折好时它在最上面）
function mapBack(W,H,cover){const c=mk(W,H),x=c.getContext('2d');x.fillStyle='#e6d6b4';x.fillRect(0,0,W,H);
  for(let i=0;i<W*H/2500;i++){x.strokeStyle=`rgba(${Math.random()<.5?'110,80,40':'255,248,230'},${rnd(.04,.1)})`;x.lineWidth=rnd(.6,1.4);const a=rnd(0,PI),l=rnd(5,16),px=rnd(0,W),py=rnd(0,H);x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}
  const g=x.createRadialGradient(W/2,H/2,H*.2,W/2,H/2,Math.max(W,H)*.8);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(130,90,40,.4)');x.fillStyle=g;x.fillRect(0,0,W,H);
  if(cover){x.strokeStyle='#5a2a16';x.lineWidth=6;x.strokeRect(W*.1,H*.12,W*.8,H*.76);x.lineWidth=2;x.strokeRect(W*.12,H*.14,W*.76,H*.72);
    x.fillStyle='#5a2a16';x.textAlign='center';x.font=`800 ${W*.11}px Fraunces`;x.fillText('MAP OF',W/2,H*.32);x.font=`italic 800 ${W*.16}px Fraunces`;x.fillText('Our Places',W/2,H*.45);
    x.font=`700 ${W*.045}px 'JB Mono'`;x.fillText('FOLDED FOR TWO · 1910 EDITION',W/2,H*.56);
    x.fillStyle='#b0281e';x.font=`400 ${W*.1}px 'Reenie'`;x.fillText('unfold me',W/2,H*.75)}
  return c}

// 一张拍立得：照片 + 下面手写地名和一条空着的日期线
function polaroid(img,name){const W=300,H=360,c=mk(W,H),x=c.getContext('2d');x.fillStyle='#f6f1e6';x.fillRect(0,0,W,H);
  const s=Math.max(260/img.width,260/img.height);x.save();x.beginPath();x.rect(20,20,260,260);x.clip();x.filter='sepia(.25) saturate(.85)';x.drawImage(img,150-img.width*s/2,150-img.height*s/2,img.width*s,img.height*s);x.restore();
  // 地名写在日期线左边，只有 140 宽：长的（Saint Petersburg 这种）先缩字，最小 24px，再不行横向压（11.03）
  x.fillStyle='#3a2a1c';let fs=36;x.font="400 36px 'Reenie'";while(fs>24&&x.measureText(name).width>140){fs-=2;x.font=`400 ${fs}px 'Reenie'`}x.textAlign='left';x.fillText(name,24,318,140);x.font="400 22px 'JB Mono'";x.fillStyle='rgba(60,45,30,.5)';x.fillText('__.__.____',170,318);
  return c}

// 一颗图钉：红钉帽 + 细针，针往纸里扎一点，稍微歪着；外面套一个看不见的大球好点中
function pin(){const g=new THREE.Group(),tilt=new THREE.Group();g.add(tilt);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.032,20,14),new THREE.MeshStandardMaterial({color:'#b3261c',roughness:.35}));head.position.y=.07;head.scale.y=.85;
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.012,.02,.03,12),new THREE.MeshStandardMaterial({color:'#9e2018',roughness:.4}));neck.position.y=.045;
  const needle=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,.05,6),new THREE.MeshStandardMaterial({color:'#b8b8b8',metalness:.8,roughness:.3}));needle.position.y=.015;
  [head,neck,needle].forEach(m=>{m.castShadow=true;tilt.add(m)});tilt.rotation.z=rnd(-.2,.2);tilt.rotation.x=rnd(-.2,.2);
  const hit=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=.05;g.add(hit);
  return {g,hit}}

const backOut=t=>{const k=1.8;t-=1;return 1+t*t*((k+1)*t+k)};
// 经纬度 → 这张裁好的 1910 地图上的位置：用拉萨、青海湖、大理、香港四个量好的点最小二乘拟合出来的一次式（误差约 2%）
export const geoToMap=(lat,lon)=>({u:.027794*lon+.0020783*lat-2.53422,v:.0029961*lon-.041407*lat+1.50385});
export const MAX_PLACES=8;
export function makeMap(img,{x=0,y=0,h=2.7,places,next,photos=[],px=()=>100}){
  // 地点可以直接给 u,v，也可以给 lat,lon；最多 8 处，再多这张图上就挤成一团了
  places=places.slice(0,MAX_PLACES).map(p=>p.u!=null?p:{...p,...geoToMap(p.lat,p.lon)});
  const g=new THREE.Group();g.position.set(x,y,0);
  const w=h*img.width/img.height,pw=w/4;
  const ft=ctex(mapFace(img)),RW=Math.round(img.width/2),RH=Math.round(img.height/2),route=routeLayer(RW,RH,places,next),rt=ctex(route.c);
  const BW=512,BH=Math.round(512*img.height/img.width*4),bt=ctex(mapBack(BW,BH,false)),ct=ctex(mapBack(BW,BH,true));
  // 一折：正面贴这一折对应的四分之一地图（上面再叠一层红笔），背面是旧纸；side=1 往右长，-1 往左长
  const routeMeshes=[];let pins=[];
  const panel=(k,side,back)=>{const geo=new THREE.PlaneGeometry(pw,h);geo.rotateX(-PI/2);geo.translate(side*pw/2,0,0);
    const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,(k+uv.getX(i))/4);
    const f=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:ft,roughness:.93,side:THREE.FrontSide}));
    const r=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:rt,roughness:.9,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
    const bgeo=geo.clone(),buv=bgeo.attributes.uv;for(let i=0;i<buv.count;i++)buv.setX(i,1-(buv.getX(i)*4-k));
    const b=new THREE.Mesh(bgeo,new THREE.MeshStandardMaterial({map:back,roughness:.95,side:THREE.BackSide}));
    f.castShadow=f.receiveShadow=b.receiveShadow=b.castShadow=true;routeMeshes.push(r);const p=new THREE.Group();p.add(f,r,b);return p};
  // P3 平躺在右页（书缝往右）；P4 挂在 P3 右边往右长；P2 挂在 P3 左边往左长；P1 挂在 P2 左边往左长
  const P3=panel(2,1,bt),P4=panel(3,1,bt),P2=panel(1,-1,ct),P1=panel(0,-1,bt);
  g.add(P3);P4.position.x=pw;P3.add(P4);P3.add(P2);P1.position.x=-pw;P2.add(P1);
  // 角度：0 是摊平，π 是扣过来。a2 = P2 扣在 P3 上，a4 = P4 扣在 P3 上，a1 = P1 扣在 P2 正面
  const A={a1:PI,a2:PI,a4:PI},G={a1:PI,a2:PI,a4:PI};
  // 扣着的几层各垫一点高度：P3 上面先是 P4，再是夹着的 P1，最上面 P2（背面封皮朝上）
  const pose=()=>{P2.rotation.z=-A.a2;P2.position.y=A.a2>2.6?.006:0;P1.rotation.z=-A.a1;P1.position.y=A.a1>2.6?.002:0;
    P4.rotation.z=A.a4;P4.position.y=A.a4>2.6?.002:0;
    // 没全摊平的时候红笔层和图钉先收起来（扣着的几层只差几毫米，红笔层会透过封皮，钉子会扎穿）
    const flatAll=A.a1<.3&&A.a2<.3&&A.a4<.3;routeMeshes.forEach(m=>m.visible=flatAll);pins.forEach(p=>p.g.visible=flatAll&&!!p.popAt)};
  pose();
  // 图钉、拍立得按 u,v 放到对应那一折上（P1、P2 往左长，局部 x 是负的）
  const folds=[P1,P2,P3,P4],onFold=(u,v)=>{const k=Math.min(3,Math.floor(u*4)),lx=(u*4-k)*pw;return {p:folds[k],x:k<2?lx-pw:lx,z:(v-.5)*h}};
  pins=places.map((pl,i)=>{const o=onFold(pl.u,pl.v),m=pin();
    m.g.position.set(o.x,.002,o.z);m.g.scale.setScalar(.001);m.g.visible=false;o.p.add(m.g);
    let pol=null;if(photos[i]){const c=polaroid(photos[i],pl.name),pg=new THREE.Group(),mm=new THREE.Mesh(new THREE.PlaneGeometry(.62,.74).translate(0,.37,0),new THREE.MeshStandardMaterial({map:ctex(c),roughness:.9,side:THREE.DoubleSide}));
      mm.castShadow=true;pg.add(mm);pg.rotation.order='YXZ';pg.position.set(0,.006,.03);pg.rotation.y=rnd(-.14,.14);pg.visible=false;m.g.add(pg);pol={g:pg,k:0,goal:0}}
    m.hit.userData.pin=i;return {...m,pop:0,popAt:0,pol}});

  // 照片翻起来时底下压着别的图钉（大理丽江这种挨得近的）：把照片垫高到刚好搭在钉帽上，不让钉子扎穿
  const TILT=PI/2-1.22,TMP=new THREE.Vector3();
  function liftFor(p){let lift=0;const ry=p.pol.g.rotation.y,D=.74*Math.cos(TILT)+.03;
    for(const o of pins){if(o===p||!o.g.visible)continue;o.g.updateMatrixWorld(true);p.g.updateMatrixWorld(true);
      TMP.set(0,.09,0);o.g.localToWorld(TMP);p.g.worldToLocal(TMP);
      const cx=TMP.x,cz=TMP.z-.03,a=cx*Math.cos(ry)-cz*Math.sin(ry),d=-(cx*Math.sin(ry)+cz*Math.cos(ry));
      if(Math.abs(a)<.34&&d>-.04&&d<D)lift=Math.max(lift,TMP.y+.012-(.006+Math.max(0,d)*Math.tan(TILT)))}
    return lift}
  // ---- 手 ----
  let hold=null,routeT=-1,routeAt=0,lastUp=0,tapped=false,doneAt=0;
  const flat=v=>v<.02;
  // 现在能捏哪一折：最上面那张先
  const grabbable=()=>{const L=[];if(!flat(G.a2))L.push(['a2',P2]);else{if(!flat(G.a4))L.push(['a4',P4]);if(!flat(G.a1))L.push(['a1',P1])}return L};
  const shownPins=()=>pins.filter(p=>p.g.visible&&p.pop>.9).map(p=>p.hit);
  function down(ev,ray){if(!g.visible)return false;
    // 先看点没点到已经钉好的图钉
    const hs=ray.intersectObjects(shownPins(),false);
    if(hs.length){const p=pins[hs[0].object.userData.pin];tapped=true;
      // 点一颗翻一张，可以好几张一起立着（她喜欢一起出来的样子），再点一下躺回去
      if(p.pol){p.pol.goal=p.pol.goal?0:1;if(p.pol.goal){p.pol.g.visible=true;p.pol.lift=liftFor(p)}}hold={tap:true};return true}
    for(const [key,P] of grabbable()){if(ray.intersectObject(P,true).length){hold={key,x0:ev.clientX,a0:A[key]};return true}}
    return false}
  function move(ev){if(!hold||hold.tap)return;
    // 往左拖 P2、P1，往右拖 P4；拖过大约一折半的宽度就全翻过去
    const d=(ev.clientX-hold.x0)*(hold.key==='a4'?1:-1)/(pw*px()*1.6);A[hold.key]=G[hold.key]=Math.max(0,Math.min(PI,hold.a0-d*PI));pose()}
  function up(){if(!hold)return;if(!hold.tap){const k=hold.key;G[k]=A[k]<PI*.5?0:PI}hold=null}
  const over=ray=>{if(!g.visible)return null;if(ray.intersectObjects(shownPins(),false).length)return 'pointer';
    for(const [,P] of grabbable())if(ray.intersectObject(P,true).length)return 'grab';return null};

  // ---- 动 ----
  let busy=false;
  function update(now){busy=false;
    for(const k of ['a1','a2','a4'])if(!hold||hold.key!==k){const d=G[k]-A[k];if(Math.abs(d)>.002){A[k]+=d*.14;busy=true}else A[k]=G[k]}
    if(busy)pose();
    // 三折都平了：红笔开始画，每段 0.9 秒，到一处钉一颗图钉
    if(routeT<0&&flat(A.a1)&&flat(A.a2)&&flat(A.a4)&&!hold){routeT=0;routeAt=now}
    if(routeT>=0&&routeT<route.n){routeT=Math.min(route.n,(now-routeAt)/900);if(now-lastUp>50||routeT>=route.n){route.draw(routeT);rt.needsUpdate=true;lastUp=now}busy=true}
    if(routeT>=route.n&&!doneAt)doneAt=now;
    // 线画完、客人还没点过：图钉一颗接一颗轻轻蹦一下，像在招手
    const wave=doneAt&&!tapped?((now-doneAt)/1000)%2.6:-1;if(wave>=0)busy=true;
    pins.forEach((p,i)=>{if(routeT>=i&&!p.popAt){p.popAt=now;p.g.visible=true}
      {const l=wave-.6-i*.16;p.g.position.y=.002+(l>0&&l<.32?.05*Math.sin(l/.32*PI):0)}
      if(p.popAt&&p.pop<1){p.pop=Math.min(1,(now-p.popAt)/380);p.g.scale.setScalar(Math.max(.001,backOut(p.pop)));busy=true}
      // 拍立得：从平躺翻起来到斜靠着
      if(p.pol){const q=p.pol,d=q.goal-q.k;if(Math.abs(d)>.003){q.k+=d*.12;busy=true}else{q.k=q.goal;if(!q.goal)q.g.visible=false}
        const e=backOut(q.k);q.g.rotation.x=-PI/2+(PI/2-1.22)*e;q.g.position.y=.006+(q.lift||0)*Math.min(1,q.k);q.g.scale.setScalar(Math.max(.001,Math.min(1,q.k*1.6)))}});
    return busy}
  // 翻页前收回去：照片先躺下，左边那折先扣回来，再扣右边那折，最后封皮盖上
  function foldAll(){if(hold)return;pins.forEach(p=>{if(p.pol)p.pol.goal=0});G.a1=PI;setTimeout(()=>G.a4=PI,280);setTimeout(()=>G.a2=PI,560)}
  // 直接全摊开、线画完（?map=open 用）
  function open(){A.a1=A.a2=A.a4=G.a1=G.a2=G.a4=0;pose();routeT=route.n;doneAt=performance.now();route.draw(routeT);rt.needsUpdate=true;pins.forEach(p=>{p.popAt=1;p.pop=1;p.g.visible=true;p.g.scale.setScalar(1)})}
  return {group:g,down,move,up,over,update,open,foldAll,cover:ct.image,pw,
    get folded(){return A.a1>PI-.03&&A.a2>PI-.03&&A.a4>PI-.03&&G.a2>PI-.03},get needHint(){return !!doneAt&&!tapped&&A.a2<.3&&G.a2<.3},get pinned(){return tapped},get holding(){return !!hold},get busy(){return busy},w,h};
}
