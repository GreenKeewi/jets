import {AIRFIELDS,fieldCoordinates} from './missions.js?v=skybreak2-1022';
import {GUN} from './guns.js?v=skybreak2-1022';

export const AIRFIELD_RESUPPLY=Object.freeze({radius:250,exitRadius:350,cooldown:12});
const fields=Object.values(AIRFIELDS);
// Match the visible pavement in scenery.js, in each runway's local coordinates.
// Distance is to these finite surfaces, including height, not an infinite column.
const pavement=field=>field.id==='home'
 ?[[0,0,100,1100],[230,-100,34,900],[490,-550,310,230]]
 :[[0,0,field.width,field.halfLength],[field.width+90,-50,24,field.halfLength*.85],[310,-250,210,170]];
const surfaces=fields.map(field=>({field,rectangles:pavement(field)}));
export function nearestAirfield(point,homeBaseId=null){
 let nearest={field:null,distance:Infinity};
 for(const {field,rectangles} of surfaces){
  if(homeBaseId&&field.id!==homeBaseId)continue;
  const local=fieldCoordinates(field,point),height=point.y-(field.elevation+3.5);
  for(const [across,along,halfWidth,halfLength] of rectangles){
   const dx=Math.max(0,Math.abs(local.across-across)-halfWidth),dz=Math.max(0,Math.abs(local.along-along)-halfLength);
   const distance=Math.hypot(dx,height,dz);
   if(distance<nearest.distance)nearest={field,distance};
  }
 }
 return nearest;
}
export function fullWeaponStores(p){
 return{gunAmmo:GUN.capacity,heat:p.bomber?0:6,radar:p.bomber?0:4,flares:6,chaff:6,bombs:p.bomber&&p.objectiveRole!=='transport'?3:0};
}
export function freshAirfieldResupply(point){
 return{resupplyLatched:nearestAirfield(point).distance<=AIRFIELD_RESUPPLY.exitRadius,resupplyReadyAt:0,resuppliedAt:null};
}
// Only the authoritative simulation calls this. Snapshot state also preserves
// the latch across guest interpolation, reconnects and aircraft handovers.
export function resupplyAtAirfield(g,p){
 if(p.dead||p.hp<=0||p.objectiveRole==='transport')return null;
 const {field,distance}=nearestAirfield(p.pos,p.homeBaseId);
 if(typeof p.resupplyLatched!=='boolean')Object.assign(p,freshAirfieldResupply(p.pos));
 if(distance>AIRFIELD_RESUPPLY.exitRadius){p.resupplyLatched=false;return null;}
 if(distance>AIRFIELD_RESUPPLY.radius||p.resupplyLatched)return null;
 // Consume the entry even during cooldown. Waiting inside never grants another refill.
 p.resupplyLatched=true;
 if(g.time<(p.resupplyReadyAt||0))return null;
 p.resupplyReadyAt=g.time+AIRFIELD_RESUPPLY.cooldown;
 const stores=fullWeaponStores(p),changed=Object.entries(stores).some(([key,max])=>p[key]<max);
 if(!changed)return null;
 Object.assign(p,stores,{resuppliedAt:g.time});
 return field;
}
