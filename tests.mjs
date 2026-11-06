import assert from 'node:assert/strict';
import {LAP,CUPS,profile,merge,unlocked,available,newRace,track,total,rank,qualified,start,step,finalFrom,settle,restore} from './core.mjs';
import {VeloHost} from './sdk.mjs';

let checks=0;
const check=(ok,label)=>{assert(ok,label);checks++};
const tick=1/60;
const clone=v=>JSON.parse(JSON.stringify(v));
const smart=(r)=>{
 const a=r.riders[0],straight=track(a.d,a.lane).curve<.34;
 return !r.fatigued&&(total(r)-a.d<26?r.energy>2:straight&&(r.energy>49||r.energy>22&&!r.draft&&rank(r)>2));
};
function run(r,rule){
 let draft=false,boost=false;
 for(let i=0;i<60*150&&r.phase!=='result';i++){
  step(r,tick,rule(r));draft ||= r.draft;boost ||= r.boost;
 }
 check(r.phase==='result'&&r.riders.every(a=>a.finish>0),'real all-rider finish');
 return {draft,boost};
}
const p=profile();
for(const [cup,c] of CUPS.entries()){
 check(unlocked(p)===cup,'cup unlock is sequential');
 const h=newRace(cup);
 check(h.riders.length===6&&h.laps===c.heat,'actual six-rider grid');
 check(start(h)&&!start(h),'one real round start');
 const evidence=run(h,smart);
 check(evidence.draft&&evidence.boost&&h.energy>=0&&h.energy<=100,'slipstream and sprint affect resource');
 check(qualified(h),'heat qualified by timing');
 const f=finalFrom(h);
 check(f.phase==='ready'&&f.riders.length===4&&f.laps===c.final,'four actual finalists with separate ready state');
 check(!!restore(clone(f),p),'final ready checkpoint survives reload');
 start(f);run(f,smart);
 check(f.place<=3&&settle(f,p),'podium earns a medal');
 const frozen=JSON.stringify(p);
 check(!settle(f,p)&&JSON.stringify(p)===frozen,'result settlement idempotent');
 check(!!restore(clone(f),p),'receipt survives reload');
}
check(unlocked(p)===2&&available(p,'mint')&&available(p,'champion'),'campaign and race kit progression');
const lose=newRace(2);start(lose);run(lose,()=>false);
check(!qualified(lose)&&!finalFrom(lose),'an unqualified result stays out of the final');
const tired=newRace();start(tired);let drained=false;
for(let i=0;i<990;i++){step(tired,tick,true);drained ||= tired.fatigued}
check(drained,'uncontrolled hold can exhaust stamina');
const saved=restore(clone(tired),p);
check(saved?.phase==='race'&&saved.time===tired.time&&!saved.boost,'moving checkpoint resets input safely');
check(!restore({...tired,riders:[]},p)&&!restore({...tired,energy:NaN},p),'malformed saves rejected');
const join=track(LAP),origin=track(0);
check(Math.hypot(join.x-origin.x,join.z-origin.z)<1e-8,'loop joins at finish mark');
check(merge(p,profile({sunset:true})).sunset,'merge keeps cosmetic and race progress');

const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function env(neonlib){const jobs=new Map();let id=0;return {neonlib,jobs,setTimeout(fn){jobs.set(++id,fn);return id},clearTimeout(id){jobs.delete(id)}}}
let starts=0,ends=0,off=0,like,comment,support={},count=0,records=[];
const hostEnv=env(),profileA=profile(),r=newRace();
const attach=()=>new VeloHost(hostEnv,{
 status:v=>support=v,reward:k=>{if(!profileA[k]){profileA[k]=true;count++}}
});
const h=attach();h.connect();check(!starts,'no SDK at startup');
if(start(r))h.start();
hostEnv.neonlib={};h.connect();
Object.assign(hostEnv.neonlib,{
 gameStart(){starts++},gameOver(){ends++},
 onLike:async cb=>{like=cb;return {code:0,data:{unsubscribe(){off++}}}},
 onComment:async cb=>{comment=cb;return {code:0,data:{unsubscribe(){off++}}}},
 loadUserGameState:async()=>({}),saveUserGameState:async v=>{records.push(v)}
});
h.connect();await flush();
check(starts===1&&support.lilac&&support.sunset,'late partial object independently registers');
like({project_id:'007',status:false,count:9});comment({project_id:7,content:'x'});comment({project_id:'007'});
check(count===0,'unlike and invalid callback payloads ignored');
like({project_id:'00123456789012345678',status:true,count:0});comment({project_id:'007',content:'',count:0});
like({project_id:'007',status:true});comment({project_id:'007',content:'again'});
check(count===2&&profile(clone(profileA)).sunset,'genuine image-only callback and persistent deduplication');
run(r,smart);if(r.phase==='result')h.end();h.end();
const nextRace=finalFrom(r);
h.save({game:'velodrome-finals',v:1,profile:profileA,race:nextRace});await flush();h.stop();
check(ends===1&&off===2&&records.at(-1).race.round==='final','actual heat and game-scoped save, both callbacks removed');
const resumed=attach(),final=restore(records.at(-1).race,profileA);resumed.connect();await flush();
check(starts===1&&final.phase==='ready','ready finalist reload does not trigger artificial start');
if(start(final))resumed.start();resumed.start();run(final,smart);if(final.phase==='result')resumed.end();resumed.end();
check(starts===2&&ends===2,'actual restored final start and finish sent once');
resumed.stop();check(off===4,'listeners cleaned on second exit');
let resolve,delayedOff=0,foreign=0;
const pending=env({onLike:()=>new Promise(r=>resolve=r)});
const delayed=new VeloHost(pending);delayed.connect();delayed.stop();
resolve({code:0,data:{unsubscribe(){delayedOff++}}});await flush();check(delayedOff===1,'late success after unload unsubscribes');
const timeoutEnv=env({loadUserGameState:()=>new Promise(()=>{}),onComment:()=>new Promise(r=>resolve=r),saveUserGameState(){foreign++}});
const timed=new VeloHost(timeoutEnv);timed.connect();timed.save({game:'velodrome-finals'});
for(const fn of [...timeoutEnv.jobs.values()])fn();
resolve({code:0,data:{unsubscribe(){delayedOff++}}});await flush();timed.stop();
check(delayedOff===2&&!foreign,'timeout guards unknown save and late listener');
const broken=new VeloHost(env({gameStart:()=>Promise.reject(Error('late')),gameOver:()=>{throw Error('late')},onLike:()=>Promise.reject(Error('late')),onComment:async()=>({code:-6}),loadUserGameState:async()=>({game:'foreign'}),saveUserGameState(){foreign++}}));
broken.connect();broken.start();broken.end();broken.save({game:'velodrome-finals'});await flush();broken.stop();
check(!foreign,'SDK exceptions and foreign state stay isolated');
console.log('PASS '+checks+' race, save and GameWave mock checks');
