// 02 立体书：翻开第二页，书缝中间立起一座纸做的小电影院
// 一层一层纸板：最后面是屏幕（照片），前面红幕布，再前面是台口（顶上走马灯写书名），
// 台下三排座位，F 排 17、18 号坐着两个靠在一起的小剪影；右页伸出一根纸拉条，以后拉它开幕。
// 现在是静帧：全部立好、幕布拉开一半。
import * as THREE from './lib/three.module.js?v=tn9zuj';
const rnd=(a,b)=>a+Math.random()*(b-a);
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const ctex=c=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t};
// 纸板的底：颜色 + 一点纤维和斑
function card(x,W,H,color){x.fillStyle=color;x.fillRect(0,0,W,H);
  for(let i=0;i<W*H/900;i++){x.strokeStyle=`rgba(${Math.random()<.5?'60,30,10':'255,240,220'},${rnd(.03,.08)})`;x.lineWidth=rnd(.5,1.2);const a=rnd(0,Math.PI),l=rnd(4,12),px=rnd(0,W),py=rnd(0,H);x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}}
// 纸板的背面：同一个剪影，素的米色卡纸（立体书平躺时朝上的是背面，不能印着正面的图）
function backOf(c){const b=mk(c.width,c.height),x=b.getContext('2d');x.drawImage(c,0,0);x.globalCompositeOperation='source-in';x.fillStyle='#e6d8bd';x.fillRect(0,0,b.width,b.height);
  x.globalCompositeOperation='source-atop';card(x,b.width,b.height,'rgba(0,0,0,0)');return b}
const backMat=c=>new THREE.MeshStandardMaterial({map:ctex(backOf(c)),roughness:.95,alphaTest:.5,side:THREE.BackSide});
// 一块竖着立在书页上的纸板：底边贴着纸，往上长；正面画，背面素
function board(c,w,{y=0}={}){const h=w*c.height/c.width,g=new THREE.PlaneGeometry(w,h);g.translate(0,h/2+y,0);
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:ctex(c),roughness:.92,alphaTest:.5,side:THREE.FrontSide}));m.castShadow=m.receiveShadow=true;
  m.add(new THREE.Mesh(g,backMat(c)));return m}

// 台口：深红纸板，中间挖空一个拱形，金色描边；顶上一条走马灯，写 NOW SHOWING + 书名
const PW=1200,PH=760,HOLE={x:PW*.2,y:PH*.32,w:PW*.6,h:PH*.6};
function proscenium(title){const c=mk(PW,PH),x=c.getContext('2d');card(x,PW,PH,'#7a1d18');
  // 纸板边上压一圈深一点的边
  x.strokeStyle='rgba(30,8,4,.45)';x.lineWidth=10;x.strokeRect(5,5,PW-10,PH-10);
  // 两边的柱子：竖条纹
  for(const sx of [PW*.06,PW*.86]){x.fillStyle='#8f2a20';x.fillRect(sx,PH*.28,PW*.08,PH*.72);x.strokeStyle='#c9a24a';x.lineWidth=3;for(let i=1;i<4;i++){x.beginPath();x.moveTo(sx+i*PW*.02,PH*.33);x.lineTo(sx+i*PW*.02,PH*.93);x.stroke()}
    // 金色柱头、柱脚
    x.fillStyle='#c9a24a';x.fillRect(sx-8,PH*.28,PW*.08+16,PH*.04);x.fillRect(sx-4,PH*.32,PW*.08+8,PH*.012);
    x.fillRect(sx-8,PH*.95,PW*.08+16,PH*.05);x.fillStyle='#e8c56a';x.fillRect(sx-8,PH*.28,PW*.08+16,4);x.fillRect(sx-8,PH*.95,PW*.08+16,4)}
  // 台口两个上角：金色卷草
  x.strokeStyle='#c9a24a';x.lineWidth=5;x.lineCap='round';
  for(const k of [-1,1]){const ox=PW/2+k*PW*.4,oy=PH*.31;x.beginPath();x.moveTo(ox,oy);x.bezierCurveTo(ox-k*40,oy-50,ox-k*120,oy-10,ox-k*95,oy+30);x.bezierCurveTo(ox-k*80,oy+50,ox-k*55,oy+30,ox-k*65,oy+18);x.stroke();
    x.beginPath();x.moveTo(ox,oy);x.bezierCurveTo(ox+k*10,oy+40,ox-k*30,oy+70,ox-k*55,oy+60);x.stroke()}
  // 走马灯牌子
  x.fillStyle='#1a0d08';x.beginPath();x.roundRect(PW*.14,PH*.04,PW*.72,PH*.22,18);x.fill();
  x.strokeStyle='#c9a24a';x.lineWidth=4;x.stroke();
  for(let i=0;i<34;i++){const t=i/33,bx=PW*.16+t*PW*.68;for(const by of [PH*.065,PH*.235]){const g=x.createRadialGradient(bx,by,0,bx,by,9);g.addColorStop(0,'#fff6d8');g.addColorStop(.4,'#f6c862');g.addColorStop(1,'rgba(246,200,98,0)');x.fillStyle=g;x.fillRect(bx-9,by-9,18,18)}}
  x.fillStyle='#e8c56a';x.textAlign='center';x.font="700 22px 'JB Mono'";x.fillText('N O W   S H O W I N G',PW/2,PH*.115);
  x.fillStyle='#fff1d6';const t=title||'Our Film';let fs=72;x.font=`italic 700 ${fs}px Fraunces`;while(x.measureText(t).width>PW*.64&&fs>30){fs-=4;x.font=`italic 700 ${fs}px Fraunces`}x.fillText(t,PW/2,PH*.205);
  // 挖空的拱形：上面是半圆拱
  const {x:hx,y:hy,w:hw,h:hh}=HOLE,r=hw/2;
  const arch=()=>{x.beginPath();x.moveTo(hx,hy+hh);x.lineTo(hx,hy+r*.35);x.ellipse(hx+r,hy+r*.35,r,r*.35,0,Math.PI,0);x.lineTo(hx+hw,hy+hh);x.closePath()};
  x.save();x.translate(0,0);arch();x.strokeStyle='#c9a24a';x.lineWidth=16;x.stroke();x.restore();
  x.save();arch();x.globalCompositeOperation='destination-out';x.fill();x.restore();
  // 拱顶垂下来的一道红帷幔：三个大弧，底边金穗，两头各挂一个流苏
  x.save();arch();x.clip();const vy=hy+hh*.2,n=3;
  x.beginPath();x.moveTo(hx,hy);x.lineTo(hx+hw,hy);x.lineTo(hx+hw,vy-30);for(let i=n;i>0;i--){const a=hx+hw*i/n,b=hx+hw*(i-1)/n;x.quadraticCurveTo((a+b)/2,vy+38,b,vy-30)}x.closePath();
  x.fillStyle='#8a1a15';x.fill();
  for(let i=0;i<14;i++){const fx=hx+i/13*hw,g=x.createLinearGradient(fx-18,0,fx+18,0);g.addColorStop(0,'rgba(40,0,0,0)');g.addColorStop(.5,'rgba(40,0,0,.35)');g.addColorStop(1,'rgba(255,120,100,.1)');x.fillStyle=g;x.fillRect(fx-18,hy,36,vy-hy+40)}
  x.strokeStyle='#d8b25a';x.lineWidth=9;x.beginPath();x.moveTo(hx,vy-30);for(let i=0;i<n;i++){const a=hx+hw*i/n,b=hx+hw*(i+1)/n;x.quadraticCurveTo((a+b)/2,vy+38,b,vy-30)}x.stroke();
  x.lineWidth=2;for(let i=0;i<=90;i++){const t=i/90,seg=Math.min(n-1,Math.floor(t*n)),u=t*n-seg,a=hx+hw*seg/n,b=hx+hw*(seg+1)/n,px=(1-u)*(1-u)*a+2*u*(1-u)*(a+b)/2+u*u*b,py=(1-u)*(1-u)*(vy-30)+2*u*(1-u)*(vy+38)+u*u*(vy-30);x.beginPath();x.moveTo(px,py+4);x.lineTo(px,py+16);x.stroke()}
  x.restore();
  for(const tx of [hx+18,hx+hw-18]){x.fillStyle='#d8b25a';x.fillRect(tx-2,vy-30,4,60);x.beginPath();x.ellipse(tx,vy+36,10,8,0,0,Math.PI*2);x.fill();x.beginPath();x.moveTo(tx-12,vy+40);x.lineTo(tx+12,vy+40);x.lineTo(tx+8,vy+78);x.lineTo(tx-8,vy+78);x.closePath();x.fill()}
  // 拱边一圈小灯泡
  for(let i=0;i<=26;i++){const a=Math.PI+i/26*Math.PI,bx=hx+r+Math.cos(a)*(r+20),by=hy+r*.35+Math.sin(a)*(r*.35+20);
    const g=x.createRadialGradient(bx,by,0,bx,by,10);g.addColorStop(0,'#fff6d8');g.addColorStop(.4,'#f6c862');g.addColorStop(1,'rgba(246,200,98,0)');x.fillStyle=g;x.fillRect(bx-10,by-10,20,20)}
  for(const k of [0,1])for(let i=1;i<=8;i++){const bx=k?hx+hw+20:hx-20,by=hy+r*.35+i*(hh-r*.35)/9;const g=x.createRadialGradient(bx,by,0,bx,by,10);g.addColorStop(0,'#fff6d8');g.addColorStop(.4,'#f6c862');g.addColorStop(1,'rgba(246,200,98,0)');x.fillStyle=g;x.fillRect(bx-10,by-10,20,20)}
  return c}
// 屏幕：照片，四周一圈暗边，像被投出来的光
function screen(img){const W=900,H=560,c=mk(W,H),x=c.getContext('2d');x.fillStyle='#0d0806';x.fillRect(0,0,W,H);
  const s=Math.max(W/img.width,H/img.height);x.filter='sepia(.25) contrast(1.05) brightness(1.08)';x.drawImage(img,(W-img.width*s)/2,(H-img.height*s)/2,img.width*s,img.height*s);x.filter='none';
  const g=x.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,W*.62);g.addColorStop(0,'rgba(255,230,190,.08)');g.addColorStop(1,'rgba(10,5,3,.7)');x.fillStyle=g;x.fillRect(0,0,W,H);return c}
// 一片幕布：红丝绒直直垂下来，竖褶子，底边一圈波浪；合着的时候两片在中间碰上
function curtain(){const W=420,H=600,c=mk(W,H),x=c.getContext('2d');
  x.save();x.beginPath();x.moveTo(0,0);x.lineTo(W,0);x.lineTo(W,H*.96);
  for(let i=0;i<=8;i++){const px=W-W*i/8;x.quadraticCurveTo(px+W/16,H,px,H*.96)}
  x.closePath();x.clip();
  x.fillStyle='#9e1f1a';x.fillRect(0,0,W,H);
  for(let i=0;i<9;i++){const fx=i/8*W,g=x.createLinearGradient(fx-26,0,fx+26,0);g.addColorStop(0,'rgba(40,0,0,0)');g.addColorStop(.5,'rgba(40,0,0,.45)');g.addColorStop(1,'rgba(255,120,100,.12)');x.fillStyle=g;x.fillRect(fx-26,0,52,H)}
  card(x,W,H,'rgba(0,0,0,0)');
  // 底边一道金穗
  x.fillStyle='#d8b25a';x.fillRect(0,H*.9,W,6);x.restore();
  return c}
// 一排座位：红椅背一个挨一个，左边金字排号；F 排在 17、18 号坐着两个人的剪影
function seats(row,{couple=false,n=11}={}){const W=1300,H=couple?300:170,c=mk(W,H),x=c.getContext('2d'),base=H;
  const sw=(W-140)/n;
  for(let i=0;i<n;i++){const sx=110+i*sw;x.fillStyle='#6e1813';x.beginPath();x.roundRect(sx+4,base-120,sw-8,120,[22,22,4,4]);x.fill();
    x.fillStyle='#8c231b';x.beginPath();x.roundRect(sx+12,base-110,sw-24,80,16);x.fill();
    x.strokeStyle='rgba(20,5,3,.5)';x.lineWidth=3;x.beginPath();x.roundRect(sx+4,base-120,sw-8,120,[22,22,4,4]);x.stroke();
    x.strokeStyle='rgba(232,197,106,.75)';x.lineWidth=3;x.beginPath();x.moveTo(sx+18,base-116);x.lineTo(sx+sw-18,base-116);x.stroke();
    x.fillStyle='#c9a24a';x.font="700 14px 'JB Mono'";x.textAlign='center';x.fillText(String(11+i),sx+sw/2,base-16)}
  x.fillStyle='#d8b25a';x.font="700 46px Fraunces";x.textAlign='center';x.fillText(row,52,base-50);
  if(couple){// 两个人：头靠在一起的剪影，坐在中间偏右那两个位子上
    const i0=6,sx=110+i0*sw;x.fillStyle='#1b0f0a';
    // 屏幕的光从前面打过来：剪影描一圈暖边，暗处才认得出是两个人
    const person=(cx,tilt)=>{x.save();x.translate(cx,base-118);x.rotate(tilt);const shape=()=>{x.beginPath();x.ellipse(0,-58,30,36,0,0,Math.PI*2);x.moveTo(-56,30);x.quadraticCurveTo(-50,-22,0,-24);x.quadraticCurveTo(50,-22,56,30);x.closePath()};
      shape();x.strokeStyle='rgba(255,196,120,.85)';x.lineWidth=7;x.stroke();x.fillStyle='#1b0f0a';shape();x.fill();x.restore()};
    person(sx+sw*.5+8,.16);person(sx+sw*1.5-8,-.16);
    x.fillStyle='#d8b25a';x.font="700 20px 'JB Mono'";x.fillText('17',sx+sw*.5,base-14);x.fillText('18',sx+sw*1.5,base-14)}
  return c}
// 拉条：一根奶白纸条从台口里面垂下来，底下挂一个小红签写 pull，往下拽就开幕
function tab(){const W=90,H=520,c=mk(W,H),x=c.getContext('2d');card(x,W*.56,H*.8,'#efe4cb');x.clearRect(W*.56,0,W,H);
  x.save();x.translate(W*.22,0);x.fillStyle='#efe4cb';x.fillRect(0,0,W*.56,H*.8);x.strokeStyle='rgba(120,90,60,.3)';x.setLineDash([8,7]);x.beginPath();x.moveTo(W*.28,8);x.lineTo(W*.28,H*.78);x.stroke();x.restore();
  x.clearRect(0,0,W*.22,H*.8);
  x.fillStyle='#b0281e';x.beginPath();x.roundRect(4,H*.76,W-8,H*.23,14);x.fill();
  x.save();x.translate(W/2,H*.875);x.rotate(-Math.PI/2);x.fillStyle='#fff1d6';x.font="400 50px 'Reenie'";x.textAlign='center';x.textBaseline='middle';x.fillText('pull',0,4);x.restore();
  return c}

// 一块竖着的纸板从正中间对折：左右两半各是一个 mesh，贴图各用一半（uv 还是整张的坐标）
function halves(c,w,{y=0}={}){const h=w*c.height/c.width,t=ctex(c),mat=new THREE.MeshStandardMaterial({map:t,roughness:.92,alphaTest:.5,side:THREE.FrontSide}),bm=backMat(c);
  return [-1,1].map(side=>{const geo=new THREE.PlaneGeometry(w/2,h);geo.translate(side*w/4,h/2+y,0);
    const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,(side<0?0:.5)+uv.getX(i)*.5);
    const m=new THREE.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;m.add(new THREE.Mesh(geo,bm));return m})}

// 整座电影院，放在右页正中（x 是右页中线在书里的 x，scale 缩到装得下）；y 是纸面高度。setTitle(书名) 重画走马灯
// 每一层纸板从正中竖着对折，像一张贺卡：书页翻过来时，它先平躺在右页上，跟着书页往下落慢慢立起来（setLean），
// 再从对折一点点撑开（setFold 的 aL：π 是左半边贴在右半边上，0 是展平）。
// 幕布开始是合着的；坐进 F17 以后拽纸条，open 从 0 到 1，幕布往两边收，屏幕亮起来
export function makeTheater(img,{x=0,y=0,scale=1,title=''}={}){
  const g=new THREE.Group();g.position.set(x,y,0);g.scale.setScalar(scale);
  const WIDE=2.3,hole=n=>n/PW*WIDE,HW=hole(HOLE.w),Y0=(PH-HOLE.y-HOLE.h)/PW*WIDE;
  // 每一层：一个左折页、一个右折页，都挂在书缝那条竖线上
  const layers=[];const layer=z=>{const l=new THREE.Group();l.position.set(0,layers.length*.0003,z);g.add(l);const L=new THREE.Group(),R=new THREE.Group();L.position.z=-.004;l.add(L,R);layers.push({l,L,R});return {L,R}};
  const put=(ly,c,w,o={},z=0)=>{const [a,b]=halves(c,w,o);a.position.z=b.position.z=z;ly.L.add(a);ly.R.add(b);return [a,b]};
  const stage=layer(-.62);
  const pc=proscenium(title),[pmL]=put(stage,pc,WIDE);
  // 屏幕在台口后面一点，正好填满拱形；开幕以后自己发光
  const scr=put(stage,screen(img),HW*1.06,{y:Y0},-.16);
  {const m=scr[0].material;m.emissive=new THREE.Color('#ffffff');m.emissiveMap=m.map;m.emissiveIntensity=.08}
  // 幕布：左右两片，合着时各盖住一半，各跟着自己那一半折
  const cw=HW*.54,curtains=[-1,1].map(side=>{const m=board(curtain(),cw,{y:Y0});m.position.z=-.08;(side<0?stage.L:stage.R).add(m);return {m,side}});
  // 台口前面一条矮矮的舞台边
  {const c=mk(1200,90),x=c.getContext('2d');card(x,1200,90,'#5a2a16');x.fillStyle='rgba(216,178,90,.8)';x.fillRect(0,0,1200,6);for(let i=0;i<12;i++){x.fillStyle='rgba(20,8,4,.35)';x.fillRect(i*100+48,14,4,70)}
   // 脚灯：一排小小的暖灯罩
   for(let i=0;i<16;i++){const bx=40+i*74,g=x.createRadialGradient(bx,26,0,bx,26,16);g.addColorStop(0,'#fff3cf');g.addColorStop(.35,'#f2b84e');g.addColorStop(1,'rgba(242,184,78,0)');x.fillStyle=g;x.fillRect(bx-16,10,32,32);x.fillStyle='#3a1c0c';x.fillRect(bx-12,30,24,10)}
   put(layer(-.52),c,WIDE*.78)}
  // 三排座位，从屏幕往外：E、F（两个人）、G
  let seatRow=null;
  [['E',-.15],['F',.3,true],['G',.75]].forEach(([r,z,couple])=>{const [,b]=put(layer(z),seats(r,{couple}),2.1);if(couple)seatRow=b});
  // F17、18 在这一排画布上的横向范围（按 seats() 里的排法算），在右半边
  const sw=(1300-140)/11,SEAT=[(110+6*sw)/1300,(110+8*sw)/1300];
  // 纸条挂在拱形右边里面，在幕布前面
  const tm=board(tab(),.1,{y:0});const TAB_Y=Y0+.36,TAB_PULL=.16;tm.position.set(HW/2-.1,TAB_Y,-.04);stage.R.add(tm);
  // 台上一盏暖灯：幕布拉开才亮
  const glow=new THREE.PointLight('#ffb866',0,2.2,2);glow.position.set(0,.55,-.35);stage.R.add(glow);
  let open=0,goal=0,holding=false;
  const apply=()=>{const e=open<.5?2*open*open:1-Math.pow(-2*open+2,2)/2;
    // 合着：中心在 ±cw/2；开了：往外挪到台口后面，边收边挤窄一点
    for(const {m,side} of curtains){m.position.x=side*(cw/2*.98+e*cw*.82);m.scale.x=1-.28*e}
    tm.position.y=TAB_Y-TAB_PULL*Math.min(1,open*1.4);scr[0].material.emissiveIntensity=.08+.45*e;glow.intensity=1.6*e};
  apply();
  // 座位上那两个人的位置（第一人称坐进去时镜头放在他们身后一点）
  const seatShot=()=>{const mid=((SEAT[0]+SEAT[1])/2-.5)*2.1;g.updateMatrixWorld(true);
    return {p:g.localToWorld(new THREE.Vector3(mid*.6,.66,1.75)),l:g.localToWorld(new THREE.Vector3(0,.62,-.78))}};
  const hitSeat=ray=>{const h=ray.intersectObject(seatRow,false)[0];return !!h&&h.uv.x>SEAT[0]&&h.uv.x<SEAT[1]};
  const hitTab=ray=>!!ray.intersectObject(tm,false)[0];
  // 折多少：aL 是左半边离摊平还差的角度（0 摊平，π 贴在右半边上），aR 同理是右半边。
  // 两半都往屏幕那边（-z）转，折起来的时候不会戳到读者脸上
  const setFold=(aL,aR)=>{for(const {L,R} of layers){L.rotation.y=-aL;R.rotation.y=aR}};
  // 立起来多少：0 往读者这边平躺在纸上，1 站直
  const setLean=r=>{for(const {l} of layers)l.rotation.x=(1-r)*Math.PI/2};
  const setTitle=t=>{const c=proscenium(t);pmL.material.map.image=c;pmL.material.map.needsUpdate=true};
  return {group:g,height:WIDE*PH/PW*scale,setTitle,setFold,setLean,seatShot,hitSeat,hitTab,
    get open(){return open},set goal(v){goal=v},hold(v){holding=v},drag(k){open=Math.max(0,Math.min(1,k));apply()},
    // 每帧：没人拽的时候往目标慢慢走；返回 true 表示还在动
    update(){if(holding||Math.abs(goal-open)<.002)return false;open+=(goal-open)*.06;apply();return true},
    reset(){open=goal=0;apply()}};
}
