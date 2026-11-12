// 书封面的几张贴图：底布、绣线（颜色+高度）、绒毛遮罩、幻灯片框
export const CW=1200,CH=1600;
// 书名字体：英文用 Fraunces 斜体；有中文就整行换成思源宋体粗体（自带常用字，打中文才加载），不歪
export const hasCJK=s=>/[⺀-鿿＀-￯]/.test(s);
const titleFont=(title,fs)=>hasCJK(title)?`800 ${fs}px 'Roll Serif SC', Fraunces, serif`:`italic 800 ${fs}px Fraunces, 'Roll Serif SC', serif`;
export const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const rnd=(a,b)=>a+Math.random()*(b-a);
function tint(c,color){const t=mk(c.width,c.height),x=t.getContext('2d');x.drawImage(c,0,0);x.globalCompositeOperation='source-in';x.fillStyle=color;x.fillRect(0,0,t.width,t.height);return t}
function shade(hex,v){const n=parseInt(hex.slice(1),16),f=c=>Math.max(0,Math.min(255,Math.round(c*v)));return `rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`}

export function coverTextures({title,byline,weave,tile=280,bright=1.3,color='#6a1411',card}){
  // 底布：灯芯绒只留一点点条纹，染成酒红；绒毛会盖在上面
  const base=mk(CW,CH),bx=base.getContext('2d');
  bx.fillStyle=color;bx.fillRect(0,0,CW,CH);
  // 用旧了的皮：边上被手摸得浅一点，四个角磨得最厉害，面上有几道细划痕
  {const E=46;for(const [x0,y0,x1,y1] of [[0,0,0,E],[0,CH,0,CH-E],[0,0,E,0],[CW,0,CW-E,0]]){const g=bx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'rgba(255,214,180,.2)');g.addColorStop(1,'rgba(255,214,180,0)');bx.fillStyle=g;bx.fillRect(0,0,CW,CH)}
   for(const [x,y] of [[0,0],[CW,0],[0,CH],[CW,CH]]){const g=bx.createRadialGradient(x,y,0,x,y,110);g.addColorStop(0,'rgba(255,220,190,.28)');g.addColorStop(1,'rgba(255,220,190,0)');bx.fillStyle=g;bx.fillRect(x-110,y-110,220,220)}
   for(let i=0;i<26;i++){const x=rnd(0,CW),y=rnd(0,CH),a=rnd(0,Math.PI),l=rnd(14,70);bx.strokeStyle=`rgba(255,225,200,${rnd(.05,.12)})`;bx.lineWidth=rnd(.8,1.8);bx.beginPath();bx.moveTo(x,y);bx.quadraticCurveTo(x+Math.cos(a)*l*.5+rnd(-6,6),y+Math.sin(a)*l*.5+rnd(-6,6),x+Math.cos(a)*l,y+Math.sin(a)*l);bx.stroke()}}
  // 绒面不是一块平色：大块一点的深浅，像毛被手抚过的方向不一样
  for(let i=0;i<70;i++){const x=rnd(0,CW),y=rnd(0,CH),r=rnd(80,260),g=bx.createRadialGradient(x,y,0,x,y,r),c=Math.random()<.5?'255,150,130':'40,0,0';
    g.addColorStop(0,`rgba(${c},${rnd(.04,.1)})`);g.addColorStop(1,`rgba(${c},0)`);bx.fillStyle=g;bx.fillRect(x-r,y-r,r*2,r*2)}
  // 布纹：真布的明暗按小块铺满，乘在底色上
  if(weave){bx.save();bx.globalCompositeOperation='multiply';bx.filter=`grayscale(1) contrast(1.25) brightness(${bright})`;
    for(let y=0;y<CH;y+=tile)for(let x=0;x<CW;x+=tile)bx.drawImage(weave,x,y,tile,tile);bx.restore()}
  // 绣线单独一层：透明底，线是凸起来的
  const thr=mk(CW,CH),tx=thr.getContext('2d'),thrH=mk(CW,CH),hx=thrH.getContext('2d');
  hx.fillStyle='#000';hx.fillRect(0,0,CW,CH);
  // 绒毛遮罩：白=长毛，黑=被线压住或者被卡片盖住
  const fur=mk(CW,CH),fx=fur.getContext('2d');fx.fillStyle='#fff';fx.fillRect(0,0,CW,CH);

  // 缎面绣：沿斜线扫过字形，每段落在字里面的就是一针，两头暗中间亮
  // rec 给了就不马上画：每一针存成一步，留给页面按从左到右的顺序一针一针绣出来
  function satin(drawMask,{angle=-.95,gap=3.4,light='#fbf1de',dark='#9c8a6c',maxLen=46,rec=null}){
    const m=mk(CW,CH),mx=m.getContext('2d');drawMask(mx);
    const d=mx.getImageData(0,0,CW,CH).data,inside=(x,y)=>{x|=0;y|=0;return x>=0&&y>=0&&x<CW&&y<CH&&d[(y*CW+x)*4+3]>110};
    const shadow=()=>{bx.save();bx.filter='blur(6px)';bx.globalAlpha=.6;bx.drawImage(tint(m,'#1a0302'),3,7);bx.restore()};
    if(!rec)shadow();
    {const k=tint(m,'#000'),d=mk(CW,CH),dx2=d.getContext('2d');for(let i=0;i<16;i++){const an=i/16*Math.PI*2;dx2.drawImage(k,Math.cos(an)*12,Math.sin(an)*12)}dx2.drawImage(k,0,0);fx.save();fx.filter='blur(7px)';fx.drawImage(d,0,0);fx.drawImage(d,0,0);fx.restore()}
    const dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx,R=Math.hypot(CW,CH);
    let li=0;
    for(let t=-R;t<R;t+=gap,li++){
      const ox=CW/2+nx*t,oy=CH/2+ny*t;let run=null;
      for(let u=-R;u<=R;u+=1){const x=ox+dx*u,y=oy+dy*u,isIn=inside(x,y);
        if(isIn&&run===null)run=u;if(!isIn&&run!==null){stitch(ox,oy,run,u,li);run=null}}
    }
    if(rec)rec.shadow=shadow;
    function stitch(ox,oy,a,b,li){
      const n=Math.max(1,Math.round((b-a)/maxLen)),step=(b-a)/n,off=(li%2)*step*.5;
      const cuts=[a];for(let i=1;i<n;i++)cuts.push(Math.min(b,a+i*step+off));cuts.push(b);
      for(let i=0;i<cuts.length-1;i++){
        const s0=cuts[i]+.4,s1=cuts[i+1]-.4;if(s1-s0<1.5)continue;
        const j=rnd(-.5,.5),x0=ox+dx*s0,y0=oy+dy*s0+j,x1=ox+dx*s1,y1=oy+dy*s1-j,v=rnd(.82,1.08);
        const draw=()=>{for(const [c,a0,a1] of [[tx,dark,shade(light,v)],[hx,'#5a5a5a','#ffffff']]){
          const g=c.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,a0);g.addColorStop(.5,a1);g.addColorStop(1,a0);
          c.strokeStyle=g;c.lineWidth=gap*1.1;c.lineCap='round';c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke()}};
        if(rec)rec.push({x:Math.min(x0,x1),draw});else draw();
      }
    }
  }
  // 书名：可以一开始就绣好（title 给了），也可以留空，等客人写完再一针一针绣（stitchTitle）
  const stitchTitle=(title,rec)=>{const tmp=mk(10,10).getContext('2d');let fs=220;
    for(;fs>60;fs-=6){tmp.font=titleFont(title,fs);if(tmp.measureText(title).width<CW*.78)break}
    satin(x=>{x.font=titleFont(title,fs);x.textAlign='center';x.fillText(title,CW/2,340)},{rec});
    if(rec)rec.sort((a,b)=>a.x-b.x);return rec};
  if(title)stitchTitle(title,null);
  satin(x=>{x.font=`italic 600 60px Fraunces`;x.textAlign='center';x.fillText(byline,CW/2,1400)},{gap:2.5,maxLen:20});
  // 一颗同色暗绣的小心，凑近才看得见
  satin(x=>{x.save();x.translate(1010,1468);x.scale(1.6,1.6);x.beginPath();x.moveTo(0,8);x.bezierCurveTo(-24,-8,-12,-26,0,-12);x.bezierCurveTo(12,-26,24,-8,0,8);x.fill();x.restore()},{gap:2.6,light:shade(color,1.25),dark:shade(color,.55),maxLen:24});

  // 卡片压住的地方不长毛
  if(card){fx.fillStyle='#000';fx.beginPath();fx.save();fx.filter="blur(8px)";fx.roundRect(card.x-18,card.y-18,card.w+36,card.h+36,50);fx.fill();fx.restore()}
  return {base,thr,thrH,fur,stitchTitle};
}

// 书名单独一条小图（整页宽 × TH 高，盖在封面书名那一段上），客人写完才一针一针绣。
// 只扫字所在的那一小块；每一针自己带一点影子，所以不用回头再改整张封面
export const TITLE_Y0=60,TITLE_H=380;
export function titleStitches(title){
  // 画在半分辨率的小图上：书在画面里本来就只有几百像素宽，传给显卡的东西少四倍，绣的时候不卡
  const W=CW,H=TITLE_H,S=.5,col=mk(W*S,H*S),cx=col.getContext('2d'),bump=mk(W*S,H*S),bx=bump.getContext('2d');
  bx.fillStyle='#000';bx.fillRect(0,0,W*S,H*S);cx.scale(S,S);bx.scale(S,S);
  const m=mk(W,H),mx=m.getContext('2d'),tmp=mk(10,10).getContext('2d');let fs=220;
  for(;fs>60;fs-=6){tmp.font=titleFont(title,fs);if(tmp.measureText(title).width<CW*.78)break}
  // 按墨迹居中，不按字宽：斜体的 1、窄字母这类，按字宽居中看着会偏
  const ink=()=>{const d=mx.getImageData(0,0,W,H).data;let x0=W,y0=H,x1=0,y1=0;for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2)if(d[(y*W+x)*4+3]>110){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}return {d,x0,y0,x1,y1}};
  mx.font=titleFont(title,fs);mx.textAlign='center';mx.fillText(title,W/2,340-TITLE_Y0);
  let b=ink();const shift=Math.round(W/2-(b.x0+b.x1)/2);
  if(Math.abs(shift)>2){mx.clearRect(0,0,W,H);mx.fillText(title,W/2+shift,340-TITLE_Y0);b=ink()}
  const d=b.d;let {x0,y0,x1,y1}=b;
  x0-=3;y0-=3;x1+=3;y1+=3;
  const inside=(x,y)=>{x|=0;y|=0;return x>=0&&y>=0&&x<W&&y<H&&d[(y*W+x)*4+3]>110};
  const angle=-.95,gap=3.4,maxLen=46,light='#fbf1de',dark='#9c8a6c';
  const dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx,ox0=W/2,oy0=H/2;
  // 只走穿过字框的那些斜线，每条线也只走字框里那一段
  const corners=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]],proj=(px,py,ax,ay)=>(px-ox0)*ax+(py-oy0)*ay;
  const tMin=Math.min(...corners.map(c=>proj(c[0],c[1],nx,ny))),tMax=Math.max(...corners.map(c=>proj(c[0],c[1],nx,ny)));
  const uMin=Math.min(...corners.map(c=>proj(c[0],c[1],dx,dy)))-2,uMax=Math.max(...corners.map(c=>proj(c[0],c[1],dx,dy)))+2;
  const out=[];let li=Math.floor(tMin/gap);
  for(let t=Math.floor(tMin/gap)*gap;t<=tMax;t+=gap,li++){
    const ox=ox0+nx*t,oy=oy0+ny*t;let run=null;
    for(let u=uMin;u<=uMax;u+=1){const isIn=inside(ox+dx*u,oy+dy*u);
      if(isIn&&run===null)run=u;if(!isIn&&run!==null){add(ox,oy,run,u,li);run=null}}
  }
  function add(ox,oy,a,b,li){
    const n=Math.max(1,Math.round((b-a)/maxLen)),step=(b-a)/n,off=(Math.abs(li)%2)*step*.5;
    const cuts=[a];for(let i=1;i<n;i++)cuts.push(Math.min(b,a+i*step+off));cuts.push(b);
    for(let i=0;i<cuts.length-1;i++){
      const s0=cuts[i]+.4,s1=cuts[i+1]-.4;if(s1-s0<1.5)continue;
      const j=rnd(-.5,.5),xa=ox+dx*s0,ya=oy+dy*s0+j,xb=ox+dx*s1,yb=oy+dy*s1-j,v=rnd(.82,1.08);
      out.push({x:Math.min(xa,xb),draw(){
        const g=cx.createLinearGradient(xa,ya,xb,yb);g.addColorStop(0,dark);g.addColorStop(.5,shade(light,v));g.addColorStop(1,dark);
        // 影子用一道偏移的深色粗线代替模糊（模糊在画布上很贵，绣的时候会卡）
        cx.lineCap='round';cx.strokeStyle='rgba(26,3,2,.28)';cx.lineWidth=gap*2.2;cx.beginPath();cx.moveTo(xa+2,ya+4);cx.lineTo(xb+2,yb+4);cx.stroke();
        cx.strokeStyle=g;cx.lineWidth=gap*1.1;cx.beginPath();cx.moveTo(xa,ya);cx.lineTo(xb,yb);cx.stroke();
        const h=bx.createLinearGradient(xa,ya,xb,yb);h.addColorStop(0,'#5a5a5a');h.addColorStop(.5,'#fff');h.addColorStop(1,'#5a5a5a');
        bx.strokeStyle=h;bx.lineWidth=gap*1.1;bx.lineCap='round';bx.beginPath();bx.moveTo(xa,ya);bx.lineTo(xb,yb);bx.stroke()}});
    }
  }
  out.sort((a,b)=>a.x-b.x);
  return {title,stitches:out,col,bump};
}
