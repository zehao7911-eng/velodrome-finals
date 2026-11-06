import {LAP,CUPS,TEAMS,KITS,profile,merge,unlocked,available,newRace,track,total,rank,sorted,qualified,start,step,finalFrom,settle,restore} from './core.mjs';
import {Arena} from './view.mjs';
import {VeloHost} from './sdk.mjs';

const $=id=>document.getElementById(id),key='velodrome-finals-v1';
const dialog=$('dialog'),panel=$('panel'),power=$('power'),canvas=$('scene');
const orientation=matchMedia('(orientation:landscape) and (max-height:540px)');
let saved;
try{saved=JSON.parse(localStorage.getItem(key))}catch{}
let p=profile(saved?.profile),r=restore(saved?.race,p)||newRace(unlocked(p));
if(!available(p,p.kit))p.kit='coral';
let arena,host,intro=!saved?.entered,pause=false,needsResume=r.phase==='race'||r.phase==='countdown',hasLocal=!!saved?.race;
let pointer=null,keyboard=false,support={},modal='',audio,notice='',noticeAt=0,lastRank=0,previousLap=0,previousCount=0,finishAnnounced=!!r.riders[0].finish;
let oldHud='',rendered=0,clock=performance.now(),acc=0;
try{arena=new Arena(canvas)}catch(e){console.error('3D arena failed',e);$('error').hidden=false;$('intro').hidden=true}
function packet(){return {game:'velodrome-finals',v:1,profile:p,race:r,entered:!intro}}
function save(cloud=true){
 hasLocal=true;try{localStorage.setItem(key,JSON.stringify(packet()))}catch{}
 if(cloud)host?.save(packet());
}
function sound(kind){
 if(p.mute)return;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;audio??=new AC();if(audio.state==='suspended')audio.resume().catch(()=>{});
  const events={tick:[340],go:[600,895],pass:[530,784],lap:[440,662],end:[440,554,660,881],line:[550,733,990],press:[225],low:[160,110]};
  for(const [i,f] of events[kind].entries()){
   const t=audio.currentTime+i*.07,osc=audio.createOscillator(),g=audio.createGain();
   osc.type=kind==='press'?'triangle':'sine';osc.frequency.setValueAtTime(f,t);osc.frequency.exponentialRampToValueAtTime(f*.88,t+.16);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.10,t+.009);g.gain.exponentialRampToValueAtTime(.0001,t+.18);
   osc.connect(g).connect(audio.destination);osc.start(t);osc.stop(t+.19);
  }
 }catch{}
}
function call(text,duration=1){
 notice=text;noticeAt=performance.now()+duration*1000;
}
function release(){
 pointer=null;keyboard=false;r.boost=false;power.classList.remove('held');$('speedFx').classList.remove('on');
}
function statusText(){
 const a=r.riders[0];
 if(a.finish)return ['FINISHED','Waiting for the field'];
 if(r.phase==='countdown')return ['GET READY','Hold on the start signal'];
 if(r.fatigued)return ['RECOVER','Ease off to refill'];
 if(r.boost)return ['SPRINT','Release before empty'];
 if(r.draft)return ['IN THE SLIPSTREAM','Stamina recovers faster'];
 if(track(a.d,a.lane).curve>.42)return ['BANKED TURN','Ease off in the bend'];
 return ['OPEN STRAIGHT','Hold to accelerate'];
}
function hud(now=performance.now()){
 if(!arena)return;
 const grid=!intro&&r.phase==='ready',live=r.phase==='race'||r.phase==='countdown',result=r.phase==='result';
 $('intro').hidden=!intro;$('grid').hidden=!grid&&!result;$('data').hidden=intro||grid;$('controls').hidden=intro||!live;
 const a=r.riders[0],lap=Math.max(1,Math.min(r.laps,Math.floor(a.d/LAP)+1)),pos=rank(r),energy=Math.round(r.energy);
 const [cue,sub]=statusText(),shown=r.phase==='countdown'?String(Math.max(1,Math.ceil(r.count))):now<noticeAt?notice:'';
 const progress=Math.min(1,Math.max(0,(a.d-(lap-1)*LAP)/LAP));
 const signature=[r.cup,r.round,r.phase,intro,lap,pos,Math.round((a.finish||r.time)*10),energy,cue,shown,r.boost,Math.round(progress*100)].join('|');
 if(signature===oldHud)return;oldHud=signature;
 $('seriesTag').textContent='TRACK SERIES / '+String(r.cup+1).padStart(2,'0');
 $('gridKicker').textContent=CUPS[r.cup].name.toUpperCase();
 $('gridTitle').textContent=result?'Race complete':r.round==='heat'?'Qualifying heat':'Championship final';
 $('gridText').textContent=result?'View your times and standings.':r.round==='heat'?r.laps+' laps · Top four advance':r.laps+' laps · Race for the podium';
 $('start').textContent=result?'View results →':'Start race →';
 $('rank').textContent=pos;$('field').textContent=' / '+r.riders.length;
 $('lapBar').style.transform='scaleX('+progress+')';
 $('lap').textContent=lap+' / '+r.laps;$('time').textContent=(a.finish||r.time).toFixed(1)+' s';
 $('energyText').textContent=energy+'%';$('energyBar').style.transform='scaleX('+energy/100+')';$('energyBar').classList.toggle('low',energy<27);
 $('meter').setAttribute('aria-valuenow',String(energy));
 $('sprintArc').style.strokeDasharray=energy+' 100';power.dataset.low=String(energy<27);
 $('drive').dataset.tone=cue==='IN THE SLIPSTREAM'?'draft':cue==='SPRINT'?'sprint':cue==='RECOVER'?'recover':'idle';
 $('cue').textContent=cue;$('cueSub').textContent=sub;
 const banner=$('call');banner.dataset.style=r.phase==='countdown'||shown==='GO!'?'signal':'chip';
 if(banner.textContent!==shown)banner.textContent=shown;
 power.disabled=!!a.finish;power.classList.toggle('held',r.boost);$('speedFx').classList.toggle('on',r.boost);
}
function open(kind,title,body){
 release();pause=true;modal=kind;
 dialog.classList.toggle('awards',kind==='result'&&r.round==='final'&&r.place<=3);
 const bar=document.createElement('div'),h=document.createElement('h2'),b=document.createElement('button');
 bar.className='panel-head';h.textContent=title;b.textContent='Close';b.onclick=()=>dialog.close();bar.append(h,b);
 panel.replaceChildren(bar,body);
 if(!dialog.open)dialog.showModal();
}
function actions(items){
 const row=document.createElement('div');row.className='actions';
 for(const [label,fn,accent] of items){const b=document.createElement('button');b.textContent=label;b.onclick=fn;if(accent)b.className='primary';row.append(b)}
 return row;
}
function text(value){const p=document.createElement('p');p.textContent=value;return p}
function setRace(next){
 host.end();r=next;intro=false;needsResume=false;noticeAt=0;release();lastRank=0;previousLap=0;previousCount=0;finishAnnounced=false;
 if(dialog.open)dialog.close();pause=false;save();oldHud='';hud();
}
function chooseCup(i){
 if(i>unlocked(p))return;
 if(r.phase==='race'||r.phase==='countdown'){
  const body=document.createElement('div');body.append(text('Leave this race and enter another cup?'),actions([['Keep racing',()=>dialog.close()],['Leave race',()=>setRace(newRace(i)),true]]));
  open('confirm','Change cup',body);return;
 }
 setRace(newRace(i));
}
function series(){
 const box=document.createElement('div'),cups=document.createElement('div');cups.className='cups';
 for(const [i,c] of CUPS.entries()){
  const b=document.createElement('button'),name=document.createElement('span'),medal=document.createElement('span');
  b.disabled=i>unlocked(p);name.textContent=c.name;medal.textContent=p.medals[i]?['','Bronze','Silver','Gold'][p.medals[i]]:b.disabled?'Locked':'Open';
  b.append(name,medal);b.onclick=()=>chooseCup(i);cups.append(b);
 }
 const kits=document.createElement('div');kits.className='kits';
 for(const [k,label] of [['coral','Coral'],['mint','Mint'],['champion','Gold'],['lilac','Lilac'],['sunset','Sunset']]){
  const b=document.createElement('button');b.textContent=label;b.disabled=!available(p,k);b.setAttribute('aria-pressed',String(p.kit===k));
  b.onclick=()=>{p.kit=k;save();series()};kits.append(b);
 }
 box.append(cups,text('Team kit · Mint for a podium, Gold for a win'),kits);
 const tips=[];if(support.lilac&&!p.lilac)tips.push('Like on GameWave to unlock Lilac.');if(support.sunset&&!p.sunset)tips.push('Leave a direct comment to unlock Sunset.');
 if(tips.length)box.append(text(tips.join(' ')));
 open('series','Track series',box);
}
function result(){
 const box=document.createElement('div'),list=document.createElement('ol');
 list.className='result-list';
 sorted(r).forEach((a,i)=>{
  const item=document.createElement('li');if(a.id===0)item.className='you';
  const number=document.createElement('span'),name=document.createElement('span'),time=document.createElement('span');
  number.textContent=String(i+1).padStart(2,'0');name.textContent=TEAMS[a.id].name;time.textContent=a.finish.toFixed(2)+' s';
  const jersey=a.id===0?KITS[p.kit]:TEAMS[a.id].ink;
  name.className='jersey';name.style.setProperty('--jersey','#'+jersey.toString(16).padStart(6,'0'));
  item.append(number,name,time);
  list.append(item);
 });
 const final=r.round==='final',top=qualified(r),medal=final&&r.place<=3;
 const title=medal?['','Gold medal','Silver medal','Bronze medal'][r.place]:top?'Qualified':final?'Final standings':'Heat standings';
 const note=top?'Top four advance to the final.':medal?'Personal best · '+p.best[r.cup].toFixed(2)+' s':final?'A podium finish opens the next cup.':'Finish in the top four to advance.';
 const items=[['Series',series],['Retry',()=>setRace(newRace(r.cup,r.round,r.riders.map(a=>a.id))),!top&&!medal]];
 if(top)items.push(['Race the final →',()=>setRace(finalFrom(r)),true]);
 else if(medal&&r.cup<CUPS.length-1)items.push(['Next cup →',()=>chooseCup(r.cup+1),true]);
 box.append(text(note),list,actions(items));open('result',title,box);
}
function openPause(){
 if(!arena)return;
 if(r.phase==='result'){result();return}
 const b=document.createElement('div');
 b.append(text('Hold SPRINT on the straight. Ease off in turns and behind a rider to recover stamina.'));
 b.append(actions([[p.mute?'Sound off':'Sound on',()=>{p.mute=!p.mute;save();openPause()}],['Resume',()=>dialog.close(),true]]));
 if(r.phase==='race'||r.phase==='countdown')save();
 open('pause','Race paused',b);
}
$('enter').onclick=()=>{intro=false;save();sound('press');hud()};
$('series').onclick=series;$('menu').onclick=openPause;
$('start').onclick=()=>{
 if(!arena||orientation.matches)return;
 if(r.phase==='result'){result();return}
 if(!start(r))return;
 host.start();previousCount=3;noticeAt=0;lastRank=rank(r);previousLap=1;save();sound('tick');hud();
};
power.addEventListener('pointerdown',e=>{
 if(!e.isPrimary||e.button!==0||pause||orientation.matches)return;
 e.preventDefault();pointer=e.pointerId;power.setPointerCapture(e.pointerId);sound('press');
});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])power.addEventListener(ev,e=>{if(pointer===e.pointerId)release()});
power.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!dialog.open){openPause();return}
 if(e.code!=='Space'||pause||orientation.matches||r.phase!=='race'||e.repeat)return;
 e.preventDefault();keyboard=true;
});
document.addEventListener('keyup',e=>{if(e.code==='Space')keyboard=false});
dialog.addEventListener('close',()=>{
 pause=false;modal='';acc=0;clock=performance.now();
 if(needsResume&&!orientation.matches){
  needsResume=false;lastRank=rank(r);previousLap=Math.max(1,Math.floor(r.riders[0].d/LAP)+1);previousCount=Math.ceil(r.count);host.start();
 }
 hud();
});
orientation.addEventListener('change',()=>{release();if(orientation.matches&&!dialog.open&&(r.phase==='race'||r.phase==='countdown'))openPause()});
window.addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){release();if(!dialog.open&&(r.phase==='race'||r.phase==='countdown'))openPause()}
});
host=new VeloHost(window,{
 reward:k=>{if(!['lilac','sunset'].includes(k)||p[k])return;p[k]=true;save();sound('end');if(modal==='series')series()},
 status:v=>{support=v;if(modal==='series')series()},
 load:v=>{
  p=merge(p,profile(v.profile));
  if(!hasLocal){
   const remote=restore(v.race,p);
   r=remote||newRace(unlocked(p));intro=v.entered!==true&&!remote;finishAnnounced=!!r.riders[0].finish;
   if(r.phase==='countdown'||r.phase==='race'){needsResume=true;openPause()}
   if(r.phase==='result'){intro=false;result()}
  }
  oldHud='';hud();save();
 }
});
host.poll();
window.addEventListener('pagehide',()=>{save();host.stop()});
window.addEventListener('pageshow',e=>{if(e.persisted){host.alive=true;host.sdk=null;host.loadSeen=new WeakSet();host.poll()}});
function sim(){
 const now=performance.now(),dt=Math.min(.12,(now-clock)/1000);clock=now;
 if(!arena||pause||orientation.matches||document.hidden||dialog.open)return;
 if(r.phase!=='countdown'&&r.phase!=='race')return;
 acc+=dt;
 while(acc>=1/60){
  acc-=1/60;const state=step(r,1/60,pointer!==null||keyboard);
  if(state==='go'){sound('go');call('GO!',.77)}
  if(state==='finish'){
   release();host.end();settle(r,p);save();sound('end');result();break;
  }
 }
 if(r.phase==='countdown'){
  const n=Math.ceil(r.count);
  if(n!==previousCount){previousCount=n;sound('tick')}
 }
 if(r.phase==='race'){
  const a=r.riders[0],pos=rank(r),lap=Math.max(1,Math.floor(a.d/LAP)+1);
  if(a.finish&&!finishAnnounced){finishAnnounced=true;call('FINISH',1.1);sound('line');navigator.vibrate?.(15)}
  else if(!a.finish&&lap>previousLap&&lap<=r.laps){call(lap===r.laps?'FINAL LAP':'LAP '+lap,.94);sound('lap');save();previousLap=lap}
  else if(lastRank&&pos<lastRank&&!a.finish&&r.time>1.2){call('OVERTAKE',.75);sound('pass');navigator.vibrate?.(12)}
  lastRank=pos;
 }
 hud(now);
}
function frame(now){
 requestAnimationFrame(frame);
 if(!arena||document.hidden||orientation.matches||now-rendered<1000/32)return;
 rendered=now;
 const mode=intro?'entry':r.phase==='ready'?'grid':r.phase==='result'&&r.round==='final'&&r.place<=3?'podium':'race';
 arena.draw(r,p,mode,now,pause||dialog.open);hud(now);
}
new ResizeObserver(()=>arena?.resize()).observe(canvas);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();release();pause=true;save();$('error').hidden=false});
if(arena){
 if(needsResume)openPause();else if(r.phase==='result'){intro=false;result()}
 hud();setInterval(sim,1000/60);requestAnimationFrame(frame);
}


