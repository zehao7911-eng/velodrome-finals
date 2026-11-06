import {track,LAP,CUPS,TEAMS,KITS,sorted,total} from './core.mjs';

const T=window.THREE;
const TAU=Math.PI*2;
const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const up=vec(0,1,0);
const C={navy:0x1a3041,steel:0x677887,black:0x212832,tire:0x25272c,pale:0xf0e3c9,cream:0xfff0d6,amber:0xf0bc63,rail:0x277d89};
const VARIANTS=[
 {wall:0x94bdc8,infield:0x496d78,sky:0xc2d9de,sun:0xffecd0,ambient:0xe8f4ff,seat:0x297687},
 {wall:0xb78679,infield:0x66617b,sky:0xf0ba94,sun:0xffcca2,ambient:0xf3c9dc,seat:0x6b476e},
 {wall:0x355071,infield:0x405878,sky:0x576c99,sun:0xd2e5ff,ambient:0xabc9ff,seat:0x355d82}
];
function rand(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function drawCanvas(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'));return c}
function bevel(w,h,d){
 const b=Math.min(w,h,d)*.13,x=w/2-b,y=h/2-b,s=new T.Shape();
 s.moveTo(-x,-y);s.lineTo(x,-y);s.lineTo(x,y);s.lineTo(-x,y);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth:d-b*2,steps:1,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:1});
 g.translate(0,0,-(d-b*2)/2);return g;
}
function wood(){
 return drawCanvas(1024,256,c=>{
  const n=rand(21);c.fillStyle='#d4a06f';c.fillRect(0,0,1024,256);
  for(let y=0;y<256;y+=12){
   c.fillStyle=['#bb8559','#d1a071','#dda97a','#c89461','#cc9767'][Math.floor(n()*5)];c.fillRect(0,y,1024,12);
   c.fillStyle='#593c2928';c.fillRect(0,y,1024,1);
   c.fillStyle='#fff0b044';c.fillRect(0,y+1,1024,1);
   for(let x=Math.floor(n()*140);x<1024;x+=95+Math.floor(n()*140))c.fillRect(x,y,2,12);
  }
  for(let i=0;i<5500;i++){
   const x=n()*1024,y=n()*256;
   c.fillStyle=i%2?'#4a2c231c':'#ffdfaa27';c.fillRect(x,y,n()*73,.3+n()*1.2);
  }
 });
}
function graphic(title,sub,bg,accent){
 return drawCanvas(768,256,c=>{
  c.fillStyle=bg;c.fillRect(0,0,768,256);
  c.strokeStyle=accent;c.lineWidth=4;c.strokeRect(13,13,742,230);
  for(let i=0;i<8;i++){c.fillStyle=i%2?accent:bg;c.fillRect(27+i*12,31,12,9);c.fillRect(645+i*12,216,12,9)}
  c.textAlign='center';c.fillStyle=accent;c.font='italic 900 78px sans-serif';c.fillText(title,384,131,650);
  c.fillStyle='#ffffff';c.font='bold 25px monospace';c.fillText(sub,384,184,620);
 });
}
function badge(team){
 return drawCanvas(128,128,c=>{
  c.fillStyle='#f5e9cc';c.fillRect(0,0,128,128);c.strokeStyle='#afad9f';c.lineWidth=4;c.strokeRect(4,4,120,120);
  c.fillStyle='#172d3d';c.textAlign='center';c.font='900 69px sans-serif';c.fillText(team.number,64,83);c.font='bold 12px monospace';c.fillText('VELO FINALS',64,106);
 });
}
function ribbon(start,end,l1,l2,n,y=0){
 const pos=[],uv=[],ind=[];
 for(let i=0;i<=n;i++){
  const u=i/n,d=start+u*(end-start);
  for(const [j,l] of [l1,l2].entries()){
   const t=track(d,l);pos.push(t.x,t.y+y,t.z);uv.push(u,j);
  }
  if(i<n){const k=i*2;ind.push(k,k+2,k+1,k+2,k+3,k+1)}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();return g;
}
export class Arena{
 constructor(canvas){
  this.canvas=canvas;
  this.r=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  this.r.outputEncoding=T.sRGBEncoding;this.r.toneMapping=T.ACESFilmicToneMapping;this.r.toneMappingExposure=.95;
  this.scene=new T.Scene();this.cam=new T.PerspectiveCamera(53,1,.10,185);
  this.scene.fog=new T.Fog(0xb7d2d9,50,138);
  this.hemi=new T.HemisphereLight(0xe8f4ff,0x9f8c78,1.04);this.scene.add(this.hemi);
  this.key=new T.DirectionalLight(0xffecd0,1.62);this.key.position.set(5,13,9);this.scene.add(this.key);
  const edge=new T.DirectionalLight(0xc1ecff,.60);edge.position.set(-9,5,-14);this.scene.add(edge);
  this.geom=new Map();this.mats=new Map();this.tone=-1;
  this.clock=0;this.look=vec();this.cameraReady=false;this.mode='';
  this.buildTrack();this.buildBowl();this.buildInfield();this.buildPodium();
  this.actors=TEAMS.map((t,i)=>this.makeRider(t,i));
  this.pack(this.scene);this.currentKit=null;this.resize();
 }
 paint(color,rough=.72,metal=0){
  const k=[color,rough,metal].join('/');
  if(!this.mats.has(k))this.mats.set(k,new T.MeshStandardMaterial({color:new T.Color(color).convertSRGBToLinear(),roughness:rough,metalness:metal}));
  return this.mats.get(k);
 }
 texture(c){const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=Math.min(6,this.r.capabilities.getMaxAnisotropy());return t}
 mesh(p,g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);p.add(o);return o}
 group(p,x=0,y=0,z=0){const o=new T.Group();o.position.set(x,y,z);p.add(o);return o}
 geo(k,make){if(!this.geom.has(k))this.geom.set(k,make());return this.geom.get(k)}
 box(p,w,h,d,m,x=0,y=0,z=0,edge=true){
  const g=this.geo(['box',w,h,d,edge].join(),()=>edge?bevel(w,h,d):new T.BoxGeometry(w,h,d));
  return this.mesh(p,g,m,x,y,z);
 }
 cyl(p,a,b,h,m,x=0,y=0,z=0,n=16){
  return this.mesh(p,this.geo(['cyl',a,b,h,n].join(),()=>new T.CylinderGeometry(a,b,h,n)),m,x,y,z);
 }
 tube(p,a,b,r,m){
  const v=b.clone().sub(a);
  const g=this.geo('tube/'+r,()=>new T.CylinderGeometry(r,r,1,9));
  const o=this.mesh(p,g,m);o.position.copy(a).addScaledVector(v,.5);o.scale.y=v.length();o.quaternion.setFromUnitVectors(up,v.normalize());return o;
 }
 board(p,tex,w,h,x,y,z){
  return this.mesh(p,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,toneMapped:false}),x,y,z);
 }
 surface(l1,l2,color,y=0){
  const m=this.paint(color).clone();m.side=T.DoubleSide;
  return this.mesh(this.scene,ribbon(0,LAP,l1,l2,500,y),m);
 }
 buildTrack(){
  const tex=this.texture(wood());tex.wrapS=T.RepeatWrapping;tex.repeat.set(8,1);
  const woodMat=new T.MeshStandardMaterial({map:tex,side:T.DoubleSide,roughness:.91});
  this.mesh(this.scene,ribbon(0,LAP,-.43,4.55,500),woodMat);
  this.surface(-1.32,-.43,0x2b8e9d,.003);
  this.surface(-1.46,-1.34,0xdce6dc,.008);
  for(const [l,w,c] of [[-.34,.052,0xf4ece1],[.37,.033,0x2e3841],[1.24,.055,0xb54b48],[3.35,.050,0x34677c],[4.46,.056,0xf9eed5]]){
   this.surface(l,l+w,c,.009);
  }
  this.surface(4.55,4.74,0x2b6272,.013);
  for(const [a,b,c] of [[-.22,0,0x252939],[0,.24,0xfff1d1]]){
   for(let i=0;i<17;i++){
    const l=-.36+i*.287,m=this.paint(i%2?c:c===0x252939?0xfff1d1:0x252939).clone();m.side=T.DoubleSide;
    this.mesh(this.scene,ribbon(a,b,l,l+.287,1,.017),m);
   }
  }
  const floor=this.box(this.scene,82,.32,58,this.paint(0x6f9aa3).clone(),0,-.26,0,false);this.floor=floor.material;
  this.box(this.scene,30,.034,15.7,this.paint(0x527b86),0,-.079,0,false);
  this.box(this.scene,23,.04,.075,this.paint(0x79aeb3),0,-.04,5.16,false);
  this.box(this.scene,23,.04,.075,this.paint(0x79aeb3),0,-.04,-5.16,false);
 }
 batch(list){
  const groups=new Map(),dummy=new T.Object3D();
  for(const o of list){const k=o.size.join();if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o)}
  for(const [k,items] of groups){
   const geo=this.geo('batch/'+k,()=>new T.BoxGeometry(...items[0].size));
   const m=new T.MeshStandardMaterial({roughness:.82});
   const batch=new T.InstancedMesh(geo,m,items.length);
   items.forEach((o,i)=>{
    dummy.position.set(o.x,o.y,o.z);dummy.rotation.set(0,o.a||0,0);dummy.scale.setScalar(1);dummy.updateMatrix();
    batch.setMatrixAt(i,dummy.matrix);batch.setColorAt(i,new T.Color(o.c).convertSRGBToLinear());
   });
   batch.instanceMatrix.needsUpdate=true;this.scene.add(batch);
  }
 }
 buildBowl(){
  const n=rand(42),o=[],add=(size,c,x,y,z,a=0)=>o.push({size,c,x,y,z,a});
  const crowd=[0xe26555,0xe6b34b,0x60a6ac,0x4b6aab,0xf0e0c1,0x829459,0x934e73,0x4e6b76];
  const skin=[0xe3aa80,0x9f6049,0xc28664,0xf1c096,0x80523e];
  for(let i=0;i<95;i++){
   const d=i*LAP/95,t=track(d,5.1),a=Math.atan2(t.tx,t.tz);
   add([.16,1.24,.16],0xe8e2cc,t.x,t.y+.61,t.z,a);
   add([.102,.13,1.65],0xbfc7be,t.x,t.y+1.13,t.z,a);
   add([.075,.078,1.62],0x5b8c95,t.x,t.y+.64,t.z,a);
   for(let row=0;row<6;row++){
    const u=track(d,6.02+row*.84),y=1.90+row*.68;
    add([.88,.49,1.76],row%2?0x6998a6:0x507d90,u.x,y-.28,u.z,a);
    if(i%11===0)continue;
    for(const along of [-.43,.43]){
     const x=u.x+u.tx*along,z=u.z+u.tz*along,j=Math.floor(n()*crowd.length);
     if(n()<.043)continue;
     add([.47,.37,.53],crowd[j],x,y+.21,z,a);
     add([.24,.26,.25],skin[Math.floor(n()*skin.length)],x,y+.54,z,a);
     add([.252,.064,.266],n()<.5?0x322d36:crowd[(j+2)%crowd.length],x,y+.696,z,a);
     add([.36,.11,.34],0x24485d,x-u.nx*.18,y-.02,z-u.nz*.18,a);
    }
   }
   if(i%5===0){
    const r=track(d,12.4);
    add([.34,8.5,.32],0xc3d1c9,r.x,5.38,r.z,a);
    add([.47,.28,4.05],0xd5d8c8,r.x,9.30,r.z,a);
    const f=track(d,8.2);
    add([.20,.19,1.90],0xf9eac9,f.x,8.63,f.z,a);
   }
  }
  this.batch(o);
  const wall=this.paint(0x94bdc8).clone();this.wall=wall;
  for(const z of [-26,26]){
   this.box(this.scene,82,14.5,.38,wall,0,6.4,z,false);
   for(let i=-9;i<=9;i++){
    this.box(this.scene,3.12,3.15,.038,this.paint(0xb6dce3),i*4.18,9.0,z-Math.sign(z)*.24,false);
    this.box(this.scene,.13,3.24,.056,this.paint(0xe2e8d6),i*4.18,9.0,z-Math.sign(z)*.28,false);
   }
  }
  for(const x of [-42,42])this.box(this.scene,.36,14.5,52,wall,x,6.4,0,false);
  for(let i=-5;i<=5;i++){
   this.box(this.scene,.26,.27,50,this.paint(0xd4d7c5),i*6.8,12,0,false);
   this.box(this.scene,3.82,.12,.22,this.paint(0xe0deca),i*6.8,12.15,0,false);
  }
  const signs=[['HARBOR VELO','TRACK SERIES   /   01'],['FIND YOUR LINE','VELODROME  FINALS'],['RIDE THE BANK','TRACK  CYCLING   /   LIVE']];
  for(let i=0;i<signs.length;i++){
   const tex=this.texture(graphic(...signs[i],['#174f63','#214662','#6b4b54'][i],'#f4d39d'));
   for(const z of [-23,23]){
    const b=this.board(this.scene,tex,7.6,2.53,(i-1)*13,7.6,z);
    b.rotation.y=z>0?Math.PI:0;
   }
  }
 }
 buildInfield(){
  const n=rand(80),o=[];
  const stand=(x,z,rot=0)=>{
   const g=this.group(this.scene,x,0,z);g.rotation.y=rot;
   this.box(g,1.78,.18,1.04,this.paint(0x244859),0,.09,0);
   this.box(g,1.63,.075,.94,this.paint(0x779fa6),0,.213,0);
   for(const a of [-.62,.62])this.box(g,.09,.72,.09,this.paint(C.steel),a,.61,-.29);
   this.box(g,1.42,.50,.085,this.paint(0x25414c),0,.85,-.30);
   this.box(g,1.27,.34,.04,this.paint(0x64a1a7),0,.88,-.24);
   const light=this.box(g,.20,.078,.052,this.paint(0xe9bb6d),.4,.79,-.207);light.rotation.z=.04;
  };
  stand(-5.4,5.9,.13);stand(5.7,-5.7,Math.PI);stand(14.3,1.1,-.42);stand(-15.9,-.2,.7);
  const tunnel=this.group(this.scene,-9.1,.07,6.45);
  this.box(tunnel,3.56,.06,2.82,this.paint(0xb75142),0,.004,0);
  const s=this.paint(0x234e64),a=this.paint(0xc9ab6a);
  for(const x of [-1.62,1.62]){
   this.box(tunnel,.26,2.55,.28,s,x,1.28,-.57);
   this.box(tunnel,.35,.15,.36,a,x,.11,-.57);
  }
  this.box(tunnel,3.60,.43,.26,s,0,2.58,-.57);
  const sign=this.texture(graphic('RIDER ENTRY','VELODROME   /   FINALS','#194556','#f0d29d'));
  this.board(tunnel,sign,2.58,.44,0,2.59,-.423);
  for(let i=0;i<22;i++){
   const x=(n()-.5)*42,z=(n()-.5)*14;if(Math.abs(x)<5&&Math.abs(z)<4)continue;
   o.push({size:[.48,.37,.43],x,y:.18,z,c:i%2?0x325968:0xc69455,a:n()*TAU});
  }
  this.batch(o);
 }
 buildPodium(){
  const p=this.group(this.scene,0,0,0);this.podium=p;
  this.box(p,7.9,.19,4.1,this.paint(0x2e596b),0,.04,0);
  const h=[1.08,.78,.56],x=[0,-1.72,1.72];
  for(let i=0;i<3;i++){
   this.box(p,1.58,h[i],1.50,this.paint([0xcea75c,0xb7c6c9,0xc48763][i]),x[i],h[i]/2+.125,0);
   const tex=this.texture(drawCanvas(192,192,c=>{c.fillStyle='#213f51';c.fillRect(0,0,192,192);c.font='900 142px sans-serif';c.textAlign='center';c.fillStyle='#ffe6ab';c.fillText(i+1,96,147)}));
   this.board(p,tex,.48,.48,x[i],.32+h[i]*.28,.764);
  }
  for(const x of [-2.95,2.95]){
   this.box(p,.10,3.55,.10,this.paint(C.steel),x,1.80,-1.4);
   this.box(p,.61,.071,.55,this.paint(C.navy),x,.14,-1.4);
  }
  this.board(p,this.texture(graphic('VELODROME','FINALS    /    MEDAL CEREMONY','#23506b','#f4cf87')),5.95,1.98,0,2.97,-1.43);
  const shades=[0xf2ba62,0xffebc3,0xe57757,0x7bd6bf];
  const flakes=new T.InstancedMesh(new T.BoxGeometry(.061,.109,.018),new T.MeshBasicMaterial(),54);
  flakes.frustumCulled=false;for(let i=0;i<54;i++)flakes.setColorAt(i,new T.Color(shades[i%4]));
  this.flakes=flakes;this.flakePose=new T.Object3D();p.add(flakes);p.visible=false;
 }
 moveConfetti(t){
  const o=this.flakePose;
  for(let i=0;i<this.flakes.count;i++){
   const a=(i*11.647+t*(.61+i%4*.10)),f=(t*(.72+i%8*.033)+i*.153)%4.5;
   o.position.set(((i*17)%53/53-.5)*6.1+Math.sin(a)*.38,4.47-f,.80+(i%11)*.105);
   o.rotation.set(a*.61,a*.84,a);o.updateMatrix();this.flakes.setMatrixAt(i,o.matrix);
  }
  this.flakes.instanceMatrix.needsUpdate=true;
 }
 pack(parent,keep=new Set()){
  const buckets=new Map();
  for(const o of parent.children){
   if(!o.isMesh||o.isInstancedMesh||keep.has(o)||o.material.transparent)continue;
   const a=buckets.get(o.material)||[];a.push(o);buckets.set(o.material,a);
  }
  const v=vec(),n=vec(),nm=new T.Matrix3();
  for(const [material,items] of buckets){
   if(items.length<2)continue;
   const pos=[],normal=[],uv=[];
   for(const o of items){
    o.updateMatrix();nm.getNormalMatrix(o.matrix);
    const g=o.geometry,a=g.attributes,ids=g.index,count=ids?ids.count:a.position.count;
    for(let i=0;i<count;i++){
     const j=ids?ids.getX(i):i;
     v.fromBufferAttribute(a.position,j).applyMatrix4(o.matrix);
     n.fromBufferAttribute(a.normal,j).applyNormalMatrix(nm);
     pos.push(v.x,v.y,v.z);normal.push(n.x,n.y,n.z);uv.push(a.uv.getX(j),a.uv.getY(j));
    }
    parent.remove(o);
   }
   const g=new T.BufferGeometry();
   g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeBoundingSphere();
   this.mesh(parent,g,material);
  }
 }
 wheel(parent,z){
  const g=this.group(parent,0,.405,z),rim=this.paint(0xe7bd78,.31,.52),metal=this.paint(0x8babb6,.37,.44);
  for(const [r,t,m] of [[.370,.038,this.paint(C.tire)],[.328,.018,rim]]){
   const torus=this.mesh(g,this.geo('torus'+r,()=>new T.TorusGeometry(r,t,7,26)),m);
   torus.rotation.y=Math.PI/2;
  }
  for(let i=0;i<8;i++){
   const a=i*TAU/8;this.tube(g,vec(0,0,0),vec(0,Math.cos(a)*.319,Math.sin(a)*.319),.010,metal);
  }
  this.cyl(g,.062,.062,.13,this.paint(C.steel),0,0,0,10).rotation.z=Math.PI/2;
  return g;
 }
 makeRider(team,i){
  const root=this.group(this.scene),bike=this.group(root),person=this.group(root);
  const kit=this.paint(team.ink,.55).clone(),trim=this.paint(team.trim),cloth=this.paint(0x233344),shoe=this.paint(0xe5ddd0),
   skin=this.paint(team.skin),black=this.paint(C.black),visor=this.paint(0x235a76,.29,.29),hi=this.paint(0x88cbd2,.38,.22),met=this.paint(C.steel,.41,.42),shell=this.paint(team.ink,.35).clone();
  const front=this.wheel(bike,.67),rear=this.wheel(bike,-.65);
  const bb=vec(0,.51,-.09),seat=vec(0,1.01,-.30),head=vec(0,.91,.42);
  for(const [a,b,r] of [[bb,seat,.053],[seat,head,.047],[bb,head,.058],[bb,vec(0,.405,-.65),.037],[seat,vec(0,.405,-.65),.037],[head,vec(0,.405,.67),.044]]){
   this.tube(bike,a,b,r,shell);
  }
  this.tube(bike,seat,vec(0,1.12,-.31),.025,met);
  this.box(bike,.17,.06,.31,black,0,1.12,-.31);
  this.tube(bike,head,vec(0,1.065,.55),.038,met);
  this.tube(bike,vec(-.25,1.065,.57),vec(.25,1.065,.57),.035,black);
  for(const x of [-.25,.25])this.tube(bike,vec(x,1.07,.55),vec(x,1.00,.71),.03,black);
  this.cyl(bike,.108,.108,.047,met,.104,.51,-.09,20).rotation.z=Math.PI/2;
  this.tube(bike,vec(.112,.49,-.15),vec(.112,.40,-.66),.014,black);
  const crank=this.group(bike,0,.51,-.09);
  for(const x of [-.167,.167]){
   this.tube(crank,vec(x,0,0),vec(x,0,x>0?.172:-.172),.026,met);
   this.box(crank,.113,.034,.073,black,x,0,x>0?.172:-.172);
  }
  this.box(bike,.036,.055,.24,trim,0,.71,.22).rotation.x=-.52;
  const hips=this.box(person,.43,.22,.29,cloth,0,1.17,-.30);
  const chest=this.group(person,0,1.41,-.17);
  this.box(chest,.51,.42,.30,kit);
  this.box(chest,.519,.10,.310,trim,0,-.035,0);
  this.box(chest,.14,.28,.017,cloth,0,-.012,.153);
  this.board(chest,this.texture(badge(team)),.215,.215,0,-.024,-.157).rotation.y=Math.PI;
  this.box(chest,.065,.063,.016,trim,.14,.11,.162);
  const headGroup=this.group(person,0,1.75,.03);
  this.box(headGroup,.339,.333,.325,skin,0,0,0);
  this.box(headGroup,.365,.115,.352,black,0,.079,-.017);
  this.box(headGroup,.396,.158,.392,shell,0,.153,-.015);
  this.box(headGroup,.308,.055,.294,shell,0,.252,-.035);
  this.box(headGroup,.094,.038,.303,trim,0,.283,-.04);
  for(const x of [-.113,.113]){
   this.box(headGroup,.039,.021,.143,black,x,.282,-.09);
   this.box(headGroup,.060,.083,.074,skin,x*1.50,-.022,.026);
   this.box(headGroup,.033,.116,.062,black,x*1.53,.006,.026).rotation.z=x*.80;
   this.box(headGroup,.110,.091,.028,visor,x*.67,.021,.177);
   this.box(headGroup,.078,.017,.009,hi,x*.67-.009,.049,.194);
  }
  this.box(headGroup,.039,.048,.040,skin,0,-.042,.183);
  this.box(headGroup,.072,.015,.016,black,0,-.091,.171);
  this.box(headGroup,.368,.032,.068,trim,0,.100,.172);
  const arms=[],legs=[];
  for(const side of [-1,1]){
   const upper=this.box(person,.145,1,.145,kit);
   const elbow=this.box(person,.121,1,.124,skin);
   const cuff=this.box(person,.13,.074,.121,cloth);
   const hand=this.box(person,.13,.105,.123,black);
   const thigh=this.box(person,.168,1,.172,cloth);
   const calf=this.box(person,.128,1,.135,skin);
   const sock=this.box(person,.14,.093,.14,trim);
   const foot=this.box(person,.151,.087,.233,shoe);
   this.box(foot,.155,.022,.239,black,0,-.041,0);
   arms.push({side,upper,elbow,cuff,hand});legs.push({side,thigh,calf,sock,foot});
  }
  const medal=this.cyl(chest,.064,.064,.025,this.paint(0xf2bb4c,.32,.38),0,-.10,.178,14);
  medal.rotation.x=Math.PI/2;medal.visible=false;
  const shadow=this.mesh(root,new T.PlaneGeometry(1.05,1.98),new T.MeshBasicMaterial({
   map:this.shadowTex??=this.texture(drawCanvas(64,64,c=>{
    const d=c.createRadialGradient(32,32,1,32,32,31);d.addColorStop(0,'#1e182876');d.addColorStop(1,'#18122200');c.fillStyle=d;c.fillRect(0,0,64,64);
   })),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3
  }),0,.025,0);
  shadow.rotation.x=-Math.PI/2;
  for(const node of [bike,front,rear,crank,chest,headGroup])this.pack(node,new Set([medal]));
  return {root,bike,person,front,rear,crank,kit,shell,hips,chest,head:headGroup,arms,legs,medal,shadow};
 }
 bone(mesh,a,b){
  const d=b.clone().sub(a);mesh.position.copy(a).addScaledVector(d,.5);mesh.scale.y=d.length()+.035;mesh.quaternion.setFromUnitVectors(up,d.normalize());
 }
 joint(a,b,prefer,bend){
  const d=b.clone().sub(a).normalize();
  const n=prefer.clone().addScaledVector(d,-prefer.dot(d)).normalize();
  return a.clone().lerp(b,.50).addScaledVector(n,bend);
 }
 pose(a,phase,style,t){
  const ride=style==='ride',award=style==='award',p=ride?phase:t*5;
  a.bike.visible=ride;a.medal.visible=award;a.shadow.visible=true;
  a.crank.rotation.x=-p;
  a.hips.position.set(0,ride?1.158:.91,ride?-.30:0);
  a.chest.position.set(0,ride?1.401:1.218,ride?-.132:0);
  a.chest.rotation.x=ride?.52:0;
  a.head.position.set(0,ride?1.694:1.608,ride?.022:0);
  a.head.rotation.set(ride?-.105:0,award?.12*Math.sin(t*3):0,0);
  for(const {side,upper,elbow,cuff,hand} of a.arms){
   const from=vec(side*.267,ride?1.51:1.355,ride?-.055:0);
   const to=ride?vec(side*.247,1.078,.597):award?vec(side*.54,1.76+.10*Math.sin(t*4+side),.12):vec(side*.315,1.06,.14*Math.sin(p)*side);
   const j=this.joint(from,to,ride?vec(side*.44,-1,.13):vec(side*.42,-.22,.34),ride?.145:.11);
   this.bone(upper,from,j);this.bone(elbow,j,to);hand.position.copy(to);cuff.position.copy(j).lerp(to,.80);
  }
  for(const {side,thigh,calf,sock,foot} of a.legs){
   const from=vec(side*.15,ride?1.13:.906,ride?-.277:0);
   const k=side===1?p:p+Math.PI;
   const to=ride?vec(side*.171,.562+Math.sin(k)*.172,-.09+Math.cos(k)*.172):vec(side*.15,.105+Math.max(0,Math.sin(k))*.10,Math.cos(k)*.16);
   const j=this.joint(from,to,vec(side*.18,0,1),ride?.209:.065);
   this.bone(thigh,from,j);this.bone(calf,j,to);sock.position.copy(j).lerp(to,.89);
   foot.position.copy(to);foot.position.z+=.038;foot.rotation.x=ride?.12*Math.cos(k):0;
  }
 }
 resize(){
  const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;
  this.r.setPixelRatio(Math.min(devicePixelRatio||1,1.45));this.r.setSize(w,h,false);
  this.cam.aspect=w/h;this.cam.updateProjectionMatrix();
 }
 venue(cup){
  if(cup===this.tone)return;
  this.tone=cup;const v=VARIANTS[cup];
  this.scene.background=new T.Color(v.sky).convertSRGBToLinear();
  this.scene.fog.color.copy(this.scene.background);
  this.hemi.color.setHex(v.ambient);this.key.color.setHex(v.sun);
  this.wall.color.setHex(v.wall).convertSRGBToLinear();this.floor.color.setHex(v.infield).convertSRGBToLinear();
 }
 draw(r,p,mode,now){
  this.venue(r.cup);
  if(p.kit!==this.currentKit){
   this.currentKit=p.kit;
   for(const m of [this.actors[0].kit,this.actors[0].shell])m.color.setHex(KITS[p.kit]||KITS.coral).convertSRGBToLinear();
  }
  if(mode!==this.mode){this.mode=mode;this.cameraReady=false;this.clock=now}
  const t=(now-this.clock)/1000;
  for(const a of this.actors)a.root.visible=false;
  const player=r.riders[0],d=player.d,b=track(d,player.lane);
  this.podium.visible=mode==='podium';
  let eye,aim;
  if(mode==='podium'){
   const list=sorted(r).slice(0,3);
   list.forEach((rider,i)=>{
    const a=this.actors[rider.id];a.root.visible=true;a.root.position.set([0,-1.72,1.72][i],[1.205,.905,.685][i],0);
    a.root.rotation.set(0,0,0);this.pose(a,rider.pedal,'award',t);
   });
   eye=vec(.14+Math.sin(t*.45)*.42,3.16,10.72);aim=vec(0,1.66,0);
   this.moveConfetti(t);
  }else if(mode==='entry'){
   const advance=Math.min(1,t/2.9),x=-9.10;
   for(let i=0;i<3;i++){
    const a=this.actors[i];a.root.visible=true;a.root.position.set(x+(i-1)*.91,.1,5.77+advance*.93-i*.45);
    a.root.rotation.set(0,.02,0);this.pose(a,0,'walk',t);
   }
   eye=vec(-7.53-Math.sin(t*.49)*.72,2.15,9.80);aim=vec(-9.37,1.26,6.03+advance*.5);
  }else{
   for(const rider of r.riders){
    const a=this.actors[rider.id],q=track(rider.d,rider.lane);
    const gap=Math.abs(rider.d-d);
    if(rider.id&&gap>38&&gap<LAP-38)continue;
    a.root.visible=true;a.root.position.set(q.x,q.y+.018,q.z);a.root.rotation.set(0,Math.atan2(q.tx,q.tz),0,'YXZ');
    a.root.rotation.z=-q.curve*(r.phase==='ready'?.08:.28)*Math.min(1,rider.speed/8);
    a.front.rotation.x=-rider.d/.37;a.rear.rotation.x=-rider.d/.37;this.pose(a,rider.pedal,'ride',t);
   }
   if(mode==='grid'){
    eye=vec(b.x+b.tx*1.48-b.nx*4.05,b.y+2.22,b.z+b.tz*1.48-b.nz*4.05);
    aim=vec(b.x+b.tx*.37,b.y+1.1,b.z+b.tz*.37);
   }else{
    eye=vec(b.x-b.tx*4.35+b.nx*.66,b.y+2.33,b.z-b.tz*4.35+b.nz*.66);
    const a=track(d+4.3,player.lane);
    aim=vec(a.x,a.y+1.10,a.z);
   }
  }
  if(!this.cameraReady){this.cam.position.copy(eye);this.look.copy(aim);this.cameraReady=true}
  else{this.cam.position.lerp(eye,.35);this.look.lerp(aim,.35)}
  this.cam.lookAt(this.look);
  this.r.render(this.scene,this.cam);
 }
}



