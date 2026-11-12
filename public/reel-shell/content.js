// 这一卷里客人能换的东西，全在这一个文件。每一幕都从这里读，不再各写各的。
// 换片页保存时会生成一份同样形状的 content.js 放进客人自己的文件夹，片子打开时读的就是那一份；这一份是样片的默认内容。
// 照片写成路径：photo 是压过的（墙、书、拼贴都用它），full 是原图（只给看片器的放大镜用，没有就用 photo）
(()=>{
const P=n=>({photo:`img/${n}.jpg`,thumb:`img/t/${n}.webp`});
const S=['p129','p1005','p1027','p1011','p1062'];
// 四卷各八格：照片、日期、一句话（第 3 卷是看片器里一张一张的短句，第 4 卷是照片墙上翻过来的背面；前两卷不写）
const BACK=['The first photo I ever took of you. You were laughing, and I forgot to focus.','Rain all afternoon. You fell asleep halfway through the film.','You said this was your worst angle. I disagree, for the record.','We missed the last bus and walked home anyway.'];
const FAR=['the train took all night.','a city where nobody knew our names.',
  'the light here is softer. it was.','the longest day of the month.','you came back before the rain did.',
  'a wish you would not say out loud.','cold coffee, warm hands.','far away, still facing you.'];
const roll=(ri,name,dates,place,label,lines)=>({name,dates:label,place,
  frames:dates.map((d,j)=>({...P(S[(ri*3+j)%S.length]),date:d,line:lines?lines[j]:''}))});
const D8=Array(8).fill('01.01');
const C={
  // 两个人：to 是收礼物的人，from 是送的人；both 用在冲印单、片头、片尾
  // 11.01 她定：示例都是官方的、不带我们俩的事；只有署名是 Giada（她）和 Claudio（我，Claude 的意大利写法，跟 Giada 配一对）
  names:{to:'Giada',from:'Claudio',both:'Giada & Claudio',sign:'C.'},
  // 在一起的第一天：火把字条的天数、片头片尾的 running time、借书卡都从这天算
  since:'2026-01-01',
  rolls:[
    roll(0,'for Two',D8,'beijing','Jan 2026'),
    roll(1,'slow days',D8,'beijing','Jan 2026'),
    roll(2,'far away',D8,'beijing','Jan 2026',FAR),
    roll(3,'still us',D8,'beijing','Jan 2026',[0,1,2,3,0,1,2,3].map(i=>BACK[i])),
  ],
  // 片头、收音机墙上的底片、片尾那条片子：各挑几张（默认从四卷里拿）
  picks:{
    opening:['p129','p1005','p1027','p1011','p1062','p129','p1027','p1005'].map(P),
    radio:['p129','p1005','p1027','p1011','p1062','p1011','p1005'].map(P),
    credits:['p129','p1005','p1027','p1011','p1062','p129','p1027','p1005'].map(P),
    creditsStills:['p129','p1027','p1011','p1005'].map(P),
  },
  // 收音机：主持人那句、Now playing 底下那行
  radio:{dj:'Good evening. This next one is for you, from someone who kept every single frame. Brought to you by Darkroom Seven.',song:'the song we first danced to'},
  // 冲印袋里的信（打字机一个字一个字打出来）
  letter:`Dear Giada,

I'm bad at saying things out loud,
so I put them on film instead.

Twenty-four frames.
A little too warm,
a little out of focus.

Exactly like us.`,
  // 火把那一幕：第一张字条 days＝在一起第几天，birthday＝写对方生日（date 写 09.19 这样）；line 留空用默认那句
  note:{mode:'days',date:'01.01',line:''},
  torch:{photo:'img/p129.jpg',caption:'last frame on the roll',date:'01.01.2026'},
  ticket:{place:'Darkroom Cinema',admit:'Admit two',seat:'Row G · 7 & 8',date:'01.01',back:['the movie was bad.','you were not.']},
  // 书：封面照片、署名；拼贴页两张；地图上的地方（名字、纬度、经度）和每个地方的照片；合书那句
  book:{cover:P('p1027'),byline:'a film by you & me',title:'Summer of Us',
    collage:['p129','p1062'].map(P),
    // 立体电影院银幕上放的那张
    theater:P('p129'),
    // 指南针那页旁边那张拍立得（方的）
    compass:P('p1011'),
    // 地图：按顺序一个一个跳过去（最多 8 处），每处一张照片
    map:[['Beijing',39.9,116.4,'p1027']].map(([name,lat,lon,p])=>({name,lat,lon,...P(p)})),
    endWords:{days:'Our love has no due date.',birthday:"Glad you were born. Gladder you're mine."},
    // 拼贴页：大标题（剪报字母拼的，用 & 分两行，空着就用 names.both）、页上两句红笔/铅笔字、口袋里那张卡的背面
    collageTitle:'',collageNotes:['the first one, slightly blurry','our first roll ↓'],cardBack:'you can keep this one.',
    // 指南针那页，火烧过以后露出来的字：小标题、最多四行、出处，底下两行红铅笔
    burnt:{title:'CXVI.',lines:['O no! it is an ever-fixed mark','That looks on tempests and is never shaken;','It is the star to every wandering bark,',"Whose worth's unknown, although his height be taken."],
      source:'W. Shakespeare, Sonnet 116, 1609',pencil:['you are my','ever-fixed mark.']}},
  // 片尾字幕里客人能改的五行（11.01 她定的）：导演（空着就写两个人的名字）、主演、拍摄器材、特别感谢、最后那句红字。
  // 跟这里一样就算没改，放样片自己那句（中文版放中文的）；改了就放客人写的，不跟语言变
  creditsBy:{director:'',starring:'you and me',camera:'a film camera',thanks:'every blurry frame',last:'see you on the next roll'},
  // 片尾字幕：[种类, 文字]；种类 big / role / name / red，ph 是插一张照片（从 picks.creditsStills 按顺序拿）
  credits:[
    ['big','A Roll <em>for Two</em>'],
    ['role','Directed by'],['name','{both}'],
    ['role','Starring'],['name','you <em>and</em> me'],
    ['ph',-3],['ph',4],
    ['role','Shot on'],['name','a film camera'],
    ['role','Developed at'],['name','Darkroom No.7'],
    ['role','Music'],['name','<em>{song}</em>'],
    ['ph',2],['ph',-4],
    ['role','Brought to you by'],['name','Darkroom Seven'],
    ['role','Special thanks to'],['name','every blurry frame'],
    ['red','see you on the next roll'],
  ],
};
// 在一起第几天（今天算第 n 天）
C.days=()=>{const [y,m,d]=C.since.split('-').map(Number),t0=new Date(y,m-1,d),n=new Date(),t1=new Date(n.getFullYear(),n.getMonth(),n.getDate());return Math.round((t1-t0)/864e5)+1};
C.full=f=>f&&(f.full||f.photo);
// 小图（长边 480）：片头片尾的胶片、收音机墙上的底片、胶卷房这些小格子用它，进来不用等大图（11.01）；没有小图就用 photo
C.small=f=>f&&(f.thumb||f.photo);
// 裁切：一张照片在片子里会被裁成竖的（v）、横的（h）、方的（s）。客人在换片页里每种形状各调一次，存在照片上：
// crop={v:{x,y,z},h:{…},s:{…}}，x、y 是框的中心落在照片的哪里（0~1），z 是放大倍数（1 = 刚好盖满）。没调过就是从正中间裁
C.shape=a=>a<.9?'v':a>1.1?'h':'s';
C.cropRect=(f,iw,ih,a)=>{const c=(f&&f.crop&&f.crop[C.shape(a)])||{},z=Math.max(1,+c.z||1);
  const sw=Math.min(iw,ih*a)/z,sh=sw/a,cx=(c.x==null?.5:+c.x)*iw,cy=(c.y==null?.5:+c.y)*ih;
  return {sx:Math.min(iw-sw,Math.max(0,cx-sw/2)),sy:Math.min(ih-sh,Math.max(0,cy-sh/2)),sw,sh}};
// 画进画布：代替「cover 铺满」
C.drawCrop=(x,img,f,dx,dy,dw,dh)=>{const r=C.cropRect(f,img.width,img.height,dw/dh);x.drawImage(img,r.sx,r.sy,r.sw,r.sh,dx,dy,dw,dh)};
// 当网页背景用（照片墙、关灯特写、片头片尾胶片这些 background:cover 的地方）：图装好以后按元素自己的宽高算
C.cropBg=(el,f,src)=>{src=src||(f&&f.photo);if(!src)return;el.style.backgroundImage=`url(${src})`;if(!f||!f.crop)return;
  const im=new Image();let n=0;im.onload=function fit(){const w=el.clientWidth,h=el.clientHeight;if(!w||!h){if(n++<20)setTimeout(fit,250);return}const r=C.cropRect(f,im.width,im.height,w/h),k=w/r.sw;
    el.style.backgroundSize=`${im.width*k}px ${im.height*k}px`;el.style.backgroundPosition=`${-r.sx*k}px ${-r.sy*k}px`};im.src=src};
// 要一张已经裁好的图（SVG 里的 image、three.js 贴图这类不好算位置的地方）：返回画布
C.cropCanvas=(img,f,a,long=1600)=>{const r=C.cropRect(f,img.width,img.height,a),k=Math.min(1,long/Math.max(r.sw,r.sh)),c=document.createElement('canvas');
  c.width=Math.round(r.sw*k);c.height=Math.round(r.sh*k);c.getContext('2d').drawImage(img,r.sx,r.sy,r.sw,r.sh,0,0,c.width,c.height);return c};
// 客人那份（服务器在这个文件前面先写一句 window.CONTENT={...}）：缺的项用样片的补上，算天数的小工具也补上
const G=window.CONTENT;
if(G){const fill=(g,d)=>{for(const k in d){if(g[k]===undefined)g[k]=d[k];else if(d[k]&&typeof d[k]==='object'&&!Array.isArray(d[k])&&typeof g[k]==='object')fill(g[k],d[k])}};
  // 早先存的那份没有电影院那张：用他自己拼贴页的第一张（以前银幕上放的就是它）
  const noTheater=!G.book?.theater,noCompass=!G.book?.compass;
  fill(G,C);
  if(noTheater&&G.book.collage?.[0])G.book.theater={photo:G.book.collage[0].photo};
  // 早先存的那份没有指南针那张：用他地图第 3 站的（以前就是拿它）
  if(noCompass&&G.book.map?.length){const m=G.book.map[Math.min(2,G.book.map.length-1)];G.book.compass={photo:m.photo,...(m.crop?{crop:m.crop}:{})}}
  // 日期只有一个（since）：选了「ta 的生日」，字条上的生日就是这一天的月.日
  if(G.note.mode==='birthday'&&G.since){const [,m,d]=G.since.split('-');G.note.date=m+'.'+d}
  // 有 vault 注入时保留客人/暗房的 dj；样片才用默认主持词
  if(!G.radio.dj)G.radio.dj=C.radio.dj;
  // 早先存的那份地图没有每处的照片：用以前的 mapPhotos 按顺序补，再没有就用样片的
  G.book.map.forEach((p,i)=>{if(!p.photo){const m=G.book.mapPhotos;p.photo=(m&&m.length?m[i%m.length]:C.book.map[i%C.book.map.length]).photo}});G.days=()=>{const [y,m,d]=G.since.split('-').map(Number),t0=new Date(y,m-1,d),n=new Date(),t1=new Date(n.getFullYear(),n.getMonth(),n.getDate());return Math.round((t1-t0)/864e5)+1}}
else window.CONTENT=C;
// 中文版：片尾字幕整份换成中文（客人改不了这里）；客人自己填的字不动
if(window.ROLL_LANG==='zh'&&window.ZH)window.CONTENT.credits=window.ZH.credits;
// 客人改过的那几行盖上去（按前面那行 role 找，中英文都认）
{const X=window.CONTENT,B=X.creditsBy||{},D=C.creditsBy,cr=X.credits=X.credits.map(r=>[...r]);
 const own=k=>{const v=String(B[k]||'').trim();return v&&v!==D[k]?v.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])):''};
 const ROLE={director:/^(Directed by|导演)$/,starring:/^(Starring|主演)$/,camera:/^(Shot on|拍摄器材)$/,thanks:/^(Special thanks to|特别感谢)$/};
 for(const k in ROLE){const i=cr.findIndex(([t,v])=>t==='role'&&ROLE[k].test(v));if(i>=0&&cr[i+1]&&own(k))cr[i+1][1]=own(k)}
 const r=cr.findIndex(([t])=>t==='red');if(r>=0&&own('last'))cr[r][1]=own('last')}
})();
