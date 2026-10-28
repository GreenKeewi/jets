import {surfaceHeight} from './world.js?v=skybreak110-1028';
import {heatFlareChance,HEAT_SEEKER} from './heat-seeker.js?v=skybreak110-1028';

// Shared with the visible sky disk. The sun is a direction, not a world point.
const sunLength=Math.hypot(-.62,.28,-.73);
export const SUN_DIRECTION=Object.freeze({x:-.62/sunLength,y:.28/sunLength,z:-.73/sunLength});
const sunCone=Math.cos(8*Math.PI/180);
const clamp01=value=>Math.max(0,Math.min(1,value));

// Fictional readable gameplay envelope; this is not a real radar model.
export const RADAR_CLUTTER=Object.freeze({fullBelow:25,clearAbove:180,lossRate:.65,minTurnScale:.38});
export function terrainOccluded(from,to,height=surfaceHeight){
 const distance=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z),steps=Math.min(96,Math.ceil(distance/70));
 for(let n=1;n<steps;n++){
  const t=n/steps,x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t,z=from.z+(to.z-from.z)*t;
  if(height(x,z)>=y)return true;
 }
 return false;
}
export function seekerInterference(missile,target,sight){
 if(missile.type==='radar'){
  // Terrain-relative height also covers aircraft skimming a runway before
  // their wheels touch. Ground clutter weakens guidance, never grants immunity.
  const clearance=target.pos.y-surfaceHeight(target.pos.x,target.pos.z);
  const strength=clamp01((RADAR_CLUTTER.clearAbove-clearance)/(RADAR_CLUTTER.clearAbove-RADAR_CLUTTER.fullBelow));
  // Solid terrain breaks the line of sight through seeker memory in sim.js;
  // low clearance alone remains a seeded chance, including grounded targets.
  const terrainBlocked=terrainOccluded(missile.pos,target.pos);
  return{strength,lossRate:RADAR_CLUTTER.lossRate*strength,turnScale:terrainBlocked?0:1-(1-RADAR_CLUTTER.minTurnScale)*strength,terrainBlocked};
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
