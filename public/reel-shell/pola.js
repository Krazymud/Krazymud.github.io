// 带走拍立得：照片墙那八张（第 4 卷），看完照片墙以后设置栏里多一行 polaroids。
// 点开一个小面板：八张正面排着；download 打包成 zip（每张正面、背面各一张 jpg）；print 开一页 A4 横版，剪下来对折粘好就是两面的拍立得。
// 尺寸照 mini 拍立得：54×86mm，照片 46×62mm（上 6、左右 4、下 18 留白）。画的时候 1mm = 16px
(()=>{
const MM=16,W=54*MM,H=86*MM,IX=4*MM,IY=6*MM,IW=46*MM,IH=62*MM;
const C=window.CONTENT,R4=C.rolls[3],FRAMES=R4.frames.slice(0,8);
const fontsReady=Promise.all([["Reenie","font/ReenieBeanie-normal.woff2"],["Courier Prime","font/CourierPrime-normal.woff2"],["JB Mono","font/jbmono.woff2"]]
  .map(([n,u])=>new FontFace(n,`url(${u})`).load().then(f=>document.fonts.add(f)).catch(()=>{})));
const img=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src});
const mk=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c};
// 相纸：奶白底，一点点颗粒，四周一圈很淡的暗
function paper(x,tint){x.fillStyle=tint;x.fillRect(0,0,W,H);
  let s=11;const r=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let i=0;i<2600;i++){x.fillStyle=`rgba(${r()<.5?'90,60,30':'255,255,255'},${r()*.05})`;x.fillRect(r()*W,r()*H,2,2)}
  const g=x.createRadialGradient(W/2,H/2,W*.35,W/2,H/2,W*.95);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(60,35,15,.12)');x.fillStyle=g;x.fillRect(0,0,W,H)}
// 一行一行往里放字，超宽就换行（中文没有空格就一个字一个字断）
function wrap(x,text,maxW){const ls=[''];for(const ch of String(text||'')){const cur=ls[ls.length-1]+ch;if(x.measureText(cur).width<=maxW||!ls[ls.length-1]){ls[ls.length-1]=cur;continue}
  const sp=cur.lastIndexOf(' ');if(sp>0&&ch!==' '){ls[ls.length-1]=cur.slice(0,sp);ls.push(cur.slice(sp+1))}else ls.push(ch.trim())}return ls}
async function front(fr,i){const c=mk(),x=c.getContext('2d');paper(x,'#f1eadc');
  // 用压过的那份（长边 1600）：拍立得只有 54×86mm，打印绰绰有余。以前拿 3200 的原片，一张一两兆，有一张没拿到整个面板就空着（11.03 悦玩的时候）
  const im=await (window.ROLL&&ROLL.img?ROLL.img(fr.photo):img(fr.photo));
  x.save();x.filter='sepia(.12) saturate(.95) contrast(1.03)';C.drawCrop(x,im,fr,IX,IY,IW,IH);x.restore();
  // 照片四周一圈细细的阴影，像压在相纸里
  x.strokeStyle='rgba(40,25,10,.25)';x.lineWidth=2;x.strokeRect(IX,IY,IW,IH);
  x.fillStyle='#b0281e';x.font=`400 ${9*MM}px Reenie`;x.textBaseline='alphabetic';x.textAlign='right';x.fillText(fr.date||'',W-IX-MM,H-6*MM);
  x.textAlign='left';x.fillStyle='rgba(60,40,20,.5)';x.font=`400 ${2.2*MM}px 'JB Mono'`;x.fillText(`${(R4.name||'').toUpperCase()} · ${String(i+1).padStart(2,'0')}`,IX+MM,H-6.2*MM);
  return c}
async function back(fr,i){const c=mk(),x=c.getContext('2d');paper(x,'#ece2cf');
  x.fillStyle='#b0281e';x.font=`400 ${10*MM}px Reenie`;x.textAlign='left';x.textBaseline='alphabetic';x.fillText(fr.date||'',6*MM,16*MM);
  x.fillStyle='#2a1a0e';x.font=`400 ${3.4*MM}px 'Courier Prime'`;wrap(x,fr.line,W-12*MM).slice(0,12).forEach((l,j)=>x.fillText(l,6*MM,26*MM+j*5.6*MM));
  x.fillStyle='rgba(60,40,20,.45)';x.font=`400 ${2*MM}px 'JB Mono'`;x.fillText(`A ROLL FOR TWO · ROLL 04 · FRAME ${String(i+1).padStart(2,'0')}`,6*MM,H-7*MM);
  return c}
let made=null;
const all=()=>made||(made=fontsReady.then(()=>Promise.all(FRAMES.map(async(fr,i)=>({f:await front(fr,i),b:await back(fr,i)})))));
const blob=(c,q=.92)=>new Promise(r=>c.toBlob(r,'image/jpeg',q));

// ---- zip：只存不压（jpg 本来就压过了），自己拼文件头，不用外面的库 ----
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
function zip(files){const parts=[],dir=[];let off=0;const enc=new TextEncoder();
  for(const {name,data} of files){const n=enc.encode(name),crc=crc32(data),h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,n.length,true);
    parts.push(h,n,data);
    const d=new DataView(new ArrayBuffer(46));d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);d.setUint16(14,33,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,n.length,true);d.setUint32(42,off,true);
    dir.push(d,n);off+=30+n.length+data.length}
  const size=dir.reduce((a,p)=>a+p.byteLength,0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,off,true);
  return new Blob([...parts,...dir,e],{type:'application/zip'})}
async function download(){const P=await all(),files=[];
  for(let i=0;i<P.length;i++){const no=String(i+1).padStart(2,'0');
    for(const [side,c] of [['front',P[i].f],['back',P[i].b]])files.push({name:`polaroid-${no}-${side}.jpg`,data:new Uint8Array(await (await blob(c)).arrayBuffer())})}
  const a=document.createElement('a');a.href=URL.createObjectURL(zip(files));a.download='a-roll-for-two-polaroids.zip';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)}
// ---- 打印版：A4 横版，每页四张，每张正面和背面左右挨着，中间是对折线；四周画裁切的细线 ----
async function print(){const w=open('','_blank');if(!w)return;const T=s=>window.ROLL&&ROLL.tr?ROLL.tr(s):s;w.document.write(`<title>polaroids</title><p style="font:14px monospace;padding:30px">${T('getting the prints ready…')}</p>`);
  const P=await all(),src=await Promise.all(P.map(async p=>({f:URL.createObjectURL(await blob(p.f,.95)),b:URL.createObjectURL(await blob(p.b,.95))})));
  const pages=[];for(let i=0;i<src.length;i+=4)pages.push(src.slice(i,i+4));
  w.document.open();w.document.write(`<!doctype html><meta charset="utf-8"><title>A Roll For Two · polaroids</title><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;font:10px/1.4 monospace;color:#888}
.page{width:297mm;height:210mm;position:relative;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}
.grid{position:absolute;left:40mm;top:15mm;display:grid;grid-template-columns:108mm 108mm;grid-template-rows:86mm 86mm;gap:9mm}
.pair{position:relative;display:flex;outline:.2mm dashed #bbb}.pair img{width:54mm;height:86mm;display:block}
.pair::after{content:"";position:absolute;left:54mm;top:0;bottom:0;border-left:.2mm dotted #999}
.note{position:absolute;left:40mm;bottom:8mm}
@media screen{body{background:#555}.page{background:#fff;margin:10mm auto;box-shadow:0 4px 20px rgba(0,0,0,.4)}}
</style>${pages.map(pg=>`<div class="page"><div class="grid">${pg.map(s=>`<div class="pair"><img src="${s.f}"><img src="${s.b}"></div>`).join('')}</div>
<div class="note">${T('cut along the dashed line · fold on the dotted line · glue the backs together · print at 100% (actual size)')}</div></div>`).join('')}`);
  w.document.close();const imgs=[...w.document.images];await Promise.all(imgs.map(i=>i.complete?0:new Promise(r=>i.onload=i.onerror=r)));setTimeout(()=>w.print(),300)}

// ---- 面板 ----
const st=document.createElement('style');st.textContent=`
.pola{position:fixed;inset:0;z-index:30;display:none;place-items:center;background:rgba(4,3,2,.82)}.pola.on{display:grid}
.pola .box{width:min(920px,92vw);padding:30px 34px 28px;background:#1b1410;border:1px solid rgba(243,230,210,.12);border-radius:14px;color:#f3e6d2;text-align:center}
.pola h3{margin:0;font:400 40px/1 'Reenie',cursive;color:#ee5546}.pola p{margin:8px 0 20px;font:400 11px/1.6 'JB Mono',monospace;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
.pola .row8{display:grid;grid-template-columns:repeat(8,1fr);gap:10px;margin-bottom:24px}.pola .row8 img{width:100%;display:block;box-shadow:0 6px 12px rgba(0,0,0,.5);transition:transform .3s}
.pola .row8 img:nth-child(odd){transform:rotate(-2deg)}.pola .row8 img:nth-child(even){transform:rotate(2deg)}.pola .row8 img:hover{transform:scale(1.08)}
.pola button{font:400 11px 'JB Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#f3e6d2;background:none;border:1px solid rgba(243,230,210,.3);border-radius:999px;padding:10px 20px;margin:0 6px;cursor:pointer}
.pola button:hover{border-color:#f3e6d2}.pola button:disabled{opacity:.4;cursor:default}.pola .x{position:absolute;right:26px;top:20px;border:0;font-size:18px}`;
document.head.appendChild(st);
const el=document.createElement('div');el.className='pola';el.innerHTML=`<div class="box"><h3>take them home</h3><p>the eight from the wall · front and back</p>
<div class="row8" id="pola8"></div><button id="polaDl">download photos</button><button id="polaPr">print &amp; cut</button></div><button class="x" id="polaX">✕</button>`;
document.body.appendChild(el);
const busy=async(b,fn)=>{b.disabled=true;const t=b.textContent;b.textContent='just a moment…';try{await fn()}catch(e){console.error(e)}b.textContent=t;b.disabled=false};
document.getElementById('polaDl').onclick=e=>busy(e.target,download);
document.getElementById('polaPr').onclick=e=>busy(e.target,print);
document.getElementById('polaX').onclick=()=>el.classList.remove('on');
el.onclick=e=>{if(e.target===el)el.classList.remove('on')};
// _all / _zip 留给调试：拿画好的正反面、拼 zip，不用真的点下载
window.POLA={_all:all,_zip:zip,open(){el.classList.add('on');const box=document.getElementById('pola8');if(box.children.length)return;
  all().then(P=>P.forEach(p=>{const i=new Image();i.src=p.f.toDataURL('image/jpeg',.7);box.appendChild(i)}))}};
})();
