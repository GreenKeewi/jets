import {worldVelocity} from './arcade-travel.js?v=skybreak110-1028';
import {surfaceHeight} from './world.js?v=skybreak110-1028';
import {fieldUnder} from './missions.js?v=skybreak110-1028';
import {validTouchdown} from './airport-operations.js?v=skybreak110-1028';

// Gameplay approximations, not certified aircraft warning or terrain avoidance logic.
// Constant-velocity look-ahead uses the collision heightfield, including sea/runways,
// and arcade world travel. It never uses indicated speed as a distance prediction.
export const WARNING_RULES=Object.freeze({
 pullup:Object.freeze({text:'Pull up',label:'PULL UP',priority:4,delay:0,repeat:4.5}),
 terrain:Object.freeze({text:'Terrain, terrain',label:'TERRAIN',priority:3,delay:.25,repeat:7}),
 overg:Object.freeze({text:'Over G',label:'OVER G',priority:2,delay:.5,repeat:12}),
 bank:Object.freeze({text:'Bank angle',label:'BANK ANGLE',priority:1,delay:1.1,repeat:12}),
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
const clock=()=>((globalThis.performance?.now?.()??Date.now())/1000);
const finiteVector=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k]));

export function predictTerrain(p,{heightAt=surfaceHeight,velocity,horizon=6,step=.2}={}){
 const result={impactTime:Infinity,minClearance:Infinity,clearance:Infinity,closing:false,landing:false,samples:0};
 if(!p||p.dead||p.grounded||!finiteVector(p.pos)||typeof heightAt!=='function')return result;
 const v=velocity??worldVelocity(p);if(!finiteVector(v))return result;
 // At most 61 heightfield samples, even if an injected caller asks for tiny steps.
 horizon=clamp(horizon,.2,6);const count=Math.min(60,Math.max(1,Math.ceil(horizon/clamp(step,.1,1))));
 let previousClearance=Infinity,previousTime=0;
 for(let i=0;i<=count;i++){
  const t=horizon*i/count,point={x:p.pos.x+v.x*t,y:p.pos.y+v.y*t,z:p.pos.z+v.z*t},height=heightAt(point.x,point.z);result.samples++;
  if(!Number.isFinite(height))continue;
  const clearance=point.y-Math.max(3,height+3);
  if(i===0)result.clearance=clearance;
  result.minClearance=Math.min(result.minClearance,clearance);
  if(clearance<=0){
   result.impactTime=i===0?0:previousTime+(t-previousTime)*clamp(previousClearance/(previousClearance-clearance),0,1);
   const field=fieldUnder(point);
   // A qualifying gear-down runway touchdown should not create a landing alarm.
   result.landing=!!field&&validTouchdown(p,field,v.y);
   break;
  }
  previousClearance=clearance;previousTime=t;
 }
 result.closing=Number.isFinite(result.impactTime)||result.clearance-result.minClearance>18;
 return result;
}

export class FlightWarnings{
 constructor({speech=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,onWarning=null}={}){
  this.speech=speech;this.Utterance=Utterance;this.onWarning=onWarning;this.enabled=true;this.volume=1;this.unlocked=false;
  this.conditions=new Map();this.lastSpoken=new Map();this.utterance=null;this.state=null;this.pilotId=null;this.nextSpeechAt=-Infinity;this.lastNow=-Infinity;
 }
 unlock(){this.unlocked=true;}
 setEnabled(value){this.enabled=!!value;if(!this.enabled)this.stop();return this.enabled;}
 setVolume(value){this.volume=clamp(value,0,1);if(!this.volume)this.stop();return this.volume;}
 publish(state){
  const changed=state?.type!==this.state?.type;this.state=state;
  if(changed&&typeof this.onWarning==='function')this.onWarning(state);
 }
 cancelSpeech(){
  if(!this.utterance)return;
  this.utterance=null;
  try{this.speech?.cancel?.();}catch{} // Speech support varies by browser/device.
 }
 stop({reset=false}={}){
  this.cancelSpeech();this.conditions.clear();this.publish(null);
  if(reset){this.lastSpoken.clear();this.nextSpeechAt=-Infinity;this.pilotId=null;this.lastNow=-Infinity;}
 }
 dispose(){this.stop({reset:true});this.unlocked=false;}
 update(p,{active=true,now=clock(),heightAt=surfaceHeight,velocity}={}){
  if(!Number.isFinite(now))return this.state;
  if(this.pilotId!==p?.id||now<this.lastNow)this.stop({reset:true});
  this.pilotId=p?.id??null;this.lastNow=now;
  if(!active||!this.enabled||!this.volume||!p||p.dead||p.grounded||!finiteVector(p.pos)){
   this.stop();return null;
  }
  const prediction=predictTerrain(p,{heightAt,velocity});
  const load=Number.isFinite(p.gLoad)?p.gLoad:Number.isFinite(p.normalLoad)?p.normalLoad:1;
  const bank=Math.abs(Math.atan2(Math.sin(p.roll||0),Math.cos(p.roll||0))),bankLimit=(p.bomber?60:75)*Math.PI/180;
  const old=id=>!!this.conditions.get(id)?.latched;
  const impact=prediction.landing?Infinity:prediction.impactTime;
  const raw={
   pullup:impact<=(old('pullup')?3.1:2.5),
   terrain:impact<=6,
   overg:load>(p.bomber?(old('overg')?2.8:3.3):(old('overg')?6.5:7.5))||load<(p.bomber?(old('overg')?-1.1:-1.4):(old('overg')?-1.5:-2)),
   bank:bank>bankLimit-(old('bank')?10*Math.PI/180:0),
  };
  for(const [id,rule]of Object.entries(WARNING_RULES)){
   let state=this.conditions.get(id);
   if(raw[id]){
    if(!state)state={since:now,latched:false,clearSince:null};
    state.clearSince=null;if(now-state.since>=rule.delay)state.latched=true;
   }else if(state){
    if(!state.latched){this.conditions.delete(id);continue;}
    state.clearSince??=now;
    if(now-state.clearSince>=.7){this.conditions.delete(id);continue;}
   }
   if(state)this.conditions.set(id,state);
  }
  const type=Object.keys(WARNING_RULES).find(id=>this.conditions.get(id)?.latched);
  const state=type?{type,...WARNING_RULES[type],impactTime:prediction.impactTime,approximation:true}:null;
  this.publish(state);
  // Cancel a completed/recovered warning promptly. Its visible state may briefly
  // hold for hysteresis, but stale speech is never allowed to finish or queue.
  if(this.utterance&&(!raw[this.utterance.type]||now-this.utterance.started>4))this.cancelSpeech();
  if(!state||!raw[type]||!this.unlocked||!this.speech?.speak||!this.Utterance)return state;
  const current=this.utterance,preempt=current&&state.priority>current.priority;
  if(preempt)this.cancelSpeech();
  if(now-(this.lastSpoken.get(type)??-Infinity)<state.repeat)return state;
  if(current&&!preempt)return state;
  if(!preempt&&(now<this.nextSpeechAt||this.speech.speaking||this.speech.pending))return state;
  try{
   const utterance=new this.Utterance(state.text),entry={type,priority:state.priority,started:now,utterance};
   utterance.lang='en-US';utterance.rate=1.06;utterance.pitch=.84;utterance.volume=this.volume*.85;
   const done=()=>{if(this.utterance!==entry)return;this.utterance=null;this.nextSpeechAt=Math.max(this.nextSpeechAt,this.lastNow+1);};
   utterance.onend=done;utterance.onerror=done;
   this.utterance=entry;this.speech.speak(utterance);this.lastSpoken.set(type,now);this.nextSpeechAt=now+2;
  }catch{this.cancelSpeech();this.nextSpeechAt=now+state.repeat;}
  return state;
 }
}
