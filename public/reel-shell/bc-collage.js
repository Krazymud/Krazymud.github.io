// 拼贴页活起来：每张碎片是一小片纸浮在书页上，自己被风吹得轻轻晃；点一下晃得厉害一点
// （蝴蝶扇翅膀、小狗蹦一下、红心跳两下）；按住能捏起来挪地方；口袋里的卡能抽出来翻面。
// 纸开始翻的时候，碎片按现在的位置画回书页（bake），翻回来平躺时再浮起来。
import * as THREE from './lib/three.module.js?v=tn9zuj';
import {collagePieces} from './bc-pages.js?v=to1gte';
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const ctex=c=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t};
// 影子：碎片的剪影糊开，染成深棕
function shadowOf(c,blur=7){const P=blur*3,s=mk(c.width+P*2,c.height+P*2),x=s.getContext('2d');x.filter=`blur(${blur}px)`;x.drawImage(c,P,P);x.filter='none';
  x.globalCompositeOperation='source-in';x.fillStyle='rgb(30,18,8)';x.fillRect(0,0,s.width,s.height);return s}

export function liveCollage({group,tex,PW,PD,opts}){
  const PX=tex.image.width,PY=tex.image.height,kx=PW/PX,kz=PD/PY,k=(kx+kz)/2;
  const page=tex.image,px=page.getContext('2d'),base=mk(PX,PY);base.getContext('2d').drawImage(page,0,0);
  const L=collagePieces(PX,PY,opts);
  const layer=new THREE.Group();layer.position.y=.0012;group.add(layer);
  let order=10;
  const mat=(t,o={})=>new THREE.MeshStandardMaterial({map:t,roughness:.9,transparent:true,alphaTest:.03,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4,...o});
  const pieces=L.map((p,i)=>{
    const pos=new THREE.Group();pos.position.set(p.cx*kx,0,-PD/2+p.cy*kz);pos.rotation.y=-p.rot;layer.add(pos);
    const sc=shadowOf(p.canvas),sm=new THREE.Mesh(new THREE.PlaneGeometry(sc.width*k,sc.height*k).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:ctex(sc),transparent:true,opacity:.36,depthWrite:false}));
    pos.add(sm);
    // 合页在碎片上边：风从下边把它掀起来（照片本来就是上边贴着胶带）
    const hinge=new THREE.Group();hinge.position.z=-p.h*k/2;pos.add(hinge);
    const lift=new THREE.Group();hinge.add(lift);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(p.w*k,p.h*k).rotateX(-Math.PI/2),mat(ctex(p.canvas)));m.position.z=p.h*k/2;lift.add(m);
    const alpha=p.canvas.getContext('2d').getImageData(0,0,p.w,p.h).data;
    const o={...p,pos,sm,hinge,lift,m,alpha,ph:Math.random()*6.28,idle:.6+Math.random()*.6,
      lh:0,hGoal:0,react:null,order:order++};
    m.renderOrder=o.order;sm.renderOrder=o.order-.5;m.userData.piece=o;return o});
  // 口袋里那张卡：挂在口袋下面，跟着口袋一起晃；正反两面
  const pocket=pieces.find(p=>p.kind==='pocket');
  const card=(()=>{const W=L.cardFront.width/2,H=L.cardFront.height/2,g=new THREE.Group();pocket.lift.add(g);
    const geo=new THREE.PlaneGeometry(W*k,H*k).rotateX(-Math.PI/2);
    const bt=ctex(L.cardBack);bt.wrapS=THREE.RepeatWrapping;bt.repeat.x=-1;
    const f=new THREE.Mesh(geo,mat(ctex(L.cardFront),{side:THREE.FrontSide})),b=new THREE.Mesh(geo,mat(bt,{side:THREE.BackSide}));
    const flip=new THREE.Group();flip.add(f,b);g.add(flip);
    // 卡自己的影子：抽出来以后才看得见
    const sc=shadowOf(L.cardFront,10),sm=new THREE.Mesh(new THREE.PlaneGeometry(sc.width*k/2,sc.height*k/2).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:ctex(sc),transparent:true,opacity:0,depthWrite:false}));g.add(sm);
    // 插在口袋里：卡的上边比口袋上边高出 55px
    const z0=pocket.h*k/2+(-60-55+H/2)*k;g.position.set(0,-.0004,z0);
    f.renderOrder=b.renderOrder=pocket.order-.2;f.userData.card=b.userData.card=true;
    return {g,flip,f,b,sm,z0,max:(H+10)*k,out:0,outGoal:0,flipK:0,flipGoal:0,W,H}})();

  // ---- 动 ----
  const t0=performance.now();
  function update(now){if(!layer.visible)return;const t=(now-t0)/1000;
    for(const p of pieces){
      p.lh+=(p.hGoal-p.lh)*.2;
      // 风：在纸面上轻轻转一点，下边一点点掀起来
      let rot=.012*Math.sin(t*p.idle+p.ph),peel=.035*(.5+.5*Math.sin(t*p.idle*1.3+p.ph*2)),y=p.lh*.06,sx=1,sz=1;
      if(p.kind==='pocket')peel*=.4;
      if(p.kind==='bfly'){peel=0;
        // 蝴蝶平时每 4 秒慢慢合一下翅膀
        const c=(t+p.ph)%4;sx=c<.8?1-.45*Math.sin(c/.8*Math.PI):1}
      const r=p.react;if(r){const a=(now-r.t0)/1000;
        if(a>r.dur)p.react=null;else{const d=Math.exp(-a*4);
          if(p.kind==='bfly'){sx=.3+.7*Math.abs(Math.cos(a*22));y+=.05*Math.sin(Math.min(1,a/r.dur)*Math.PI)}
          else if(p.kind==='dog'){const hop=a<.7?Math.abs(Math.sin(a/.35*Math.PI)):0;y+=.07*hop;sz=1-.12*(1-hop)*(a<.7?1:0);rot+=.08*Math.sin(a*14)*d}
          else if(p.kind==='heart'){const b=Math.max(0,Math.sin(a*Math.PI/.25))*(a<1?1:0);sx=sz=1+.25*b*(a%.5<.25?1:.6)}
          else{rot+=.12*d*Math.sin(a*18);peel+=.12*d*Math.abs(Math.sin(a*9))}}}
      if(p.hGoal>0)peel=.16+.02*Math.sin(t*3);
      p.hinge.rotation.y=rot;p.lift.rotation.x=-peel*(1-p.lh*.3);p.hinge.position.y=y;p.lift.scale.set(sx*(1+p.lh*.04),1,sz*(1+p.lh*.04));
      // 影子：离纸越高越大越淡，往右下偏
      p.sm.position.set(.008+y*.4,0,.012+y*.6);p.sm.rotation.y=rot;p.sm.scale.setScalar(1+y*1.5);p.sm.material.opacity=.36-y*1.6;
    }
    card.out+=(card.outGoal-card.out)*.14;card.flipK+=(card.flipGoal-card.flipK)*.12;
    card.g.position.z=card.z0-card.out*card.max;
    const fl=Math.sin(card.flipK*Math.PI);// 翻过来以后浮起来一点、放大一点，像被人拿到眼前看
    const near=Math.max(0,card.flipK-.5)*2;card.flip.position.y=card.out*.003+fl*.05+near*.2;card.flip.scale.setScalar(1+near*1.4);card.sm.scale.z=1+near*1.6;card.g.position.y=-.0004;card.flip.rotation.z=card.flipK*Math.PI;
    card.sm.material.opacity=Math.max(0,card.out-.5)*.7*(1-fl*.5);card.sm.position.set(.006+fl*.03,0,.01+fl*.04);card.sm.scale.x=Math.max(.05,Math.abs(Math.cos(card.flipK*Math.PI)))*(1+near*1.6);card.sm.renderOrder=card.f.renderOrder-.1;
    // 抽出来以后压在口袋上面
    const above=card.out>.6;card.f.renderOrder=card.b.renderOrder=above?5000:pocket.order-.2;
  }

  // ---- 手 ----
  const plane=new THREE.Plane(),hitW=new THREE.Vector3(),loc=new THREE.Vector3();
  const pagePoint=ray=>{group.updateMatrixWorld();const n=new THREE.Vector3(0,1,0).transformDirection(group.matrixWorld),o=layer.getWorldPosition(new THREE.Vector3());
    plane.setFromNormalAndCoplanarPoint(n,o);return ray.ray.intersectPlane(plane,hitW)?group.worldToLocal(loc.copy(hitW)):null};
  let hold=null;
  function down(ev,ray){if(!layer.visible)return false;
    const meshes=[...pieces.map(p=>p.m),card.f,card.b];
    const hits=ray.intersectObjects(meshes,false).filter(h=>{if(h.object.userData.card)return true;const p=h.object.userData.piece,u=h.uv;
      const i=(Math.floor((1-u.y)*p.h)*p.w+Math.floor(u.x*p.w))*4+3;return p.alpha[i]>40});
    if(!hits.length)return false;
    // 叠在最上面的那张先被捏住
    hits.sort((a,b)=>b.object.renderOrder-a.object.renderOrder);const h=hits[0],pt=pagePoint(ray);if(!pt)return false;
    hold={x0:ev.clientX,y0:ev.clientY,at:performance.now(),moved:false,pt0:pt.clone()};
    if(h.object.userData.card){hold.card=true;hold.out0=card.outGoal;return true}
    const p=h.object.userData.piece;hold.p=p;hold.off=new THREE.Vector3(p.pos.position.x-pt.x,0,p.pos.position.z-pt.z);
    if(p.kind!=='pocket'){p.hGoal=1;p.order=order++;p.m.renderOrder=p.order;p.sm.renderOrder=p.order-.5}
    return true}
  function move(ev,ray){if(!hold)return;if(Math.hypot(ev.clientX-hold.x0,ev.clientY-hold.y0)>6)hold.moved=true;if(!hold.moved)return;
    const pt=pagePoint(ray);if(!pt)return;
    if(hold.card){// 顺着口袋的方向往上抽
      const a=pocket.pos.rotation.y,dx=pt.x-hold.pt0.x,dz=pt.z-hold.pt0.z,along=-(dx*Math.sin(-a)*-1+dz*Math.cos(a));
      card.outGoal=Math.max(0,Math.min(1,hold.out0+along/card.max));if(card.flipGoal)card.flipGoal=0;return}
    const p=hold.p;if(p.kind==='pocket')return;
    p.pos.position.x=Math.max(.02,Math.min(PW-.02,pt.x+hold.off.x));p.pos.position.z=Math.max(-PD/2+.02,Math.min(PD/2-.02,pt.z+hold.off.z))}
  function up(){if(!hold)return;const h=hold;hold=null;
    if(h.card){if(!h.moved){// 点一下：在里面就抽出来翻面，在外面就翻回去塞回去
        if(card.outGoal<.5){card.outGoal=1;setTimeout(()=>card.flipGoal=1,350)}else{card.flipGoal=0;setTimeout(()=>card.outGoal=0,450)}}
      else{card.outGoal=card.outGoal>.5?1:0;if(card.outGoal)setTimeout(()=>card.flipGoal=1,250)}return}
    const p=h.p;p.hGoal=0;
    // 没挪就是点了一下：晃 / 扇翅膀 / 蹦 / 跳；挪过就是放下时轻轻颤一下
    p.react={t0:performance.now(),dur:h.moved?.6:(p.kind==='bfly'?1.2:p.kind==='heart'?1:1.2)};
    if(h.moved&&p.kind!=='bfly'&&p.kind!=='dog'&&p.kind!=='heart')p.react.dur=.5}

  // ---- 画回书页 / 浮起来 ----
  function bake(){px.drawImage(base,0,0);
    const all=[...pieces].sort((a,b)=>a.order-b.order);
    for(const p of all){const cx=p.pos.position.x/kx,cy=(p.pos.position.z+PD/2)/kz,rot=-p.pos.rotation.y;
      if(p===pocket){px.save();px.translate(cx,cy);px.rotate(rot);const cw=L.cardFront.width/2,ch=L.cardFront.height/2;px.drawImage(L.cardFront,-cw/2,-60-55,cw,ch);px.restore()}
      px.save();px.translate(cx,cy);px.rotate(rot);px.shadowColor='rgba(40,25,10,.38)';px.shadowBlur=9;px.shadowOffsetX=2;px.shadowOffsetY=5;px.drawImage(p.canvas,-p.w/2,-p.h/2);px.restore()}
    tex.needsUpdate=true}
  function setLive(on){if(on===layer.visible)return;layer.visible=on;
    if(on){px.drawImage(base,0,0);tex.needsUpdate=true}else{hold=null;card.outGoal=card.out=0;card.flipGoal=card.flipK=0;card.g.position.z=card.z0;card.flip.rotation.z=0;bake()}}
  layer.visible=true;setLive(false);
  return {update,down,move,up,setLive,get live(){return layer.visible},get holding(){return !!hold}};
}
