// GameWave adapter scoped exclusively to VELODROME FINALS. Rendering never awaits it.
export class VeloHost{
 constructor(env,cb={}){this.env=env;this.cb=cb;this.sdk=null;this.alive=true;this.active=false;this.sent=false;this.epoch=0;this.entries=new Map();this.tries={};this.timers=new Set();this.support={};this.cloud=false;this.dirty=false;this.busy=false;this.latest=null;this.loadSeen=new WeakSet();}
 later(fn,ms){let id=this.env.setTimeout(()=>{this.timers.delete(id);if(this.alive)fn()},ms);this.timers.add(id);return id}
 clear(t){this.env.clearTimeout(t);this.timers.delete(t)}
 safe(name){try{if(typeof this.sdk?.[name]==='function'){Promise.resolve(this.sdk[name]()).catch(()=>{});return true}}catch{}return false}
 start(){if(!this.alive||this.active)return;this.active=true;this.sent=this.safe('gameStart')}
 end(){if(!this.active)return;this.active=false;if(this.sent)this.safe('gameOver');this.sent=false}
 register(name,key){if(typeof this.sdk?.[name]!=='function'||this.entries.has(name)||(this.tries[name]||0)>=2)return;this.tries[name]=(this.tries[name]||0)+1;let epoch=this.epoch,sdk=this.sdk,entry={live:false,expired:false,stop:null};this.entries.set(name,entry);const stop=fn=>{try{fn?.()}catch{}};let expiry=this.later(()=>{entry.expired=true;if(epoch!==this.epoch||!this.alive)return;if(this.entries.get(name)===entry)this.entries.delete(name);this.support[key]=false;this.cb.status?.({...this.support})},4000);
  const callback=e=>{if(!this.alive||epoch!==this.epoch||!entry.live||entry.expired||!e||typeof e.project_id!=='string'||(name==='onLike'?e.status!==true:typeof e.content!=='string'))return;this.cb.reward?.(key)};
  let pending;try{pending=Promise.resolve(sdk[name](callback))}catch{pending=Promise.reject()}
  pending.then(r=>{this.clear(expiry);let off=r?.code===0&&typeof r?.data?.unsubscribe==='function'?r.data.unsubscribe:null;if(!this.alive||epoch!==this.epoch||entry.expired){stop(off);return}if(r?.code===0){entry.live=true;entry.stop=off;this.support[key]=true;}else{this.entries.delete(name);if(r?.code!==-2)this.tries[name]=2;this.support[key]=false}this.cb.status?.({...this.support})},()=>{this.clear(expiry);if(!this.alive||epoch!==this.epoch)return;if(this.entries.get(name)===entry)this.entries.delete(name);this.support[key]=false;this.cb.status?.({...this.support})});
 }
 connect(){if(!this.alive)return;let sdk=this.env.neonlib;if(!sdk||typeof sdk!=='object')return;if(sdk!==this.sdk){this.epoch++;for(let e of this.entries.values()){e.expired=true;try{e.stop?.()}catch{}}this.entries.clear();this.tries={};this.support={};this.sdk=sdk;this.cloud=false;this.busy=false;if(this.latest)this.dirty=true;this.sent=false;this.cb.status?.({});}if(this.active&&!this.sent)this.sent=this.safe('gameStart');
  if(!this.loadSeen.has(sdk)&&typeof sdk.loadUserGameState==='function'){this.loadSeen.add(sdk);let epoch=this.epoch,expired=false,t=this.later(()=>expired=true,3500);try{Promise.resolve(sdk.loadUserGameState()).then(v=>{this.clear(t);if(!this.alive||epoch!==this.epoch||expired)return;if(v&&v.game==='velodrome-finals'&&v.v===1){this.cb.load?.(v);this.cloud=true}else if(v&&typeof v==='object'&&Object.keys(v).length===0)this.cloud=true;if(this.dirty)this.flush()},()=>this.clear(t))}catch{this.clear(t)}}
  this.register('onLike','lilac');this.register('onComment','sunset');if(this.dirty)this.flush();
 }
 poll(){this.connect();if(this.alive)this.later(()=>this.poll(),1600)}
 save(v){this.latest=JSON.parse(JSON.stringify(v));this.dirty=true;this.flush()}
 flush(){if(!this.alive||!this.cloud||this.busy||!this.dirty||typeof this.sdk?.saveUserGameState!=='function')return;this.busy=true;this.dirty=false;let v=this.latest,epoch=this.epoch;try{Promise.resolve(this.sdk.saveUserGameState(v)).catch(()=>{}).finally(()=>{if(epoch!==this.epoch)return;this.busy=false;if(this.dirty)this.flush()})}catch{this.busy=false}}
 stop(){if(!this.alive)return;this.alive=false;this.epoch++;for(let t of this.timers)this.env.clearTimeout(t);this.timers.clear();for(let e of this.entries.values()){e.expired=true;try{e.stop?.()}catch{}}this.entries.clear();}
}






