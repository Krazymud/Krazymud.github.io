// 04 指南针：一只黄铜怀表指南针（Poly Haven seadogs_compass，CC0）放在右页，那个人的照片是一张能拖的拍立得（角上贴一颗爱心）。
// 盖子先合着，点一下弹开，盖子内圈刻着两个人的首字母和日期。照片拖到哪，指针就带着惯性追过去（转快了会晃两下才停）。
// （红线和图钉 10.23 她说像在墙上破案，拿掉了）
import * as THREE from './lib/three.module.js?v=tn9zuj';
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const ctex=c=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t};
const PI=Math.PI,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// 拍立得：白边、照片微微做旧、底下留白
function polaroid(img){const W=420,H=500,c=mk(W,H),x=c.getContext('2d');x.fillStyle='#f6f1e6';x.fillRect(0,0,W,H);
  const s=Math.max(380/img.width,380/img.height);x.save();x.beginPath();x.rect(20,20,380,380);x.clip();x.filter='sepia(.2) saturate(.9)';x.drawImage(img,210-img.width*s/2,210-img.height*s/2,img.width*s,img.height*s);x.restore();
  x.strokeStyle='rgba(120,90,60,.25)';x.strokeRect(.5,.5,W-1,H-1);
  // 右上角一颗爱心贴纸：白边、红心、一点影子，歪着贴
  x.save();x.translate(W-62,58);x.rotate(.28);x.shadowColor='rgba(40,25,10,.35)';x.shadowBlur=8;x.shadowOffsetY=3;
  const heart=r=>{x.beginPath();x.moveTo(0,r);x.bezierCurveTo(-r*2,-r*.3,-r,-r*1.6,0,-r*.6);x.bezierCurveTo(r,-r*1.6,r*2,-r*.3,0,r);x.closePath()};
  x.fillStyle='#fffaf0';heart(44);x.fill();x.shadowColor='transparent';x.fillStyle='#c22a1e';heart(34);x.fill();
  x.fillStyle='rgba(255,255,255,.45)';x.beginPath();x.ellipse(-14,-16,8,5,-.6,0,PI*2);x.fill();x.restore();
  return c}
// 会烧的纸：从 uOrig（纸上的点，单位跟书一样）往外一圈一圈烧。火线前面先烤黄，再焦黑、边上翘起来卷着；
// 黑的那一圈里撒着灰白的灰和一闪一闪的暗红火星，火线亮着往前走，走过去纸就没了
const BURN_FN=`uniform float uBurn,uTime;uniform vec2 uOrig,uSize;
float bh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float bn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(bh(i),bh(i+vec2(1,0)),f.x),mix(bh(i+vec2(0,1)),bh(i+vec2(1,1)),f.x),f.y);}
float bEdge(vec2 bp){return uBurn-(length(bp-uOrig)+(bn(bp*28.)-.5)*.05+(bn(bp*7.)-.5)*.09);}`;
function burnable(mat,w,h){const u={uBurn:{value:-9},uTime:{value:0},uOrig:{value:new THREE.Vector2()},uSize:{value:new THREE.Vector2(w,h)}};mat.userData.u=u;
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,mat.userData.u);
    sh.vertexShader=sh.vertexShader.replace('void main() {',BURN_FN+'\nvoid main() {').replace('#include <begin_vertex>',`#include <begin_vertex>
  {vec2 bp=(uv-.5)*uSize;float be=bEdge(bp);transformed.z+=smoothstep(-.16,.02,be)*(.035+.03*bn(bp*6.));}`);
    sh.fragmentShader=sh.fragmentShader.replace('void main() {',BURN_FN+'\nvoid main() {').replace('#include <map_fragment>',`#include <map_fragment>
  vec2 bp=(vMapUv-.5)*uSize;float be=bEdge(bp);
  if(be>.028)discard;
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.8,.58,.34),smoothstep(-.22,-.11,be));
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.36,.2,.1),smoothstep(-.12,-.065,be));
  float ch=smoothstep(-.075,-.035,be);vec3 ashc=mix(vec3(.05,.035,.025),vec3(.36,.33,.3),smoothstep(.62,.85,bn(bp*55.))*.7);
  diffuseColor.rgb=mix(diffuseColor.rgb,ashc,ch);
  float bg=smoothstep(-.008,.006,be)*(1.-smoothstep(.01,.028,be));
  float emb=ch*smoothstep(.72,.9,bn(bp*42.+vec2(uTime*.7,0.)))*(.6+.4*sin(uTime*9.+bp.x*80.));`).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  totalEmissiveRadiance+=vec3(.9,.28,.04)*bg*(1.1+.3*sin(uTime*13.+bp.y*60.))+vec3(.9,.18,.03)*emb*1.2;
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.55,.12,.02),bg*.8);`)};
  return mat}
function shadowOf(c,blur=12){const P=blur*3,s=mk(c.width+P*2,c.height+P*2),x=s.getContext('2d');x.filter=`blur(${blur}px)`;x.drawImage(c,P,P);x.filter='none';
  x.globalCompositeOperation='source-in';x.fillStyle='rgb(30,18,8)';x.fillRect(0,0,s.width,s.height);return s}

// gltf：GLTFLoader 读进来的模型；x,y,z 指南针放在书里哪儿（y 是纸面高度），size 多宽；photo 那个人的照片；start 照片起始位置（书里坐标）；bounds 照片能拖的范围
export function makeCompass(gltf,{x=0,y=0,z=0,size=1.35,spin=-.35,photo,start,bounds,left,right,mapImg,onLid,candle,stowAt,engrave='YOU · ME · ',words=CONTENT.book.burnt}){
  const g=new THREE.Group();g.position.set(x,y,z);
  const root=gltf.scene;root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;if(o.material){o.material.envMapIntensity=1.6;o.material.color?.multiplyScalar(1.35)}}});
  // 模型本身约 8 厘米宽，放大到 size
  const box=new THREE.Box3().setFromObject(root),w=box.max.x-box.min.x,k=size/w;root.scale.setScalar(k);
  const body=new THREE.Group();body.rotation.y=spin;body.add(root);g.add(body);
  const lid=root.getObjectByName('seadogs_compass_lid'),needle=root.getObjectByName('seadogs_compass_needle');

  // ---- 照片：一张拍立得平躺在纸上 ----
  const PWd=.62,PH=PWd*500/420,ph=new THREE.Group();g.add(ph);
  const pm=new THREE.Mesh(new THREE.PlaneGeometry(PWd,PH).rotateX(-PI/2),new THREE.MeshStandardMaterial({map:ctex(polaroid(photo)),roughness:.9}));pm.position.y=.045;pm.receiveShadow=true;ph.add(pm);
  const sc=shadowOf(polaroid(photo)),sh=new THREE.Mesh(new THREE.PlaneGeometry(PWd*sc.width/420,PH*sc.height/500).rotateX(-PI/2),new THREE.MeshBasicMaterial({map:ctex(sc),transparent:true,opacity:.35,depthWrite:false}));sh.position.set(.01,.042,.015);ph.add(sh);
  ph.position.set(start.x-x,0,start.z-z);ph.rotation.y=.06;
  const B={x0:bounds.x0-x,x1:bounds.x1-x,z0:bounds.z0-z,z1:bounds.z1-z};

  // ---- 指针：带惯性追着照片转（弹簧 + 阻尼）；一进来先偏一大圈，晃着找过去 ----
  const T=new THREE.Vector3();
  const targetAngle=()=>{ph.getWorldPosition(T);root.worldToLocal(T);return Math.atan2(-T.x,-T.z)};
  let th=null,om=0,last=0;

  // ---- 盖子：先合着，点一下弹开（带一点回弹）；内圈刻字 ----
  const LID_OPEN=lid.rotation.x,LID_Z=lid.rotation.z;lid.rotation.x=0;let lidK=0,lidGoal=0;
  if(engrave){const c=mk(512,512),x=c.getContext('2d'),txt=engrave;x.translate(256,256);x.font="700 30px Fraunces";x.textBaseline='middle';
   // 字沿着一圈排：先压一道暗、再一道亮，像刻进铜里
   const n=[...txt],step=PI*2/Math.max(n.length,26);
   for(const [col,off] of [['rgba(60,35,10,.85)',0],['rgba(255,225,160,.35)',1.5]]){x.fillStyle=col;n.forEach((ch,i)=>{x.save();x.rotate(-PI/2+i*step);x.translate(0,-188+off);x.fillText(ch,-9,0);x.restore()})}
   const m=new THREE.Mesh(new THREE.PlaneGeometry(.068,.068).rotateX(PI/2),new THREE.MeshStandardMaterial({map:ctex(c),transparent:true,depthWrite:false,roughness:.5,metalness:.3,polygonOffset:true,polygonOffsetFactor:-2}));
   m.position.set(0,-.0028,.042);lid.add(m)}
  // ---- 玻璃裂纹：坏掉那一下从一个点炸开几道，修好了慢慢淡掉 ----
  const crack=(()=>{const c=mk(512,512),x=c.getContext('2d'),ox=300,oy=210;x.lineCap='round';
    for(const [col,w] of [['rgba(40,30,20,.35)',3.2],['rgba(255,255,255,.85)',1.6]]){x.strokeStyle=col;x.lineWidth=w;
      for(let i=0;i<9;i++){let a=i/9*PI*2+Math.sin(i*7.3)*.3,px=ox,py=oy;x.beginPath();x.moveTo(px,py);
        for(let k=0;k<7;k++){a+=Math.sin(i*3.1+k*1.7)*.35;const L=22+((i*13+k*7)%17)*2;px+=Math.cos(a)*L;py+=Math.sin(a)*L;x.lineTo(px,py)}x.stroke()}
      for(let r of [26,58]){x.beginPath();for(let k=0;k<=24;k++){const a=k/24*PI*2,rr=r+Math.sin(k*2.9)*6;k?x.lineTo(ox+Math.cos(a)*rr,oy+Math.sin(a)*rr):x.moveTo(ox+rr,oy)}x.stroke()}}
    const m=new THREE.Mesh(new THREE.CircleGeometry(.5,48).rotateX(-PI/2),new THREE.MeshBasicMaterial({map:ctex(c),transparent:true,opacity:0,depthWrite:false}));
    m.renderOrder=5;g.updateMatrixWorld(true);const bx=new THREE.Box3().setFromObject(needle),cp=new THREE.Vector3();needle.getWorldPosition(cp);cp.y=bx.max.y+.004;
    body.worldToLocal(cp);m.position.copy(cp);m.scale.setScalar(size*.5);body.add(m);return m})();
  // 坏掉以后指针的样子：疯转一阵 → 卡住抖 → 抽一下反着转
  const bk={next:0,mode:'spin',at:0};
  // ---- 左页的碎片：拨一下指针，飘下来一把纸碎片（旧地图、旧航海图，形状大小都不一样）；
  //      第二下里夹着一只纸船和一小条航海图纸剪的浪，船压在浪上轻轻晃。碎片主要落在左页上半截，下半截留给照片 ----
  const L={x0:left.x0-x,x1:left.x1-x,z0:left.z0-z,z1:left.z1-z},LW=L.x1-L.x0,LD=L.z1-L.z0,sea=new THREE.Group();g.add(sea);
  const rnd=(a,b)=>a+Math.random()*(b-a);
  // 一块旧航海图纸：米黄底、经纬格、几条航向线、零散水深数字
  const chartPaper=(W,H)=>{const c=mk(W,H),x=c.getContext('2d');x.fillStyle='#e8d9b3';x.fillRect(0,0,W,H);
    x.strokeStyle='rgba(70,55,40,.3)';x.lineWidth=1;const s=rnd(22,40);for(let i=0;i<W;i+=s){x.beginPath();x.moveTo(i,0);x.lineTo(i,H);x.stroke()}for(let i=0;i<H;i+=s){x.beginPath();x.moveTo(0,i);x.lineTo(W,i);x.stroke()}
    x.strokeStyle='rgba(60,45,30,.25)';const ox=rnd(0,W),oy=rnd(0,H);for(let i=0;i<10;i++){const a=i/10*PI*2;x.beginPath();x.moveTo(ox,oy);x.lineTo(ox+Math.cos(a)*W*2,oy+Math.sin(a)*W*2);x.stroke()}
    x.fillStyle='rgba(60,45,30,.5)';x.font="400 13px 'Courier Prime'";for(let i=0;i<8;i++)x.fillText(String(Math.round(rnd(3,60))),rnd(0,W-20),rnd(12,H));return c};
  // 撕出来的轮廓：多边形、细长条、缺角三角、半个圆，每一步都抖一下
  const tornShape=(x,W,H,kind)=>{const pts=[],cx=W/2,cy=H/2,j=()=>rnd(-5,5);
    if(kind==='rect')pts.push([rnd(4,14),rnd(4,14)],[W-rnd(4,14),rnd(4,14)],[W-rnd(4,14),H-rnd(4,14)],[rnd(4,14),H-rnd(4,14)]);
    else if(kind==='poly'){const n=5+Math.floor(rnd(0,4));for(let i=0;i<n;i++){const a=i/n*PI*2+rnd(-.3,.3),r=rnd(.32,.48);pts.push([cx+Math.cos(a)*W*r,cy+Math.sin(a)*H*r])}}
    else if(kind==='strip')pts.push([4,H*.3],[W-4,H*.22],[W-6,H*.7],[6,H*.78]);
    else if(kind==='tri')pts.push([6,6],[W-6,H*.15],[W*.2,H-6]);
    else{for(let i=0;i<=12;i++){const a=PI+i/12*PI;pts.push([cx+Math.cos(a)*W*.46,H*.85+Math.sin(a)*H*.75])}}
    x.beginPath();pts.forEach((p,i)=>{const q=pts[(i+1)%pts.length];for(let k=0;k<6;k++){const t=k/6,px=p[0]+(q[0]-p[0])*t+j(),py=p[1]+(q[1]-p[1])*t+j();(i||k)?x.lineTo(px,py):x.moveTo(px,py)}});x.closePath()};
  const scrapCanvas=()=>{const W=256,H=200,c=mk(W,H),x=c.getContext('2d'),kind=['rect','rect','rect','rect','rect','rect','rect','poly','strip','tri','half'][Math.floor(rnd(0,11))];
    tornShape(x,W,H,kind);x.save();x.clip();
    if(Math.random()<.6){const sw=mapImg.width*rnd(.1,.22),sx=rnd(0,mapImg.width-sw),sy=rnd(0,mapImg.height-sw*H/W);x.drawImage(mapImg,sx,sy,sw,sw*H/W,0,0,W,H);
      x.globalCompositeOperation='multiply';x.fillStyle='rgba(225,195,140,.55)';x.fillRect(0,0,W,H)}
    else x.drawImage(chartPaper(W,H),0,0);
    x.restore();x.strokeStyle='rgba(255,250,235,.75)';x.lineWidth=3;x.stroke();return c};
  // 纸船：剪出来的小帆船
  const shipCanvas=()=>{const W=256,H=256,c=mk(W,H),x=c.getContext('2d');
    x.fillStyle='#6b3d22';x.beginPath();x.moveTo(30,170);x.lineTo(226,170);x.lineTo(196,214);x.lineTo(60,214);x.closePath();x.fill();x.fillStyle='#8a5530';x.fillRect(40,170,176,10);
    x.fillStyle='#3a2414';x.fillRect(124,40,6,132);
    x.fillStyle='#f3ead8';x.beginPath();x.moveTo(132,46);x.lineTo(206,160);x.lineTo(132,160);x.closePath();x.fill();x.beginPath();x.moveTo(122,60);x.lineTo(60,160);x.lineTo(122,160);x.closePath();x.fill();
    x.fillStyle='#b0281e';x.beginPath();x.moveTo(130,40);x.lineTo(160,48);x.lineTo(130,56);x.closePath();x.fill();
    x.globalCompositeOperation='source-atop';x.strokeStyle='rgba(255,250,235,.8)';x.lineWidth=4;x.strokeRect(0,0,W,H);return c};
  // 一小条浪：从航海图纸上剪下来的波浪形，下边一刷淡蓝
  const waveCanvas=()=>{const W=384,H=128,c=mk(W,H),x=c.getContext('2d');x.beginPath();x.moveTo(4,H-6);
    for(let px=4;px<=W-4;px+=6)x.lineTo(px,H*.42+Math.sin(px/W*PI*4)*H*.22+rnd(-2,2));x.lineTo(W-4,H-6);x.closePath();x.save();x.clip();
    x.drawImage(chartPaper(W,H),0,0);const gr=x.createLinearGradient(0,H*.2,0,H);gr.addColorStop(0,'rgba(90,150,175,.15)');gr.addColorStop(1,'rgba(70,130,160,.5)');x.fillStyle=gr;x.fillRect(0,0,W,H);
    x.strokeStyle='rgba(40,80,100,.55)';x.lineWidth=2;for(let k=0;k<3;k++){x.beginPath();for(let px=0;px<=W;px+=6){const py=H*(.6+k*.13)+Math.sin(px/W*PI*4+k)*H*.08;px?x.lineTo(px,py):x.moveTo(px,py)}x.stroke()}
    x.restore();x.strokeStyle='rgba(255,250,235,.8)';x.lineWidth=3;x.stroke();return c};
  const scraps=[];
  // 落点：左页上 68% 打一张 5×5 的格子，每格抖一下，碎片比格子大一点，铺满只留一丢丢缝；下半截只留三个位置给零星几片。
  // 照片浮在碎片上面（客人挪开照片能看到底下也铺满了），只躲便签
  const NOTE={x:L.x0+LW*.27,z:L.z0+LD*.82};
  const spots=(()=>{const up=[],C=5,R=5,x0=L.x0+.17,x1=L.x1-.17,z0=L.z0+.17,z1=L.z0+LD*.68;
    for(let r=0;r<R;r++)for(let c=0;c<C;c++)up.push(new THREE.Vector3(x0+(c+.5)/C*(x1-x0)+rnd(-.07,.07),0,z0+(r+.5)/R*(z1-z0)+rnd(-.07,.07)));
    for(let i=up.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[up[i],up[j]]=[up[j],up[i]]}
    const low=[];for(let k=0;k<40&&low.length<3;k++){const p=new THREE.Vector3(L.x0+.25+Math.random()*(LW-.5),0,L.z0+LD*(.72+Math.random()*.2));if(Math.hypot(p.x-NOTE.x,p.z-NOTE.z)>.6)low.push(p)}
    // 下面那三个夹在中间顺序里，不是最后才落
    [8,17,26].forEach((at,i)=>low[i]&&up.splice(at,0,low[i]));return up})();
  const nextSpot=()=>spots.shift();
  function drop(c,w,h,now,to,{yaw=rnd(-.35,.35),kind='scrap'}={}){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h,12,10),burnable(new THREE.MeshStandardMaterial({map:ctex(c),roughness:.9,transparent:true,alphaTest:.3,side:THREE.DoubleSide}),w,h));
    m.castShadow=true;to.y=.008+scraps.length*.0005;
    m.userData={to,r:Math.max(w,h)/2,from:new THREE.Vector3(to.x+rnd(-.4,.4),1.6+rnd(0,.6),to.z-.4),t0:now,yaw,spin:rnd(-3,3),kind};m.visible=false;sea.add(m);scraps.push(m);return m}
  // 大小跟最早那版差不多，又大大小小交叉：大多 .3–.5，偶尔小的 .2、大的 .56
  function spawnScraps(n,now){for(let i=0;i<n;i++){const to=nextSpot();if(!to)return;const big=Math.random();const w=big<.15?rnd(.2,.26):big>.88?rnd(.5,.56):rnd(.32,.48),h=w*rnd(.62,1);
    drop(scrapCanvas(),w,h,now+i*140,to)}}
  // 船和浪一起落：浪在下，船压在浪上靠左一点
  function spawnShip(now){const at=nextSpot();if(!at)return;const yaw=rnd(-.25,.25);
    drop(waveCanvas(),.62,.21,now+200,at.clone(),{yaw,kind:'wave'});
    const sp=at.clone();sp.x-=.04;sp.z-=.1;drop(shipCanvas(),.42,.42,now+520,sp,{yaw,kind:'ship'})}
  let flicks=0,saidF=0,brokeAt=0,healed=0,jamAt=0,jamBack=null;
  function flicked(now){flicks++;
    // 拨到第五下，指针彻底乱了：转着转着卡一下、又疯转，玻璃裂开
    if(flicks>=5&&!brokeAt){brokeAt=now+900;return}
    if(flicks===1)spawnScraps(9,now);else if(flicks===2){spawnScraps(7,now);spawnShip(now+700)}else if(flicks===3)spawnScraps(8,now);else spawnScraps(6,now)}

  // ---- 烧：蜡烛凑到碎片边上点着一片，火顺着挨着的碎片一路烧过去；烧完的落一点灰，过一会儿灰被吹走 ----
  const toLocal=(m,px,pz)=>{const u=m.userData,a=px-u.to.x,b=-(pz-u.to.z),c=Math.cos(u.yaw),s=Math.sin(u.yaw);return new THREE.Vector2(a*c+b*s,-a*s+b*c)};
  let burnFrom=0,burnt=0,RATE=1;
  function ignite(m,now,px,pz){const u=m.userData;if(u.fire||!u.done)return;u.fire=now;m.castShadow=false;
    const o=toLocal(m,px,pz),hw=m.geometry.parameters.width/2,hh=m.geometry.parameters.height/2;o.x=Math.max(-hw,Math.min(hw,o.x));o.y=Math.max(-hh,Math.min(hh,o.y));
    m.material.userData.u.uOrig.value.copy(o);u.burnEnd=Math.hypot(hw*2,hh*2)+.12;if(!burnFrom)burnFrom=now}
  // ---- 火、烟、火星、灰、焦印（火苗和烟的贴图：Kenney Particle Pack，CC0） ----
  const TL=new THREE.TextureLoader(),tx=n=>{const t=TL.load('img/fx/'+n+'.png');t.colorSpace=THREE.SRGBColorSpace;return t};
  const T_TONGUE=[tx('flame_05'),tx('flame_06')],T_LICK=tx('flame_02'),T_SMOKE=[tx('smoke_01'),tx('smoke_02')];
  // 一池贴片：火舌（叠加发光）、舔边的一大团暖光、烟（灰色，贴图当透明度用）
  const pool=(n,mkMat)=>{const a=[];for(let i=0;i<n;i++){const sp=new THREE.Sprite(mkMat(i));sp.visible=false;sp.userData={life:0};sea.add(sp);a.push(sp)}a.i=0;return a};
  const tongues=pool(320,i=>new THREE.SpriteMaterial({alphaMap:T_TONGUE[i%2],color:'#ff7a1a',transparent:true,depthWrite:false}));
  tongues.forEach(s=>s.center.set(.5,.08));
  const cores=pool(200,i=>new THREE.SpriteMaterial({map:T_TONGUE[i%2],color:'#ffb347',blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));
  cores.forEach(s=>s.center.set(.5,.08));
  const licks=pool(30,()=>new THREE.SpriteMaterial({map:T_LICK,color:'#ff6a1c',blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:0}));
  const smokes=pool(70,i=>new THREE.SpriteMaterial({alphaMap:T_SMOKE[i%2],color:'#3a3028',transparent:true,depthWrite:false,opacity:0}));
  // 从池子里拿一个空着的；都在用就这次不冒（不抢还没烧完的那根）
  const take=a=>{for(let k=0;k<8;k++){const s=a[a.i++%a.length];if(s.userData.life<=0){s.visible=true;return s}}return null};
  const tongue=(x0,z0)=>{const s=take(tongues);if(!s)return;const u=s.userData;u.life=u.L=rnd(.35,.7);u.x=x0;u.z=z0;u.w=rnd(.22,.34);u.h=rnd(.2,.34);u.vy=rnd(.05,.12);s.material.rotation=rnd(-.25,.25);s.position.set(x0,.055,z0);
    if(Math.random()<.6){const c=take(cores);if(c){Object.assign(c.userData,{life:u.life,L:u.L,w:u.w*.55,h:u.h*.6,vy:u.vy});c.material.rotation=s.material.rotation;c.position.set(x0,.057,z0)}}};
  const lick=(x0,z0)=>{const s=take(licks);if(!s)return;const u=s.userData;u.life=u.L=rnd(.5,.9);u.s=rnd(.14,.24);s.material.rotation=rnd(0,PI*2);s.position.set(x0,.03,z0)};
  const smoke=(x0,z0)=>{const s=take(smokes);if(!s)return;const u=s.userData;u.life=u.L=rnd(2.2,3.4);u.s0=rnd(.08,.14);u.vx=rnd(.02,.07);u.vz=rnd(-.03,.02);u.spin=rnd(-.4,.4);s.position.set(x0,.08,z0)};
  // 火星：圆的、软边的小亮点，往上飘还左右晃，从黄变红再暗下去
  const dotTex=(()=>{const c=mk(64,64),x=c.getContext('2d'),gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.8)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
  const SPK=200,spG=new THREE.BufferGeometry(),spP=new Float32Array(SPK*3),spC=new Float32Array(SPK*3),spV=[];
  spG.setAttribute('position',new THREE.BufferAttribute(spP,3));spG.setAttribute('color',new THREE.BufferAttribute(spC,3));
  for(let i=0;i<SPK;i++){spP[i*3+1]=-9;spV.push({life:0,vx:0,vy:0,vz:0,ph:0})}
  const sparks=new THREE.Points(spG,new THREE.PointsMaterial({size:.022,map:dotTex,vertexColors:true,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));sea.add(sparks);let spI=0;
  const spark=(x0,z0)=>{const i=spI++%SPK,v=spV[i];spP[i*3]=x0;spP[i*3+1]=.03;spP[i*3+2]=z0;v.life=1;v.vx=rnd(-.04,.06);v.vy=rnd(.18,.42);v.vz=rnd(-.05,.03);v.ph=rnd(0,9)};
  // 纸灰：烧剩的一小片，炭黑里透灰白，边上一圈暗红慢慢凉掉；有点卷。躺一会儿，一阵风把它们卷起来飘走
  const ashTex=[...Array(6)].map(()=>{const W=128,H=96,c=mk(W,H),x=c.getContext('2d'),e=mk(W,H),y=e.getContext('2d'),pts=[];
    const n=7+Math.floor(rnd(0,4));for(let i=0;i<n;i++){const a=i/n*PI*2+rnd(-.25,.25),r=rnd(.3,.48);pts.push([W/2+Math.cos(a)*W*r,H/2+Math.sin(a)*H*r])}
    const path=q=>{q.beginPath();pts.forEach((p,i)=>{const nx=pts[(i+1)%n];for(let k=0;k<4;k++){const t=k/4,px=p[0]+(nx[0]-p[0])*t+rnd(-4,4),py=p[1]+(nx[1]-p[1])*t+rnd(-4,4);(i||k)?q.lineTo(px,py):q.moveTo(px,py)}});q.closePath()};
    path(x);const gr=x.createRadialGradient(W/2,H/2,4,W/2,H/2,W*.5);gr.addColorStop(0,'#2a2522');gr.addColorStop(.45,'#5e5852');gr.addColorStop(.85,'#a8a29a');gr.addColorStop(1,'#c9c3ba');x.fillStyle=gr;x.fill();
    x.save();x.clip();for(let i=0;i<70;i++){x.fillStyle=`rgba(${190+rnd(0,40)|0},${185+rnd(0,40)|0},${180+rnd(0,40)|0},${rnd(.15,.55)})`;x.fillRect(rnd(0,W),rnd(0,H),rnd(1,4),rnd(1,2))}
    x.strokeStyle='rgba(170,165,158,.6)';x.lineWidth=1;for(let i=0;i<4;i++){x.beginPath();x.moveTo(rnd(0,W),rnd(0,H));x.lineTo(rnd(0,W),rnd(0,H));x.stroke()}x.restore();
    path(y);y.strokeStyle='#ff5a14';y.lineWidth=5;y.filter='blur(2px)';y.stroke();
    const t=ctex(c),te=ctex(e);return {t,te}});
  const ashes=[];
  const ash=(x0,z0,now)=>{const s=rnd(.09,.17),k=ashTex[Math.floor(rnd(0,6))],geo=new THREE.PlaneGeometry(s,s*.75,4,3),pa=geo.attributes.position,cv=rnd(4,10);
    for(let i=0;i<pa.count;i++){const px=pa.getX(i),py=pa.getY(i);pa.setZ(i,(px*px+py*py*.6)*cv*1.6)}geo.rotateX(-PI/2);
    const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:k.t,emissiveMap:k.te,emissive:'#ffffff',emissiveIntensity:1.6,roughness:1,transparent:true,alphaTest:.05,side:THREE.DoubleSide}));
    m.position.set(x0,.006,z0);m.rotation.y=rnd(0,PI*2);m.userData={born:now,t0:now+rnd(1800,3200),vx:rnd(.12,.28),vz:rnd(-.1,.04),sp:rnd(-3,3),sw:rnd(0,9)};sea.add(m);ashes.push(m)};
  // 纸面焦印：火经过的地方在左页上留下焦褐色的一片（Kenney 的 scorch 贴图，亮度当透明度，染成焦褐）
  const scorch=(()=>{const W=450,H=600,c=mk(W,H),x=c.getContext('2d'),t=ctex(c),stamp=mk(128,128);
    const im=new Image();im.onload=()=>{const q=stamp.getContext('2d');q.drawImage(im,0,0,128,128);const d=q.getImageData(0,0,128,128);
      for(let i=0;i<d.data.length;i+=4){const l=d.data[i]/255;d.data[i]=92;d.data[i+1]=48;d.data[i+2]=18;d.data[i+3]=l*255}q.putImageData(d,0,0)};im.src='img/fx/scorch_03.png';
    const m=new THREE.Mesh(new THREE.PlaneGeometry(LW,LD).rotateX(-PI/2),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.position.set((L.x0+L.x1)/2,.0028,(L.z0+L.z1)/2);g.add(m);
    let dirty=0;const at=(px,pz,r,a)=>{const u=(px-L.x0)/LW*W,v=(pz-L.z0)/LD*H,R=r/LW*W*2;x.save();x.globalAlpha=a;x.translate(u,v);x.rotate(rnd(0,PI*2));x.drawImage(stamp,-R/2,-R/2,R,R);x.restore();dirty++};
    return {at,flush(){if(dirty){t.needsUpdate=true;dirty=0}}}})();
  // 一盏跟着火走的暖光，照得整页一明一暗
  const fireLight=new THREE.PointLight('#ff8a3a',0,3.2,2);g.add(fireLight);
  // 碎片底下一直写着的（客人能换，content.js 的 book.burnt）：默认是莎士比亚 116 号十四行诗里讲星星和船的四行（1609，公有领域），一圈焦痕，底下一行我的红铅笔
  // 专属设置（服务器 custom.json）burntFont：上面的诗和下面的红铅笔都换成客人挑的字体（只切了她用到的字，在 x/）；字到了重画一遍
  const BF=window.CUSTOM?.burntFont?'"XMBurnt", ':'',PS=BF?'400':'italic 500';
  const poem=(()=>{const W=900,H=1200,c=mk(W,H),x=c.getContext('2d');const paint=()=>{x.clearRect(0,0,W,H);
    x.fillStyle='#2a1a0e';x.textAlign='center';x.font="700 26px 'JB Mono'";x.fillText(words.title||'',W/2,130);
    const LINES=(words.lines||[]).filter(l=>l&&l.trim()).slice(0,4);
    x.font=`${PS} 56px ${BF}Fraunces`;const k=Math.min(1,850/Math.max(1,...LINES.map(l=>x.measureText(l).width)));x.font=`${PS} ${Math.floor(56*k)}px ${BF}Fraunces`;
    LINES.forEach((l,i)=>x.fillText(l,W/2,230+i*82));
    x.font="400 26px 'Courier Prime'";x.fillText(words.source||'',W/2,560);
    // 红铅笔两行以 W*.33 为中心：比 540 宽就整体缩小，不出纸边、不压右下角挪过去的照片（11.05 客人写中文，十一个字两头都出去了）
    x.fillStyle=x.strokeStyle='#a8231a';x.lineWidth=1.8;x.font=`400 80px ${BF}'Reenie'`;let pk=1;{const PL=(words.pencil||[]).slice(0,2),w=Math.max(1,...PL.map(l=>x.measureText(l).width));if(w>540){pk=540/w;x.font=`400 ${Math.floor(80*pk)}px ${BF}'Reenie'`;x.lineWidth=1.4}}x.save();x.translate(W*.33,690);x.rotate(-.05);(words.pencil||[]).slice(0,2).forEach((l,i)=>{x.strokeText(l,0,i*78*Math.max(pk,.75));x.fillText(l,0,i*78*Math.max(pk,.75))});x.restore();
    };paint();
    const m=new THREE.Mesh(new THREE.PlaneGeometry(LW,LD).rotateX(-PI/2),new THREE.MeshBasicMaterial({map:ctex(c),transparent:true,opacity:0,depthWrite:false}));
    if(BF)new FontFace('XMBurnt',`url(${window.CUSTOM.burntFont})`).load().then(f=>{document.fonts.add(f);paint();m.material.map.needsUpdate=true}).catch(()=>{});
    m.position.set((L.x0+L.x1)/2,.0035,(L.z0+L.z1)/2);g.add(m);return m})();
  // 照片烧起来以后让个位：滑到左页右下，不压着诗
  const photoRest=new THREE.Vector3(L.x0+LW*.79,0,L.z0+LD*.64);let photoGo=0;
  // 蜡烛：坏了以后才能拿；拿起来稍稍抬高，放在左页上就留在那儿，放别处就回桌上
  let cHome=null,cGoalY=0;const yPage=-.01;
  const candleAt=()=>candle.group.position.clone().sub(g.position);

  // ---- 右页上的两句红铅笔：开盖以后先 move her anywhere.；照片挪过一次、指针停稳以后换 now flick the needle. ----
  const guide=(()=>{const c=mk(512,384),cx2=c.getContext('2d'),t=ctex(c),m=new THREE.Mesh(new THREE.PlaneGeometry(.88,.66).rotateX(-PI/2),new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:0,depthWrite:false}));
    m.position.set(right.x-x,.012,right.z-z);m.rotation.y=-.06;g.add(m);
    const write=lines=>{const x=cx2;x.clearRect(0,0,512,384);x.fillStyle=x.strokeStyle='#a8231a';x.lineWidth=1.5;x.font="400 84px 'Reenie'";x.lineWidth=2.4;x.textAlign='center';
      // 一行太长（中文版）就整体缩小，别出纸边
      {const w=Math.max(...lines.map(l=>x.measureText(l).width));if(w>470){x.font=`400 ${Math.floor(84*470/w)}px 'Reenie'`;x.lineWidth=1.6}}const y0=192-(lines.length-1)*46;lines.forEach((l,i)=>{x.strokeText(l,256,y0+i*92);x.fillText(l,256,y0+i*92)});t.needsUpdate=true};
    return {m,write}})();
  let guideStep=-1,guideGoal=0,guideK=0,moved=false,lidAt=0,seenAt=0,pending;
  const say=lines=>{pending=lines;guideGoal=0};

  // ---- 手：拖照片 / 开盖 / 捏外圈转指南针 / 按表盘中间拨指针 ----
  const plane=new THREE.Plane(),hitW=new THREE.Vector3(),loc=new THREE.Vector3(),RL=new THREE.Vector3();
  const pagePoint=ray=>{g.updateMatrixWorld(true);const o=g.getWorldPosition(new THREE.Vector3());plane.set(new THREE.Vector3(0,1,0),-(o.y+.006));
    return ray.ray.intersectPlane(plane,hitW)?g.worldToLocal(loc.copy(hitW)):null};
  // 指南针本体中心（g 里）和表盘半径：按在半径里是拨指针，外面是转整只
  const center=()=>{RL.set(0,0,0);root.localToWorld(RL);return g.worldToLocal(RL)};const DIAL=size*.26;
  const needleAngleAt=p=>{RL.copy(p);g.localToWorld(RL);root.worldToLocal(RL);return Math.atan2(-RL.x,-RL.z)};
  let hold=null,lift=0,liftGoal=0,freeUntil=0;
  const canCandle=()=>candle&&brokeAt&&performance.now()>brokeAt&&!healed;
  function down(ev,ray){if(!g.visible||stowGoal)return false;
    if(canCandle()&&ray.intersectObjects(candle.group.children.filter(o=>!o.isSprite),true).length){const p=pagePoint(ray);if(!p)return false;const c=candleAt();
      if(!cHome)cHome=c.clone();hold={kind:'candle',dx:c.x-p.x,dz:c.z-p.z};cGoalY=yPage+.14;return true}
    if(ray.intersectObject(pm,false).length){const p=pagePoint(ray);if(!p)return false;hold={kind:'photo',dx:ph.position.x-p.x,dz:ph.position.z-p.z,sx:ph.position.x,sz:ph.position.z};liftGoal=1;return true}
    if(!ray.intersectObject(root,true).length)return false;
    if(!lidGoal){lidGoal=1;onLid&&onLid(lid);return true}
    const p=pagePoint(ray);if(!p)return false;const c=center(),dx=p.x-c.x,dz=p.z-c.z;
    if(Math.hypot(dx,dz)<DIAL&&!(brokeAt&&!healed)){const a=needleAngleAt(p);hold={kind:'needle',off:wrap(th-a),last:a,t:performance.now(),vel:0,tot:0};return true}
    hold={kind:'body',a0:Math.atan2(dx,dz),r0:body.rotation.y};return true}
  function move(ev,ray){if(!hold)return;const p=pagePoint(ray);if(!p)return;
    if(hold.kind==='candle'){candle.group.position.x=g.position.x+Math.max(L.x0+.1,Math.min(cHome.x,p.x+hold.dx));candle.group.position.z=g.position.z+Math.max(L.z0+.1,Math.min(L.z1-.1,p.z+hold.dz));return}
    if(hold.kind==='photo'){ph.position.x=Math.max(B.x0,Math.min(B.x1,p.x+hold.dx));ph.position.z=Math.max(B.z0,Math.min(B.z1,p.z+hold.dz));
      // 照片不许钻进指南针底下：碰到外圈就沿着圈被推开
      const c=center(),dx=ph.position.x-c.x,dz=ph.position.z-c.z,d=Math.hypot(dx,dz),R=size*.5+.36;
      if(d<R){const k=R/Math.max(d,1e-4);ph.position.x=c.x+(d<1e-4?R:dx*k);ph.position.z=c.z+(d<1e-4?0:dz*k)}return}
    const c=center();
    if(hold.kind==='body'){const d=wrap(Math.atan2(p.x-c.x,p.z-c.z)-hold.a0);
      if(brokeAt&&performance.now()>brokeAt&&!healed){body.rotation.y=hold.r0+Math.sign(d)*Math.min(Math.abs(d),.035);if(Math.abs(d)>.03&&performance.now()-jamAt>420)jamAt=performance.now();return}
      body.rotation.y=hold.r0+d;return}
    // 拨指针：指针跟着手转，记下转得多快，松手时甩出去
    const a=needleAngleAt(p),now=performance.now(),d=wrap(a-hold.last),dtt=Math.max(.008,(now-hold.t)/1000);
    hold.vel=hold.vel*.5+(d/dtt)*.5;hold.tot+=Math.abs(d);hold.last=a;hold.t=now;th=a+hold.off;om=0}
  function up(){if(!hold)return;const h=hold;hold=null;
    if(h.kind==='body'&&brokeAt&&performance.now()>brokeAt&&!healed){jamBack=h.r0;return}
    if(h.kind==='candle'){const c=candleAt();cGoalY=c.x<L.x1-.05?yPage+.025:null;return}
    if(h.kind==='photo'){liftGoal=0;if(Math.hypot(ph.position.x-h.sx,ph.position.z-h.sz)>.15)moved=true;return}
    if(h.kind==='needle'){om=Math.max(-40,Math.min(40,h.vel));freeUntil=performance.now()+Math.min(2600,700+Math.abs(om)*90);// 甩得够快，或者拨着转过大约 45 度，都算拨了一下（慢慢拧的也算，不然碎片不落，客人以为坏了）
      if(Math.abs(om)>2||h.tot>.8){if(Math.abs(om)<3)om=Math.sign(om||h.vel||1)*3;flicked(performance.now())}}}
  const over=ray=>{if(!g.visible)return null;if(canCandle()&&ray.intersectObjects(candle.group.children.filter(o=>!o.isSprite),true).length)return 'grab';if(ray.intersectObject(pm,false).length)return 'grab';if(!ray.intersectObject(root,true).length)return null;if(!lidGoal)return 'pointer';
    const p=pagePoint(ray);if(!p)return null;const c=center();return Math.hypot(p.x-c.x,p.z-c.z)<DIAL?'crosshair':'grab'};

  // ---- 收起来：翻走这页之前，盖子合上，整只被提起来划一道弧，落到书右边桌上，蜡烛跟着吹灭 ----
  // 落好以后把它从 g 里挪到书上（g 里的照片、诗那些跟着这页一起被盖走，它不跟）
  const HOME_B=body.position.clone(),STOW=stowAt?new THREE.Vector3(stowAt.x-x,-y+.004,stowAt.z-z):HOME_B.clone(),BP=new THREE.Vector3();
  let stowGoal=0,stowK=0,stowed=false;
  function stow(){if(stowGoal)return;stowGoal=1;lidGoal=0;hold=null;liftGoal=0;if(cHome)cGoalY=null}
  // 直接跳到后面的页（?page=5）时：不演，直接在桌上
  function stowNow(){if(stowed)return;stowGoal=1;stowK=1;lidGoal=0;lidK=0;lid.rotation.x=0;body.position.copy(STOW);body.scale.setScalar(.85);g.updateMatrixWorld(true);g.parent.attach(body);stowed=true;if(candle)candle.blow(performance.now()-5000)}
  function unstow(){if(body.parent!==g)g.attach(body);body.position.copy(HOME_B);body.scale.setScalar(1);stowGoal=0;stowK=0;stowed=false}
  // ---- 每帧 ----
  function update(now){if(!g.visible){last=now;return false}
    if(last&&now<last)return false;const dt=Math.min(.05,(now-(last||now))/1000);last=now;let busy=false;
    g.updateMatrixWorld(true);const tgt=targetAngle();
    if(th===null){th=tgt+2.6;om=0}
    // 被拨过以后先自己转一会儿（只有一点摩擦），然后弹簧再把它拉回照片；拿在手里时不管
    const broken=brokeAt&&now>brokeAt&&!healed;
    // 卡死：拧它就咔哒抖两下（整只和盖子一起颤），松手退回原位
    if(stowGoal&&stowK<1){stowK=Math.min(1,stowK+dt/1.3);busy=true;if(stowK>.6&&candle)candle.blow(now)}
    const se=stowK<.5?2*stowK*stowK:1-Math.pow(-2*stowK+2,2)/2;BP.lerpVectors(HOME_B,STOW,se);BP.y+=Math.sin(se*PI)*.7;if(stowGoal&&!stowed)body.scale.setScalar(1-.15*se);
    if(!stowed){const k=Math.max(0,1-(now-jamAt)/320);body.position.set(BP.x+Math.sin(now*.13)*.007*k,BP.y,BP.z+Math.cos(now*.17)*.004*k);if(k>0){lid.rotation.z=LID_Z+Math.sin(now*.11)*.05*k;busy=true}else lid.rotation.z=LID_Z;
      if(jamBack!==null){body.rotation.y+=(jamBack-body.rotation.y)*.3;if(Math.abs(jamBack-body.rotation.y)<.001){body.rotation.y=jamBack;jamBack=null}busy=true}}
    if(broken){busy=true;crack.material.opacity=Math.min(.9,crack.material.opacity+dt*6);
      if(now>bk.next){const r=Math.random();bk.mode=r<.45?'spin':r<.8?'stuck':'twitch';bk.next=now+(bk.mode==='twitch'?250:rnd(500,1400));bk.at=th;
        if(bk.mode==='spin')om=(Math.random()<.5?-1:1)*rnd(7,18);if(bk.mode==='twitch')om=(Math.random()<.5?-1:1)*rnd(20,30)}
      if(bk.mode==='stuck')th=bk.at+Math.sin(now*.09)*.025;else{om*=1-1.4*dt;th+=om*dt}}
    else if(!(hold&&hold.kind==='needle')){
      if(now<freeUntil){om*=1-1.1*dt;th+=om*dt;busy=true}
      else{const err=wrap(tgt-th);om+=(err*38-om*3.2)*dt;th+=om*dt;if(Math.abs(err)>.003||Math.abs(om)>.01)busy=true}}
    needle.rotation.set(0,th,0);
    // 拿起来的照片抬高一点、影子变大变淡
    lift+=(liftGoal-lift)*.2;ph.position.y=lift*.05;sh.scale.setScalar(1+lift*.12);sh.material.opacity=.35-lift*.15;if(Math.abs(liftGoal-lift)>.01)busy=true;
    // 盖子：弹开带一点回弹
    if(Math.abs(lidGoal-lidK)>.002){lidK+=(lidGoal-lidK)*.09;busy=true}else lidK=lidGoal;
    {const t=lidK,k=1.6,e=t<=0?0:1+(t-1)*(t-1)*((k+1)*(t-1)+k);lid.rotation.x=LID_OPEN*e}
    // 地图碎片：从上面打着旋飘下来，落平
    for(const m of scraps){const u=m.userData,t=(now-u.t0)/1300;if(t<0||u.gone)continue;m.visible=true;if(t>=1){if(!u.done){u.done=true;m.position.copy(u.to);m.rotation.set(-PI/2,0,u.yaw)}continue}
      busy=true;const e=1-Math.pow(1-t,2);m.position.lerpVectors(u.from,u.to,e);m.position.x+=Math.sin(t*PI*3)*.12*(1-t);
      m.rotation.set(-PI/2+(1-t)*Math.sin(t*9)*.9,0,u.yaw+u.spin*(1-t))}
    // 落下来的纸船在浪上轻轻摇
    for(const m of scraps)if(m.userData.kind==='ship'&&m.userData.done){m.rotation.set(-PI/2,0,m.userData.yaw+Math.sin(now*.0021)*.09);m.position.y=m.userData.to.y+.004+Math.sin(now*.0029)*.003}
    // 蜡烛：拿着时跟手抬高一点，放在左页上落到纸面，不然慢慢回桌上
    if(candle&&cHome){const P=candle.group.position;
      if(cGoalY!==null){const ty=g.position.y+cGoalY;P.y+=(ty-P.y)*.2;if(Math.abs(ty-P.y)>.001)busy=true}
      else{const H=new THREE.Vector3().copy(cHome).add(g.position),over=P.x<H.x-.12,ty=over?g.position.y+yPage+.14:H.y;
        // 回去的路上先举着越过书页，出了书边再落回桌上
        P.x+=(H.x-P.x)*.07;P.z+=(H.z-P.z)*.07;P.y+=(ty-P.y)*.15;if(P.distanceTo(H)>.002)busy=true}}
    // 点火：坏着的时候蜡烛凑近哪片就点哪片
    if(broken&&candle&&cHome){const c=candleAt();for(const m of scraps){const u=m.userData;if(!u.fire&&u.done&&Math.hypot(c.x-u.to.x,c.z-u.to.z)<u.r*.8+.12)ignite(m,now,c.x,c.z)}}
    // 火往外走；烧过一小段就去点挨着的；火线上一路冒火舌、火星、烟，纸面留焦印；烧完了落几片纸灰
    let fires=0;const FL=new THREE.Vector3();
    const front=(m,u,o,b,ang)=>{const lx=o.x+Math.cos(ang)*b,ly=o.y+Math.sin(ang)*b,hw=m.geometry.parameters.width/2,hh=m.geometry.parameters.height/2;
      if(Math.abs(lx)>hw||Math.abs(ly)>hh)return null;const c=Math.cos(u.yaw),sn=Math.sin(u.yaw);return [u.to.x+lx*c-ly*sn,u.to.z-(lx*sn+ly*c)]};
    for(const m of scraps){const u=m.userData;if(!u.fire&&u.igAt&&now>u.igAt)ignite(m,now,u.igX,u.igZ);if(!u.fire||u.gone)continue;
      busy=true;if(!u.bt){u.bt=0}u.bt+=dt*.11*RATE;const b=u.bt-.05,o=m.material.userData.u.uOrig.value;m.material.userData.u.uBurn.value=b;m.material.userData.u.uTime.value=now/1000;
      if(b>0&&b<u.burnEnd-.08){fires++;FL.x+=u.to.x;FL.z+=u.to.z;
        for(let k=0,K=Math.min(10,Math.round(dt*130*rnd(.7,1.3)));k<K;k++){const p=front(m,u,o,b,rnd(0,PI*2));if(!p)continue;if(Math.random()<.45)tongue(p[0],p[1]);if(Math.random()<.35)spark(p[0],p[1]);if(Math.random()<.05)smoke(p[0],p[1]);if(Math.random()<.12)scorch.at(p[0],p[1],rnd(.08,.16),.05)}}
      if(b>.17&&!u.spread){u.spread=1;for(const n of scraps){const v=n.userData;if(v.fire||v.igAt||!v.done)continue;if(Math.hypot(v.to.x-u.to.x,v.to.z-u.to.z)<(u.r+v.r)*.9){v.igAt=now+rnd(500,1300)/RATE;v.igX=(u.to.x+v.to.x)/2;v.igZ=(u.to.z+v.to.z)/2}}}
      if(b>u.burnEnd){u.gone=1;m.visible=false;burnt++;const n=2+Math.floor(rnd(0,2));for(let i=0;i<n;i++)ash(u.to.x+rnd(-u.r,u.r)*.5,u.to.z+rnd(-u.r,u.r)*.5,now)}}
    scorch.flush();
    // 火光：跟着正在烧的那几片走，越多越亮，一直在跳
    {const goal=fires?Math.min(2.6,.7+fires*.35)*(.85+.15*Math.sin(now*.023)+.1*Math.sin(now*.041)):0;fireLight.intensity+=(goal-fireLight.intensity)*.15;
      if(fires)fireLight.position.set(FL.x/fires,.35,FL.z/fires);if(fireLight.intensity>.01)busy=true}
    // 漏掉的（离得远、没挨着的）过一阵自己着
    if(burnFrom&&RATE&&now-burnFrom>14000/RATE)for(const m of scraps){const u=m.userData;if(!u.fire&&!u.igAt&&u.done){u.igAt=now+rnd(0,1500);u.igX=u.to.x;u.igZ=u.to.z-u.r}}
    // 火舌：长出来、往上窜、细下去；舔边的光团一胀一缩；烟慢慢升、散开、变淡
    for(const s of tongues){const u=s.userData;if(u.life<=0){s.visible=false;continue}busy=true;u.life-=dt;const t=1-u.life/u.L,e=Math.sin(Math.min(1,t)*PI);
      s.position.y+=u.vy*dt;s.scale.set(u.w*(1-t*.5),u.h*e,1);s.material.opacity=Math.min(1,e*1.5);s.material.color.setRGB(1,.26-t*.2,.02)}
    for(const s of cores){const u=s.userData;if(u.life<=0){s.visible=false;continue}u.life-=dt;const t=1-u.life/u.L,e=Math.sin(Math.min(1,t)*PI);s.position.y+=u.vy*dt;s.scale.set(u.w*(1-t*.5),u.h*e,1);s.material.opacity=e*.55}
    for(const s of licks){const u=s.userData;if(u.life<=0){s.visible=false;continue}u.life-=dt;const t=1-u.life/u.L,e=Math.sin(Math.min(1,t)*PI);s.scale.setScalar(u.s*(.7+t*.5));s.material.opacity=e*.22}
    for(const s of smokes){const u=s.userData;if(u.life<=0){s.visible=false;continue}u.life-=dt;const t=1-u.life/u.L;s.position.x+=u.vx*dt;s.position.z+=u.vz*dt;s.position.y+=.16*dt;
      s.scale.setScalar(u.s0*(1+t*3));s.material.rotation+=u.spin*dt;s.material.opacity=Math.sin(Math.min(1,t)*PI)*.11}
    {let any=false;for(let i=0;i<SPK;i++){const v=spV[i];if(v.life<=0)continue;any=true;v.life-=dt*.8;
      spP[i*3]+=(v.vx+Math.sin(now*.006+v.ph)*.05)*dt;spP[i*3+1]+=v.vy*dt;spP[i*3+2]+=v.vz*dt;v.vy*=1-.6*dt;
      const k=Math.max(0,v.life);spC[i*3]=k;spC[i*3+1]=k*k*.6;spC[i*3+2]=k*k*k*.2;if(v.life<=0)spP[i*3+1]=-9}
      if(any){spG.attributes.position.needsUpdate=spG.attributes.color.needsUpdate=true;busy=true}}
    // 纸灰：边上的暗红两秒里凉掉；然后一阵风从左往右把它们卷起来，翻着飘走、淡掉
    for(let i=ashes.length-1;i>=0;i--){const m=ashes[i],u=m.userData;busy=true;m.material.emissiveIntensity=Math.max(0,1.6*(1-(now-u.born)/2000))*(.8+.2*Math.sin(now*.02+u.sw));
      if(now<u.t0)continue;const k=(now-u.t0)/2400;
      m.position.x+=u.vx*dt*(.5+k);m.position.z+=u.vz*dt+Math.sin(now*.004+u.sw)*.03*dt;m.position.y+=(.06+.12*k)*dt;m.rotation.x+=u.sp*dt*k;m.rotation.z+=u.sp*.6*dt*k;
      m.material.opacity=Math.min(1,(1-k)*1.6);if(k>=1){sea.remove(m);m.geometry.dispose();m.material.dispose();ashes.splice(i,1)}}
    // 诗跟着烧掉的比例慢慢露出来；照片让到右下
    if(burnFrom){const goal=scraps.length?burnt/scraps.length:1;if(Math.abs(goal-poem.material.opacity)>.003){poem.material.opacity+=(goal-poem.material.opacity)*.04;busy=true}
      if(!hold||hold.kind!=='photo'){const d=ph.position.distanceTo(photoRest);if(d>.002){ph.position.x+=(photoRest.x-ph.position.x)*.04;ph.position.z+=(photoRest.z-ph.position.z)*.04;busy=true}}}
    // 全烧完、灰也散了：裂纹慢慢淡掉，指针好了，晃两下又指回照片；蜡烛回桌上
    if(burnFrom&&!healed&&burnt===scraps.length&&!ashes.length){healed=now;cGoalY=null;om=0}
    if(healed&&crack.material.opacity>0){crack.material.opacity=Math.max(0,crack.material.opacity-dt*.4);busy=true}
    // 引导字（右页上方）：一进来先 open the lid.；开了盖换 move the photo on your left.；照片挪过、指针停稳后换 why not flick the needle?；拨够三下收掉
    if(!seenAt)seenAt=now;if(guideStep===-1&&!lidGoal&&now-seenAt>2600){guideStep=0;say(['open the lid.'])}
    if(lidGoal&&!lidAt)lidAt=now;
    const calm=Math.abs(wrap(tgt-th))<.06&&Math.abs(om)<.4;
    if(lidAt&&guideStep<1&&now-lidAt>900){guideStep=1;say(['move the photo','on your left.'])}
    if(guideStep===1&&moved&&!hold&&calm){guideStep=2;say(['why not flick','the needle?','spin it hard.'])}
    // 每拨一下换一句，一路推着客人拨到第五下（第三下就收字的话，客人以为玩完了，永远看不到它坏掉）
    if((guideStep===1||guideStep===2)&&flicks>0&&flicks!==saidF&&flicks<5){guideStep=2;saidF=flicks;say([['again.'],['again!','it keeps','pointing back.'],['harder.'],['one more.','as hard','as you can.']][flicks-1])}
    if(guideStep<4&&brokeAt&&now>brokeAt+700){guideStep=4;say(['oh no.','the needle','is lost.'])}
    if(guideStep===4&&now>brokeAt+3800){guideStep=5;say(['bring the candle','to the scraps.'])}
    if(guideStep===5&&burnFrom){guideStep=6;say(null)}
    if(guideStep===6&&healed&&now>healed+1600){guideStep=7;say(['it always','finds you.'])}
    if(pending!==undefined&&guideK<.02){if(pending){guide.write(pending);guideGoal=1}pending=undefined}
    if(Math.abs(guideGoal-guideK)>.005){guideK+=(guideGoal-guideK)*.05;busy=true}guide.m.material.opacity=guideK;
    if(stowK>=1&&!stowed){stowed=true;g.parent.attach(body)}
    return busy||!!hold}
  return {group:g,body,stow,stowNow,unstow,get stowed(){return stowed},lid,needle,down,move,up,over,update,get lidOpen(){return lidGoal===1},get broke(){return !!brokeAt},get holding(){return !!hold},get flicks(){return flicks},
    // 调试用：直接拨一下 / 把蜡烛放到左页 u,v
    _test:{flick:()=>flicked(performance.now()),put:(u,v)=>{if(!cHome)cHome=candleAt();candle.group.position.set(g.position.x+L.x0+u*LW,g.position.y+yPage,g.position.z+L.z0+v*LD);cGoalY=yPage},set rate(v){RATE=v},home:()=>{cGoalY=null},fx:{tongues,licks,smokes,tongue},get state(){return {brokeAt,healed,burnt,n:scraps.length,burnFrom,ashes:ashes.length}}}};
}
