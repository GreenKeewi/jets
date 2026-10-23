// Signed pilot-axis specific force, light visual feedback and gentle airframe wear.
// See flight-model.md for sources, envelopes and non-medical tuning assumptions.
import {viewAxes,flightForward} from './view-axes.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const G=9.81;
// Cosmetic vignette and gently accumulated airframe wear, never physiology.
export const G_EFFECTS=Object.freeze({maxVision:.12,wearPositive:7.5,wearNegative:-2,wearDelay:5,wearRate:.15,maxWear:10});
export const freshPilotG=()=>({normalLoad:1,gLoad:1,gVision:0,contactLoad:0,gWearTime:0,airframeWear:0,gWearActive:false});
export function sanitizePilotG(p){
 for(const key of ['blackedOut','gRedout','gBlackoutTime','gNeedsRelease','gUnloading','gExposure','gNegativeExposure'])delete p[key];
 p.gVision=clamp(Number(p.gVision)||0,0,G_EFFECTS.maxVision);
 p.airframeWear=clamp(Number(p.airframeWear)||0,0,G_EFFECTS.maxWear);
 p.gWearTime=Number.isFinite(p.gWearTime)?clamp(p.gWearTime,0,120):0;
 return p;
}
export function physicalVelocity(p){const f=flightForward(p);return{x:f.x*p.speed,y:f.y*p.speed-(p.grounded?0:p.stallSink||0),z:f.z*p.speed};}
export function signedPilotLoad(before,after,up,dt){
 if(!(dt>0))return 1;
 return ((after.x-before.x)*up.x+(after.y-before.y)*up.y+(after.z-before.z)*up.z)/(dt*G)+up.y;
}
// Limit the commanded flight-path change BEFORE movement. HUD loads are never
// clipped. The same controller protects normal, advanced and bot flight.
export function limitFlightEnvelope(p,previous,dt){
 if(p.grounded||!(dt>0))return;
 const min=p.bomber?-1.5:-3,max=p.bomber?3.5:9;
 const old=flightForward(previous),desired={pitch:p.pitch,yaw:p.yaw,roll:p.roll};
 const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
 const apply=t=>{for(const key of ['pitch','yaw','roll'])p[key]=previous[key]+angle(desired[key]-previous[key])*t;};
 const allowed=()=>{const {forward:f,up}=viewAxes(p,p.roll),a={x:(f.x-old.x)*p.speed/(dt*G),y:(f.y-old.y)*p.speed/(dt*G)+1,z:(f.z-old.z)*p.speed/(dt*G)};
 const load=dot(a,up),along=dot(a,f),transverse=Math.sqrt(Math.max(0,dot(a,a)-along*along));
 return load>=min&&load<=max&&transverse<=max;};
 if(allowed()){p.envelopeLimited=false;return;}
 let low=0,high=1;for(let n=0;n<18;n++){const mid=(low+high)/2;apply(mid);if(allowed())low=mid;else high=mid;}apply(low);p.envelopeLimited=true;
}
export function pilotGInput(p,input={}){
 sanitizePilotG(p);if(!Number.isFinite(p.gLoad))p.gLoad=1;
 return input; // Every control and weapon remains available at every G load.
}
// Legacy export name retained for callers; no physiological impairment remains.
export function advancePilotPhysiology(p,load,dt){
 sanitizePilotG(p);if(!(dt>0))return;
 if(!Number.isFinite(p.gLoad))p.gLoad=1;
 p.gLoad+=(load-p.gLoad)*(1-Math.exp(-dt*5));
 const target=G_EFFECTS.maxVision*clamp((Math.abs(load)-5)/4,0,1);
 p.gVision+=(target-p.gVision)*(1-Math.exp(-dt*3));
 if(p.gVision<.001)p.gVision=0;
}
export function advanceAirframeWear(p,dt){
 sanitizePilotG(p);p.gWearActive=false;
 const excessive=!p.dead&&!p.grounded&&(p.normalLoad>G_EFFECTS.wearPositive||p.normalLoad<G_EFFECTS.wearNegative);
 const previous=Math.max(0,Number(p.gWearTime)||0);
 p.gWearTime=excessive?previous+dt:Math.max(0,previous-dt*2);
 if(!excessive)return;
 const wearSeconds=Math.max(0,p.gWearTime-G_EFFECTS.wearDelay)-Math.max(0,previous-G_EFFECTS.wearDelay);
 const damage=Math.min(wearSeconds*G_EFFECTS.wearRate,G_EFFECTS.maxWear-p.airframeWear,Math.max(0,(p.hp??100)-1));
 if(damage>0){p.airframeWear+=damage;p.hp=(p.hp??100)-damage;p.gWearActive=true;}
}
export function updatePilotG(p,before,after,dt,wasGrounded,{velocities=false}={}){
 if(!(dt>0))return;
 if(!Number.isFinite(p.gLoad))Object.assign(p,freshPilotG());
 // Direction input is retained for small standalone attitude fixtures. The game
// supplies pre/post physical velocities, including speed change and stall sink.
 if(!velocities){before={x:before.x*p.speed,y:before.y*p.speed,z:before.z*p.speed};after={x:after.x*p.speed,y:after.y*p.speed,z:after.z*p.speed};}
 const measured=signedPilotLoad(before,after,viewAxes(p,p.roll).up,dt);
 p.normalLoad=p.grounded||wasGrounded?1:measured;
 // Ground transitions are contact impulses, not sustained flight loading.
 p.contactLoad=p.grounded!==wasGrounded?measured:0;
 advancePilotPhysiology(p,p.normalLoad,dt);
}
