// 实拍剪报字母：从公有领域的老报纸扫描里，把标题一个字母一个字母切下来
// SRC 里每条是：哪张图、标题所在的框、框里按顺序是哪些字（空格不算，标点要算，切出来会被跳过）
export const SRC=[
  // 1912 电影报纸广告：又大又黑的老铅字
  {img:'filmad',box:[200,62,590,158],text:'WAR!!'},
  {img:'filmad',box:[800,62,1180,158],text:'WAR!!'},
  {img:'filmad',box:[55,465,670,575],text:'COLONIAL'},
  {img:'filmad',box:[785,465,1345,575],text:'THEATRE'},
  {img:'filmad',box:[600,415,795,460],text:'ATTHE'},
  {img:'filmad',box:[952,597,1145,634],text:'MATINEE'},
  {img:'filmad',box:[995,634,1145,670],text:'NIGHT'},
  // 1917 报纸头版的窄长标题字（报头那几个字母粘在一起切不开、INTERURBAN 那行下半截被裁，都没用）
  {img:'news',box:[745,1365,1085,1418],text:'REPORTOFSINKINGINCORRECT'},
  {img:'news',box:[910,232,1085,258],text:'USMEDICALCORPS'},
  {img:'news',box:[910,418,1085,448],text:'LIBERTYBONDSMAY'},
  {img:'news',box:[575,433,745,462],text:'FRONTIERTOPREVENT'},
];
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};

// 按连通块切：墨连在一起的算一个字母；很小的墨点丢掉；左右大半重叠的块（比如 ! 的点、断开的笔画）并成一个
export function segment(img,[x0,y0,x1,y1]){
  const W=x1-x0,H=y1-y0,c=mk(W,H),x=c.getContext('2d');x.drawImage(img,x0,y0,W,H,0,0,W,H);
  const d=x.getImageData(0,0,W,H).data,ink=new Uint8Array(W*H);for(let i=0;i<W*H;i++)ink[i]=d[i*4]+d[i*4+1]+d[i*4+2]<330?1:0;
  const lab=new Int32Array(W*H),boxes=[];let n=0;
  for(let i=0;i<W*H;i++){if(!ink[i]||lab[i])continue;n++;let a=W,b=0,t=H,bt=0,cnt=0;const st=[i];lab[i]=n;
    while(st.length){const j=st.pop(),xx=j%W,yy=(j/W)|0;cnt++;if(xx<a)a=xx;if(xx>b)b=xx;if(yy<t)t=yy;if(yy>bt)bt=yy;
      for(const k of [j-1,j+1,j-W,j+W]){if(k<0||k>=W*H||Math.abs((k%W)-xx)>1)continue;if(ink[k]&&!lab[k]){lab[k]=n;st.push(k)}}}
    if(cnt>H*H*.004&&bt-t>H*.12)boxes.push({a,b,t,bt})}
  boxes.sort((p,q)=>p.a-q.a);const out=[];
  for(const bx of boxes){const last=out[out.length-1];
    if(last){const ov=Math.min(last.b,bx.b)-Math.max(last.a,bx.a),mn=Math.min(last.b-last.a,bx.b-bx.a);
      if(ov>mn*.6){last.a=Math.min(last.a,bx.a);last.b=Math.max(last.b,bx.b);last.t=Math.min(last.t,bx.t);last.bt=Math.max(last.bt,bx.bt);continue}}
    out.push({...bx})}
  return out.map(o=>({x:x0+o.a,y:y0+o.t,w:o.b-o.a+1,h:o.bt-o.t+1}));
}

// 切好的字母：每个字母留一点周围的纸，做成小画布
export function buildLetters(imgs){
  const map={};
  for(const src of SRC){const img=imgs[src.img];const segs=segment(img,src.box),chars=[...src.text];
    if(segs.length!==chars.length){console.warn('letters: count mismatch',src.text,segs.length);continue}
    segs.forEach((g,i)=>{const ch=chars[i];if(!/[A-Z0-9]/.test(ch))return;
      // 只取这个字母自己那一块，四周补一圈干净的纸，免得带进隔壁字母的边；对比拉高一点，放大了不那么糊
      const pad=Math.round(g.h*.16),c=mk(g.w+pad*2,g.h+pad*2),cx=c.getContext('2d');cx.fillStyle='#f6f3ea';cx.fillRect(0,0,c.width,c.height);
      cx.filter='contrast(1.5) grayscale(1)';cx.drawImage(img,g.x,g.y,g.w,g.h,pad,pad,g.w,g.h);c.big=g.h>60;(map[ch]||=[]).push(c)})}
  return map;
}
