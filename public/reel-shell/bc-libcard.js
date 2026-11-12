// 06 借书卡（bc-libcard.js；bc-card.js 是封面那个幻灯片框，别弄混）：右页右下贴着一个真的旧借书卡口袋（1959，Commons「Card Pocket.jpg」Calsidyrose，CC BY 2.0），
// 里面插着一张真的旧借阅卡（1916 多伦多图书馆，Commons 公有领域），原来的字擦掉换成我们的。
// 放映机那段片子放完 unlock → 卡自己冒出一截 → 客人抽卡 → 卡飞到眼前放大，一百年的借阅记录一行行活过来（1916、1943、1971、1998 都还了、划掉），
// 轮到 you & me，后面是续借过的纪念日 → 日期章也飘上来，客人点它盖今天 + DAY n → 卡落回页上，口袋里掉出一张催还单落到左页
// （1898 斯普林菲尔德图书馆的印刷催还单，公有领域，空格填我们的），红铅笔写 we're keeping it. → 日期章自己过去盖红的 DUE: FOREVER →
// 点卡插回口袋 → onDone（书合上、台灯灭）。
import * as THREE from './lib/three.module.js?v=tn9zuj';
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const ctex=c=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t};
const PI=Math.PI,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),sm=t=>{t=clamp(t);return t*t*(3-2*t)};
const MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const fmt=d=>`${String(d.getDate()).padStart(2,' ')} ${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
const DAY=86400000;
// 卡上前面借过这本书的人：都按时还了
const OLD=[['2 APR 16','31 MAR 16','edith hartley'],['19 NOV 43','17 NOV 43','thomas bell'],['8 JUN 71','7 JUN 71','ruth moreau'],['14 FEB 98','14 FEB 98','daniel kwan']];

// card/pocket/stamper：三张图；notice：催还单 {paper,print}；cam：镜头（卡要飞到它跟前）；met 认识那天；right/left 两页范围（书里坐标）
// locked：先锁着，等放映机那段片子放完再 unlock
export function makeCard({card,pocket,stamper,notice,cam,hint,met='2026-05-10',names='you & me',home='wherever we are',title='Summer of Us',y,right,left,onDone,locked=false}){
  const g=new THREE.Group();g.position.set(0,y,0);
  const R=right,RW=R.x1-R.x0,RD=R.z1-R.z0,L=left;
  // ---- 日子：认识那天是第 1 天；续借过的纪念日（第 100 天、每个周年）只盖已经过去的 ----
  const m0=new Date(met+'T00:00:00'),today=new Date();today.setHours(0,0,0,0);
  const dayN=Math.floor((today-m0)/DAY)+1;
  const marks=[[new Date(+m0+99*DAY),'day 100']];
  for(let yr=1;yr<20;yr++){const d=new Date(m0);d.setFullYear(m0.getFullYear()+yr);marks.push([d,yr===1?'one year':yr+' years'])}
  // 卡上一共 8 行：4 个陌生人 + 我们 + 续借 + 今天
  const renew=marks.filter(([d])=>d<today).sort((a,b)=>a[0]-b[0]).slice(-2);
  const US=OLD.length,TODAY=US+1+renew.length;

  // ---- 卡面：画在 .6 倍的画布上（原图 1353×1920 的坐标都乘 K） ----
  const K=.6,CW=Math.round(card.width*K),CH=Math.round(card.height*K),cc=mk(CW,CH),q=cc.getContext('2d'),cardT=ctex(cc);
  const rowsY=[1170,1255,1342,1427,1512,1597,1682,1767],cols=[164,495,832,1160];
  const inkPiece=(t,size,color)=>{const f=`700 ${size}px 'Courier Prime'`;q.font=f;const w=Math.ceil(q.measureText(t).width)+10,h=size+14,o=mk(w,h),z=o.getContext('2d');
    z.font=f;z.textBaseline='middle';z.fillStyle=color;z.globalAlpha=.88;z.fillText(t,5,h/2);z.globalAlpha=.2;z.fillText(t,7,h/2+2);
    z.globalCompositeOperation='destination-out';z.globalAlpha=.7;for(let i=0;i<w*.35;i++)z.fillRect(rnd(0,w),rnd(0,h),rnd(1.5,4),rnd(1,2));return o};
  // 每个章先做好（随机的缺墨固定下来），重画时只是贴上去；老的墨淡一点
  const BLUE='#2b4f9a',OLDINK='#4a5a86',RED='#a8231a';
  const oldInk=OLD.map(([a,b])=>[{o:inkPiece(a,54,OLDINK),rot:rnd(-.05,.05)},{o:inkPiece(b,54,OLDINK),rot:rnd(-.05,.05)}]);
  const usInk={o:inkPiece(fmt(m0),58,BLUE),rot:-.02};
  const renInk=renew.map(([d])=>({o:inkPiece(fmt(d),58,BLUE),rot:rnd(-.04,.04)}));
  const todayInk=[{o:inkPiece(fmt(today),58,BLUE),x:cols[0],rot:-.03},{o:inkPiece('DAY '+dayN,58,BLUE),x:cols[1],rot:.02}],dueInk={o:inkPiece('DUE: FOREVER',62,RED),x:(cols[2]+cols[3])/2,rot:-.05};
  const put=(p,x,yy,a)=>{if(a<=0)return;q.save();q.globalAlpha=Math.min(1,a);q.translate(x,yy);q.rotate(p.rot);q.drawImage(p.o,-p.o.width/2,-p.o.height/2);q.restore()};
  // 手写一点一点写出来：只露出左边 k 那么多
  const hand=(s,x,yy,k,font,color)=>{if(k<=0)return;q.save();q.font=font;q.textAlign='left';const w=q.measureText(s).width;q.beginPath();q.rect(x-4,yy-90,(w+8)*k,130);q.clip();q.fillStyle=color;q.fillText(s,x,yy);q.restore();return w};
  // 时间线（秒，从卡飞到眼前那一刻算）
  const OLD0=.9,OLDS=1.5,U0=OLD0+OLD.length*OLDS,R0=U0+1.3,READY=R0+renew.length*.45+.5;
  let seq=0,stampK=0,dueK=0;
  function drawCard(){const t=seq;q.save();q.clearRect(0,0,CW,CH);q.drawImage(card,0,0,CW,CH);q.scale(K,K);
    q.fillStyle='#2a1d16';q.textAlign='center';q.font="700 62px Fraunces";q.fillText('THE LIBRARY OF US',676,232);q.font="700 44px Fraunces";q.fillText("BORROWER'S CARD",676,312);
    q.textAlign='left';q.font="400 44px Fraunces";q.fillText('Name',96,432);q.fillText('Residence',96,545);q.fillStyle='rgba(42,29,22,.7)';
    for(const [x0,x1,yy] of [[210,1260,436],[310,1260,549]])for(let xx=x0;xx<x1;xx+=11)q.fillRect(xx,yy,4,4);
    q.fillStyle='#24345f';q.font="400 96px Reenie";q.fillText(names,250,420);q.fillText(home,350,533);q.font="400 70px Reenie";q.fillText('never',880,128);
    q.globalCompositeOperation='multiply';
    // 一百年：借走（盖到期日）→ 还回来（盖还书日）→ 名字 → 划掉
    OLD.forEach(([,,name],i)=>{const b=OLD0+i*OLDS,yy=rowsY[i];
      put(oldInk[i][0],cols[0],yy,sm((t-b)/.12));put(oldInk[i][1],cols[1],yy,sm((t-b-.35)/.12));
      const w=hand(name,cols[2]-140,yy+18,clamp((t-b-.6)/.55),"400 66px Reenie",'rgba(70,64,60,.85)');
      const k=clamp((t-b-1.15)/.3);if(k>0&&w){q.strokeStyle='rgba(70,64,60,.8)';q.lineWidth=4;q.beginPath();q.moveTo(cols[2]-150,yy+4);q.lineTo(cols[2]-150+(w+20)*k,yy-2+6*k);q.stroke()}});
    // 我们：名字（跟 Name 那栏同一支笔）→ 借走那天
    hand(names,cols[2]-140,rowsY[US]+20,clamp((t-U0)/.7),"400 80px Reenie",'#24345f');put(usInk,cols[0],rowsY[US],sm((t-U0-.8)/.12));
    // 续借过的日子
    renew.forEach(([,label],j)=>{const b=R0+j*.45,yy=rowsY[US+1+j];put(renInk[j],cols[0],yy,sm((t-b)/.12));hand('renewed · '+label,cols[2]-140,yy+16,clamp((t-b-.1)/.4),"400 62px Reenie",'rgba(36,52,95,.85)')});
    // 今天：客人盖；DUE: FOREVER 最后盖
    for(const p of todayInk)put(p,p.x,rowsY[TODAY],stampK);put(dueInk,dueInk.x,rowsY[TODAY],dueK);
    q.restore();cardT.needsUpdate=true}
  drawCard();

  // ---- 口袋面：原图 + 打字机打的几行 + 图书馆名 ----
  const pc=mk(pocket.width,pocket.height),pq=pc.getContext('2d');pq.drawImage(pocket,0,0);pq.fillStyle='rgba(40,30,25,.88)';pq.font="400 46px 'Courier Prime'";pq.textAlign='left';
  pq.fillText('♡ 001',30,62);pq.fillText(names+'.',250,62);pq.fillText(title+'.',250,108);pq.fillText('COPY 1 OF 1',470,170);
  pq.fillStyle='rgba(30,22,18,.92)';pq.textAlign='center';pq.font="700 58px Fraunces";pq.fillText('The Library of Us',pocket.width/2,282);

  // ---- 3D：口袋贴在右页右下；卡插在里面露出一截 ----
  const PWw=1.02,PDd=PWw*pocket.height/pocket.width,CWw=.97,CDd=CWw*card.height/card.width;
  const pocketM=new THREE.Mesh(new THREE.PlaneGeometry(PWw,PDd).rotateX(-PI/2),new THREE.MeshStandardMaterial({map:ctex(pc),roughness:.9}));
  const PC=new THREE.Vector3(R.x0+RW*.7,.009,R.z1-PDd/2-.12);pocketM.position.copy(PC);pocketM.rotation.y=-.04;pocketM.receiveShadow=pocketM.castShadow=true;g.add(pocketM);
  // 卡飞到眼前的时候外面没灯照，自己带一点亮（emissive 跟着飞的进度走）
  const cardMat=new THREE.MeshStandardMaterial({map:cardT,roughness:.88,emissiveMap:cardT,emissive:'#ffffff',emissiveIntensity:0});
  const cardM=new THREE.Mesh(new THREE.PlaneGeometry(CWw,CDd).rotateX(-PI/2),cardMat);cardM.castShadow=cardM.receiveShadow=true;g.add(cardM);
  // 在口袋里：卡底对齐口袋底（卡比口袋长，顶上露出一截）；拿出来：躺在右页左边
  const IN={p:new THREE.Vector3(PC.x,.005,PC.z+PDd/2-.06-CDd/2),r:-.04},OUT={p:new THREE.Vector3(R.x0+RW*.34,.011,R.z0+CDd/2+.1),r:.05};
  const IN0z=IN.p.z;let cs='in',from=null,to=null,t0=0;cardM.position.copy(IN.p);cardM.rotation.y=IN.r;
  const goCard=(st,now)=>{from={p:cardM.position.clone(),r:cardM.rotation.y};to=st==='out'?OUT:IN;cs=st;t0=now};
  // ---- 日期章：躺在左页 ----
  const SW=.5,SD=SW*stamper.height/stamper.width,stMat=new THREE.MeshStandardMaterial({map:ctex((()=>{const c=mk(stamper.width,stamper.height);c.getContext('2d').drawImage(stamper,0,0);return c})()),transparent:true,alphaTest:.3,roughness:.6,side:THREE.DoubleSide,emissive:'#ffffff',emissiveIntensity:0});
  stMat.emissiveMap=stMat.map;const stM=new THREE.Mesh(new THREE.PlaneGeometry(SW,SD).rotateX(-PI/2),stMat);
  const SH={p:new THREE.Vector3(L.x0+(L.x1-L.x0)*.68,.03,L.z0+(L.z1-L.z0)*.63),r:.4};stM.position.copy(SH.p);stM.rotation.y=SH.r;stM.castShadow=true;g.add(stM);
  // ---- 催还单：先藏在口袋里，盖完今天从口袋里飞出来落到左页上半截 ----
  const NW=2.0,ND=NW*notice.print.height/notice.print.width,nc=mk(notice.print.width,notice.print.height),nq=nc.getContext('2d'),noteT=ctex(nc);
  const noteMat=new THREE.MeshStandardMaterial({map:noteT,roughness:.92,emissiveMap:noteT,emissive:'#ffffff',emissiveIntensity:0});
  const noticeM=new THREE.Mesh(new THREE.PlaneGeometry(NW,ND).rotateX(-PI/2),noteMat);noticeM.castShadow=noticeM.receiveShadow=true;noticeM.visible=false;g.add(noticeM);
  const NOTE={p:new THREE.Vector3(L.x0+(L.x1-L.x0)*.5,.016,L.z0+(L.z1-L.z0)*.28),r:-.07};
  let noteK=0;   // 红铅笔写到哪了
  function drawNotice(){const W=nc.width,H=nc.height;nq.globalCompositeOperation='source-over';nq.drawImage(notice.paper,0,0,W,H);
    nq.globalCompositeOperation='multiply';nq.globalAlpha=.9;nq.drawImage(notice.print,0,0,W,H);nq.globalAlpha=1;
    // 印的馆名（原来那家擦掉了）
    nq.fillStyle='#1c1612';nq.textAlign='center';nq.font="600 42px Fraunces";nq.fillText('The Library of Us, wherever we are.',W/2,82);
    nq.font="500 19px Fraunces";nq.fillText('FILMS :  PHOTOGRAPHS :  LOVE LETTERS.',W/2,109);
    // 空格里图书管理员手写的
    nq.fillStyle='rgba(30,40,80,.9)';nq.textAlign='left';nq.font="400 54px Reenie";nq.fillText('♡ 001',440,288);nq.fillText('73715',240,338);
    // 日期跟客人的纪念日走（11.06：以前写死 May 10, 2026.，是我们自己的日子，客人的片子里也露出来）
    {const [yy,mm,dd]=String(met).split('-').map(Number),MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];nq.fillText(mm?`${MO[mm-1]} ${dd}, ${yy}.`:'',810,338)}
    nq.font="400 50px Reenie";nq.fillText('the librarian.',780,528);
    // 红章：逾期多少天（就是在一起多少天）
    nq.save();nq.translate(800,410);nq.rotate(-.12);nq.strokeStyle='rgba(168,35,26,.82)';nq.lineWidth=5;nq.strokeRect(-240,-40,480,74);
    nq.fillStyle='rgba(168,35,26,.85)';nq.font="700 44px 'Courier Prime'";nq.textAlign='center';nq.textBaseline='middle';nq.fillText(dayN+' DAYS OVERDUE',0,0);nq.restore();
    // 红铅笔回一句
    if(noteK>0){nq.save();nq.translate(110,578);nq.rotate(-.05);nq.font="400 76px Reenie";nq.textAlign='left';const w=nq.measureText("we're keeping it.").width;
      nq.beginPath();nq.rect(-6,-80,(w+12)*noteK,110);nq.clip();nq.fillStyle=nq.strokeStyle=RED;nq.lineWidth=1.6;nq.strokeText("we're keeping it.",0,0);nq.fillText("we're keeping it.",0,0);nq.restore()}
    noteT.needsUpdate=true}
  drawNotice();

  // ---- 右边竖着的红铅笔 ----
  const guide=(()=>{const c=mk(512,128),x=c.getContext('2d'),t=ctex(c),m=new THREE.Mesh(new THREE.PlaneGeometry(.9,.225).rotateX(-PI/2),new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:0,depthWrite:false}));
    m.position.set(R.x1-.16,.012,R.z0+RD*.3);m.rotation.y=PI/2-.03;g.add(m);
    return {m,write:s=>{x.clearRect(0,0,512,128);x.fillStyle=x.strokeStyle=RED;x.font="400 78px 'Reenie'";x.lineWidth=1.6;x.textAlign='center';x.strokeText(s,256,84);x.fillText(s,256,84);t.needsUpdate=true}}})();
  let gGoal=0,gK=0,pending,seenAt=0;const say=s=>{pending=s;gGoal=0};

  // ---- 卡和章飞到镜头跟前：算出镜头前面某处在书里的位置和朝向（卡面朝镜头，卡顶朝上） ----
  const vP=new THREE.Vector3(),vF=new THREE.Vector3(),vU=new THREE.Vector3(),vR=new THREE.Vector3(),mB=new THREE.Matrix4(),qW=new THREE.Quaternion(),qG=new THREE.Quaternion();
  function camPose(dist,offR,offU,out){cam.updateMatrixWorld();cam.getWorldPosition(vP);cam.getWorldDirection(vF);vU.set(0,1,0).applyQuaternion(cam.quaternion);vR.crossVectors(vF,vU);
    vP.addScaledVector(vF,dist).addScaledVector(vR,offR).addScaledVector(vU,offU);
    mB.makeBasis(vR,vF.clone().negate(),vU.clone().negate());qW.setFromRotationMatrix(mB);
    g.updateMatrixWorld(true);out.p.copy(g.worldToLocal(vP));g.getWorldQuaternion(qG).invert();out.q.copy(qG.multiply(qW));return out}
  const pose=()=>({p:new THREE.Vector3(),q:new THREE.Quaternion()});
  const poseOf=(st)=>({p:st.p.clone(),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(0,st.r,0))});
  const FD=3.3;   // 卡离镜头多远：差不多占画面高度八成
  const camCard=pose(),camStamp=pose(),camNote=pose(),qPocket=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-.04,0));
  // 卡上某一格在书里的位置，和卡面朝外的方向
  const onCard=(u,v)=>{cardM.updateMatrix();return new THREE.Vector3((u-.5)*CWw,0,(v-.5)*CDd).applyMatrix4(cardM.matrix)};
  const cardUp=()=>new THREE.Vector3(0,1,0).applyQuaternion(cardM.quaternion);
  const todayUV=[(cols[0]+cols[1])/2/card.width,rowsY[TODAY]/card.height],dueUV=[(cols[2]+cols[3])/2/card.width,rowsY[TODAY]/card.height];

  // 进度：ph 走到哪一步；各步开始的时间
  // pocket 在口袋里 → rise 飞到眼前、一百年 → float 章飘上来等客人点 → press 盖今天 → down 卡落回页上 → note 催还单 → write 红铅笔 → due 盖 DUE: FOREVER → back 等插回去 → home 插回去了
  let ph='pocket',phAt=0,riseFrom=null,hold=null,doneAt=0;
  const go=(p,now)=>{ph=p;phAt=now};

  function unlock(){if(!locked)return;locked=false;IN.p.z-=.16;goCard('in',performance.now())}
  // ---- 手 ----
  const plane=new THREE.Plane(),hit=new THREE.Vector3(),loc=new THREE.Vector3();
  const pagePoint=ray=>{g.updateMatrixWorld(true);const o=g.getWorldPosition(new THREE.Vector3());plane.set(new THREE.Vector3(0,1,0),-(o.y+.006));return ray.ray.intersectPlane(plane,hit)?g.worldToLocal(loc.copy(hit)):null};
  const hits=(m,ray)=>m.visible&&ray.intersectObject(m,false).length>0;
  function down(ev,ray){if(!g.visible||locked||from)return false;
    if(ph==='pocket'&&hits(cardM,ray)){const p=pagePoint(ray);if(!p)return false;hold={z0:p.z,start:cardM.position.z,moved:false};return true}
    if(ph==='float'&&hits(stM,ray)){go('press',performance.now());return true}
    if(ph==='read'){hint&&hint(null);go('drop',performance.now());return true}
    if(ph==='back'&&hits(cardM,ray)){goCard('in',performance.now());go('home',performance.now());return true}
    return false}
  function move(ev,ray){if(!hold)return;const p=pagePoint(ray);if(!p)return;const d=p.z-hold.z0;if(Math.abs(d)>.02)hold.moved=true;
    // 只能往上抽（z 变小），跟着手
    cardM.position.z=Math.min(IN.p.z,Math.max(IN.p.z-CDd*.8,hold.start+d))}
  function up(){if(!hold)return;const h=hold;hold=null;const now=performance.now();const pulled=IN.p.z-cardM.position.z;
    // 点一下或者抽出一截：飞起来；没抽够又松手：滑回去
    if(!h.moved||pulled>.2){riseFrom={p:cardM.position.clone(),q:cardM.quaternion.clone()};cs='out';go('rise',now)}else goCard('in',now)}
  const over=ray=>{if(!g.visible||locked||from)return null;if(ph==='pocket'&&hits(cardM,ray))return 'grab';if(ph==='float'&&hits(stM,ray))return 'pointer';if(ph==='back'&&hits(cardM,ray))return 'pointer';if(ph==='read')return 'pointer';return null};

  const lerpPose=(a,b,k,m)=>{m.position.lerpVectors(a.p,b.p,k);m.quaternion.slerpQuaternions(a.q,b.q,k)};
  // 飞到眼前的东西：台灯照不匀（上亮下暗），把吃灯光的那份压下去，换成自己匀匀地亮
  const setLit=(m,k,a=.4)=>{m.color.setScalar(1-.85*k);m.emissiveIntensity=a*k};
  const setFocus=k=>{setLit(cardMat,k);cardM.castShadow=k<.05};
  const stampHome=()=>{stM.position.copy(SH.p);stM.quaternion.setFromEuler(new THREE.Euler(0,SH.r,0));stM.scale.setScalar(1);setLit(stMat,0)};
  // 章在卡上某格按一下：t 0..1.3 秒；k 走到 .7 的时候墨印上去（onInk）
  // 章那张图的印面在图的左下（不在正中），对准格子的是印面
  function pressAt(t,uv,fromPose,onInk){const P=onCard(uv[0],uv[1]).add(new THREE.Vector3((.5-.3)*SW,0,(.5-.64)*SD).applyQuaternion(cardM.quaternion)),N=cardUp(),above=(h)=>({p:P.clone().addScaledVector(N,h),q:cardM.quaternion.clone()});
    if(t<.5)lerpPose(fromPose,above(.35),sm(t/.5),stM);
    else if(t<.7)lerpPose(above(.35),above(.015),sm((t-.5)/.2),stM);
    else if(t<.9){lerpPose(above(.015),above(.3),sm((t-.7)/.2),stM);onInk(clamp((t-.7)/.1))}
    else{onInk(1);lerpPose(above(.3),fromPose,sm((t-.9)/.5),stM)}}

  let last=0;
  function update(now){if(!g.visible){last=now;return false}if(last&&now<last)return false;last=now;let busy=!!hold;const t=(now-phAt)/1000,P0=ph;   // 这一帧只走开头那一步：换了步骤，下一帧再用新的计时开始（不然几步会在同一帧里一口气跳完）
    // 口袋里滑进滑出（冒头、插回去）
    if(from){const k=Math.min(1,(now-t0)/700),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      cardM.position.lerpVectors(from.p,to.p,e);cardM.position.y=Math.max(from.p.y,to.p.y)+Math.sin(k*PI)*.12;cardM.rotation.set(0,from.r+(to.r-from.r)*e,0);busy=true;
      if(k>=1){cardM.position.copy(to.p);cardM.rotation.set(0,to.r,0);from=null;if(P0==='home'&&!doneAt)doneAt=now}}
    if(P0!=='pocket'&&P0!=='home')busy=true;
    // 卡在眼前（rise / float / press）：每帧按镜头算位置，镜头动了它也跟着
    if(P0==='rise'||P0==='float'||P0==='press'||P0==='down')camPose(FD,-.28,0,camCard);
    if(P0==='rise'){const k=sm(t/1.0);lerpPose(riseFrom,camCard,k,cardM);setFocus(k);
      seq=t;drawCard();if(t>=READY){camPose(FD-.3,.8,-.28,camStamp);riseFrom=null;go('float',now);say('stamp today.')}}
    if(P0==='float'||P0==='press'){lerpPose(camCard,camCard,0,cardM);setFocus(1);camPose(FD-.3,.8,-.28+.025*Math.sin(now/300),camStamp)}
    // 章从页上飘起来，停在卡右下边，等客人点
    if(P0==='float'){const k=sm(t/.8);lerpPose(poseOf(SH),camStamp,k,stM);setLit(stMat,k,.4)}
    if(P0==='press'){pressAt(t,todayUV,camStamp,k=>{if(k>stampK){stampK=k;drawCard()}});if(t>=1.4+.6){say(null);go('down',now)}}
    // 卡落回页上，章回家
    if(P0==='down'){const k=sm(t/1.1);lerpPose(camCard,poseOf(OUT),k,cardM);setFocus(1-k);lerpPose(camStamp,poseOf(SH),k,stM);setLit(stMat,1-k,.4);
      if(t>=1.1){cardM.position.copy(OUT.p);cardM.rotation.set(0,OUT.r,0);stampHome();go('rest',now)}}
    // 卡落定以后歇一下，口袋里慢慢探出一张折小的纸（催还单），再慢慢飘到眼前、展开
    if(P0==='rest'&&t>=1.2)go('peek',now);
    const PEEK={p:PC.clone().add(new THREE.Vector3(0,.014,-PDd*.62)),q:qPocket};
    if(P0==='peek'){const k=sm(t/1.4);noticeM.position.lerpVectors(new THREE.Vector3(PC.x,.004,PC.z),PEEK.p,k);noticeM.quaternion.copy(qPocket);
      noticeM.rotateY(Math.sin(t*9)*.03*(1-k));noticeM.scale.setScalar(.42);if(t>=1.9)go('note',now)}
    if(P0==='note'||P0==='write'||P0==='read'||P0==='drop')camPose(3.2,0,.04,camNote);
    if(P0==='note'){const k=sm(t/1.8);lerpPose(PEEK,camNote,k,noticeM);noticeM.position.y+=Math.sin(k*PI)*.25;noticeM.scale.setScalar(.42+.58*k);setLit(noteMat,k);
      if(t>=1.8){noticeM.scale.setScalar(1);go('write',now)}}
    // 在眼前停着：读一会儿，红铅笔在底下写一句，然后一直等客人点
    if(P0==='write'){lerpPose(camNote,camNote,0,noticeM);noteK=clamp((t-1.2)/1.3);drawNotice();if(t>=2.8){go('read',now);hint&&hint('tap to put it down.')}}
    if(P0==='read')lerpPose(camNote,camNote,0,noticeM);
    // 点了：落到左页上半截
    if(P0==='drop'){const k=sm(t/1.4);lerpPose(camNote,poseOf(NOTE),k,noticeM);setLit(noteMat,1-k);if(t>=1.4){noticeM.position.copy(NOTE.p);noticeM.rotation.set(0,NOTE.r,0);go('due',now)}}
    // 日期章自己过去，在今天那行盖红的 DUE: FOREVER
    if(P0==='due'){pressAt(t,dueUV,poseOf(SH),k=>{if(k>dueK){dueK=k;drawCard()}});if(t>=1.4){stampHome();go('back',now);say('put it back.')}}
    // 插回去一秒半以后：书合上
    if(doneAt>0&&now-doneAt>1500){doneAt=-1;say(null);onDone&&onDone()}
    // 引导字
    if(!seenAt)seenAt=now;
    if(P0==='pocket'&&!locked&&gGoal===0&&pending===undefined&&gK<.02&&now-seenAt>1500)say(IN.p.z<IN0z?'your turn.':'pull the card.');
    if(pending!==undefined&&gK<.02){if(pending){guide.write(pending);gGoal=1}pending=undefined}
    if(Math.abs(gGoal-gK)>.005){gK+=(gGoal-gK)*.06;busy=true}guide.m.material.opacity=gK;
    return busy}

  // 印到纸上（3D 不在的时候）：口袋 + 插在里面的卡露出的那截
  function drawOn(x,W,H,{px,pz,pw,pd}){const sx=W/pw,sz=H/pd;
    const put=(img,p,r,w,d,clip)=>{x.save();x.translate((p.x-px)*sx,(p.z-pz)*sz);x.rotate(-r);if(clip){x.beginPath();x.rect(-w/2*sx,-d/2*sz,w*sx,clip*sz);x.clip()}x.drawImage(img,-w/2*sx,-d/2*sz,w*sx,d*sz);x.restore()};
    x.save();x.shadowColor='rgba(40,25,10,.3)';x.shadowBlur=10;x.shadowOffsetY=4;
    if(cs==='in')put(cc,cardM.position,cardM.rotation.y,CWw,CDd,CDd-PDd+.08+(IN0z-IN.p.z));else put(cc,cardM.position,cardM.rotation.y,CWw,CDd);
    put(pc,pocketM.position,pocketM.rotation.y,PWw,PDd);x.restore()}
  // 左页的东西印到纸上（合书、往回翻的时候 3D 的收掉，换成纸上这一份跟着纸走）：日期章 + 落下来的催还单
  function drawLeft(x,W,H,{px,pz,pw,pd}){const sx=W/pw,sz=H/pd;
    const put=(img,p,r,w,d)=>{x.save();x.translate((p.x-px)*sx,(p.z-pz)*sz);x.rotate(-r);x.drawImage(img,-w/2*sx,-d/2*sz,w*sx,d*sz);x.restore()};
    x.save();x.shadowColor='rgba(40,25,10,.3)';x.shadowBlur=10;x.shadowOffsetY=4;
    if(['due','back','home'].includes(ph))put(nc,NOTE.p,NOTE.r,NW,ND);
    put(stamper,SH.p,SH.r,SW,SD);x.restore()}
  // 右页的东西（跟右页走）和左页的东西（日期章、催还单，跟左页走），书那边分开管显隐
  const setShow=(r,l)=>{cardM.visible=pocketM.visible=guide.m.visible=r;stM.visible=l;noticeM.visible=l&&['peek','note','write','read','drop','due','back','home'].includes(ph);g.visible=r||l};
  return {unlock,_test:{pull:()=>{riseFrom={p:cardM.position.clone(),q:cardM.quaternion.clone()};cs='out';go('rise',performance.now())},stamp:()=>go('press',performance.now()),back:()=>{goCard('in',performance.now());go('home',performance.now())},get ph(){return ph}},
    group:g,setShow,get rightShown(){return cardM.visible},down,move,up,over,update,drawOn,drawLeft,get leftShown(){return stM.visible},stamper:stM,get dayN(){return dayN},get holding(){return !!hold},get story(){return !['pocket','back','home'].includes(ph)}};
}
