// 幻灯片框：有厚度的圆角塑料框，中间一个往里凹的窗口放黑白照片，上面印字和播放键
import * as THREE from './lib/three.module.js?v=tn9zuj';
import {mk} from './bc-tex.js?v=tnboar';
export const SW=640,SH=760;
const WIN={x:64,y:132,w:512,h:384,r:10};

function print(photo){
  const c=mk(SW,SH),x=c.getContext('2d');
  x.fillStyle='#ece3d1';x.fillRect(0,0,SW,SH);
  for(let i=0;i<3000;i++){x.fillStyle=`rgba(${Math.random()<.5?'90,70,45':'255,255,255'},${Math.random()*.05+.02})`;x.fillRect(Math.random()*SW,Math.random()*SH,1.5,1.5)}
  const red='#a3211c';x.fillStyle=red;x.textBaseline='middle';
  // 上面一行：两个词各自靠着照片的左右边，心在正中
  x.font='italic 400 42px Fraunces';x.textAlign='left';x.fillText('Now',WIN.x+6,76);x.textAlign='right';x.fillText('Playing',WIN.x+WIN.w-6,76);
  heart(x,SW/2,78,13);
  // 播放键一行在照片和进度条正中间
  const by=598,tri=(cx,w,dir)=>{x.beginPath();x.moveTo(cx-dir*w*.6,by-w);x.lineTo(cx+dir*w*.9,by);x.lineTo(cx-dir*w*.6,by+w);x.closePath();x.fill()};
  tri(SW/2,22,1);
  tri(SW/2-112,13,-1);tri(SW/2-128,13,-1);x.fillRect(SW/2-148,by-13,4,26);
  tri(SW/2+112,13,1);tri(SW/2+128,13,1);x.fillRect(SW/2+144,by-13,4,26);
  x.fillRect(WIN.x+20,672,WIN.w-40,3);x.beginPath();x.arc(WIN.x+20+(WIN.w-40)*.62,673.5,8,0,Math.PI*2);x.fill();
  // 照片：原彩，不加滤镜（11.06 客人要看原来的颜色，她定整卷这一处都改；以前是 grayscale(1) contrast(1.12) brightness(.95) sepia(.1)）
  const p=mk(WIN.w,WIN.h),px=p.getContext('2d'),s=Math.max(WIN.w/photo.width,WIN.h/photo.height);
  px.drawImage(photo,(WIN.w-photo.width*s)/2,(WIN.h-photo.height*s)/2,photo.width*s,photo.height*s);
  return {print:c,photo:p};
}
function heart(x,cx,cy,r){x.beginPath();x.moveTo(cx,cy+r);x.bezierCurveTo(cx-r*2,cy-r*.3,cx-r,cy-r*1.6,cx,cy-r*.6);x.bezierCurveTo(cx+r,cy-r*1.6,cx+r*2,cy-r*.3,cx,cy+r);x.fill()}
function rr(path,x,y,w,h,r){path.moveTo(x+r,y);path.lineTo(x+w-r,y);path.quadraticCurveTo(x+w,y,x+w,y+r);path.lineTo(x+w,y+h-r);path.quadraticCurveTo(x+w,y+h,x+w-r,y+h);path.lineTo(x+r,y+h);path.quadraticCurveTo(x,y+h,x,y+h-r);path.lineTo(x,y+r);path.quadraticCurveTo(x,y,x+r,y)}

// w 是卡片在世界里的宽；返回一个躺平的 Group，原点在卡片底面中心
export function makeCard(photo,w){
  const {print:pc,photo:ph}=print(photo),k=w/SW;
  // 形状用画布像素坐标，y 朝上（画布 y 反过来），这样正面的 uv 直接对上印刷图
  const sh=new THREE.Shape();rr(sh,0,0,SW,SH,48);
  const hole=new THREE.Path();rr(hole,WIN.x,SH-WIN.y-WIN.h,WIN.w,WIN.h,WIN.r);sh.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(sh,{depth:6,bevelEnabled:true,bevelThickness:4,bevelSize:4,bevelSegments:5,curveSegments:16});
  const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/SW,uv.getY(i)/SH);
  geo.translate(-SW/2,-SH/2,4);geo.scale(k,k,k);
  const pt=new THREE.CanvasTexture(pc);pt.colorSpace=THREE.SRGBColorSpace;pt.anisotropy=8;
  const face=new THREE.MeshStandardMaterial({map:pt,roughness:.42});
  const side=new THREE.MeshStandardMaterial({color:'#e2d6bf',roughness:.45});
  const frame=new THREE.Mesh(geo,[face,side]);frame.castShadow=frame.receiveShadow=true;
  // 照片沉在窗口里，比框面低一截
  const tt=new THREE.CanvasTexture(ph);tt.colorSpace=THREE.SRGBColorSpace;tt.anisotropy=8;
  const pic=new THREE.Mesh(new THREE.PlaneGeometry(WIN.w*k,WIN.h*k),new THREE.MeshStandardMaterial({map:tt,roughness:.55}));
  pic.position.set((WIN.x+WIN.w/2-SW/2)*k,(SH/2-WIN.y-WIN.h/2)*k,3*k);pic.receiveShadow=true;
  const g=new THREE.Group(),inner=new THREE.Group();inner.add(frame,pic);inner.rotation.x=-Math.PI/2;g.add(inner);
  return {group:g,h:w*SH/SW};
}
