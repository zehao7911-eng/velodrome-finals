export const STRAIGHT=32,RADIUS=11,ARC=Math.PI*RADIUS,LAP=2*(STRAIGHT+ARC);
export const CUPS=[
 {name:'Harbor Open',heat:2,final:3,pace:0,short:'HARBOR'},
 {name:'Sundown Cup',heat:3,final:3,pace:.28,short:'SUNDOWN'},
 {name:'Midnight Finals',heat:3,final:4,pace:.54,short:'MIDNIGHT'}
];
export const TEAMS=[
 {name:'You',ink:0xef5b47,trim:0xffe6b1,skin:0xc8875e,number:7},
 {name:'Mika',ink:0x4abfae,trim:0xddf5d7,skin:0x945437,number:21},
 {name:'Jules',ink:0x587ee0,trim:0xf3ecb9,skin:0xebac81,number:16},
 {name:'Sol',ink:0xe4a443,trim:0x2c4150,skin:0x915b45,number:32},
 {name:'Noor',ink:0x9669c9,trim:0xf3e0f0,skin:0xbb795a,number:12},
 {name:'Rio',ink:0x6f9e52,trim:0xe4edd2,skin:0xe8af8d,number:9}
];
export const KITS={coral:0xef5b47,mint:0x32b58c,champion:0xf8b739,lilac:0x9564d7,sunset:0xdc5c95};
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n)), mod=(n,d)=>((n%d)+d)%d;
const number=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
export const gridStart=8.4;
export function track(d,lane=0){
 const u=mod(d+gridStart,LAP),h=STRAIGHT/2;
 let x,z,tx,tz,nx,nz,curve=0;
 if(u<STRAIGHT){x=u-h;z=RADIUS;tx=1;tz=0;nx=0;nz=1}
 else if(u<STRAIGHT+ARC){
  const a=(u-STRAIGHT)/RADIUS;x=h+RADIUS*Math.sin(a);z=RADIUS*Math.cos(a);
  tx=Math.cos(a);tz=-Math.sin(a);nx=Math.sin(a);nz=Math.cos(a);curve=Math.min(1,Math.sin(a)*4.1);
 }else if(u<2*STRAIGHT+ARC){x=h-(u-STRAIGHT-ARC);z=-RADIUS;tx=-1;tz=0;nx=0;nz=-1}
 else{
  const a=(u-2*STRAIGHT-ARC)/RADIUS;x=-h-RADIUS*Math.sin(a);z=-RADIUS*Math.cos(a);
  tx=-Math.cos(a);tz=Math.sin(a);nx=-Math.sin(a);nz=-Math.cos(a);curve=Math.min(1,Math.sin(a)*4.1);
 }
 const slope=.076+.41*curve;
 return {x:x+nx*lane,y:.15+lane*slope,z:z+nz*lane,tx,tz,nx,nz,curve,slope};
}
export function profile(v){
 return {medals:CUPS.map((_,i)=>Number.isInteger(v?.medals?.[i])?clamp(v.medals[i],0,3):0),
  best:CUPS.map((_,i)=>number(v?.best?.[i],1,240)?v.best[i]:0),
  kit:Object.hasOwn(KITS,v?.kit)?v.kit:'coral',lilac:v?.lilac===true,sunset:v?.sunset===true,mute:v?.mute===true};
}
export function merge(p,q){
 return {...p,medals:p.medals.map((n,i)=>Math.max(n,q.medals[i])),
  best:p.best.map((n,i)=>n&&q.best[i]?Math.min(n,q.best[i]):n||q.best[i]),lilac:p.lilac||q.lilac,sunset:p.sunset||q.sunset};
}
export const unlocked=p=>p.medals[0]?(p.medals[1]?2:1):0;
export const available=(p,k)=>k==='coral'||(k==='mint'&&p.medals.some(Boolean))||(k==='champion'&&p.medals.includes(3))||(k==='lilac'&&p.lilac)||(k==='sunset'&&p.sunset);
const AI=[
 {pace:0,lane:1.36},{pace:1.02,lane:1.40},{pace:.61,lane:2.91},
 {pace:.41,lane:.62},{pace:.75,lane:2.13},{pace:.18,lane:3.67}
];
export function newRace(cup=0,round='heat',ids=[0,1,2,3,4,5]){
 const laps=CUPS[cup][round],lanes=[1.38,1.38,2.91,.62,2.13,3.67];
 return {cup,round,laps,phase:'ready',count:3,time:0,energy:100,spent:0,fatigued:false,place:0,
  riders:ids.map((id,i)=>({id,d:i===0?-2.42:i===1?-.15:-1.1-Math.floor((i-1)/2)*1.42,speed:0,lane:lanes[id],pedal:0,finish:0})),draft:false,boost:false};
}
export const total=r=>r.laps*LAP;
export const sorted=r=>[...r.riders].sort((a,b)=>a.finish&&b.finish?a.finish-b.finish:a.finish?-1:b.finish?1:b.d-a.d||a.id-b.id);
export const rank=r=>sorted(r).findIndex(r=>r.id===0)+1;
export const qualified=r=>r.round==='heat'&&r.phase==='result'&&r.place<=4;
export function start(r){if(r.phase!=='ready')return false;r.phase='countdown';r.count=3;return true}
export function finalFrom(r){return qualified(r)?newRace(r.cup,'final',[0,...sorted(r).filter(a=>a.id!==0).slice(0,3).map(a=>a.id)]):null}
export function step(r,dt,hold=false){
 if(r.phase==='countdown'){
  r.count=Math.max(0,r.count-dt);
  if(r.count<=1e-6){r.phase='race';return 'go'}return '';
 }
 if(r.phase!=='race')return '';
 r.time+=dt;
 const you=r.riders[0],course=track(you.d,you.lane),straight=course.curve<.42;
 const leaders=r.riders.slice(1).filter(a=>a.d>you.d+.95&&a.d<you.d+8.0&&Math.abs(a.lane-you.lane)<1.14);
 r.draft=leaders.length>0;
 if(r.fatigued&&r.energy>=24)r.fatigued=false;
 r.boost=hold&&!r.fatigued&&r.energy>0;
 if(!you.finish){
  r.energy=clamp(r.energy+dt*(r.boost?-(straight?16:25):(r.draft?23:straight?10.5:14.2)),0,100);
  if(r.boost)r.spent+=dt;
  if(r.energy===0){r.fatigued=true;r.boost=false}
 }
 for(const a of r.riders){
  const human=a.id===0,q=track(a.d,a.lane),c=q.curve,model=AI[a.id],late=clamp((a.d/total(r)-.72)*3.5,0,1);
  let desired=human?(a.finish?9.7:10.08+(r.draft?.69:0)-c*.18+(r.boost?3.7-c*1.65:0)-(r.fatigued?.76:0)):
   10.36+model.pace+CUPS[r.cup].pace+(r.round==='final'?.24:0)-c*.37+Math.sin(r.time*.82+a.id*1.8)*.26+late*.36;
  let lane=model.lane;
  if(human){
   lane=1.39;
   const near=r.riders.find(b=>b.id&&Math.abs(b.d-a.d)<1.9&&Math.abs(b.lane-lane)<.62);
   if(near)lane=near.lane+.82;
  }else{
   lane+=Math.sin(r.time*.50+a.id)*.10;
   if(a.id===1&&Math.abs(you.d-a.d)<1.42&&you.lane>1.65)lane=1.21;
  }
  a.lane+=(lane-a.lane)*Math.min(1,dt*5.3);
  a.speed+=(desired-a.speed)*Math.min(1,dt*(human?2.55:1.7));
  const before=a.d;
  a.d+=a.speed*dt;
  a.pedal=mod(a.pedal+a.speed*dt*1.08,2*Math.PI);
  if(a.d>=total(r)&&!a.finish)a.finish=r.time-dt+dt*(total(r)-before)/(a.d-before);
 }
 if(you.finish&&r.riders.every(a=>a.finish)){
  r.place=rank(r);r.phase='result';r.boost=false;r.draft=false;return 'finish';
 }
 return '';
}
export function settle(r,p){
 if(r.round!=='final'||r.phase!=='result')return false;
 const old=p.medals[r.cup];
 p.medals[r.cup]=Math.max(old,Math.max(0,4-r.place));
 const t=r.riders[0].finish;
 p.best[r.cup]=p.best[r.cup]?Math.min(p.best[r.cup],t):t;
 return p.medals[r.cup]>old;
}
export function restore(v,p){
 if(!v||!Number.isInteger(v.cup)||v.cup<0||v.cup>unlocked(p)||!['heat','final'].includes(v.round)||!['ready','countdown','race','result'].includes(v.phase))return null;
 if(v.laps!==CUPS[v.cup][v.round]||!number(v.count,0,3)||!number(v.time,0,240)||!number(v.energy,0,100)||!number(v.spent,0,v.time+.01)||typeof v.fatigued!=='boolean')return null;
 if(!Array.isArray(v.riders)||v.riders.length!==(v.round==='heat'?6:4)||v.riders[0]?.id!==0||new Set(v.riders.map(a=>a?.id)).size!==v.riders.length)return null;
 if(v.riders.some(a=>!a||!Number.isInteger(a.id)||a.id<0||a.id>=6||!number(a.d,-5,total(v)+300)||!number(a.speed,0,20)||!number(a.lane,0,4.5)||!number(a.pedal,0,2*Math.PI)||!number(a.finish,0,v.time+.01)))return null;
 if(v.phase==='result'&&(v.riders.some(a=>!a.finish)||v.place!==rank(v)))return null;
 if(v.phase!=='result'&&v.place!==0)return null;
 return {...v,riders:v.riders.map(a=>({...a})),boost:false,draft:false};
}

