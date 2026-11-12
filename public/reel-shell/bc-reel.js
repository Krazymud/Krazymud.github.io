// 06 借书卡那页的小放映机（bc-reel.js）：书顶上那头的桌上站着一台 8mm 老放映机（Poly Haven filmstrip_projector_8mm，CC0，
// 机身上的牌子已经擦掉）。客人点它 → 台灯慢慢暗下去 → 片盘转起来，一道糊糊的光打到左页上，左页那张纸就是银幕 →
// 放一段一分钟不到的默片（1940《Portrait of a Library》蒙特克莱尔公共图书馆，公有领域，剪好的在 img/reel/libreel.mp4），
// 黑场的地方浮出字幕卡 → 放完灯亮回来，onEnd（右页的卡自己冒出一截）。再点一下可以重放。
import * as THREE from './lib/three.module.js?v=tn9zuj';
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const PI=Math.PI;

// 字幕卡：跟 libreel.mp4 的黑场对齐（秒）
// 专属设置（服务器 custom.json）换了片子：用它自己的字幕卡（没给就不要卡）
const CARDS=window.CUSTOM?.reel?(window.CUSTOM.reel.cards||[]):[
  [0.3,4.0,['Once, in a little library,','people borrowed books like this.']],
  [23.0,27.4,['You took the book home.','You brought it back.']],
  [30.5,33.8,['Then someone else did.']],
  [40.5,44.9,['For a hundred years,','everyone brought it back.']],
  [50.9,56.9,['Until two people borrowed it.']],
];
const FADE=1.4,SOUND=!!window.CUSTOM?.reel?.sound;   // SOUND：片子带声音，放的时候歌停，放完接着放

// model：GLTF 场景；src：片子地址；at：放映机站在书里哪（x,z，桌面 y=0）；screen：左页上投影那一块（书里坐标，x0..x1,z0..z1,y）
// dim(k)：整个房间跟着暗（0 正常，1 放映中），书那边给（曝光 + 补光）；银幕和光柱不吃曝光，房间暗了它们就显出来
export function makeReel(model,{src,at,screen,lamp,lampOn,dim,onEnd}){
  const g=new THREE.Group();
  // ---- 放映机 ----
  const S=5,proj=model.scene.clone(true);proj.scale.setScalar(S);
  // 模型的镜头朝 -x，转过来朝 +z（对着客人那边），站在书顶上那头
  proj.rotation.y=PI/2;proj.position.set(at.x,0,at.z);g.add(proj);
  const spools=[],hide=['cable','schuko','connector'];
  proj.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;if(o.material&&'envMapIntensity' in o.material)o.material.envMapIntensity=.25}
    if(/spool_(takeup|feed)|feed_holder|takeup_holder|01_film_side|_film$/.test(o.name))spools.push(o);
    if(hide.some(h=>o.name.endsWith(h)))o.visible=false});
  // 镜头在书里的位置（模型里 focus 那个钮的前面一点）
  proj.updateMatrixWorld(true);
  const lens=new THREE.Vector3(-.105,.074,.093);proj.localToWorld(lens);g.updateMatrixWorld(true);
  // 现在 lens 是 g 的父级坐标；g 在书里原点，所以就是书里坐标
  // ---- 银幕：左页上一块，片子 + 字幕画在一张画布上，四边羽化，叠加在纸上（灯暗了纸是暗的，叠上去就是光） ----
  const VW=960,VH=720,sc=mk(VW,VH),sx=sc.getContext('2d'),tex=new THREE.CanvasTexture(sc);tex.colorSpace=THREE.SRGBColorSpace;
  // 羽化遮罩：四边各 9% / 11% 慢慢淡出
  const fe=mk(VW,VH);{const x=fe.getContext('2d');const h=x.createLinearGradient(0,0,VW,0);h.addColorStop(0,'rgba(0,0,0,0)');h.addColorStop(.1,'#000');h.addColorStop(.9,'#000');h.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=h;x.fillRect(0,0,VW,VH);x.globalCompositeOperation='destination-in';const v=x.createLinearGradient(0,0,0,VH);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(.12,'#000');v.addColorStop(.88,'#000');v.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=v;x.fillRect(0,0,VW,VH)}
  // 颗粒：几张预先做好的噪点轮着用
  const grains=[0,1,2].map(()=>{const c=mk(VW/4,VH/4),x=c.getContext('2d'),d=x.createImageData(c.width,c.height);for(let i=0;i<d.data.length;i+=4){const n=Math.random()*255;d.data[i]=d.data[i+1]=d.data[i+2]=n;d.data[i+3]=255}x.putImageData(d,0,0);return c});
  const SWd=screen.x1-screen.x0,SDd=screen.z1-screen.z0;
  const scrM=new THREE.Mesh(new THREE.PlaneGeometry(SWd,SDd).rotateX(-PI/2),new THREE.MeshBasicMaterial({map:tex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,opacity:0}));
  scrM.position.set((screen.x0+screen.x1)/2,screen.y,(screen.z0+screen.z1)/2);scrM.renderOrder=5;g.add(scrM);
  // ---- 光柱：镜头到银幕四个角的四棱锥，侧面两边和靠银幕那头都是软的 ----
  const beamM=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    uniforms:{k:{value:0},flick:{value:1}},
    vertexShader:'attribute vec2 fuv;varying vec2 vu;void main(){vu=fuv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vu;uniform float k,flick;void main(){float a=sin(vu.x*3.14159)*mix(1.,.25,vu.y)*smoothstep(1.,.7,vu.y)*smoothstep(0.,.08,vu.y);gl_FragColor=vec4(vec3(1.,.82,.58)*a*.09*k*flick,1.);}'});
  const C=[[screen.x0,screen.z0],[screen.x1,screen.z0],[screen.x1,screen.z1],[screen.x0,screen.z1]].map(([x,z])=>new THREE.Vector3(x,screen.y,z));
  {const pos=[],fuv=[];for(let i=0;i<4;i++){const a=C[i],b=C[(i+1)%4];pos.push(lens.x,lens.y,lens.z,a.x,a.y,a.z,b.x,b.y,b.z);fuv.push(.5,0,0,1,1,1)}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('fuv',new THREE.Float32BufferAttribute(fuv,2));
   var beam=new THREE.Mesh(geo,beamM);beam.renderOrder=6;beam.frustumCulled=false;g.add(beam)}
  // 镜头口一点暖光
  const glow=new THREE.PointLight('#ffcf94',0,3,2);glow.position.copy(lens);g.add(glow);
  // ---- 片子：家里静态服务不给 Range，整段拿成 blob 再喂给 video，iOS 才肯放 ----
  const v=document.createElement('video');v.muted=!SOUND;v.playsInline=true;v.setAttribute('playsinline','');v.preload='auto';
  const ready=fetch(src).then(r=>r.blob()).then(b=>{v.src=URL.createObjectURL(new Blob([b],{type:'video/mp4'}));return new Promise(r=>{v.onloadeddata=r;v.load()})});
  // ---- 桌上红铅笔：play me. ----
  const note=(()=>{const c=mk(512,128),x=c.getContext('2d'),t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.375).rotateX(-PI/2),new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:0,depthWrite:false}));
    m.position.set(at.x+1.3,.004,at.z+.3);m.rotation.y=.12;g.add(m);
    x.fillStyle=x.strokeStyle='#a8231a';x.font="400 84px 'Reenie'";x.lineWidth=1.6;x.textAlign='center';x.strokeText('play me.',256,86);x.fillText('play me.',256,86);
    // 一个小箭头指向放映机
    x.lineWidth=4;x.lineCap='round';x.beginPath();x.moveTo(110,64);x.quadraticCurveTo(70,40,38,52);x.moveTo(38,52);x.lineTo(56,36);x.moveTo(38,52);x.lineTo(58,66);x.stroke();
    t.needsUpdate=true;return m})();

  let playing=false,watched=false,startAt=0,endAt=0,dark=0,lampBase=lampOn,last=0,shownAt=0;
  function play(now){if(playing)return;playing=true;startAt=now;endAt=0;if(SOUND)ROLL.music('hush');
    // 带声音的放不出来（浏览器不让）就静音放
    ready.then(()=>{v.currentTime=0;v.play().catch(()=>{v.muted=true;v.play().catch(()=>{})})})}
  const hitProj=ray=>g.visible&&ray.intersectObject(proj,true).length>0;
  function down(ev,ray){if(!hitProj(ray)||playing)return false;play(performance.now());return true}
  const over=ray=>!playing&&hitProj(ray)?'pointer':null;

  function draw(){const t=v.currentTime;
    sx.globalCompositeOperation='source-over';sx.fillStyle='#000';sx.fillRect(0,0,VW,VH);
    // 做旧和压亮部已经压进片子里了（ffmpeg curves），这里只留老放映机的灯在抖：每帧亮度差一点点，用透明度做，不用滤镜
    // 片子不是 4:3 就整张塞进去、两边留黑（换过片子的客人）
    sx.globalAlpha=.9+Math.random()*.1;try{const w=v.videoWidth||VW,h=v.videoHeight||VH,k=Math.min(VW/w,VH/h);sx.drawImage(v,(VW-w*k)/2,(VH-h*k)/2,w*k,h*k)}catch(e){}sx.globalAlpha=1;
    // 字幕卡：黑底一起淡进淡出，镜头切进切出也跟着变柔
    let a=0,lines=null;for(const [t0,t1,l] of CARDS){if(t>=t0-FADE&&t<=t1+FADE){a=Math.max(0,Math.min(1,(t-t0+FADE)/FADE,(t1+FADE-t)/FADE));lines=l}}
    if(a>0){sx.globalAlpha=a;sx.fillStyle='#000';sx.fillRect(0,0,VW,VH);sx.fillStyle='#ece0c6';sx.textAlign='center';sx.textBaseline='middle';
      sx.font="400 51px 'IM Fell'";sx.globalAlpha=a*(.93+Math.random()*.07);lines.forEach((s,i)=>sx.fillText(s,VW/2,VH/2+(i-(lines.length-1)/2)*69));sx.globalAlpha=1}
    sx.globalCompositeOperation='overlay';sx.globalAlpha=.06;sx.drawImage(grains[(Math.random()*3)|0],0,0,VW,VH);sx.globalAlpha=1;
    sx.globalCompositeOperation='destination-in';sx.drawImage(fe,0,0);sx.globalCompositeOperation='source-over';tex.needsUpdate=true}

  function update(now){if(!g.visible){last=now;return false}if(last&&now<last)return false;last=now;let busy=false;
    if(!shownAt)shownAt=now;
    // 灯：放的时候 1.5 秒暗到一成，放完 1.5 秒亮回来
    const want=playing&&!endAt?1:0;if(Math.abs(want-dark)>.001){dark+=Math.sign(want-dark)*Math.min(Math.abs(want-dark),(now-(update.t||now))/1500);busy=true}
    update.t=now;
    if(dark>0||playing){lamp.intensity=lampBase*(1-.96*dark);dim&&dim(dark)}
    // 白纸当幕布会冲白：片子本身压一点
    scrM.material.opacity=dark*.78;beamM.uniforms.k.value=dark;beamM.uniforms.flick.value=.9+Math.random()*.1;glow.intensity=.6*dark;
    if(playing){busy=true;spools.forEach(s=>s.rotation.x-=.06);
      if(!v.paused||v.currentTime>0)draw();
      if(!endAt&&(v.ended||(v.duration&&v.currentTime>=v.duration-.05))){endAt=now;if(SOUND)ROLL.music('unhush')}
      if(endAt&&dark<=0){playing=false;lamp.intensity=lampBase;dim&&dim(0);if(!watched){watched=true;onEnd&&onEnd()}}}
    // play me. 进页一秒半后浮出来，看过以后就不再提示
    const nGoal=!playing&&!watched&&now-shownAt>1500?1:0,no=note.material.opacity;if(Math.abs(nGoal-no)>.005){note.material.opacity=no+(nGoal-no)*.06;busy=true}
    return busy}
  // 翻走了：片子停、灯复原、提示重来
  function reset(){if(playing||dark>0){if(SOUND&&!endAt)ROLL.music('unhush');v.pause();playing=false;dark=0;lamp.intensity=lampBase;dim&&dim(0);scrM.material.opacity=0;beamM.uniforms.k.value=0;glow.intensity=0}shownAt=0;note.material.opacity=0}
  function setShow(on){if(g.visible&&!on)reset();g.visible=on}
  g.visible=false;
  return {group:g,down,over,update,setShow,play:()=>play(performance.now()),get playing(){return playing||dark>0},get watched(){return watched},video:v,proj};
}
