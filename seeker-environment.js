import {surfaceHeight} from './world.js?v=skybreak14-1023';
import {heatFlareChance,HEAT_SEEKER} from './heat-seeker.js?v=skybreak14-1023';

// Shared with the visible sky disk. The sun is a direction, not a world point.
const sunLength=Math.hypot(-.62,.28,-.73);
export const SUN_DIRECTION=Object.freeze({x:-.62/sunLength,y:.28/sunLength,z:-.73/sunLength});
const sunCone=Math.cos(8*Math.PI/180);
const clamp01=value=>Math.max(0,Math.min(1,value));

export function seekerInterference(missile,target,sight){
 if(missile.type==='radar'){
  // Terrain-relative height also covers aircraft skimming a runway before
  // their wheels touch. Ground clutter weakens guidance, never grants immunity.
  const clearance=target.pos.y-surfaceHeight(target.pos.x,target.pos.z);
  const strength=target.grounded?1:clamp01((18-clearance)/15);
  return{strength,lossRate:.18*strength,turnScale:1-.45*strength};
 }
 if(missile.type!=='heat')return{strength:0,lossRate:0,turnScale:1};
 const alignment=sight.x*SUN_DIRECTION.x+sight.y*SUN_DIRECTION.y+sight.z*SUN_DIRECTION.z;
 let strength=clamp01((alignment-sunCone)/(1-sunCone));
 if(strength>0){
  // A ridge hiding the disk must not confuse the seeker. Bounded ray samples
  // reach above the authored terrain; only run them inside the small sun cone.
  for(let distance=125;distance<=8000;distance+=125){
   const x=missile.pos.x+SUN_DIRECTION.x*distance,z=missile.pos.z+SUN_DIRECTION.z*distance;
   if(surfaceHeight(x,z)>=missile.pos.y+SUN_DIRECTION.y*distance){strength=0;break;}
  }
 }
 // A hot afterburner remains easier to distinguish; flare probabilities and
 // their one-roll-per-burst logic stay unchanged.
 const susceptibility=.45+.55*heatFlareChance(target)/HEAT_SEEKER.idleFlareChance;
 return{strength,lossRate:.7*strength*susceptibility,turnScale:1-.3*strength};
}

export function advanceSeekerInterference(missile,interference,dt,random){
 if(!(interference.lossRate>0)||!(dt>0))return false;
 // One exponential threshold per missile, integrated in simulation seconds.
 // No per-frame chance or growing history; these numbers survive snapshots.
 if(!Number.isFinite(missile.environmentLossThreshold))missile.environmentLossThreshold=-Math.log(Math.max(1e-9,1-random()));
 missile.environmentExposure=Math.min(32,(missile.environmentExposure||0)+interference.lossRate*dt);
 return missile.environmentExposure>=missile.environmentLossThreshold;
}
