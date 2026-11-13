// 串成一卷时，每一幕跟外面的壳子（roll.html）说话：演完了、放音乐、重来
// 单独打开某一幕的时候 in=false，这些都不做，onGo 立刻执行
// 壳可能嵌在站点 React iframe 里：此时 top 是宿主页，不是壳。消息必须发给带 FILM_V 的壳窗口。
function rollShell(){
  try{
    let w=window.parent;
    for(let i=0;i<5&&w&&w!==window;i++){
      if(w.FILM_V!=null)return w;
      if(!w.parent||w.parent===w)break;
      w=w.parent;
    }
  }catch(e){}
  return window.top;
}
window.ROLL={
  in:window.top!==window,
  shell:rollShell,
  done(fx){if(this.in)rollShell().postMessage({roll:'done',fx},'*')},
  // 快演完了：让壳子先把下一幕装起来（大场景不会提前加载）
  prep(){if(this.in)rollShell().postMessage({roll:'prep'},'*')},
  // 东西都装好、第一帧画出来了（书这种要等模型的大场景用：iframe 的 load 早就到了，可画面还是黑的）
  ready(){if(this.in)rollShell().postMessage({roll:'ready'},'*')},
  music(cmd){if(this.in)rollShell().postMessage({roll:'music',cmd},'*')},
  restart(){if(this.in)rollShell().postMessage({roll:'restart'},'*');else location.href='opening.html'},
  // 壳子把这一幕亮出来的时候才开始（提前在后台加载好，但别提前演）
  // 清晰度：smooth 1 倍、standard 1.5 倍、sharp 2 倍（画布像素和屏幕像素的比）
  pr(){let q='standard';try{q=localStorage.getItem('aroll.q')||q}catch(e){}return {smooth:1,standard:1.5,sharp:2}[q]||1.5},
  onQuality(fn){addEventListener('message',e=>{if(e.data&&e.data.roll==='quality')fn()})},
  // 「再试一次」重装的这一幕地址带 rgo：壳子的 go 只发一次，重装以后就当已经收到
  went:new URLSearchParams(location.search).has('rgo'),
  onGo(fn){if(!this.in||this.went){fn();return}let ran=false;addEventListener('message',e=>{if(!ran&&e.data&&e.data.roll==='go'){ran=true;fn()}})},
  // 拿一张图：跨境线路偶尔丢一个请求，没拿到就再拿，最多四次（隔 1.5、3、5 秒）；十秒都拿不到才给一块暗色空画布顶上（.missing），整幕接着演，不会一直黑着等（11.02）
  // 中文字体装好了没有（没有中文、或者不需要的时候马上就好；zh 那段会换成真的）
  zhReady(){return Promise.resolve()},
  img(src){return new Promise(r=>{let n=0;const i=new Image(),WAIT=[1500,3000,5000];i.onload=()=>r(i);
    i.onerror=()=>{if(src&&n<WAIT.length){setTimeout(()=>{i.src=src},WAIT[n++]);return}console.warn('[roll] missing',src);
      const c=document.createElement('canvas');c.width=480;c.height=360;const x=c.getContext('2d');x.fillStyle='#2a211b';x.fillRect(0,0,480,360);c.missing=true;r(c)};
    if(src)i.src=src;else i.onerror()})}
};
// 这一幕出错卡住了（3D 起不来、脚本没拿到、抛错）：三秒后底下亮一行「跳到下一幕」，不让客人对着黑框干等（11.02）
// 放不了声音这类没关系的错不算；图片没拿到由上面的 img() 管
if(window.top!==window&&(location.pathname.split('/').pop()||'roll.html')!=='roll.html')(()=>{let shown=false;const QUIET=/NotAllowedError|AbortError|ResizeObserver|EncodingError|decodeAudioData/;
  const bad=m=>{if(shown||QUIET.test(String(m)))return;shown=true;console.warn('[roll] scene error',m);setTimeout(()=>{
    // 两个选择：再试一次（这一幕重新装）/ 跳到下一幕
    const zh=window.ROLL_LANG==='zh',a=document.createElement('div');a.className='rollskip';
    a.style.cssText=`position:fixed;left:50%;bottom:5%;transform:translateX(-50%);z-index:99;white-space:nowrap;color:#f3e6d2;font:400 ${zh?"14px -apple-system,'PingFang SC','Microsoft YaHei',sans-serif":"11px 'JB Mono',monospace"};letter-spacing:.15em`;
    const opt=(t,fn)=>{const b=document.createElement('span');b.textContent=t;b.style.cssText='cursor:pointer;opacity:.7;margin:0 14px';b.onmouseenter=()=>b.style.opacity=1;b.onmouseleave=()=>b.style.opacity=.7;
      b.onclick=e=>{e.stopPropagation();a.remove();fn()};a.appendChild(b)};
    a.append(zh?'这一幕没装好 ·':'this reel got stuck ·');
    opt(zh?'再试一次':'try again',()=>location.replace(location.href.replace(/[?&]rgo=1/,'')+(location.search?'&':'?')+'rgo=1'));opt(zh?'跳到下一幕 →':'skip to the next scene →',()=>window.ROLL.done('black'));
    document.body.appendChild(a)},3000)};
  addEventListener('error',e=>{const t=e.target;if(t&&t!==window&&t.tagName!=='SCRIPT')return;bad(e.message||(t&&t.src))},true);
  addEventListener('unhandledrejection',e=>{const r=e.reason;bad(r&&(r.name+' '+r.message)||r)})})();
// 字体先装好再亮：网速慢的时候，字会先用电脑自带的字顶着，装好了再跳回来（她 11.01 看到片头跳两下）。
// 第一帧排好以后，页面上真用到的字体（document.fonts.ready）装好之前先不显示，最多等 1.2 秒。
// 以前是把这页声明的字体全装一遍、等 2.5 秒，大幕临转场才装，转场就黑着等（11.01 她又看到黑屏）。壳子自己不等
(()=>{if((location.pathname.split('/').pop()||'roll.html')==='roll.html')return;const h=document.documentElement;h.style.opacity=0;
  requestAnimationFrame(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1200))]).then(()=>h.style.opacity=''))})();
// 提前在后台装着的下一幕，还没轮到它（壳子没发 go）的时候，动画一秒只走五帧，把显卡让给正在放的这一幕。
// 只管壳子直接装的那一层；照片墙这种装在别的幕里面的不管（它收不到 go）
if(window.top!==window&&window.parent===window.top){let live=window.ROLL.went;addEventListener('message',e=>{if(e.data&&e.data.roll==='go')live=true});
  const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>live?raf(cb):setTimeout(()=>raf(cb),200)}
// 音效音量：每一幕自己 new AudioContext 放声音（撕纸、打字机、拉绳……），这里让所有 AudioContext 都先过一道总音量，
// 设置栏里的 sound 拉条存在 localStorage 的 aroll.sfx（0~1），改了以后别的页面会收到 storage 事件，马上跟着变
(()=>{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
  const lvl=()=>{try{const v=localStorage.getItem('aroll.sfx');return v===null?1:+v}catch(e){return 1}};
  const all=[];
  class SfxContext extends A{constructor(...a){super(...a);const g=A.prototype.createGain.call(this);g.gain.value=lvl();g.connect(super.destination);this.__sfx=g;all.push(this)}
    get destination(){return this.__sfx||super.destination}}
  window.AudioContext=SfxContext;if(window.webkitAudioContext)window.webkitAudioContext=SfxContext;
  addEventListener('storage',e=>{if(e.key==='aroll.sfx'){const v=lvl();all.forEach(c=>{try{c.__sfx.gain.setTargetAtTime(v,c.currentTime,.05)}catch(_){}})}})})();
// 老 Safari（Mac 上去年以前的）不认画布的 ctx.filter：胶卷的负片/正片、暗房刚洗出来的黑白都变回彩色（11.05 客人电脑上看到）。
// 先试认不认；不认才接管：带 grayscale/sepia/invert 的滤镜，drawImage 时先画到一张小画布、逐像素把颜色算出来再贴上去。
// 这些地方都是打开时画一次存起来，不是每帧画，所以不拖慢；只微调亮度对比的（看片台每帧那种）不接管，就不调了。?pf=1 强制接管，测试用
(()=>{const P=CanvasRenderingContext2D.prototype,t=document.createElement('canvas').getContext('2d');if(!t)return;
  t.canvas.width=t.canvas.height=2;t.filter='grayscale(1)';t.fillStyle='#f00';t.fillRect(0,0,2,2);const d=t.getImageData(0,0,1,1).data;
  if(Math.abs(d[0]-d[1])<40&&!/[?&]pf=1/.test(location.search))return;
  const desc=Object.getOwnPropertyDescriptor(P,'filter'),FK=Symbol('pf');
  Object.defineProperty(P,'filter',{configurable:true,get(){return this[FK]||'none'},set(v){this[FK]=String(v);if(desc&&desc.set)try{desc.set.call(this,'none')}catch(e){}}});
  const parse=s=>[...s.matchAll(/([a-z-]+)\(([-\d.]+)(deg|%)?\)/g)].map(([,f,n,u])=>[f,u==='%'?n/100:+n]);
  const mat={grayscale:a=>{const b=1-a;return [.2126+.7874*b,.7152-.7152*b,.0722-.0722*b,.2126-.2126*b,.7152+.2848*b,.0722-.0722*b,.2126-.2126*b,.7152-.7152*b,.0722+.9278*b]},
    sepia:a=>{const b=1-a;return [.393+.607*b,.769-.769*b,.189-.189*b,.349-.349*b,.686+.314*b,.168-.168*b,.272-.272*b,.534-.534*b,.131+.869*b]},
    saturate:s=>[.213+.787*s,.715-.715*s,.072-.072*s,.213-.213*s,.715+.285*s,.072-.072*s,.213-.213*s,.715-.715*s,.072+.928*s],
    'hue-rotate':g=>{const r=g*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return [.213+c*.787-s*.213,.715-c*.715-s*.715,.072-c*.072+s*.928,.213-c*.213+s*.143,.715+c*.285+s*.140,.072-c*.072-s*.283,.213-c*.213-s*.787,.715-c*.715+s*.715,.072+c*.928+s*.072]}};
  // 每一步都写成「3×3 矩阵 + 偏移」12 个数，排成一串；每个像素按顺序走一遍、每步后夹在 0–1（跟浏览器一样逐步夹）
  const step=(f,v)=>mat[f]?[...mat[f](v),0,0,0]:f==='invert'?[1-2*v,0,0,0,1-2*v,0,0,0,1-2*v,v,v,v]:f==='brightness'?[v,0,0,0,v,0,0,0,v,0,0,0]:f==='contrast'?[v,0,0,0,v,0,0,0,v,.5-.5*v,.5-.5*v,.5-.5*v]:null;
  const apply=(img,ops)=>{const S=new Float32Array(ops.map(([f,v])=>step(f,v)).filter(Boolean).flat()),n=S.length,p=img.data,L=p.length;
    for(let i=0;i<L;i+=4){let r=p[i]/255,g=p[i+1]/255,b=p[i+2]/255;
      for(let k=0;k<n;k+=12){let R=S[k]*r+S[k+1]*g+S[k+2]*b+S[k+9],G=S[k+3]*r+S[k+4]*g+S[k+5]*b+S[k+10],B=S[k+6]*r+S[k+7]*g+S[k+8]*b+S[k+11];
        r=R<0?0:R>1?1:R;g=G<0?0:G>1?1:G;b=B<0?0:B>1?1:B}
      p[i]=r*255;p[i+1]=g*255;p[i+2]=b*255}return img};
  const dI=P.drawImage;P.drawImage=function(src,...a){const f=this[FK];if(!f||f==='none'||!/grayscale|sepia|invert/.test(f))return dI.call(this,src,...a);
    let sx=0,sy=0,sw=src.naturalWidth||src.videoWidth||src.width,sh=src.naturalHeight||src.videoHeight||src.height,dx,dy,dw,dh;
    if(a.length>=8)[sx,sy,sw,sh,dx,dy,dw,dh]=a;else if(a.length>=4)[dx,dy,dw,dh]=a;else{[dx,dy]=a;dw=sw;dh=sh}
    const k=Math.min(1,2048/Math.max(Math.abs(dw),Math.abs(dh))),w=Math.max(1,Math.round(Math.abs(dw)*k)),h=Math.max(1,Math.round(Math.abs(dh)*k));
    const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');dI.call(x,src,sx,sy,sw,sh,0,0,w,h);
    const ops=parse(f);try{x.putImageData(apply(x.getImageData(0,0,w,h),ops),0,0)}catch(e){}
    return dI.call(this,c,dx,dy,dw,dh)}})();
// 专属设置 text（服务器 custom.json）：{原句: 新句} 或 {原句: [英文新句, 中文新句]}，片子里写死的句子整句换（网页上的字、画布上画的字）。
// 有中文那段（ZH / ZH_FONT）就交给它的 tr() 先换再查字典；没有就自己换（11.05 男生送朋友，要把恋人味的句子换掉）
(()=>{const T=window.CUSTOM?.text;if(!T)return;const M=new Map(Object.entries(T).map(([k,v])=>[k.replace(/\s+/g,' ').trim(),v]));
  window.ROLL.cx=s=>{if(typeof s!=='string'||!s)return s;const v=M.get(s.replace(/\s+/g,' ').trim());if(v==null)return s;
    const r=Array.isArray(v)?(window.ZH&&v[1]||v[0]):v;return s.match(/^\s*/)[0]+r+s.match(/\s*$/)[0]};
  if(window.ZH||window.ZH_FONT)return;
  window.ROLL.tr=window.ROLL.cx;   // 先整句换再拆行画的地方（便利贴之类）调的是 ROLL.tr
  const cx=window.ROLL.cx,fixText=n=>{if(n.parentNode&&/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName))return;const t=cx(n.data);if(t!==n.data)n.data=t};
  const walk=root=>{if(root.nodeType===3)return fixText(root);if(!root.querySelectorAll&&root.nodeType!==9)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))fixText(n)};
  new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData')fixText(m.target);else m.addedNodes.forEach(walk)}}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>walk(document));else walk(document);
  const P=CanvasRenderingContext2D.prototype;for(const m of ['fillText','strokeText','measureText']){const o=P[m];P[m]=function(t,...a){return o.call(this,cx(String(t)),...a)}}})();
// 中文版：zh.js 设了 window.ZH 才做。网页上的字、画布上 fillText 的字，整句对上字典的就换成中文；
// 英文字体缺中文字，就在字体后面接一个中文字体（CSS 规则、SVG 的 font-family、画布的 ctx.font 都接）
// 英文版没有 ZH，只有 ZH_FONT：不换字，只给客人写的中文接上中文字体
(()=>{const ZHON=!!window.ZH,Z=window.ZH||(window.ZH_FONT&&{page:{},rx:{},...window.ZH_FONT});if(!Z)return;
  const file=location.pathname.split('/').pop()||'roll.html',D=Z.page[file]||{},RX=Z.rx[file]||[];
  const tr=s=>{if(window.ROLL.cx){const c=window.ROLL.cx(s);if(c!==s)return c}if(!ZHON||typeof s!=='string'||!s)return s;const k=s.replace(/\s+/g,' ').trim();if(!k)return s;
    let z=Object.prototype.hasOwnProperty.call(D,k)?D[k]:null;if(z==null)for(const [re,f] of RX)if(re.test(k)){z=k.replace(re,f);break}
    return z==null?s:s.match(/^\s*/)[0]+z+s.match(/\s*$/)[0]};
  const zhFont=f=>{for(const [re,n] of [...((Z.fontsFor||{})[file]||[]),...Z.fonts])if(re.test(f))return n};
  const addFam=v=>!v||/Muyao|JasonHandwriting|YShi|ZH Kai|ZH Brush/.test(v)?v:v.replace(/(\s*,\s*(?:cursive|serif|sans-serif|monospace|system-ui|fantasy))?\s*$/,m=>`, "${zhFont(v)}"`+m);
  // 字体：四个都在自己服务器的 font/ 下（三个是 ZeoSeven 按字切好的，霞鹜文楷是 3500 常用字）。
  // 不用 <link>：那样每一幕都要等字体清单下完才算装好，转场会黑着等。改成自己去拿、拿到了塞成 <style>，不挡装载
  // 中文字体只管中文：英文字母、标点从它的字表里拿掉，不然英文字体还没装好时，英文会先用中文字体里的英文顶着，样子很怪
  const cjkOnly=css=>css.replace(/@font-face\{[^}]*\}/g,b=>{const m=b.match(/unicode-range:([^;}]*)/);if(!m)return b;
    const keep=m[1].split(',').map(r=>r.trim()).filter(r=>{const [a,z]=r.replace(/^U\+/i,'').split('-');return parseInt(z||a,16)>=0x2E80})
      .map(r=>{const [a,z]=r.replace(/^U\+/i,'').split('-');return z&&parseInt(a,16)<0x2E80?'U+2E80-'+z:r});
    return keep.length?b.replace(m[0],'unicode-range:'+keep.join(',')):''});
  // 后面再接 roll.css：整卷字典里的字合成了一个文件（排在后面的优先），这些字就只拿这一个；客人另写的字才去拿 result.css 的小文件
  const txt=u=>fetch(u).then(r=>r.ok?r.text():'').catch(()=>'');
  // 合成文件里有的字，从小文件的字表里删掉（不删的话 fonts.load 会把沾边的小文件也都拿一遍）
  const cps=r=>{const [a,z]=r.trim().replace(/^U\+/i,'').split('-').map(h=>parseInt(h,16)),o=[];for(let c=a;c<=(z||a);c++)o.push(c);return o};
  const minus=(css,roll)=>{const m=roll.match(/unicode-range:([^;}]*)/);if(!m)return css;const has=new Set(m[1].split(',').flatMap(cps));
    return css.replace(/@font-face\{[^}]*\}/g,b=>{const r=b.match(/unicode-range:([^;}]*)/);if(!r)return b;
      const keep=r[1].split(',').flatMap(cps).filter(c=>!has.has(c)).map(c=>'U+'+c.toString(16));return keep.length?b.replace(r[0],'unicode-range:'+keep.join(',')):''})};
  // 客人自己写的字（11.02）：服务器在 content.js 前面写了 window.ZH_GUEST，把这些字也合成了一个文件，就不碰 result.css 的小文件了
  // （一个客人写几十个字，小文件要拿六七十个、两三兆，她朋友那边第一幕的胶片都被挤得出不来）
  const G=window.ZH_GUEST,gid=u=>(u.match(/zh\/(\d+)\//)||[])[1];
  const cssDone=Promise.all(Z.fontCSS.map(u=>Promise.all([G?'':txt(u),txt(u.replace('result.css','roll.css'))]).then(([a,b])=>G?b+'\n'+(G[gid(u)]||''):minus(a,b)+'\n'+b).then(css=>{const st=document.createElement('style');
    st.textContent=cjkOnly(css).replace(/url\("\.\//g,`url("${u.replace(/[^/]*$/,'')}`);document.head.appendChild(st);
    const fam=(css.match(/font-family:"([^"]+)"/)||[])[1];if(fam)document.fonts.load(`20px "${fam}"`,chars).catch(()=>{})}).catch(()=>{})));
  {const st=document.createElement('style');st.textContent="@font-face{font-family:'ZH Kai';src:url(font/LXGWWenKai-Regular.woff2) format('woff2');unicode-range:U+2E80-9FFF,U+3000-303F,U+FF00-FFEF}\n@font-face{font-family:'ZH Brush';src:url(font/MaShanZheng-Regular.ttf) format('truetype');unicode-range:U+2E80-9FFF,U+3000-303F,U+FF00-FFEF}";document.head.appendChild(st)}
  // 提前把要用到的字装好，画布上画字的时候字体已经在了
  const chars=[...new Set((ZHON?Object.values(D).join('')+'第天卷张晾干了你的从年月日开始':'')+(JSON.stringify(window.CONTENT||{}).match(/[\u2E80-\u9FFF\uFF00-\uFFEF]/g)||[]).join(''))].join('');
  addEventListener('load',()=>['Muyao-Softbrush','JasonHandwriting8','YShi-Written','ZH Kai','ZH Brush'].forEach(f=>document.fonts.load(`20px "${f}"`,chars).catch(()=>{})));
  // 3D 场景把字画进贴图之前等一下中文字体（贴图只画一次，抢在字体前面画就永远是电脑自带的字）；最多等 3 秒（11.03）
  if(chars)window.ROLL.zhReady=()=>Promise.race([cssDone.then(()=>Promise.all(['Muyao-Softbrush','JasonHandwriting8','YShi-Written','ZH Kai','ZH Brush'].map(f=>document.fonts.load(`20px "${f}"`,chars).catch(()=>{})))),new Promise(r=>setTimeout(r,3000))]);
  // 壳子：片头放着的时候，把整卷字典里的中文字先下好放进缓存，后面每一幕装的时候就不用现等字体（转场黑屏）
  if(ZHON&&file==='roll.html')addEventListener('load',()=>setTimeout(()=>{const all=[...new Set(Object.values(Z.page).flatMap(p=>Object.values(p)).join('')+chars)].join('');
    ['Muyao-Softbrush','JasonHandwriting8','YShi-Written','ZH Kai','ZH Brush'].forEach(f=>document.fonts.load(`20px "${f}"`,all).catch(()=>{}))},2500));
  // CSS 规则里的 font-family 都接上中文字体（后来加进来的 <style> 也接）
  const seen=new WeakSet();
  const fixRules=rules=>{for(const r of rules){if(r.cssRules&&!(r instanceof CSSFontFaceRule))fixRules(r.cssRules);
    if(r instanceof CSSStyleRule&&!seen.has(r)){seen.add(r);if(r.style.fontFamily)r.style.fontFamily=addFam(r.style.fontFamily)}}};
  const fixSheets=()=>{for(const s of document.styleSheets){try{fixRules(s.cssRules)}catch(e){}}};
  // 文字和属性：整句换
  const fixEl=el=>{if(el.nodeType!==1)return;if(el.hasAttribute('placeholder')){const p=el.getAttribute('placeholder'),t=tr(p);if(t!==p)el.setAttribute('placeholder',t)}
    if(el.hasAttribute('font-family'))el.setAttribute('font-family',addFam(el.getAttribute('font-family')));if(el.style&&el.style.fontFamily)el.style.fontFamily=addFam(el.style.fontFamily)};
  const fixText=n=>{if(n.parentNode&&/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName))return;const t=tr(n.data);if(t!==n.data)n.data=t};
  const walk=root=>{if(root.nodeType===3)return fixText(root);if(root.nodeType!==1&&root.nodeType!==9)return;if(root.nodeType===1)fixEl(root);
    root.querySelectorAll&&root.querySelectorAll('[placeholder],[font-family],[style]').forEach(fixEl);
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))fixText(n)};
  new MutationObserver(ms=>{let css=false;for(const m of ms){if(m.type==='characterData')fixText(m.target);
    else{m.addedNodes.forEach(n=>{if(n.nodeName==='STYLE'||n.nodeName==='LINK')css=true;walk(n)})}}if(css)fixSheets()})
    .observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  const all=()=>{fixSheets();walk(document)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',all);else all();addEventListener('load',fixSheets);
  // 画布：fillText / strokeText / measureText 换字，ctx.font 接中文字体
  const P=CanvasRenderingContext2D.prototype;
  // 动画里每一帧都在画字、设字体：查过的记下来，不每次都重新查字典、跑正则（11.01 她说一有动效就卡）
  const memo=f=>{const M=new Map();return v=>{let r=M.get(v);if(r===undefined){r=f(v);if(M.size>4000)M.clear();M.set(v,r)}return r}};
  const trC=memo(tr),famC=memo(addFam);
  for(const m of ['fillText','strokeText']){const o=P[m];P[m]=function(t,...a){return o.call(this,trC(String(t)),...a)}}
  const mt=P.measureText;P.measureText=function(t){return mt.call(this,trC(String(t)))};
  const fd=Object.getOwnPropertyDescriptor(P,'font');Object.defineProperty(P,'font',{configurable:true,get(){return fd.get.call(this)},set(v){fd.set.call(this,famC(v))}});
  window.ROLL.tr=tr})();
// 第一次在这一幕里点一下，就跟壳子喊一声：从中间某一幕开始放的时候（换了语言重装、?s= 直接打开），收音机那幕没演，音乐还没开始，壳子听到就把音乐接上
if(window.top!==window)addEventListener('pointerdown',()=>rollShell().postMessage({roll:'music',cmd:'kick'},'*'),{once:true,capture:true});
// 每点一下都同步喊壳子 unlockMusic：苹果只认点下去那一刻开始的声音，postMessage 一转手就不算了（同源，直接调得到）
if(window.top!==window)['pointerup','touchend','click','keydown'].forEach(t=>addEventListener(t,()=>{try{const s=rollShell();s.unlockMusic&&s.unlockMusic()}catch(e){}},{capture:true,passive:true}));
// 每一幕都不让选字、复制、右键、拖图，点来点去不会误选中东西；输入框照常能打字
(()=>{const st=document.createElement('style');
  st.textContent='*{-webkit-user-select:none;user-select:none;-webkit-user-drag:none;-webkit-touch-callout:none}input,textarea,[contenteditable]{-webkit-user-select:text;user-select:text}';
  document.head.appendChild(st);
  const typing=e=>e.target&&e.target.closest&&e.target.closest('input,textarea,[contenteditable]');
  ['selectstart','copy','cut','contextmenu','dragstart'].forEach(t=>addEventListener(t,e=>{if(!typing(e))e.preventDefault()},true))})();
// 画框底下那行红字提示、去下一幕的红笔链接，统一挪到画框外面（框正下方那条黑里）。
// 搬进 .proj 里一个贴着框底的 .below；画框身上的状态类（focused、opened…）同步抄给 .below，原来写的 .focused .hint 这类规则照样生效
(()=>{const SEL='.hint,.hint2,.todark,.tocred,.next,.ltgo';
  const st=document.createElement('style');
  st.textContent='.below{position:absolute;left:0;right:0;top:100%;height:110px;pointer-events:none;-webkit-mask:none;mask:none}.below>*{top:18px!important;bottom:auto!important}.below>.hint,.below>.hint2{pointer-events:none}.below>.hint.gone{pointer-events:none}';
  document.head.appendChild(st);
  function setup(){const fr=document.querySelector('.proj>.frame');if(!fr||fr.parentNode.querySelector(':scope>.below'))return;
    const below=document.createElement('div');fr.after(below);
    const sync=()=>{below.className='below '+[...fr.classList].filter(c=>c!=='frame').join(' ')};sync();
    new MutationObserver(sync).observe(fr,{attributes:true,attributeFilter:['class']});
    const move=el=>{if(el.nodeType===1&&el.tagName!=='IFRAME'&&el.matches(SEL))below.appendChild(el)};
    [...fr.children].forEach(move);
    new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(move))).observe(fr,{childList:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup()})();
