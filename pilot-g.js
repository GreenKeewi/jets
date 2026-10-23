// Signed pilot-axis specific force and deliberately simplified game physiology.
// See flight-model.md for sources, envelopes and non-medical tuning assumptions.
import {viewAxes,flightForward} from './view-axes.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const G=9.81;
export const freshPilotG=()=>({normalLoad:1,gLoad:1,gExposure:0,gNegativeExposure:0,gVision:0,gRedout:0,blackedOut:false,gBlackoutTime:0,gNeedsRelease:false,gUnloading:false,contactLoad:0});
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
 if(!Number.isFinite(p.gLoad))Object.assign(p,freshPilotG());
 const turning=Math.max(Math.abs(Number(input.roll)||0),Math.abs(Number(input.pitch)||0),Math.abs(Number(input.yaw)||0));
 if(p.gNeedsRelease&&(!p.human||turning<.12))p.gNeedsRelease=false;
 // Bots obey the same limit and unload before they lose consciousness.
 if(!p.human){if(p.gExposure>.6)p.gUnloading=true;else if(p.gExposure<.18)p.gUnloading=false;}
 if(p.blackedOut||p.gNeedsRelease)return{...input,roll:0,pitch:0,yaw:0,fireGun:false,fireHeat:false,fireRadar:false,bomb:false,flare:false,chaff:false};
 // A conscious bot can still make gentle terrain-avoidance corrections while
 // unloading. Full neutral for several seconds would fly it into a valley wall.
 if(p.gUnloading)return{...input,roll:clamp(Number(input.roll)||0,-.16,.16),pitch:clamp(Number(input.pitch)||0,-.24,.32),yaw:0,fireGun:false,fireHeat:false,fireRadar:false,bomb:false};
 return input;
}
export function advancePilotPhysiology(p,load,dt){
 if(!(dt>0))return;
 p.gLoad+=(load-p.gLoad)*(1-Math.exp(-dt*5));
 // Exposure is integrated from actual signed force, not delayed HUD filtering.
 // Thresholds/times are generous gameplay values, not individual tolerances.
 const positive=Math.max(0,load-4.5)*.075,negative=Math.max(0,-load-.5)*.22;
 p.gExposure=clamp((p.gExposure||0)+(positive||-.24)*dt,0,1);
 p.gNegativeExposure=clamp((p.gNegativeExposure||0)+(negative||-.32)*dt,0,1);
 if(!p.blackedOut&&Math.max(p.gExposure,p.gNegativeExposure)>=1){p.blackedOut=true;p.gBlackoutTime=0;p.gNeedsRelease=true;}
 if(p.blackedOut){p.gBlackoutTime+=dt;if(p.gBlackoutTime>=1.5&&Math.max(p.gExposure,p.gNegativeExposure)<.3){p.blackedOut=false;p.gBlackoutTime=0;p.gNeedsRelease=false;}}
 const positiveVision=clamp((p.gExposure-.15)/.85,0,1),negativeVision=clamp((p.gNegativeExposure-.15)/.85,0,1);
 const vision=p.blackedOut?1:positiveVision*.9;
 p.gVision+=(vision-p.gVision)*(1-Math.exp(-dt*4));
 p.gRedout=((p.gRedout||0)+(negativeVision-(p.gRedout||0))*(1-Math.exp(-dt*4)));
 if(p.gVision<.001)p.gVision=0;if(p.gRedout<.001)p.gRedout=0;
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
