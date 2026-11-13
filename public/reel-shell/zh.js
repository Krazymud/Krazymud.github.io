// 中文版：设置里选了「中文」（localStorage 的 aroll.lang = 'zh'）才生效，英文版这里什么都不做。
// 规矩（她 10.30-10.31 定的，详见 darkroom/中文版.md）：片头全英文；所有镜头框四角的角标不改；胶片、冲印单、看片台纸上的印字不改；
// 第 4 幕页面那两行标题不改；照片墙的小纸牌和贴纸不改；书旁边那一堆、借书卡、读书卡不改。
// 换字是整句对整句（roll-link.js 在网页文字、画布 fillText 上换），所以这里只放「要换」的句子，没列出来的就保持英文。
(()=>{
let lang='zh';try{lang = localStorage.getItem('aroll.lang') || 'zh'}catch(e){}
window.ROLL_LANG=lang;
// 中文字体：英文版也要有——客人在换片页写的中文（照片背面、信……）不跟语言变，可也得用手写中文字体写出来（11.01）
window.ZH_FONT={
  // 英文字体缺中文字的时候用哪个中文字体顶上：好玩的手写 → 沐瑶软笔；花体签名 → 清松手写体 8；衬线、打字机 → 霞鹜文楷；小标签 → 写意体
  fonts:[
    [/Reenie|Allura|Sacramento|Corinthia|Ephesis|Herr Von|Mrs Saint/i,'ZH Brush'],
    [/./,'ZH Kai']],
  // 某一幕想换别的中文字体就写在这里，比如 'tray.html':[[/Reenie/i,'JasonHandwriting8']]（10.31 试过清松，她说还是原来的好）
  fontsFor:{},
  // 10.31 起放在我们自己服务器上（font/zh/，出处见那里的 LICENSE.txt），不再现拿外面的
  fontCSS:['font/zh/122/result.css','font/zh/943/result.css','font/zh/802/result.css'],
};
if(lang!=='zh')return;
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
window.ZH={
  // 每一幕自己的句子（按网页文件名分开，免得一个短词在别的地方被误换）
  page:{
    'roll.html':{
      'settings':'设置','music':'音乐','on':'开','off':'关','volume':'音乐音量','sound':'音效音量','clarity':'清晰度',
      'smooth':'流畅','standard':'标准','sharp':'清晰','polaroids':'拍立得','take them home':'带它们回家','language':'语言',
      'loading the next reel':'下一卷正在装片',
      'the eight from the wall · front and back':'照片墙上那八张 · 正面和背面','download photos':'下载照片','print & cut':'打印下来剪',
      'just a moment…':'稍等一下…','getting the prints ready…':'正在冲印…',
      'cut along the dashed line · fold on the dotted line · glue the backs together · print at 100% (actual size)':'沿虚线剪下 · 在点线处对折 · 背面粘起来 · 打印时选「实际大小」',
      'Gymnopédie No.1 · Erik Satie':'《吉诺佩蒂》第一号 · 萨蒂','Liebestraum No.3 · Franz Liszt':'《爱之梦》第三号 · 李斯特',
      'Let Me Call You Sweetheart · Lewis James, 1924':'《让我叫你甜心》· 刘易斯·詹姆斯，1924','Comfort · imaboo':'《Comfort》· imaboo'},
    'index.html':{
      'settings':'设置','music':'音乐','on':'开','off':'关','volume':'音乐音量','sound':'音效音量','clarity':'清晰度',
      'smooth':'流畅','standard':'标准','sharp':'清晰','polaroids':'拍立得','take them home':'带它们回家','language':'语言',
      'loading the next reel':'下一卷正在装片',
      'the eight from the wall · front and back':'照片墙上那八张 · 正面和背面','download photos':'下载照片','print & cut':'打印下来剪',
      'just a moment…':'稍等一下…','getting the prints ready…':'正在冲印…',
      'cut along the dashed line · fold on the dotted line · glue the backs together · print at 100% (actual size)':'沿虚线剪下 · 在点线处对折 · 背面粘起来 · 打印时选「实际大小」',
      'Gymnopédie No.1 · Erik Satie':'《吉诺佩蒂》第一号 · 萨蒂','Liebestraum No.3 · Franz Liszt':'《爱之梦》第三号 · 李斯特',
      'Let Me Call You Sweetheart · Lewis James, 1924':'《让我叫你甜心》· 刘易斯·詹姆斯，1924','Comfort · imaboo':'《Comfort》· imaboo'},
    'opening.html':{'roll it, darling':'宝宝，往下看'},
    'frame-lists.html':{'Some things':'有些东西','take time':'要慢慢','to develop':'才显影','tear here':'从这里撕开'},
    'frame-c.html':{
      'pull me':'拉我','On air · request line':'正在直播 · 点歌热线','Now playing · Side A ·':'正在播放 · A 面 ·','pick a song ▴':'换一首 ▴',
      'Gymnopédie No.1':'《吉诺佩蒂》第一号','Erik Satie':'萨蒂','Liebestraum No.3':'《爱之梦》第三号','Franz Liszt':'李斯特',
      'Let Me Call You Sweetheart':'《让我叫你甜心》','Lewis James, 1924':'刘易斯·詹姆斯，1924','Comfort':'《Comfort》'},
    'frame-e.html':{'Some things':'有些东西','take time':'要慢慢','to develop':'才显影','tear here':'从这里撕开'},
    'rolls.html':{
      'pick one':'挑一卷','← back to the table':'← 放回桌上','to the darkroom →':'去暗房 →','press me':'按我','winding back':'倒片中',
      'how to play':'怎么玩','How to play ·':'怎么玩 ·',
      'drag to pull it out, tap one to develop':'拖出来，点一格显影',
      'Drag the film out of the can. It clicks at every frame.':'把胶片从罐子里拖出来，每过一格会咔哒一下。',
      'Tap a frame to develop it.':'点一格，让它显影。',
      'These are just for looking. Prints only come from roll 04.':'这几卷只是看的，洗照片只洗第 04 卷。',
      'take your time':'慢慢来',
      'pull one out, hold it up to the light':'拉出一格，举到灯下看',
      'Pull the film out.':'把胶片拉出来。','Press and hold a frame. It lifts up to the light.':'按住一格，它会举到灯下。',
      'Keep holding until the picture shows through.':'一直按着，直到画面透出来。','like we used to':'像我们以前那样',
      'press the lever, one frame at a time':'按一下拉杆，一次看一格',
      'Press the red lever. One frame at a time.':'按红色的拉杆，一次一格。','Every frame keeps a day and a line.':'每一格都存着一天，和一句话。',
      'At the end, the lever winds it back.':'看到最后，拉杆会把它倒回去。','no skipping ahead':'不许跳着看',
      'circle the ones to print. a heart just means you love it.':'想洗的画个圈。画爱心只是喜欢，不洗。',
      'Pick a pen from the right.':'从右边挑一支笔。','Circle the ones you want printed. They go to the darkroom.':'想洗的画个圈，它们会被送进暗房。',
      'A heart means you love it. It develops, but stays off the print list.':'画爱心是喜欢它。它会显影，但不送去洗。',
      'Mark it again to let it go. The pencil is just for doodling.':'再画一次就是不要了。铅笔只是拿来乱画的。',
      'Drag the film out of the can, one frame at a time.':'把胶片从罐子里慢慢拖出来，每过一格会轻轻咔哒一声。',
      'Tap any frame and it will develop.':'点一下胶片上的照片，它就会显影。',
      'This roll is just for looking. Prints come from roll 04.':'这一卷只用来看，洗照片在第 04 卷。',
      'Drag the film out of the can.':'先把胶片从罐子里拖出来。',
      'Press and hold a frame. It rises to the light.':'长按住一格，它会举到灯前。',
      'Keep holding until the picture appears.':'一直按着，等照片慢慢显出来。',
      'Tap the red lever to see the next frame.':'点一下红色拉杆，就能看下一格。',
      'Each frame keeps its date and a line.':'每一格都留着它的日期和一句话。',
      'After the last frame, the film winds back.':'看完最后一格，胶片会自己倒回去。',
      'Tap a pen on the right to switch.':'点一下右边的笔，就能换着用。',
      'Red pen: circle the ones you want printed.':'红笔：圈出想洗出来的照片，它们会被送进暗房。',
      'Heart: the ones you love. They develop, but stay off the print list.':'爱心：特别喜欢的那几张，会显影，但不会洗出来。',
      'Pencil: draw anywhere. Mark a frame again to undo.':'铅笔：哪里都可以画。同一格再画一次就是取消。',
      'keep the good ones':'留下好的那些'},
    'tray.html':{
      "don't rush this one":'别催！！慢慢来！','take a closer look.':'凑近看看。','try another one.':'再看一张。','lights on.':'开灯。',
      "now, let's print them":'好，去洗出来吧',"now, let's print them →":'好，去洗出来吧 →','tap to look up.':'点一下，抬起头。',
      'tap the paper to start':'点一下相纸，开始','tap the paper for the next one':'点一下相纸，洗下一张','wait for it':'等一等','now the tongs':'拿夹子',
      'tap a print to read the back':'点一张照片，看看背面','tap again to hang it back':'再点一下，挂回去','nothing developed yet':'还什么都没洗出来',
      'psst, flip me.':'嘘，翻过来看看。','all dry.':'都晾干了。','to the wall →':'去照片墙 →'},
    'wall.html':{
      'follow the red thread →':'顺着红线走 →','tap to turn it over':'点一下，翻过来','something on the back. tap to turn it over':'背面写了字，点一下翻过来',
      'tap anywhere to pin it back':'随便点哪儿，把它钉回去','tap outside to pin it back':'点外面，钉回去','buy more film. (and snacks)':'再买点胶卷。（还有零食）'},
    'torch-comic.html':{
      'Lights are out.':'灯灭了。','Three things on this desk are ours. Use the torch, tap what you find.':'桌上有三样东西是我们的。拿手电筒照一照，找到了就点一下。',
      'found':'找到','pull it':'拉一下','tap a panel':'点一格','tap anywhere to put it back':'随便点哪儿，放回去','tap outside to put it back':'点外面，放回去',
      'tap the ticket to turn it over':'点票根，翻过来','and off?':'再关上？','next roll →':'下一卷 →',
      "and I'm still counting.":'我还在数。','the day you showed up in the world.':'你来到这个世界的那天。','lucky world.':'这个世界真走运。'},
    'book-cover.html':{
      'tap the letter':'点那封信','If our story':'如果我们的故事','were a film,':'是一部电影，','what would':'它会叫','it be called?':'什么名字？',
      'The book will keep it.':'这本书会替你记着。','Film title':'电影名','tap the line to write':'点那条线，写下来','then press enter':'写好按回车',
      'short and sweet is better':'短一点，甜一点','this book belongs to the two of us':'这本书属于我们两个',
      'pull me':'拉我','everything here peels off. try the pocket.':'这一页的东西都能揭下来。试试那个口袋。',
      'put the card back first.':'先把卡放回去。','play the film first.':'先看完电影。','pull the card.':'抽出那张卡。',
      'Our Film':'我们的电影','unfold me.':'打开我。','unfold me':'打开我','play me.':'放我。','your turn.':'轮到你了。','tap a pin':'点一个图钉','stand up':'站起来',
      "whatever's playing, I'm only here for the girl in F18.":'放什么都行，我只是来看 F18 那个女孩的。','find your seat. F17.':'找到你的座位。F17。',
      'no matter where we go':'不管我们去哪儿','open it. move the photo. flick the needle.':'打开它。挪开照片。拨一下指针。',
      'open the lid.':'打开盖子。','move the photo':'挪动左边的照片','on your left.':'到书里的任何地方','why not flick':'拨一下','the needle?':'指针？','spin it hard.':'用力转。',
      'again.':'再来。','again!':'再来！','it keeps':'它总是','pointing back.':'指回来。','harder.':'用力点。','one more.':'再一次。','as hard':'使出','as you can.':'全力。',
      'oh no.':'糟了。','the needle':'指针','is lost.':'丢了。','bring the candle':'把蜡烛','to the scraps.':'凑近碎片。','it always':'它总能','finds you.':'找到你。',
      'north star':'北极星','pull a petal.':'摘一片花瓣。','loves me, loves me not.':'爱我，不爱我。','loves me':'爱我','loves me not':'不爱我',
      'I counted the petals':'我数过花瓣，','before I pressed it.':'在把它压平之前。',
      'the last page,':'最后一页，','but not the last day.':'但不是最后一天。',
      'close the book':'合上书','pull the tab':'拉那个小标签','read it again':'再读一遍','roll the credits →':'放片尾字幕 →',
      'eat something':'睡前','warm before':'吃点热乎的。','bed.':'','(I checked.)':'（我检查过了）'},
    'credits.html':{'the end,':'剧终，','for now':'暂时的','roll it again':'再放一遍'},
  },
  // 带数字、拼起来的句子
  rx:{
    'tray.html':[[/^yours: (\d+)$/,(m,n)=>`你的：${n} 张`],[/^(\d+) of (\d+) dry$/,(m,a,b)=>`晾干了 ${a} / ${b}`]],
    'rolls.html':[[/^Roll (\d\d)$/,(m,n)=>`第 ${n} 卷`]],
    'torch-comic.html':[[/^day (\d+)\.$/,(m,n)=>`第 ${n} 天。`],[/^since ([a-z]{3}) (\d+), (\d+)\.$/,(m,mo,d,y)=>`从 ${y} 年 ${MON[mo]} 月 ${d} 日开始。`]],
  },
  // 客人在换片页填的字（信、票、署名、书里那些）不跟着语言变：客人写什么就是什么（她 10.31 定的）
  // 片尾字幕整份换（客人改不了这里）；片名 A Roll for Two 保持英文
  credits:[
    ['big','A Roll <em>for Two</em>'],
    ['role','导演'],['name','{both}'],
    ['role','主演'],['name','你<em>和</em>我'],
    ['ph',-3],['ph',4],
    ['role','拍摄器材'],['name','一台胶片机'],
    ['role','冲洗于'],['name','第七暗房'],
    ['role','音乐'],['name','<em>{song}</em>'],
    ['ph',2],['ph',-4],
    ['role','出品'],['name','第七暗房'],
    ['role','特别感谢'],['name','每一张拍糊了的'],
    ['red','下一卷见'],
  ],
};
Object.assign(window.ZH,window.ZH_FONT);
})();
