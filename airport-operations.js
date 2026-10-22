import {collisionRadius} from './aircraft-collision.js?v=skybreak4-1022';
import {AIRFIELDS,fieldPoint,fieldCoordinates,fieldUnder} from './missions.js?v=skybreak4-1022';

// Home-base runway operations. Gear is mandatory for a qualifying touchdown.
export const AIRPORT=Object.freeze({takeoffSpeed:80,landingSpeed:115,repairSpeed:8,repairPower:.2,repairRate:8,repairDelay:3,queueDistance:240});
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function airportForTeam(g,team){
 const ids=g.arenaId==='valley'?['northpoint','home','westhaven']:['home','northpoint','westhaven'];
 return AIRFIELDS[ids[team%ids.length]];
}
export function groundSpawn(g,p,slot=p.slot||0){
 const field=g.mode==='freeflight'?AIRFIELDS.home:airportForTeam(g,p.team);
 // Each squad uses its own airport. The front aircraft departs first; the
 // following aircraft physically waits until its forward runway is clear.
 return{pos:fieldPoint(field,0,-field.halfLength+110+slot*165,3),yaw:field.heading,pitch:0,roll:0,speed:0,throttle:0,grounded:true,landed:false,flightState:'parked',homeBaseId:field.id,gearDown:true,airbrake:false,maneuverAssist:false,runwayId:field.id,departureHold:false,departureActive:g.mode!=='freeflight',departureReadyAt:g.time,repairing:false};
}
export function departureBlocked(g,p){
 if(!p.grounded||p.landed)return false;
 const f={x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
 return g.pilots.some(q=>{
  if(q===p||q.dead||Math.abs(q.pos.y-p.pos.y)>45)return false;
  const x=q.pos.x-p.pos.x,z=q.pos.z-p.pos.z,along=x*f.x+z*f.z,across=x*f.z-z*f.x;
  return along>0&&along<AIRPORT.queueDistance&&Math.abs(across)<65;
 });
}
export function departureInput(g,p){
 const field=AIRFIELDS[p.runwayId];
 if(!field)return null;
 if(p.grounded){
  const local=fieldCoordinates(field,p.pos),heading=angle(field.heading-p.yaw);
  return{roll:clamp(-local.across*.018+heading*2,-.35,.35),yaw:0,pitch:p.speed>=AIRPORT.takeoffSpeed?.7:0,throttle:p.throttle<(p.bomber?1:.82)?1:0,brake:p.departureHold};
 }
 if(!p.departureActive)return null;
 // Climb straight out of the airport before engaging, rather than steering
 // into terrain or a wingmate as soon as the wheels leave the runway.
 const heading=angle(field.heading-p.yaw);
 return{roll:clamp(heading*2,-.3,.3),yaw:0,pitch:clamp((.22-p.pitch)*4,-.5,.7),throttle:p.throttle<(p.bomber?1:.82)?1:0};
}
export function validTouchdown(p,field,verticalSpeed){
 if(!field||!p.gearDown||field.id!==p.homeBaseId||p.speed<40||p.speed>AIRPORT.landingSpeed||Math.abs(p.roll)>.35||verticalSpeed< -12||verticalSpeed>4)return false;
 const heading=Math.abs(angle(p.yaw-field.heading));
 return Math.min(heading,Math.abs(Math.PI-heading))<.35;
}
// Recheck the actual runway, not just a stored flag. A low flyby never qualifies.
export function onRunway(p){
 const field=fieldUnder(p.pos);
 return!!(p.grounded&&field&&field.id===p.homeBaseId&&Math.abs(p.pos.y-field.elevation-3)<2);
}
export const missileImmune=p=>onRunway(p);
export function repairAtAirport(g,p,dt){
 p.repairing=false;p.refueling=false;
 if(p.dead||p.hp<=0||!p.landed||!onRunway(p)||p.speed>AIRPORT.repairSpeed||p.throttle>AIRPORT.repairPower||g.time-(p.lastDamage?.t??-Infinity)<AIRPORT.repairDelay)return;
 if(p.fuelKg<p.fuelCapacityKg){p.fuelKg=Math.min(p.fuelCapacityKg,p.fuelKg+p.fuelCapacityKg*.025*dt);p.fuelFraction=p.fuelKg/p.fuelCapacityKg;p.refueling=true;}
 if(p.hp<100||(p.engineHealth??1)<1||(p.controlHealth??1)<1){p.hp=Math.min(100,p.hp+AIRPORT.repairRate*dt);p.engineHealth=Math.min(1,(p.engineHealth??1)+.08*dt);p.controlHealth=Math.min(1,(p.controlHealth??1)+.08*dt);p.repairing=true;}
}

// Normal mode manages systems; K mode leaves them in the pilot's hands.
export function automaticSystems(p){
 if(!p.human||p.maneuverAssist)return;
 p.airbrake=false;
 const home=AIRFIELDS[p.homeBaseId],near=home&&Math.hypot(p.pos.x-home.x,p.pos.z-home.z)<2800;
 const height=p.pos.y-(home?.elevation||0);
 p.gearDown=!!(p.grounded||(near&&height<25&&p.pitch>=0)||(near&&height<220&&p.speed<155&&p.pitch<.06&&!p.departureActive));
}

// Claiming an AI seat must never spawn a new human in mid-flight. Keep stores
// and damage unchanged so reconnecting is not a free rearm/repair shortcut.
export function placePilotOnRunway(g,p){
 const field=AIRFIELDS[p.homeBaseId]||AIRFIELDS[p.runwayId];
 if(!field||p.dead)return false;
 let position=null;
 for(let attempt=0;attempt<12;attempt++){
  const candidate=fieldPoint(field,0,-field.halfLength+100+attempt*105,3);
  if(g.pilots.every(q=>q===p||q.dead||Math.hypot(candidate.x-q.pos.x,candidate.y-q.pos.y,candidate.z-q.pos.z)>collisionRadius(q)+collisionRadius(p)+35)){position=candidate;break;}
 }
 if(!position)return false;
 Object.assign(p,groundSpawn(g,p),{pos:position,homeBaseId:field.id,runwayId:field.id,yaw:field.heading,gLoad:1,stallSink:0,speedAcceleration:0,braking:false,afterburnerActive:false,throttleHeld:0,throttleDirection:0});
 for(const m of g.missiles||[])if(m.targetId===p.id){m.seekerLost=true;m.targetId=null;}
 return true;
}
