// 书里每一页画在纸上的东西。先是 01 拼贴页（静帧，之后再让东西能撕下来挪）
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
// 单独剪下来画一张碎片的时候不画 2D 影子（影子由 bc-collage.js 另外做，能跟着抬起来变大）
let SH=true;

// ---- 老插画贴纸：Commons 上 Pearson Scott Foresman 的公有领域线稿（img/collage/*.png）----
// 线条加粗封口 → 从四边灌水找出外面的白底 → 剩下的就是轮廓；轮廓里铺一层颜色，外面一圈白边，像剪下来的贴纸
function dilate(src,w,h,r){let a=src,b=new Uint8Array(w*h);
  for(let p=0;p<2;p++){for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;
      for(let k=-r;k<=r&&!v;k++){const xx=p?x:x+k,yy=p?y+k:y;if(xx>=0&&yy>=0&&xx<w&&yy<h&&a[yy*w+xx])v=1}b[y*w+x]=v}
    [a,b]=[b,new Uint8Array(w*h)]}return a}
export function makeSticker(img,{tint='#e8d9b8',max=520,border=9}={}){
  const s=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*s),h=Math.round(img.height*s),P=border+6,W=w+P*2,H=h+P*2;
  const c=mk(W,H),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.drawImage(img,P,P,w,h);
  const d=x.getImageData(0,0,W,H).data,ink=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++){const a=d[i*4+3]/255,g=(d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11)*a+255*(1-a);ink[i]=g<150?1:0}
  const closed=dilate(ink,W,H,3),out=new Uint8Array(W*H),st=[];
  for(let i=0;i<W;i++){st.push(i,(H-1)*W+i)}for(let j=0;j<H;j++){st.push(j*W,j*W+W-1)}
  while(st.length){const i=st.pop();if(out[i]||closed[i])continue;out[i]=1;const xx=i%W,yy=(i/W)|0;
    if(xx>0)st.push(i-1);if(xx<W-1)st.push(i+1);if(yy>0)st.push(i-W);if(yy<H-1)st.push(i+W)}
  const sil=new Uint8Array(W*H);for(let i=0;i<W*H;i++)sil[i]=out[i]?0:1;
  const rim=dilate(sil,W,H,border);
  const o=mk(W,H),ox=o.getContext('2d'),id=ox.createImageData(W,H),tc=parseInt(tint.slice(1),16),tr=tc>>16,tg=tc>>8&255,tb=tc&255;
  for(let i=0;i<W*H;i++){const j=i*4;if(!rim[i])continue;
    if(sil[i]){const g=(d[j]*.3+d[j+1]*.59+d[j+2]*.11)/255;id.data[j]=tr*g;id.data[j+1]=tg*g;id.data[j+2]=tb*g}else{id.data[j]=id.data[j+1]=id.data[j+2]=252}
    id.data[j+3]=255}
  ox.putImageData(id,0,0);return o;
}
function placeSticker(x,st,cx,cy,w,rot){const h=w*st.height/st.width;x.save();x.translate(cx,cy);x.rotate(rot);
  if(SH)x.shadowColor='rgba(40,25,10,.38)';x.shadowBlur=9;x.shadowOffsetX=2;x.shadowOffsetY=5;x.drawImage(st,-w/2,-h/2,w,h);x.restore()}

// ---- 让东西不那么整齐：撕出来的毛边、皱过的纸、发黄的旧印刷 ----
// 皱纸：一张灰度图，很多道折痕（一边亮一边暗），用 overlay 叠到东西上
let CRUMPLE=null;
function crumple(){if(CRUMPLE)return CRUMPLE;const S=512,c=mk(S,S),x=c.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,S,S);
  for(let i=0;i<46;i++){const a=rnd(0,Math.PI),cx=rnd(0,S),cy=rnd(0,S),L=rnd(120,520),w=rnd(6,26);x.save();x.translate(cx,cy);x.rotate(a);
    const g=x.createLinearGradient(0,-w,0,w);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.45,`rgba(255,255,255,${rnd(.15,.4)})`);g.addColorStop(.5,`rgba(0,0,0,${rnd(.2,.45)})`);g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g;x.fillRect(-L/2,-w,L,w*2);x.restore()}
  for(let i=0;i<30;i++){const cx=rnd(0,S),cy=rnd(0,S),r=rnd(30,120),g=x.createRadialGradient(cx,cy,0,cx,cy,r),v=Math.random()<.5?255:0;g.addColorStop(0,`rgba(${v},${v},${v},${rnd(.08,.2)})`);g.addColorStop(1,`rgba(${v},${v},${v},0)`);x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2)}
  return CRUMPLE=c}
// 撕开的边：沿着矩形走一圈，每一小步都抖一下，偶尔撕进去一大口
function tornPath(x,w,h,amp=5){const pts=[],step=7;
  const side=(x0,y0,x1,y1)=>{const L=Math.hypot(x1-x0,y1-y0),n=Math.max(2,Math.round(L/step)),nx=-(y1-y0)/L,ny=(x1-x0)/L;let off=0;
    for(let i=0;i<n;i++){const t=i/n;off=off*.6+rnd(-amp,amp)*.8;if(Math.random()<.03)off-=rnd(amp,amp*3);pts.push([x0+(x1-x0)*t+nx*off,y0+(y1-y0)*t+ny*off])}};
  side(-w/2,-h/2,w/2,-h/2);side(w/2,-h/2,w/2,h/2);side(w/2,h/2,-w/2,h/2);side(-w/2,h/2,-w/2,-h/2);
  x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath()}
// 在当前裁剪区里叠一层皱纹
function wrinkle(x,w,h,k=.5){const c=crumple();x.save();x.globalCompositeOperation='overlay';x.globalAlpha=k;x.rotate(rnd(0,6));x.drawImage(c,-Math.max(w,h),-Math.max(w,h),Math.max(w,h)*2,Math.max(w,h)*2);x.restore()}
// 一块撕下来的东西：先垫一层白色毛边（撕开时露出来的纸芯），再画本体，再叠皱纹
function torn(x,cx,cy,w,h,rot,paint,{amp=5,fiber=true,k=.5,shadow=true}={}){
  x.save();x.translate(cx,cy);x.rotate(rot);
  if(shadow&&SH){x.shadowColor='rgba(40,25,10,.4)';x.shadowBlur=10;x.shadowOffsetX=3;x.shadowOffsetY=5}
  if(fiber){x.fillStyle='#fbf8f0';x.save();x.translate(rnd(-2,2),rnd(1,3));tornPath(x,w+6,h+6,amp*1.2);x.fill();x.restore()}
  x.shadowColor='transparent';tornPath(x,w,h,amp);x.save();x.clip();paint(x,w,h);wrinkle(x,w,h,k);x.restore();x.restore()}
// 旧印刷的一块：从扫描图里裁一段，泛黄
function scrap(x,img,[sx,sy,sw,sh],cx,cy,w,rot,{tint='#e8d6a8',amp=6}={}){const h=w*sh/sw;
  torn(x,cx,cy,w,h,rot,(x,w,h)=>{x.fillStyle=tint;x.fillRect(-w,-h,w*2,h*2);x.globalCompositeOperation='multiply';x.drawImage(img,sx,sy,sw,sh,-w/2,-h/2,w,h);x.globalCompositeOperation='source-over'},{amp})}

// 一小块纸：撕出来的边、有皱纹、带影子
function chip(x,cx,cy,w,h,rot,bg,draw,{amp=3,fiber=true,tex=null,k=.45}={}){
  torn(x,cx,cy,w,h,rot,(x,w,h)=>{x.fillStyle=bg;x.fillRect(-w,-h,w*2,h*2);
    // 有的字母是从报纸上剪的：底下透出一点真报纸的字
    if(tex){x.globalAlpha=.35;x.globalCompositeOperation='multiply';x.drawImage(tex.img,tex.sx,tex.sy,w*2.2,h*2.2,-w/2,-h/2,w,h);x.globalAlpha=1;x.globalCompositeOperation='source-over'}
    draw&&draw(x,w,h)},{amp,fiber,k});
}
// 纸胶带：半透明，两头是撕开的锯齿，歪着贴
function tape(x,cx,cy,w,rot,color){
  x.save();x.translate(cx,cy);x.rotate(rot);x.globalAlpha=.72;x.fillStyle=color;
  const h=36;x.beginPath();x.moveTo(-w/2,-h/2);x.lineTo(w/2,-h/2);for(let i=0;i<=8;i++)x.lineTo(w/2+rnd(-4,4),-h/2+i*h/8);
  x.lineTo(-w/2,h/2);for(let i=8;i>=0;i--)x.lineTo(-w/2+rnd(-4,4),-h/2+i*h/8);x.closePath();x.fill();
  x.save();x.clip();x.globalAlpha=.5;wrinkle(x,w,h,.6);x.restore();x.restore();
}
// 一张照片：白边，有皱，可选黑白；amp 大一点就是撕过的
// raw：客人的照片放原片，不加滤镜（11.01 她定）
function photo(x,img,cx,cy,w,h,rot,{bw=false,raw=false,border=16,bottom=16,amp=1.2}={}){
  const H=h+border+bottom,W=w+border*2;
  torn(x,cx,cy,W,H,rot,(x)=>{x.fillStyle='#f4efe3';x.fillRect(-W,-H,W*2,H*2);
    const s=Math.max(w/img.width,h/img.height);x.save();x.beginPath();x.rect(-w/2,-H/2+border,w,h);x.clip();
    x.filter=raw?'none':bw?'grayscale(1) contrast(1.1) sepia(.15)':'sepia(.22) saturate(.85) contrast(1.05)';
    x.drawImage(img,-img.width*s/2,-H/2+border+h/2-img.height*s/2,img.width*s,img.height*s);x.restore();x.filter='none'},{amp,fiber:amp>2,k:0});
}

// 剪报字母：每个字母剪自不同的杂志，底色、字体、大小、歪的角度都不一样，撕的边，叠在一起
const LETTER_STYLES=[
  {bg:'#f2ead6',fg:'#1b140e',font:"italic 900 {s}px Fraunces",news:true},
  {bg:'#16100b',fg:'#f2ead6',font:"700 {s}px 'Courier Prime'"},
  {bg:'#c22a1e',fg:'#fff7e8',font:"900 {s}px Fraunces"},
  {bg:'#f2c230',fg:'#16100b',font:"800 {s}px Fraunces"},
  {bg:'#2c5aa0',fg:'#f7efe0',font:"italic 400 {s}px 'Instrument Serif'"},
  {bg:'#f4eee0',fg:'#c22a1e',font:"700 {s}px 'JB Mono'",news:true},
  {bg:'#2f6b3f',fg:'#f2c230',font:"900 {s}px Fraunces"},
  {bg:'#e8a0b4',fg:'#16100b',font:"italic 900 {s}px Fraunces"},
  {bg:'#e9dcbc',fg:'#2a1a0c',font:"900 {s}px 'Courier Prime'",news:true},
];
// 剪下来的字母纸底：几种旧报纸、彩色杂志纸的颜色（正片叠底，黑字还是黑的）
const NEWSPRINT=['#efe4c8','#f4ecd8','#e6d3a8','#f2c9c0','#f1d77e','#c9dcea','#d8e5c6','#f6f1e4'];
// 有电影广告上的大字就八成用大字（清楚），报纸小字只是补缺
const pickLetter=a=>{const big=a.filter(c=>c.big);return big.length&&Math.random()<.8?pick(big):pick(a)};
function ransom(x,text,cx,cy,size,maxW,news,letters){
  const items=[...text].map(ch=>{const st=pick(LETTER_STYLES),s=size*rnd(.82,1.18),real=letters?.[ch]?pickLetter(letters[ch]):null;
    return {ch,st,s,real,w:ch===' '?size*.35:real?s*1.12*real.width/real.height:s*rnd(.68,.95)}});
  let total=items.reduce((a,b)=>a+b.w+5,0);const k=Math.min(1,maxW/total);total*=k;let px=cx-total/2;
  for(const it of items){const w=it.w*k,s=it.s*k;if(it.ch!==' '&&it.real){
      const tint=pick(NEWSPRINT);
      chip(x,px+w/2,cy+rnd(-10,10),w,s*1.12,rnd(-.16,.16),tint,(x,w,h)=>{x.globalCompositeOperation='multiply';x.drawImage(it.real,-w/2,-h/2,w,h);x.globalCompositeOperation='source-over'},{amp:1.6,fiber:Math.random()<.55,k:.28})}
    else if(it.ch!==' '){
      const tex=it.st.news&&news?{img:news,sx:rnd(80,1300),sy:rnd(250,1700)}:null;
      chip(x,px+w/2,cy+rnd(-10,10),w*rnd(1,1.1),s*rnd(1.05,1.18),rnd(-.17,.17),it.st.bg,(x,w,h)=>{x.fillStyle=it.st.fg;x.font=it.st.font.replace('{s}',Math.round(s*.86));x.textAlign='center';x.textBaseline='middle';x.fillText(it.ch,rnd(-3,3),h*.05)},{amp:2,fiber:Math.random()<.5,tex,k:.3})}
    px+=w+5*k}
}
function sticker(x,cx,cy,r,rot,draw){x.save();x.translate(cx,cy);x.rotate(rot);if(SH)x.shadowColor='rgba(40,25,10,.3)';x.shadowBlur=5;x.shadowOffsetY=2;draw(x,r);x.restore()}

// 实拍的东西抠出来：邮票扫描是黑底（齿孔也是黑的），从四边把接近黑色的地方灌掉
export function makeCutout(img,{max=520,dark=60}={}){
  const s=Math.min(1,max/Math.max(img.width,img.height)),W=Math.round(img.width*s),H=Math.round(img.height*s);
  const c=mk(W,H),x=c.getContext('2d');x.drawImage(img,0,0,W,H);
  const id=x.getImageData(0,0,W,H),d=id.data,out=new Uint8Array(W*H),st=[];
  const bg=i=>d[i*4]+d[i*4+1]+d[i*4+2]<dark*3;
  for(let i=0;i<W;i++){st.push(i,(H-1)*W+i)}for(let j=0;j<H;j++){st.push(j*W,j*W+W-1)}
  while(st.length){const i=st.pop();if(out[i]||!bg(i))continue;out[i]=1;const xx=i%W,yy=(i/W)|0;
    if(xx>0)st.push(i-1);if(xx<W-1)st.push(i+1);if(yy>0)st.push(i-W);if(yy<H-1)st.push(i+W)}
  for(let i=0;i<W*H;i++)if(out[i])d[i*4+3]=0;x.putImageData(id,0,0);return c;
}
// 实拍物件放到页上：有点立体的影子（离纸有点高）
function placeReal(x,img,cx,cy,w,rot,{lift=6,k=0}={}){const h=w*img.height/img.width;x.save();x.translate(cx,cy);x.rotate(rot);
  if(SH)x.shadowColor='rgba(30,18,8,.42)';x.shadowBlur=lift*2;x.shadowOffsetX=lift*.5;x.shadowOffsetY=lift;x.drawImage(img,-w/2,-h/2,w,h);x.restore()}

// 纸上本来写着、画着的东西（挪不走）：页眉、剪报名字、红色 &、铅笔注、红笔一句
export function collageBase(x,W,H,{letters,names='YOU & ME',notes=['the first one, slightly blurry','our first roll ↓']}){
  x.fillStyle='rgba(60,45,30,.6)';x.font="400 15px 'JB Mono'";x.textAlign='left';x.fillText('01 · COLLAGE',70,70);x.textAlign='right';x.fillText('A ROLL FOR TWO',W-70,70);
  // 名字：两个人各一行，中间一个红色花体 &
  const [a,b]=names.split('&').map(s=>s.trim().toUpperCase());
  ransom(x,a,W*.42,165,92,W*.66,null,letters);
  x.save();x.translate(W*.67,240);x.rotate(-.12);x.fillStyle='#c22a1e';x.font="400 110px Allura";x.textAlign='center';x.fillText('&',0,30);x.restore();
  ransom(x,b||'',W*.53,318,90,W*.8,null,letters);
  x.save();x.translate(W*.43,H*.52+170);x.rotate(-.05);x.fillStyle='#3a2a1c';x.font="400 30px 'Reenie'";x.textAlign='center';x.fillText(notes[0]||'',0,0);x.restore();
  x.save();x.translate(W*.6,H*.335);x.rotate(.04);x.fillStyle='#b0281e';x.font="400 34px 'Reenie'";x.textAlign='left';x.fillText(notes[1]||'',0,0);x.restore();
}

// 一张张能捏起来的碎片：每张在页上的中心 cx,cy、角度 rot、包住它的大小 w,h（页面像素），
// draw 还是按整页坐标画，collagePieces 把它挪进自己那张小画布里
export function collagePieces(W,H,{photos,real,date='10 MAY',no='0510',card={front:'pull me',back:'you can keep this one.'}}){
  const L=[];
  const add=(id,kind,cx,cy,rot,w,h,draw)=>L.push({id,kind,cx,cy,rot,w:Math.round(w),h:Math.round(h),draw});
  // 一只真的蝴蝶落在右上角
  {const h=190*real.bflyOrange.height/real.bflyOrange.width;add('bfly','bfly',W*.85,H*.16,.28,230,h+40,x=>placeReal(x,real.bflyOrange,W*.85,H*.16,190,.28,{lift:9}))}
  // 老邮票，上面盖一个日期邮戳（邮戳跟着邮票走）
  add('stampCT','paper',W*.17,H*.38,-.12,660,320,x=>{placeReal(x,real.stampCT,W*.17,H*.38,190,-.12,{lift:3});
    x.save();x.translate(W*.23,H*.35);x.rotate(-.22);x.globalAlpha=.75;x.strokeStyle='#2f4a7a';x.lineWidth=4;x.beginPath();x.ellipse(0,0,74,44,0,0,Math.PI*2);x.stroke();
    x.fillStyle='#2f4a7a';x.font="700 25px 'JB Mono'";x.textAlign='center';x.textBaseline='middle';x.fillText(date,0,2);x.font="700 11px 'JB Mono'";x.fillText('DEVELOPED',0,-25);x.fillText('WITH LOVE',0,27);
    x.lineWidth=3;for(let i=0;i<4;i++){x.beginPath();for(let t=0;t<=1;t+=.05)x.lineTo(80+t*150,-30+i*16+Math.sin(t*12)*5);x.stroke()}
    x.globalCompositeOperation='destination-out';for(let i=0;i<220;i++){x.fillStyle=`rgba(0,0,0,${rnd(.2,.7)})`;x.fillRect(rnd(-80,230),rnd(-50,50),rnd(1,4),rnd(1,3))}x.restore()});
  // 大照片（黑白）+ 两条胶带
  add('photoBig','paper',W*.43,H*.52,-.05,580,480,x=>{photo(x,photos[0],W*.43,H*.52,360,270,-.05,{raw:true,bottom:56});
    tape(x,W*.43-150,H*.52-172,140,-.5,'#e6b8a2');tape(x,W*.43+170,H*.52-158,120,.45,'#c9d6c2')});
  // 小照片（彩色）压在右下
  add('photoSmall','paper',W*.75,H*.62,.09,330,390,x=>{photo(x,photos[1],W*.75,H*.62,210,250,.09,{raw:true,bottom:20});tape(x,W*.75,H*.62-152,100,.08,'#f0d78a')});
  add('stampMI','paper',W*.9,H*.44,.18,170,200,x=>placeReal(x,real.stampMI,W*.9,H*.44,120,.18,{lift:3}));
  // 票根
  add('ticket','paper',W*.27,H*.75,.12,300,160,x=>chip(x,W*.27,H*.75,250,104,.12,'#d9b98a',(x,w,h)=>{x.setLineDash([5,5]);x.strokeStyle='rgba(60,35,15,.55)';x.lineWidth=2;x.beginPath();x.moveTo(-w/2+w*.22,-h/2+6);x.lineTo(-w/2+w*.22,h/2-6);x.stroke();x.setLineDash([]);
    x.fillStyle='#3a2414';x.font="700 12px 'JB Mono'";x.textAlign='left';x.fillText('ADMIT TWO',-w/2+w*.27,-18);x.font="italic 700 30px Fraunces";x.fillText('Row F, 17',-w/2+w*.27,16);
    x.save();x.rotate(-Math.PI/2);x.textAlign='center';x.font="700 11px 'JB Mono'";x.fillText('Nº '+no,0,-w/2+w*.11+4);x.restore()},{amp:2.5,k:.3}));
  // 灰狗贴纸（她喜欢第二版里那只）站在下面
  {const h=300*real.greyhound.height/real.greyhound.width;add('dog','dog',W*.5,H*.87,.04,330,h+30,x=>placeSticker(x,real.greyhound,W*.5,H*.87,300,.04))}
  // 红心贴纸
  add('heart','heart',W*.08,H*.22,-.3,120,120,x=>sticker(x,W*.08,H*.22,30,-.3,(x,r)=>{x.fillStyle='#fff';x.beginPath();heart(x,0,0,r+8);x.fill();x.fillStyle='#c22a1e';x.beginPath();heart(x,0,0,r);x.fill()}));
  // 右下角牛皮纸小口袋，里面插着一张卡，卡能抽出来翻面
  add('pocket','pocket',W*.86,H*.9,-.06,190,150,x=>torn(x,W*.86,H*.9,160,120,-.06,(x,w,h)=>{x.fillStyle='#b98e5a';x.fillRect(-w,-h,w*2,h*2);x.fillStyle='rgba(90,60,30,.25)';x.beginPath();x.moveTo(-w/2,-h/2);x.lineTo(0,-h/2+40);x.lineTo(w/2,-h/2);x.closePath();x.fill()},{amp:1.5,fiber:false,k:0}));
  // 卡：正面一头写 pull me（露在口袋外面那截），背面一行红笔
  // 像一张旧索引卡：淡黄底、蓝横线、顶上一道红线，跟书页的米白分得开
  const CW=130,CH=170;
  const cardFace=(text,back)=>{const c=mk(CW*2,CH*2),x=c.getContext('2d');x.scale(2,2);x.fillStyle=back?'#ecd9a8':'#f2e2b4';x.fillRect(0,0,CW,CH);
    x.strokeStyle='rgba(194,42,30,.55)';x.lineWidth=1.5;x.beginPath();x.moveTo(6,back?30:48);x.lineTo(CW-6,back?30:48);x.stroke();
    x.strokeStyle='rgba(60,90,150,.28)';x.lineWidth=1;for(let y=back?52:70;y<CH;y+=20){x.beginPath();x.moveTo(6,y);x.lineTo(CW-6,y);x.stroke()}
    x.strokeStyle='rgba(120,80,30,.35)';x.strokeRect(.5,.5,CW-1,CH-1);
    x.fillStyle='#b0281e';x.textAlign='center';
    x.strokeStyle='#b0281e';x.lineWidth=.7;
    if(back){const zh=/[　-鿿＀-￯]/.test(text),LH=zh?22:20;x.font=zh?"400 17px 'Reenie',serif":"400 25px 'Reenie'";// 一个字一个字往行里放，超宽了就在上一个空格断（中文没有空格就在字中间断），最多五行
      const ls=[''];for(const ch of text){const cur=ls[ls.length-1]+ch;if(x.measureText(cur).width<=CW-18||!ls[ls.length-1]){ls[ls.length-1]=cur;continue}const sp=cur.lastIndexOf(' ');if(sp>0&&ch!==' '){ls[ls.length-1]=cur.slice(0,sp);ls.push(cur.slice(sp+1))}else ls.push(ch.trim())}ls.splice(5);ls.forEach((l,i)=>{if(!zh)x.strokeText(l,CW/2,66+i*LH);x.fillText(l,CW/2,66+i*LH)})}
    else{x.font="400 26px 'Reenie'";x.fillText(text,CW/2,38)}return c};
  L.cardFront=cardFace(card.front,false);L.cardBack=cardFace(card.back,true);
  // 每张碎片画进自己的小画布：转回 0 度，碎片中心在画布中心
  SH=false;
  for(const p of L){const c=mk(p.w,p.h),x=c.getContext('2d');x.translate(p.w/2,p.h/2);x.rotate(-p.rot);x.translate(-p.cx,-p.cy);p.draw(x);p.canvas=c}
  SH=true;
  return L;
}

// 静帧（没有互动的时候）：底 + 所有碎片按原位贴上
export function drawCollage(x,W,H,o){collageBase(x,W,H,o);const L=collagePieces(W,H,o);
  for(const p of L){x.save();x.translate(p.cx,p.cy);x.rotate(p.rot);x.shadowColor='rgba(40,25,10,.38)';x.shadowBlur=9;x.shadowOffsetX=2;x.shadowOffsetY=5;x.drawImage(p.canvas,-p.w/2,-p.h/2);x.restore()}}

function heart(x,cx,cy,r){x.moveTo(cx,cy+r);x.bezierCurveTo(cx-r*2,cy-r*.3,cx-r,cy-r*1.6,cx,cy-r*.6);x.bezierCurveTo(cx+r,cy-r*1.6,cx+r*2,cy-r*.3,cx,cy+r)}
function star(x,cx,cy,r){x.beginPath();for(let i=0;i<=10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}x.closePath()}

// 左页的小便签：一张黄便利贴，红铅笔写这一页怎么玩；右下角卷起来一点
export function stickyNote(x,cx,cy,text,{rot=-.05,S=440,color='#f4dc72',fold='#fbeca6',ink='#a8231a',size=64}={}){
  if(window.ROLL&&ROLL.tr)text=ROLL.tr(text);
  x.save();x.translate(cx,cy);x.rotate(rot);
  x.shadowColor='rgba(40,25,10,.32)';x.shadowBlur=10;x.shadowOffsetX=3;x.shadowOffsetY=6;
  // 卷角：右下角斜着切掉一块，露出底下的影子和翻起来的背面
  const c=60;x.fillStyle=color;x.beginPath();x.moveTo(-S/2,-S/2);x.lineTo(S/2,-S/2);x.lineTo(S/2,S/2-c);x.lineTo(S/2-c,S/2);x.lineTo(-S/2,S/2);x.closePath();x.fill();
  x.shadowColor='transparent';
  // 顶上那条胶边颜色深一点
  const g=x.createLinearGradient(0,-S/2,0,-S/2+34);g.addColorStop(0,'rgba(180,140,30,.28)');g.addColorStop(1,'rgba(180,140,30,0)');x.fillStyle=g;x.fillRect(-S/2,-S/2,S,34);
  const g2=x.createLinearGradient(-S/2,S/2,S/2,-S/2);g2.addColorStop(0,'rgba(255,255,255,0)');g2.addColorStop(.6,'rgba(255,255,255,.12)');g2.addColorStop(1,'rgba(150,110,20,.08)');x.fillStyle=g2;x.fillRect(-S/2,-S/2,S,S);
  // 翻起来的角：背面颜色浅一点，带一道折痕
  x.fillStyle=fold;x.beginPath();x.moveTo(S/2,S/2-c);x.lineTo(S/2-c,S/2);x.lineTo(S/2-c*1.05,S/2-c*1.05);x.closePath();x.fill();
  x.strokeStyle='rgba(150,110,20,.35)';x.lineWidth=1;x.beginPath();x.moveTo(S/2,S/2-c);x.lineTo(S/2-c,S/2);x.stroke();
  // 字：红铅笔，自动换行
  // 字要在远处也认得出：写大、描一道同色细边加粗
  // 中文：字小一号（中文字比英文手写满得多），一个字一个字地折行，标点不放行首
  const cjk=/[⺀-鿿＀-￯]/.test(text);if(cjk)size=Math.round(size*.62);
  const lh=cjk?size*1.45:size;
  x.fillStyle=x.strokeStyle=ink;x.lineWidth=cjk?1.2:1.8;x.lineJoin='round';x.textAlign='left';x.font=`400 ${size}px 'Reenie'`;
  const ls=[''];
  if(cjk)(text.match(/[A-Za-z0-9.]+|\s+|./g)||[]).forEach(w=>{const cur=ls[ls.length-1],t=cur+w;
    if(x.measureText(t).width>S-60&&cur&&!/^[\s。，、！？；：）」』…]/.test(w))ls.push(w.trim());else ls[ls.length-1]=t});
  else text.split(' ').forEach(w=>{const t=(ls[ls.length-1]+' '+w).trim();if(x.measureText(t).width>S-50)ls.push(w);else ls[ls.length-1]=t});
  ls.forEach((l,i)=>{const y=-S/2+size*(cjk?2:1.55)+i*lh;x.strokeText(l,-S/2+30,y);x.fillText(l,-S/2+30,y)});
  x.restore();
}

// 旧报纸上撕下来的一格剧照：网点印刷、发黄、上面一条报头、下面一行图注，撕边、有皱
export function newsStill(x,img,cx,cy,w,rot,{head='NOW PLAYING',title='',credit=''}={}){
  const ih=w*img.height/img.width,top=58,bot=46,H=ih+top+bot+16,W=w+28;
  // 网点：先画成灰度小图，再按每格深浅点一个墨点
  const cell=4,gw=Math.ceil(w/cell),gh=Math.ceil(ih/cell),sm=mk(gw,gh),sx=sm.getContext('2d');sx.filter='grayscale(1) contrast(1.25) brightness(1.05)';sx.drawImage(img,0,0,gw,gh);
  const d=sx.getImageData(0,0,gw,gh).data,ht=mk(Math.ceil(w),Math.ceil(ih)),hx=ht.getContext('2d');hx.fillStyle='#2b2219';
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const v=d[(j*gw+i)*4]/255,r=cell*.62*Math.sqrt(1-v);if(r<.25)continue;hx.beginPath();hx.arc(i*cell+cell/2+(j%2?cell/2:0),j*cell+cell/2,r,0,Math.PI*2);hx.fill()}
  torn(x,cx,cy,W,H,rot,(x,W,H)=>{x.fillStyle='#e8dab8';x.fillRect(-W,-H,W*2,H*2);
    // 纸发黄、边上更黄、有几块霉斑
    const g=x.createRadialGradient(0,0,Math.min(W,H)*.3,0,0,Math.max(W,H)*.7);g.addColorStop(0,'rgba(255,250,235,0)');g.addColorStop(1,'rgba(150,105,40,.28)');x.fillStyle=g;x.fillRect(-W/2,-H/2,W,H);
    for(let i=0;i<9;i++){const fx=rnd(-W/2,W/2),fy=rnd(-H/2,H/2),r=rnd(6,22),gg=x.createRadialGradient(fx,fy,0,fx,fy,r);gg.addColorStop(0,'rgba(140,90,30,.18)');gg.addColorStop(1,'rgba(140,90,30,0)');x.fillStyle=gg;x.fillRect(fx-r,fy-r,r*2,r*2)}
    // 报头：两道粗细线夹着一行大写
    const y0=-H/2+8;x.fillStyle='#2b2219';x.fillRect(-w/2,y0,w,3);x.fillRect(-w/2,y0+7,w,1);
    x.font="700 13px 'JB Mono'";x.textAlign='left';x.fillText(head,-w/2,y0+26);x.textAlign='right';x.fillText('PAGE 7',w/2,y0+26);
    x.textAlign='center';x.font="italic 800 26px Fraunces";x.fillText(title,0,y0+top-10);
    // 剧照本身（网点）
    x.globalCompositeOperation='multiply';x.drawImage(ht,-w/2,-H/2+top+8,w,ih);x.globalCompositeOperation='source-over';
    x.strokeStyle='#2b2219';x.lineWidth=1.2;x.strokeRect(-w/2,-H/2+top+8,w,ih);
    // 图注
    x.font="italic 400 15px 'Instrument Serif'";x.fillStyle='#3a2d20';x.fillText(credit,0,H/2-bot/2+4);
    // 背面透过来一点别的字（报纸薄）
    x.save();x.globalAlpha=.07;x.scale(-1,1);x.font="400 11px 'Courier Prime'";for(let i=0;i<14;i++)x.fillText('the matinee crowd lined up around the block for the picture '.repeat(2),0,-H/2+20+i*16);x.restore();
  },{amp:4,k:.35});
}

// 一张用两条纸胶带贴在页上的照片（左页那个人用）
export function tapedPhoto(x,img,cx,cy,w,h,rot,{bw=false}={}){
  photo(x,img,cx,cy,w,h,rot,{bw,bottom:48});
  tape(x,cx-w*.36,cy-h*.62,130,-.55,'#e6b8a2');tape(x,cx+w*.36,cy-h*.62,120,.5,'#c9d6c2')}

// 指南针底下垫的一块旧航海图：撕边、泛黄、经纬线、海岸线、水深数字、咖啡渍；中间一个墨线风玫瑰，
// 风玫瑰的 N 被红笔划掉，旁边改写成 you（rot 让风玫瑰歪一点，别被打开的盖子挡住）
export function seaChart(x,cx,cy,w,h,{rot=-.04,roseRot=.45,roseR=300}={}){
  torn(x,cx,cy,w,h,rot,(x,w,h)=>{x.fillStyle='#e9dbb6';x.fillRect(-w,-h,w*2,h*2);
    const g=x.createRadialGradient(0,0,h*.2,0,0,Math.max(w,h)*.75);g.addColorStop(0,'rgba(255,250,235,0)');g.addColorStop(1,'rgba(140,95,40,.35)');x.fillStyle=g;x.fillRect(-w/2,-h/2,w,h);
    // 经纬线
    x.strokeStyle='rgba(70,55,40,.28)';x.lineWidth=1.2;for(let i=-4;i<=4;i++){x.beginPath();x.moveTo(i*w/8,-h/2);x.lineTo(i*w/8,h/2);x.stroke();x.beginPath();x.moveTo(-w/2,i*h/8);x.lineTo(w/2,i*h/8);x.stroke()}
    // 一段海岸线和点点水深
    x.strokeStyle='rgba(60,45,30,.6)';x.lineWidth=2;x.beginPath();let px=-w/2,py=-h*.3;x.moveTo(px,py);for(let i=0;i<40;i++){px+=w/40;py+=rnd(-14,14);x.lineTo(px,py)}x.stroke();
    x.fillStyle='rgba(70,55,40,.45)';x.font="400 15px 'Courier Prime'";for(let i=0;i<26;i++)x.fillText(String(Math.round(rnd(4,60))),rnd(-w/2+20,w/2-40),rnd(-h*.2,h/2-20));
    // 咖啡渍
    x.strokeStyle='rgba(120,70,25,.22)';x.lineWidth=7;x.beginPath();x.arc(w*.28,h*.3,64,0,PI2);x.stroke();x.lineWidth=2;x.beginPath();x.arc(w*.28+3,h*.3+2,58,0,PI2);x.stroke();
    // 风玫瑰：从中间放射出去的航向线 + 十六个尖
    x.save();x.rotate(roseRot);
    x.strokeStyle='rgba(60,45,30,.22)';x.lineWidth=1;for(let i=0;i<32;i++){const a=i/32*PI2;x.beginPath();x.moveTo(0,0);x.lineTo(Math.cos(a)*w,Math.sin(a)*w);x.stroke()}
    const spike=(a,L,wid,dark)=>{x.save();x.rotate(a);x.beginPath();x.moveTo(0,-L);x.lineTo(wid,0);x.lineTo(0,0);x.closePath();x.fillStyle=dark?'rgba(50,38,26,.85)':'rgba(240,228,200,.95)';x.fill();
      x.beginPath();x.moveTo(0,-L);x.lineTo(-wid,0);x.lineTo(0,0);x.closePath();x.fillStyle=dark?'rgba(240,228,200,.95)':'rgba(50,38,26,.85)';x.fill();x.strokeStyle='rgba(50,38,26,.8)';x.lineWidth=1.5;
      x.beginPath();x.moveTo(0,-L);x.lineTo(wid,0);x.lineTo(0,0);x.lineTo(-wid,0);x.closePath();x.stroke();x.restore()};
    for(let i=0;i<16;i++)spike(i/16*PI2,roseR*(i%4===0?1:i%2===0?.66:.42),i%4===0?28:16,i%2===0);
    x.strokeStyle='rgba(50,38,26,.8)';x.lineWidth=2;x.beginPath();x.arc(0,0,roseR*.3,0,PI2);x.stroke();
    // 方位字母
    x.fillStyle='rgba(50,38,26,.9)';x.font=`700 ${roseR*.16}px Fraunces`;x.textAlign='center';x.textBaseline='middle';
    [['N',0],['E',PI/2],['S',PI],['W',-PI/2]].forEach(([t,a])=>{x.save();x.rotate(a);x.fillText(t,0,-roseR*1.13);x.restore()});
    // 红笔把 N 划掉，旁边写 you
    x.strokeStyle='#b0281e';x.lineWidth=5;x.lineCap='round';const ny=-roseR*1.13;
    x.beginPath();x.moveTo(-roseR*.1,ny-roseR*.07);x.lineTo(roseR*.1,ny+roseR*.07);x.stroke();x.beginPath();x.moveTo(-roseR*.1,ny+roseR*.06);x.lineTo(roseR*.09,ny-roseR*.08);x.stroke();
    x.fillStyle=x.strokeStyle='#a8231a';x.lineWidth=1.8;x.font=`400 ${roseR*.24}px 'Reenie'`;x.textAlign='left';x.strokeText('you',roseR*.13,ny-roseR*.12);x.fillText('you',roseR*.13,ny-roseR*.12);
    x.restore()},{amp:5,k:.3});
}
const PI=Math.PI,PI2=PI*2;

// 指南针那页右页上方的小装饰：一枚旧邮票盖着邮戳、铅笔画的一颗北极星、一个拴着细绳的行李吊牌 destination: you
export function compassDeco(x,W,H,{stamp}){
  // 邮票 + 邮戳
  if(stamp){placeReal(x,stamp,W*.13,H*.1,150,-.1,{lift:3});
    x.save();x.translate(W*.19,H*.085);x.rotate(-.25);x.globalAlpha=.7;x.strokeStyle='#2f4a7a';x.lineWidth=3;x.beginPath();x.arc(0,0,46,0,PI2);x.stroke();
    x.fillStyle='#2f4a7a';x.font="700 13px 'JB Mono'";x.textAlign='center';x.textBaseline='middle';x.fillText('NO. 1',0,-14);x.fillText('NORTH',0,4);x.fillText('★',0,21);
    for(let i=0;i<3;i++){x.beginPath();for(let t=0;t<=1;t+=.05)x.lineTo(50+t*120,-16+i*14+Math.sin(t*12)*4);x.stroke()}x.restore()}
  // 铅笔北极星：一颗四角星，旁边写 north star，一道虚线从星星往下指
  x.save();x.translate(W*.1,H*.32);x.strokeStyle='rgba(70,58,48,.75)';x.lineWidth=2;x.beginPath();
  for(let i=0;i<8;i++){const a=-PI/2+i*PI/4,r=i%2?7:24;i?x.lineTo(Math.cos(a)*r,Math.sin(a)*r):x.moveTo(Math.cos(a)*r,Math.sin(a)*r)}x.closePath();x.stroke();
  x.fillStyle='rgba(70,58,48,.75)';x.font="400 34px 'Reenie'";x.textAlign='left';x.fillText('north star',34,10);
  x.setLineDash([5,6]);x.beginPath();x.moveTo(0,30);x.lineTo(-18,120);x.stroke();x.setLineDash([]);x.restore();
  // 行李吊牌：牛皮纸、剪角、铁圈孔、拴一根细麻绳
  x.save();x.translate(W*.86,H*.83);x.rotate(.22);x.scale(.85,.85);x.shadowColor='rgba(40,25,10,.35)';x.shadowBlur=10;x.shadowOffsetX=3;x.shadowOffsetY=5;
  const tw=150,th=250;x.fillStyle='#c79a63';x.beginPath();x.moveTo(-tw/2+26,-th/2);x.lineTo(tw/2-26,-th/2);x.lineTo(tw/2,-th/2+26);x.lineTo(tw/2,th/2);x.lineTo(-tw/2,th/2);x.lineTo(-tw/2,-th/2+26);x.closePath();x.fill();
  x.shadowColor='transparent';x.fillStyle='rgba(255,240,210,.18)';for(let i=0;i<120;i++)x.fillRect(rnd(-tw/2,tw/2),rnd(-th/2,th/2),rnd(1,3),1);
  x.fillStyle='#e9e3d6';x.beginPath();x.arc(0,-th/2+26,12,0,PI2);x.fill();x.fillStyle='#8a6a3e';x.beginPath();x.arc(0,-th/2+26,6,0,PI2);x.fill();
  x.strokeStyle='#a0855a';x.lineWidth=3;x.beginPath();x.moveTo(0,-th/2+26);x.bezierCurveTo(-30,-th/2-30,40,-th/2-60,10,-th/2-110);x.stroke();
  x.fillStyle='#3a2414';x.textAlign='center';x.font="700 15px 'JB Mono'";x.fillText('DESTINATION',0,-th/2+70);
  x.strokeStyle='rgba(60,40,20,.4)';x.lineWidth=1;for(let i=0;i<4;i++){x.beginPath();x.moveTo(-tw/2+16,-th/2+120+i*30);x.lineTo(tw/2-16,-th/2+120+i*30);x.stroke()}
  x.fillStyle='#a8231a';x.font="400 54px 'Reenie'";x.fillText('you',0,-th/2+112);x.restore();
}

// 数花瓣那页左边的小东西：一簇压干的勿忘我（Commons「20190422Myosotis sylvatica3.jpg」CC0，抠好的 fmn）、一朵单独的，
// 和一张植物标本签（Bellis perennis，下面两行手写：哪天摘的、摘给谁）
// 摘的那天跟客人的纪念日走（11.06：以前写死 10 May，是我们自己的日子）
const sinceDM=()=>{const [,m,d]=String(window.CONTENT?.since||'').split('-').map(Number);return m?`${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]}`:''};
export function petalsDeco(x,W,H,{fmn,sprig,picked=sinceDM(),forWho='you'}){
  const tape=(cx,cy,w,rot)=>{x.save();x.translate(cx,cy);x.rotate(rot);x.fillStyle='rgba(222,200,168,.72)';x.fillRect(-w/2,-15,w,30);x.restore()};
  const press=(sx,sy,sw,sh,cx,cy,w,rot,eyes=[])=>{const h=w*sh/sw,k=w/sw;x.save();x.translate(cx,cy);x.rotate(rot);x.shadowColor='rgba(40,25,10,.28)';x.shadowBlur=8;x.shadowOffsetY=3;
    // 两朵花心在照片里是暗的、被抠空了，先垫一点奶黄
    for(const [ex,ey] of eyes){x.fillStyle='#ecdca0';x.beginPath();x.arc((ex-sx)*k-w/2,(ey-sy)*k-h/2,15*k*1.4,0,PI2);x.fill()}
    x.drawImage(fmn,sx,sy,sw,sh,-w/2,-h/2,w,h);x.restore()};
  // 左边一长条：一整株压干的雏菊（Museo Tazzetti 标本，Epgrande 摄，CC BY 4.0），原来固定用的白纸条抠掉后留下的缝用胶带盖住
  if(sprig){const h=H*.66,w=h*sprig.width/sprig.height,k=w/sprig.width,x0=W*.19-w/2,y0=H*.04;
    x.save();x.translate(x0+w/2,y0+h/2);x.rotate(-.035);x.shadowColor='rgba(40,25,10,.3)';x.shadowBlur=9;x.shadowOffsetX=2;x.shadowOffsetY=4;x.drawImage(sprig,-w/2,-h/2,w,h);x.shadowColor='transparent';
      for(const [px,py,tw,tr] of [[210,705,70,.5],[330,600,70,-.4],[420,693,70,.35],[315,1055,150,-.06]])tape((px-sprig.width/2)*k,(py-sprig.height/2)*k,tw*k*1.4,tr);x.restore();
    x.save();x.fillStyle='rgba(70,58,48,.55)';x.font="400 12px 'JB Mono'";x.textAlign='center';x.fillText('pressed daisy: Museo Tazzetti Herbarium, photo Epgrande, CC BY 4.0',W*.5,H*.985);x.restore()}
  if(fmn){press(0,0,fmn.width,fmn.height,W*.24,H*.83,330,-.12,[[480,207],[592,290]]);tape(W*.13,H*.79,110,.7);
    press(140,0,165,120,W*.86,H*.06,120,.35)}
  // 标本签：牛皮纸，双线框，上面印的，下面手写
  x.save();x.translate(W*.74,H*.84);x.rotate(.05);x.shadowColor='rgba(40,25,10,.3)';x.shadowBlur=10;x.shadowOffsetY=4;
  const lw=300,lh=170;x.fillStyle='#e6d3ad';x.fillRect(-lw/2,-lh/2,lw,lh);x.shadowColor='transparent';
  x.fillStyle='rgba(120,90,50,.08)';for(let i=0;i<160;i++)x.fillRect(rnd(-lw/2,lw/2),rnd(-lh/2,lh/2),rnd(1,3),1);
  x.strokeStyle='rgba(80,55,30,.7)';x.lineWidth=1.5;x.strokeRect(-lw/2+10,-lh/2+10,lw-20,lh-20);x.strokeRect(-lw/2+14,-lh/2+14,lw-28,lh-28);
  x.fillStyle='#3a2414';x.textAlign='center';x.font="700 14px 'JB Mono'";x.fillText('HERBARIUM · NO. 21',0,-lh/2+38);
  x.font="italic 400 30px Fraunces";x.fillText('Bellis perennis',0,-lh/2+74);
  x.textAlign='left';x.font="700 13px 'JB Mono'";x.fillStyle='rgba(58,36,20,.8)';x.fillText('PICKED',-lw/2+30,24);x.fillText('FOR',-lw/2+30,58);
  x.strokeStyle='rgba(58,36,20,.4)';x.lineWidth=1;[28,62].forEach(yy=>{x.beginPath();x.moveTo(-lw/2+96,yy);x.lineTo(lw/2-28,yy);x.stroke()});
  x.fillStyle='#2b3a6a';x.font="400 40px 'Reenie'";x.fillText(picked,-lw/2+102,22);x.fillText(forWho,-lw/2+102,56);
  x.restore();
}
