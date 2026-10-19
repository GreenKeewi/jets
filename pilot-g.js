// Arcade pilot physiology, based on the aircraft's actual change in flight path.
// This is deliberately forgiving game balance, not a medical or aircraft model.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const freshPilotG=()=>({gLoad:1,gExposure:0,gVision:0,blackedOut:false,gBlackoutTime:0,gNeedsRelease:false,gUnloading:false});
export function pilotGInput(p,input={}){
 if(!Number.isFinite(p.gLoad))Object.assign(p,freshPilotG());
 const turning=Math.max(Math.abs(Number(input.roll)||0),Math.abs(Number(input.pitch)||0),Math.abs(Number(input.yaw)||0));
 if(p.gNeedsRelease&&(!p.human||turning<.12))p.gNeedsRelease=false;
 // Bots obey the same limit and unload before they lose consciousness.
 if(!p.human){if(p.gExposure>.6)p.gUnloading=true;else if(p.gExposure<.18)p.gUnloading=false;}
 if(p.blackedOut||p.gNeedsRelease||p.gUnloading)return{...input,roll:0,pitch:0,yaw:0,fireGun:false,fireHeat:false,fireRadar:false,bomb:false,flare:false,chaff:false};
 return input;
}
export function updatePilotG(p,before,after,dt,wasGrounded){
 if(dt<=0)return;
 let load=1;
 if(!p.grounded&&!wasGrounded){
  const acceleration={x:(after.x-before.x)*p.speed/dt,y:(after.y-before.y)*p.speed/dt+9.81,z:(after.z-before.z)*p.speed/dt};
  const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),sp=Math.sin(p.pitch),cp=Math.cos(p.pitch),sr=Math.sin(p.roll),cr=Math.cos(p.roll);
  // Project turn acceleration plus gravity onto the pilot's rolled-up axis.
  const up={x:-sy*sp*cr+cy*sr,y:cp*cr,z:-cy*sp*cr-sy*sr};
  load=clamp((acceleration.x*up.x+acceleration.y*up.y+acceleration.z*up.z)/9.81,0,45);
 }
 p.gLoad+=(load-p.gLoad)*(1-Math.exp(-dt*4.5));
 const strain=p.gLoad>5.5?Math.min(.30,(p.gLoad-5.5)*.035):-Math.max(.07,(5.5-p.gLoad)*.05);
 p.gExposure=clamp(p.gExposure+strain*dt,0,1);
 if(!p.blackedOut&&p.gExposure>=1){p.blackedOut=true;p.gBlackoutTime=0;p.gNeedsRelease=true;}
 if(p.blackedOut){
  p.gBlackoutTime+=dt;
  // Neutral controls level the plane and unload it; blackout cannot latch forever.
  if(p.gBlackoutTime>=1.5&&p.gExposure<.3){p.blackedOut=false;p.gBlackoutTime=0;}
 }
 const x=clamp((p.gExposure-.18)/.82,0,1),vision=p.blackedOut?1:x*x*(3-2*x);
 p.gVision+=(vision-p.gVision)*(1-Math.exp(-dt*(vision>p.gVision?4:1.7)));
 if(p.gVision<.001)p.gVision=0;
}
