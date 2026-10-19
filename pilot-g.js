// Arcade pilot physiology, based on the aircraft's actual change in flight path.
// This is deliberately forgiving game balance, not a medical or aircraft model.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const freshPilotG=()=>({normalLoad:1,gLoad:1,gExposure:0,gVision:0,blackedOut:false,gBlackoutTime:0,gNeedsRelease:false,gUnloading:false});
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
export function updatePilotG(p,before,after,dt,wasGrounded){
 if(dt<=0)return;
 let load=1,normalLoad=1;
 if(!p.grounded&&!wasGrounded){
  const acceleration={x:(after.x-before.x)*p.speed/dt,y:(after.y-before.y)*p.speed/dt+9.81,z:(after.z-before.z)*p.speed/dt};
  const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),sp=Math.sin(p.pitch),cp=Math.cos(p.pitch),sr=Math.sin(p.roll),cr=Math.cos(p.roll);
  // Project turn acceleration plus gravity onto the pilot's rolled-up axis.
  const up={x:-sy*sp*cr+cy*sr,y:cp*cr,z:-cy*sp*cr-sy*sr};
  normalLoad=clamp((acceleration.x*up.x+acceleration.y*up.y+acceleration.z*up.z)/9.81,-15,45);load=Math.max(0,normalLoad);
 }
 // Flight energy uses this same instantaneous normal load for induced drag;
 // the HUD and physiology retain their smoothed value.
 p.normalLoad=normalLoad;p.gLoad+=(load-p.gLoad)*(1-Math.exp(-dt*4.5));
 // Short evasive turns stay clear. Even extreme, continuous loading takes
 // over fifteen seconds from a rested pilot to reach a blackout.
 const strain=p.gLoad>7.5?Math.min(.065,(p.gLoad-7.5)*.012):-Math.min(.5,.18+(7.5-p.gLoad)*.05);
 p.gExposure=clamp(p.gExposure+strain*dt,0,1);
 if(!p.blackedOut&&p.gExposure>=1){p.blackedOut=true;p.gBlackoutTime=0;p.gNeedsRelease=true;}
 if(p.blackedOut){
  p.gBlackoutTime+=dt;
  // Brief automatic unloading, then return control without requiring a key-up.
  // Remaining exposure still discourages immediately holding another hard turn.
  if(p.gBlackoutTime>=.65&&p.gExposure<.65){p.blackedOut=false;p.gBlackoutTime=0;p.gNeedsRelease=false;}
 }
 // A conscious pilot only gets a light peripheral warning; central vision is
 // reserved for the rare full blackout. Unloading clears the effect quickly.
 const x=clamp((p.gExposure-.4)/.6,0,1),vision=p.blackedOut?1:.48*x*x*(3-2*x);
 p.gVision+=(vision-p.gVision)*(1-Math.exp(-dt*(vision>p.gVision?3:4.5)));
 if(p.gVision<.001)p.gVision=0;
}
