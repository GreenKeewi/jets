import {advanceAttitude} from './attitude.js';
import {AIRPORT,automaticSystems,groundSpawn,departureBlocked,departureInput,validTouchdown,missileImmune,repairAtAirport} from './airport-operations.js?v=skybreak3-1022';
import {seekerInterference,advanceSeekerInterference} from './seeker-environment.js?v=skybreak3-1022';
import {fullWeaponStores,freshAirfieldResupply,resupplyAtAirfield} from './airfield-resupply.js?v=skybreak3-1022';
import {COMBAT_MISSIONS,combatMissionId,combatMissionBlocked,missionRoute} from './combat-missions.js?v=skybreak3-1022';
import {tryHeatFlare} from './heat-seeker.js?v=skybreak3-1022';
import {freshPilotG,pilotGInput,updatePilotG} from './pilot-g.js?v=skybreak3-1022';
import {flightForward,gunMuzzle as gunMuzzleForAI} from './view-axes.js?v=skybreak3-1022';
import {GUN,gunIntercept,fireGunRound,advanceGunRounds} from './guns.js?v=skybreak3-1022';
import {AIRCRAFT_RADIUS,collisionRadius,sweptSphereHit} from './aircraft-collision.js?v=skybreak3-1022';
export {AIRCRAFT_RADIUS,collisionRadius,sweptSphereHit} from './aircraft-collision.js?v=skybreak3-1022';
import {FLIGHT,fighterTargetSpeed,advanceFlightEnergy,turnAuthority,pitchRateLimit,initializeFuel} from './flight.js?v=skybreak3-1022';
export {FLIGHT,fighterTargetSpeed} from './flight.js?v=skybreak3-1022';
import {surfaceHeight} from './world.js?v=skybreak3-1022';
import {ARENAS,VALLEY,valleyCenter,valleyFloor,valleyPoint,inValley} from './arenas.js?v=skybreak3-1022';
import {AIRFIELDS,ROUTES,routeFor,destinationFor,approachFor,fieldPoint,fieldCoordinates,fieldUnder,WORLD_BOUNDS} from './missions.js?v=skybreak3-1022';
export {AIRFIELDS,ROUTES,routeFor,destinationFor,approachFor,fieldPoint,fieldCoordinates} from './missions.js?v=skybreak3-1022';
// Flight and combat rules are renderer-independent so missions can be replayed deterministically.
export const RUNWAY=AIRFIELDS.home;
export const ROUTE=ROUTES.local.gates;
export const TARGET={x:0,y:4,z:700};
export const ESCAPE={x:2700,y:500,z:-1500,radius:550};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angle=(v)=>Math.atan2(Math.sin(v),Math.cos(v));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export const horizontal=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const forward=flightForward;
function random(g){g.rng=(1664525*g.rng+1013904223)>>>0;return g.rng/4294967296}
export const COMBAT_LIMITS=Object.freeze({maxTeams:3,maxTeamSize:4,maxPilots:12,formationSeconds:4.5,spawnGrace:2.5,playerRespawnSeconds:3,botRespawnSeconds:8,matchSeconds:480});
function normalizedTeams(mode,teamSize,teamSizes){
 const legacy=clamp(Math.floor(Number(teamSize))||1,1,3);
 if(mode==='freeflight')return[1];
 if(mode!=='dogfight'||!Array.isArray(teamSizes))return[legacy,legacy];
 const sizes=teamSizes.slice(0,COMBAT_LIMITS.maxTeams).map(n=>clamp(Math.floor(Number(n))||1,1,COMBAT_LIMITS.maxTeamSize));
 while(sizes.length<2)sizes.push(1);
 return sizes;
}
function formationPoint(origin,yaw,slot,spacing,type='vee'){
 const row=type==='echelon'?slot:Math.ceil(slot/2),side=type==='echelon'?1:slot%2===1?-1:1;
 const across=slot?side*row*spacing:0,behind=slot?row*spacing*.78:0;
 return{x:origin.x+Math.cos(yaw)*across-Math.sin(yaw)*behind,y:origin.y,z:origin.z-Math.sin(yaw)*across-Math.cos(yaw)*behind};
}
function corridorFloor(pos,yaw,speed,seconds=4.5){
 // Check the whole airframe and its initial forward path, not just the spawn point.
 let height=-Infinity;
 for(let n=0;n<=5;n++)for(const side of[-35,0,35]){
  const along=speed*seconds*n/5,x=pos.x+Math.sin(yaw)*along+Math.cos(yaw)*side,z=pos.z+Math.cos(yaw)*along-Math.sin(yaw)*side;
  height=Math.max(height,surfaceHeight(x,z));
 }
 return height;
}
function liftFormationClear(g,formation){
 const speed=g.combatMission?175:g.mode==='strike'?185:FLIGHT.cruiseSpeed,clearance=g.arenaId==='valley'?175:240;
 for(let slot=0;slot<g.teamSizes[formation.team];slot++){
  const point=formationPoint(formation.origin,formation.yaw,slot,formation.spacing,formation.type);
  formation.origin.y=Math.max(formation.origin.y,corridorFloor(point,formation.yaw,speed)+clearance);
 }
 return formation;
}
function createFormations(g){
 const formations=[],attacker=g.role==='defend'?1:0;
 // Discard one LCG value so nearby seeds still produce varied approach sectors.
 random(g);const sector=Math.floor(random(g)*4),turn=Math.floor(random(g)*2)+1;
 for(let team=0;team<g.teamSizes.length;team++){
  let origin={x:0,y:850,z:-1100},yaw=0;
  if(g.combatMission&&g.missionId!=='ambush'){
   const route=g.combatMission.route,start=route[0],next=route[1],escort=team===g.combatMission.transportTeam;
   yaw=Math.atan2(next.x-start.x,next.z-start.z);origin={...start};
   if(escort){origin.x+=Math.sin(yaw)*260;origin.z+=Math.cos(yaw)*260;}
   else{const advance=g.arenaId==='valley'?2400:2700,side=g.arenaId==='valley'?360:1400;origin.x+=Math.sin(yaw)*advance+Math.cos(yaw)*side;origin.z+=Math.cos(yaw)*advance-Math.sin(yaw)*side;yaw=angle(yaw+Math.PI);}
  }
  else if(g.missionId==='ambush'){
   origin=g.arenaId==='valley'?valleyPoint(team===0?-1000:-2500,team===0?0:170,235+team*25):{x:team===0?0:300,y:850+team*35,z:team===0?-1100:-2750};
   yaw=g.arenaId==='valley'?Math.PI/2:0;
  }
  else if(g.mode==='dogfight'&&g.arenaId==='valley'){
   const reverse=sector%2===1,ends=reverse?[3450,-2700]:[-2700,3450],x=team<2?ends[team]:(reverse?-1600:2350),offset=team===2?-510:team===0?-140:210;
   origin=valleyPoint(x,offset,VALLEY.cruiseClearance+team*25);
   const toward=valleyPoint(team===0?ends[1]:ends[0],0);yaw=Math.atan2(toward.x-origin.x,toward.z-origin.z);
  }
  else if(g.mode==='strike'){origin=team===attacker?{x:0,y:450,z:-2450}:{x:1800,y:650,z:300};yaw=team===attacker?0:-Math.PI/2;}
  else if(team>0){const approachSector=(sector+(team-1)*turn)%4,bearing=approachSector*Math.PI/2+(random(g)-.5)*.42,range=(approachSector===2?1550:approachSector%2?2350:3300)+random(g)*(approachSector===2?300:450);
   origin={x:Math.sin(bearing)*range,y:850+team*75,z:-1100+Math.cos(bearing)*range};yaw=angle(bearing+Math.PI);}
  const spacing=(g.mode==='strike'&&team===attacker||g.combatMission?.transportTeam===team?AIRCRAFT_RADIUS.bomber:AIRCRAFT_RADIUS.fighter)*3;
  formations.push(liftFormationClear(g,{team,origin,yaw,spacing,type:team%2?'echelon':'vee',until:COMBAT_LIMITS.formationSeconds}));
 }
 return formations;
}
function spawnPilot(g,i,team,slot=0){
 const free=g.mode==='freeflight',strike=g.mode==='strike',attacker=g.role==='defend'?1:0;
 const transport=g.combatMission?.transportTeam===team&&slot===g.teamSizes[team]-1,bomber=transport||strike&&team===attacker&&slot===0,formation=g.formations[team];
 const departure=groundSpawn(g,{team,slot},slot),pos=departure.pos;
 return initializeFuel({...freshPilotG(),engineHealth:1,controlHealth:1,id:i===0?'host':`bot${i}`,team,slot,human:i===0,bomber,objectiveRole:transport?'transport':null,personality:transport?'transport':g.teamSizes[team]-(g.combatMission?.transportTeam===team?1:0)>=2&&slot<2?'paired':((g.rng+team+slot)%2?'aggressive':'cautious'),pos,yaw:free?0:formation.yaw,pitch:0,roll:0,speed:free?0:g.combatMission?transport?155:215:strike?(team===attacker?110:185):FLIGHT.cruiseSpeed,throttle:free?0:transport?.92:g.combatMission?.69:strike&&!bomber?(team===attacker?.55:.635):.78,hp:100,...fullWeaponStores({bomber,objectiveRole:transport?'transport':null}),...freshAirfieldResupply(pos),lastDamage:null,gunCD:0,gunShots:0,heatCD:0,radarCD:0,flareCD:0,chaffCD:0,bombCD:0,lock:0,targetId:null,dead:false,grounded:free,landed:false,runwayId:'home',throttleHeld:0,throttleDirection:0,aiTargetId:null,aiTargetUntil:0,aiGunBurst:0,aiGunRest:0,aiFlarePending:false,aiExtendYaw:0,aiTimer:0,aiShot:2+i*.6,aiDefend:0,aiBreak:0,aiNextBreak:7+i*1.9,rearm:0,aiEvade:0,spawnProtectedUntil:0,collisionGraceUntil:g.time+COMBAT_LIMITS.spawnGrace,respawnAt:null,deaths:0,kills:0,trail:[],...departure},g.startingFuel);
}
export function createGame({mode='dogfight',teamSize=1,teamSizes,skirmish=false,role='attack',seed=64821,difficulty='normal',routeId='local',arenaId='coast',missionId='dogfight',startingFuel=.75}={}){
 if(!['dogfight','strike','freeflight'].includes(mode))mode='dogfight';
 if(!Object.hasOwn(ROUTES,routeId))routeId='local';
 if(mode!=='dogfight'||!Object.hasOwn(ARENAS,arenaId))arenaId='coast';
 missionId=mode==='dogfight'?combatMissionId(missionId):'dogfight';
 const tactical=missionId!=='dogfight',transportTeam=missionId==='escort'?0:missionId==='intercept'?1:null;
 const sizes=normalizedTeams(mode,teamSize,tactical?undefined:teamSizes);
 if(transportTeam!==null)sizes[transportTeam]++;
 if(missionId==='ambush')sizes[1]=Math.max(2,sizes[1]);
 const g={version:2,startingFuel:clamp(Number(startingFuel)||.75,.25,1),mode,missionId,combatMission:tactical?{transportTeam,route:transportTeam===null?[]:missionRoute(arenaId),routeIndex:1,deadline:missionId==='ambush'?90:150}:null,arenaId,routeId,destinationId:ROUTES[routeId].destination,teamSize:sizes[0],teamSizes:sizes,skirmish:mode==='dogfight'&&!tactical&&skirmish===true,scores:sizes.map(()=>0),role:role==='defend'?'defend':'attack',difficulty:difficulty==='ace'?'ace':'normal',rng:seed>>>0,time:0,tick:0,status:'playing',result:null,pilots:[],missiles:[],bullets:[],countermeasures:[],bombs:[],effects:[],events:[],serial:0,targetHp:100,bombed:false,routeIndex:0,flightStage:'takeoff',approachIndex:0,missionMessage:'',escaped:false};
 g.formations=createFormations(g);
 for(let team=0;team<sizes.length;team++)for(let slot=0;slot<sizes[team];slot++)g.pilots.push(spawnPilot(g,g.pilots.length,team,slot));
 emit(g,'start',tactical?COMBAT_MISSIONS[missionId].description:mode==='freeflight'?'Clear for takeoff. Add power, then gently climb.':mode==='strike'?(g.role==='attack'?'Strike package ready at the airport. Take off, reach the target, then escape.':'Intercept the bomber before it escapes.'):'Airport departure. Add power; above 155 knots hold W to lift off. Gear is automatic; K enables advanced manual controls. Land and stop at your HOME runway to repair; fly within 250 m of HOME to rearm.');
 return g;
}
export function configurePlayers(g,ids=['host']){
 if(g.mode==='freeflight'){
  for(let i=g.pilots.length;i<Math.min(ids.length,6);i++){const p=spawnPilot(g,i,0,i);g.pilots.push(p)}
  g.pilots.forEach((p,i)=>{p.id=ids[i]||`bot${i}`;p.human=!!ids[i]});return;
 }
 const seats=[];
 for(let slot=0;slot<Math.max(...g.teamSizes);slot++)for(let team=0;team<g.teamSizes.length;team++){
  const p=g.pilots.find(p=>p.team===team&&p.slot===slot&&!p.objectiveRole);if(p)seats.push(p);
 }
 for(let i=0;i<Math.min(ids.length,seats.length);i++){seats[i].id=ids[i];seats[i].human=true}
}
function emit(g,type,text,extra={}){g.events.push({id:++g.serial,type,text,t:g.time,...extra});if(g.events.length>24)g.events.shift()}
function recordDamage(g,p,weapon,sourceId,amount,origin){
 if(weapon!=='terrain'&&weapon!=='collision'){p.engineHealth=clamp((p.engineHealth??1)-amount*.004,0,1);p.controlHealth=clamp((p.controlHealth??1)-amount*.006,0,1);}
 p.lastDamage={id:++g.serial,weapon,sourceId,amount,t:g.time,bearing:origin?angle(desiredHeading(p,origin)-p.yaw):null};
}
function kill(g,p,source){if(p.dead)return;if(source==='terrain'||source==='collision')recordDamage(g,p,source,null,p.hp,null);p.hp=0;p.dead=true;p.deaths=(p.deaths||0)+1;p.lock=0;p.targetId=null;
 p.respawnAt=g.skirmish?g.time+(p.human?COMBAT_LIMITS.playerRespawnSeconds:COMBAT_LIMITS.botRespawnSeconds):null;
 const killer=g.pilots.find(q=>q.id===source&&q.team!==p.team);if(killer){killer.kills=(killer.kills||0)+1;g.scores[killer.team]=(g.scores[killer.team]||0)+1;}
 g.effects.push({id:++g.serial,type:'explosion',pos:{...p.pos},age:0,life:2.3});emit(g,'kill',`${p.human?'Pilot':p.bomber?'Bomber':'Bandit'} down`,{pilotId:p.id,source});}
// Rejoin the same running match. The UI remains responsible for the human's choice.
export function respawnPilot(g,id){
 const p=g.pilots.find(p=>p.id===id);
 if(!g.skirmish||g.mode!=='dogfight'||g.status!=='playing'||!p?.dead||g.time<(p.respawnAt??Infinity))return false;
 const fresh=spawnPilot(g,g.pilots.indexOf(p),p.team,p.slot),identity={id:p.id,human:p.human,kills:p.kills||0,deaths:p.deaths||0};
 const field=AIRFIELDS[fresh.runwayId];let safe=null;
 for(let attempt=0;attempt<12;attempt++){
  const candidate=fieldPoint(field,0,-field.halfLength+100+attempt*105,3);
  if(g.pilots.every(q=>q===p||q.dead||dist(candidate,q.pos)>collisionRadius(q)+collisionRadius(p)+35)){safe=candidate;break;}
 }
 if(!safe){p.respawnBlocked=true;return false;}
 Object.assign(p,fresh,identity,freshAirfieldResupply(safe),{pos:safe,spawnProtectedUntil:0,respawnAt:null,respawnBlocked:false});
 // Missiles aimed at the previous airframe cannot reacquire the replacement.
 for(const m of g.missiles)if(m.targetId===id){m.seekerLost=true;m.targetId=null;}
 emit(g,'respawn',p.human?'Ready at the airport. Add power and climb to rejoin.':'Squad reinforcement preparing for takeoff',{pilotId:id});return true;
}
function updateAircraftCollisions(g,previous){
 const contacts=[];
 for(let i=0;i<g.pilots.length;i++)for(let j=i+1;j<g.pilots.length;j++){
  const a=g.pilots[i],b=g.pilots[j];
  if(a.dead||b.dead||g.time<Math.max(a.spawnProtectedUntil||0,a.collisionGraceUntil||0)||g.time<Math.max(b.spawnProtectedUntil||0,b.collisionGraceUntil||0))continue;
  const a0=previous.get(a.id),b0=previous.get(b.id);if(!a0||!b0)continue;
  const t=sweptSphereHit(a0,a.pos,b0,b.pos,collisionRadius(a)+collisionRadius(b));
  if(t!==null)contacts.push({a,b,a0,b0,t});
 }
 contacts.sort((a,b)=>a.t-b.t);
 for(const{a,b,a0,b0,t}of contacts){if(a.dead||b.dead)continue;
  const at=(from,to)=>({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t});
  a.pos=at(a0,a.pos);b.pos=at(b0,b.pos);
  const pos={x:(a.pos.x+b.pos.x)/2,y:(a.pos.y+b.pos.y)/2,z:(a.pos.z+b.pos.z)/2};
  g.effects.push({id:++g.serial,type:'collision',pos,age:0,life:1.5});
  emit(g,'collision','Mid-air collision',{pilotId:a.id,targetId:b.id});kill(g,a,'collision');kill(g,b,'collision');
 }
}
function formationInput(g,p){
 const squad=g.formations?.[p.team];if(!squad||g.time>squad.until)return null;
 const leader=g.pilots.find(q=>q.team===p.team&&q.slot===0&&!q.dead);if(!leader)return null;
 if(leader===p){const speed=p.bomber?115:g.combatMission?215:g.mode==='strike'?185:FLIGHT.cruiseSpeed;return{roll:clamp(angle(squad.yaw-p.yaw)*2,-1,1),pitch:0,yaw:0,throttle:p.speed<speed-.5?.15:p.speed>speed+.5?-.15:0};}
 const slot=formationPoint(leader.pos,leader.yaw,p.slot,squad.spacing,squad.type),f=forward(leader),lead=Math.max(200,leader.speed*1.2);
 const target={x:slot.x+f.x*lead,y:slot.y+f.y*lead,z:slot.z+f.z*lead},input=steer(p,target);
 const along=(slot.x-p.pos.x)*f.x+(slot.z-p.pos.z)*f.z,desired=leader.speed+clamp(along*.45,-35,35);
 input.throttle=p.speed<desired-1?.25:p.speed>desired+1?-.25:0;return input;
}
export function desiredHeading(p,target){return Math.atan2(target.x-p.pos.x,target.z-p.pos.z)}
function terrainAvoidance(g,p,input){
 const i={...input},f=forward(p),valley=g.arenaId==='valley',ground=surfaceHeight(p.pos.x,p.pos.z);
 if(valley){
  const look={x:p.pos.x+f.x*p.speed*3.6,z:p.pos.z+f.z*p.speed*3.6};
  if(!inValley(p.pos,-130)||!inValley(look,-160)){
   // Turn back along the corridor before reaching a wall or leaving its mouth.
   // All pilots still use the same controls; there is no position snapping.
   const returning=p.pos.x<VALLEY.minX+850||p.pos.x>VALLEY.maxX-850;
   const x=returning?500:clamp(p.pos.x+(f.x>=0?1000:-1000),VALLEY.minX+900,VALLEY.maxX-900);
   const target=valleyPoint(x,0,VALLEY.cruiseClearance+(p.slot%2)*35),safe=steer(p,target);
   i.roll=safe.roll;i.yaw=safe.yaw;i.pitch=safe.pitch;i.fireGun=false;
  }else if(p.pos.y>valleyFloor(p.pos.x)+430){
   i.pitch=Math.min(i.pitch,-.22);
  }
 }
 let pullUp=0;
 for(const seconds of[.8,1.6,2.8]){
  const x=p.pos.x+f.x*p.speed*seconds,z=p.pos.z+f.z*p.speed*seconds;
  const predicted=p.pos.y+(f.y*p.speed-(p.stallSink||0))*seconds;
  const margin=valley?115:200,deficit=surfaceHeight(x,z)+margin-predicted;
  if(deficit>0)pullUp=Math.max(pullUp,clamp(deficit/180,.15,.9));
 }
 if(p.pos.y<ground+(valley?135:190))pullUp=Math.max(pullUp,.85);
 if(pullUp){i.pitch=Math.max(i.pitch,pullUp);i.throttle=Math.max(i.throttle||0,.5);i.fireGun=false;}
 // Stay below the world ceiling, not an arbitrary low-altitude combat lid.
 // A target above 1,700 m must remain reachable without forced diving.
 if(!valley&&p.pos.y>5200&&!pullUp)i.pitch=Math.min(-.35,i.pitch);
 // Ease off high-load pursuits before an energy stall; regain speed with power.
 if(p.speed<(p.stallSpeed||83)+25){i.throttle=1;i.roll=clamp(i.roll||0,-.3,.3);if(!pullUp)i.pitch=Math.min(i.pitch||0,.05);}
 return i;
}
function pursuitTarget(g,p){
 let nearest=null,nearestRange=Infinity,current=null,currentRange=Infinity;
 for(const q of g.pilots){if(q.dead||q.team===p.team||g.time<(q.spawnProtectedUntil||0))continue;
  const range=dist(p.pos,q.pos);if(q.id===p.aiTargetId){current=q;currentRange=range;}
  if(range<nearestRange){nearest=q;nearestRange=range;}
 }
 // Pursuit and weapon lock are separate. A nearby formation member should not
 // steal either every frame, but a dead/distant opponent is replaced promptly.
 const retained=current&&currentRange<6500&&(g.time<(p.aiTargetUntil||0)||nearestRange>currentRange*.6);
 let enemy=retained?current:nearest;
 const transport=g.combatMission&&g.pilots.find(q=>q.objectiveRole==='transport'&&!q.dead);
 if(transport&&transport.team!==p.team&&(p.slot===0||p.personality==='aggressive'))enemy=transport;
 if(p.personality==='paired'&&p.slot%2===1){
  const leader=g.pilots.find(q=>q.team===p.team&&q.slot===p.slot-1&&!q.dead),shared=leader&&g.pilots.find(q=>q.id===(leader.human?leader.targetId:leader.aiTargetId)&&!q.dead&&q.team!==p.team&&g.time>=(q.spawnProtectedUntil||0));
  if(shared&&dist(p.pos,shared.pos)<6500)enemy=shared;
 }
 if(enemy?.id!==p.aiTargetId){p.aiTargetId=enemy?.id||null;p.aiTargetUntil=g.time+4;}
 return enemy;
}
function ai(g,p,dt){
 if(g.mode==='freeflight')return{};
 const departure=departureInput(g,p);if(departure)return departure;
 const ace=g.mode==='dogfight'||g.difficulty==='ace',cautious=p.personality==='cautious',aggressive=p.personality==='aggressive';let target,enemy=null;
 if(p.objectiveRole==='transport'){
  const m=g.combatMission,waypoint=m?.route[Math.min(m.routeIndex,m.route.length-1)];if(!waypoint)return terrainAvoidance(g,p,{throttle:0});
  const input=steer(p,waypoint);input.roll=clamp(input.roll,-.5,.5);input.throttle=p.speed<150?.5:p.speed>164?-.35:0;
  // The unarmed transport flies the route with the same energy, G and terrain rules.
  return terrainAvoidance(g,p,avoidAircraft(g,p,input));
 }
 if(g.arenaId==='valley'&&!inValley(p.pos,-100)){const rendezvous=valleyPoint(500,0,550),route=steer(p,rendezvous);route.throttle=p.throttle<.82?.5:0;return terrainAvoidance({...g,arenaId:'coast'},p,route);}
 const form=g.mode!=='freeflight'?formationInput(g,p):null;if(form)return terrainAvoidance(g,p,form);
 if(g.mode==='strike'&&p.bomber){
  target={...(g.bombed?ESCAPE:{...TARGET,y:430})};
  // The heavy airframe needs a longer terrain horizon than a dogfighting jet.
  // Climb before the coastal ridge, then settle onto the actual target line.
  const range=horizontal(p.pos,target),dx=(target.x-p.pos.x)/Math.max(1,range),dz=(target.z-p.pos.z)/Math.max(1,range);
  for(let ahead=0;ahead<=Math.min(range,5000);ahead+=250)target.y=Math.max(target.y,surfaceHeight(p.pos.x+dx*ahead,p.pos.z+dz*ahead)+350);
 }
 else{
  enemy=pursuitTarget(g,p);if(!enemy)return terrainAvoidance(g,p,{roll:0,pitch:0,yaw:0,throttle:0});
  const range=dist(p.pos,enemy.pos),ef=forward(enemy),gun=gunIntercept(p,enemy,1000),lead=clamp(range/Math.max(180,p.speed+enemy.speed),.2,aggressive?1.15:ace?1.1:cautious?.65:.8);
  target=gun?.point||{x:enemy.pos.x+ef.x*enemy.speed*lead,y:enemy.pos.y+ef.y*enemy.speed*lead,z:enemy.pos.z+ef.z*enemy.speed*lead};
  if(p.personality==='paired'&&p.slot%2===1&&range>850){const side=p.team%2?1:-1;target={x:target.x+Math.cos(enemy.yaw)*side*230,y:target.y+70,z:target.z-Math.sin(enemy.yaw)*side*230};}
 }
 if(g.arenaId==='valley'){const x=clamp(target.x,VALLEY.minX+550,VALLEY.maxX-550);target={x,z:valleyCenter(x)+clamp(target.z-valleyCenter(x),-470,470),y:clamp(target.y,valleyFloor(x)+140,valleyFloor(x)+340)};}
 let i=steer(p,target);const headingError=Math.abs(angle(desiredHeading(p,target)-p.yaw));
 p.aiNextBreak=Math.max(0,(p.aiNextBreak||0)-dt);p.aiBreak=Math.max(0,(p.aiBreak||0)-dt);
 const lowEnergy=!p.bomber&&p.speed<Math.max(155,(p.stallSpeed||83)+35),overshot=enemy&&dist(p.pos,enemy.pos)<500&&headingError>1.25;
 if(!p.bomber&&p.aiBreak<=0&&p.aiNextBreak<=0&&(lowEnergy||overshot||cautious&&p.hp<55||headingError>1.6&&p.speed>300)){
  p.aiBreak=lowEnergy?3.2:cautious?3.6:aggressive?1.6:ace?1.8:2.5;p.aiNextBreak=p.aiBreak+(cautious?3:aggressive?6:ace?4:5);p.aiExtendYaw=p.yaw;
 }
 if(p.aiBreak>0){
  // A short, shallow extension unloads the wing instead of circling ever slower.
  i.roll=clamp(angle((p.aiExtendYaw??p.yaw)-p.yaw)*1.4,-.18,.18);i.yaw=0;
  const clearance=p.pos.y-surfaceHeight(p.pos.x,p.pos.z);i.pitch=lowEnergy&&clearance>260?-.1:0;
 }
 let desiredSpeed=p.bomber?245:g.mode==='strike'?185:g.arenaId==='valley'?(ace?265:245):FLIGHT.cruiseSpeed+(p.slot%3)*8+(aggressive?18:cautious?-15:0);
 if(enemy&&!p.bomber&&g.mode!=='strike'&&g.arenaId!=='valley'){
  const range=dist(p.pos,enemy.pos);
  // Close on a straight runner, then match speed for a sustained firing pass.
  // In a hard turn shed excess energy instead of demanding cruise power.
  desiredSpeed=headingError<.7?clamp(enemy.speed+clamp((range-400)*.045,-45,90),210,470):Math.min(desiredSpeed,headingError>1.25?255:285);
 }
 // Throttle is a lever, not an instant speed setting. Anticipate acceleration
 // so boosted thrust does not repeatedly overshoot into a wide, slow turn.
 const predictedSpeed=p.speed+(p.speedAcceleration||0)*1.8;
 i.throttle=clamp((desiredSpeed-predictedSpeed)*.025,-.7,.7);
 if(lowEnergy||p.aiBreak>0&&p.speed<desiredSpeed)i.throttle=1;
 if(g.mode==='strike'&&p.bomber&&canBomb(g,p)&&p.bombCD<=0&&!g.bombs.some(b=>b.ownerId===p.id)){
  // Account for the aircraft's vertical velocity, not just horizontal distance
  // to a fixed release point. Hold the remaining stores until impact is known.
  const f=forward(p),vy=f.y*p.speed,t=(vy+Math.sqrt(vy*vy+90*Math.max(0,p.pos.y-4)))/45;
  const impact={x:p.pos.x+f.x*p.speed*t,z:p.pos.z+f.z*p.speed*t};
  if(horizontal(impact,TARGET)<180)i.bomb=true;
 }
 let incoming=null,incomingRange=Infinity;
 for(const m of g.missiles){if(m.targetId!==p.id||m.decoyed||m.seekerLost||m.age>=m.life)continue;const range=dist(m.pos,p.pos);if(range<(ace?1500:1250)&&range<incomingRange){incoming=m;incomingRange=range;}}
 p.aiShot=Math.max(0,(p.aiShot||0)-dt);p.aiDefend=Math.max(0,(p.aiDefend||0)-dt);p.aiEvade=Math.max(0,(p.aiEvade||0)-dt);
 if(incoming&&p.aiDefend<=0){p.aiDefend=(ace?3.2:5)+random(g)*(ace?1.5:2);if(random(g)<(ace?.88:cautious?.75:aggressive?.5:.62)){p.aiFlarePending=incoming.type==='heat';i.chaff=incoming.type==='radar';}p.aiEvade=2.5+random(g)*1.5;}
 if(incoming?.type==='heat'){
  // Extinguish afterburner before dispensing; terrain/stall recovery may still
  // override power below. Bots obey the same flare chances as human pilots.
  if(p.throttle>.68)i.throttle=-1;
  if(p.aiFlarePending&&(p.bomber||p.throttle<=.8)){i.flare=true;p.aiFlarePending=false;}
 }else p.aiFlarePending=false;
 if(p.aiEvade>1.5){i.roll+=(p.team===0?.45:-.45);i.pitch=clamp(i.pitch+.15,-1,1);}
 if(!p.bomber&&g.mode!=='freeflight'&&p.targetId&&p.lock>.8&&p.aiShot<=0){const locked=g.pilots.find(q=>q.id===p.targetId&&!q.dead);if(locked&&dist(p.pos,locked.pos)<(ace?2900:2300)){i.fireHeat=p.heat>0&&(random(g)<.65||p.radar<=0);i.fireRadar=!i.fireHeat&&p.lock>1.45;p.aiShot=(ace?3.5:4.5)+(cautious?1.4:aggressive?-.5:p.personality==='paired'?p.slot%2*.7:0)+random(g)*(ace?1.8:2.5);}}
 p.aiGunBurst=Math.max(0,(p.aiGunBurst||0)-dt);p.aiGunRest=Math.max(0,(p.aiGunRest||0)-dt);
 const gun=enemy&&p.aiBreak<=0&&p.aiEvade<=0?gunIntercept(p,enemy,ace?850:700):null;
 if(gun){const f=forward(p),muzzle=gunMuzzleForAI(p),dx=gun.point.x-muzzle.x,dy=gun.point.y-muzzle.y,dz=gun.point.z-muzzle.z,length=Math.hypot(dx,dy,dz),tolerance=clamp((enemy.bomber?18:11)/gun.range,.012,.045)*(ace?1:.85);
  const aligned=(dx*f.x+dy*f.y+dz*f.z)/Math.max(1,length)>Math.cos(tolerance);
  if(aligned&&p.aiGunRest<=0&&p.aiGunBurst<=0){p.aiGunBurst=ace?.36:.24;p.aiGunRest=(ace?.9:1.4)+random(g)*.6;}
  i.fireGun=aligned&&p.aiGunBurst>0;
 }
 // Predict closest approach before committing to a firing pass. Formation,
 // collision, valley containment and terrain clearance always outrank pursuit.
 i=avoidAircraft(g,p,i);
 if(p.pos.x<WORLD_BOUNDS.minX||p.pos.x>WORLD_BOUNDS.maxX||p.pos.z<WORLD_BOUNDS.minZ||p.pos.z>WORLD_BOUNDS.maxZ)i={...i,...steer(p,g.arenaId==='valley'?valleyPoint(500):{x:0,y:650,z:0}),fireGun:false};
 return terrainAvoidance(g,p,i);
}
function avoidAircraft(g,p,i){
 const pf=forward(p),ownIndex=g.pilots.indexOf(p);let imminent=null,best=Infinity;
 for(const q of g.pilots){if(q===p||q.dead||dist(p.pos,q.pos)>1100)continue;
  const qf=forward(q),r={x:q.pos.x-p.pos.x,y:q.pos.y-p.pos.y,z:q.pos.z-p.pos.z},v={x:qf.x*q.speed-pf.x*p.speed,y:qf.y*q.speed-pf.y*p.speed,z:qf.z*q.speed-pf.z*p.speed};
  const vv=v.x*v.x+v.y*v.y+v.z*v.z,t=clamp(-(r.x*v.x+r.y*v.y+r.z*v.z)/Math.max(1,vv),0,2.2);
  const separation=Math.hypot(r.x+v.x*t,r.y+v.y*t,r.z+v.z*t);
  if(separation<collisionRadius(p)+collisionRadius(q)+55&&t<best){best=t;imminent=q;}
 }
 if(imminent){const side=angle(desiredHeading(p,imminent.pos)-p.yaw);i.roll=side>=0?-.8:.8;i.pitch=ownIndex<g.pilots.indexOf(imminent)?.85:-.85;i.fireGun=false;}
 return i;
}
export function steer(p,target){const heading=angle(desiredHeading(p,target)-p.yaw),d=horizontal(p.pos,target),pitch=Math.atan2(target.y-p.pos.y,Math.max(100,d));return{roll:clamp(heading*2.1,-1,1),pitch:clamp((pitch-p.pitch)*3.8,-1,1),yaw:clamp(heading*0.12,-0.3,0.3),throttle:0}}
function selectTarget(g,p){
 let best=null,score=Infinity,current=null,currentScore=Infinity;const f=forward(p);
 for(const q of g.pilots){if(q.dead||q.team===p.team||g.time<(q.spawnProtectedUntil||0))continue;
  const d=dist(p.pos,q.pos),dot=((q.pos.x-p.pos.x)*f.x+(q.pos.y-p.pos.y)*f.y+(q.pos.z-p.pos.z)*f.z)/Math.max(1,d),a=Math.acos(clamp(dot,-1,1));
  if(d>=4200||a>=.58)continue;const candidate=d*(a+.2);
  if(q.id===p.targetId){current=q;currentScore=candidate;}if(candidate<score){best=q;score=candidate;}
 }
 // The same acquisition cone/range still applies. Switch only for a clearly
 // better candidate, so a close formation does not reset lock every tick.
 return current&&score>=currentScore*.65?current:best;
}
function launch(g,p,type){if(p.bomber||p.grounded||g.time<(p.spawnProtectedUntil||0))return;const cd=type==='heat'?'heatCD':'radarCD';if(p[cd]>0||p[type]<=0)return;const target=g.pilots.find(q=>q.id===p.targetId&&!q.dead);if(!target||missileImmune(target)||p.lock<(type==='heat'?0.45:1.45))return;
 p[type]--;p[cd]=type==='heat'?1.65:2.5;const f=forward(p);g.missiles.push({id:++g.serial,type,ownerId:p.id,team:p.team,targetId:target.id,pos:{x:p.pos.x+f.x*18,y:p.pos.y+f.y*18-2,z:p.pos.z+f.z*18},dir:f,speed:p.speed+90,age:0,life:type==='heat'?13:17,decoyed:false,seekerLost:false,lostTime:0});emit(g,'launch',type==='heat'?'Fox two · heat seeker away':'Fox one · radar missile away',{pilotId:p.id});}
export function bombSolution(p){const t=Math.sqrt(Math.max(0,p.pos.y-4)*2/45),f=forward(p);return{x:p.pos.x+f.x*p.speed*t,y:4,z:p.pos.z+f.z*p.speed*t}}
export function canBomb(g,p){return p.bomber&&p.bombs>0&&!g.bombed&&p.pos.y>100&&p.pos.y<1000&&horizontal(bombSolution(p),TARGET)<330}
function counter(g,p,type){const key=type==='flare'?'flares':'chaff',cd=type+'CD';if(!p[key]||p[cd]>0)return;p[key]--;p[cd]=1.2;const burstId=g.serial+1;for(let i=0;i<6;i++)g.countermeasures.push({id:++g.serial,burstId,type,ownerId:p.id,pos:{...p.pos},vel:{x:(random(g)-.5)*60,y:(random(g)-.5)*40-12,z:(random(g)-.5)*60},age:0,life:type==='flare'?3.8:5});emit(g,'counter',type==='flare'?'Flares out':'Chaff out',{pilotId:p.id})}
function updatePilot(g,p,input,dt){
 if(p.dead)return;
 for(const k of ['gunCD','heatCD','radarCD','flareCD','chaffCD','bombCD'])p[k]=Math.max(0,p[k]-dt);
 if(input?.toggleManeuver){p.maneuverAssist=!p.maneuverAssist;emit(g,'systems',`Advanced arcade mode ${p.maneuverAssist?'ON · manual G / X':'OFF · automatic systems'}`,{pilotId:p.id});}
 automaticSystems(p);
 if(p.maneuverAssist&&input?.toggleAirbrake){p.airbrake=!p.airbrake;emit(g,'systems',`Airbrake ${p.airbrake?'DEPLOYED':'STOWED'}`,{pilotId:p.id});}
 if(p.maneuverAssist&&input?.toggleGear){if(!p.grounded){p.gearDown=!p.gearDown;emit(g,'systems',`Landing gear ${p.gearDown?'DOWN':'UP'}`,{pilotId:p.id});}else emit(g,'systems','Landing gear stays down while on the ground',{pilotId:p.id});}
 const i={...pilotGInput(p,input||{})},before=forward(p),wasGrounded=p.grounded,previousHeight=p.pos.y;
 i.brake=!!(i.brake||p.airbrake||(p.human&&!p.maneuverAssist&&p.grounded&&p.landed&&p.throttle<=.2));p.departureHold=departureBlocked(g,p);if(p.departureHold){i.brake=true;i.pitch=0;}p.braking=!!i.brake;p.repairing=false;
 const powerInput=clamp(Number(i.throttle)||0,-1,1),manualPower=p.human&&Math.abs(powerInput)>.9,direction=manualPower?Math.sign(powerInput):0;
 p.throttleHeld=direction&&direction===p.throttleDirection?(p.throttleHeld||0)+dt:0;p.throttleDirection=direction;
 // Fine taps, fast held travel. Assist and AI retain their gentler power rate;
 // only the throttle lever is quicker, never the aircraft's energy response.
 const powerRate=manualPower?(p.throttleHeld<.16?.6:1.25):.38;
 p.throttle=clamp(p.throttle+powerInput*dt*powerRate,0,1);
 if(p.grounded){p.pitch=0;p.roll=0;p.yaw+=clamp(Number(i.roll)||0,-1,1)*dt*(p.speed<60?0.32:0.15)+clamp(Number(i.yaw)||0,-1,1)*dt*.28;
 if(!p.departureHold&&p.speed>=Math.max(AIRPORT.takeoffSpeed,(p.stallSpeed||AIRPORT.takeoffSpeed)*1.03)&&Number(i.pitch)>.12){p.grounded=false;p.landed=false;p.flightState='airborne';p.departureActive=g.mode!=='freeflight';p.pitch=.12;p.pos.y=(AIRFIELDS[p.runwayId]?.elevation||0)+4;emit(g,'takeoff',g.mode==='freeflight'?'Positive climb. Follow the route.':'Airborne. Join the fight.',{pilotId:p.id});if(g.mode==='freeflight'&&p.id==='host'){g.flightStage=g.routeIndex>=routeFor(g).length?'approach':'route';if(g.flightStage==='approach')g.approachIndex=0}}
 }else if(p.human&&p.maneuverAssist&&!i.autopilot){advanceAttitude(p,i,dt);
 }else{
 const wantedRoll=clamp(Number(i.roll)||0,-1,1)*1.0;
 p.roll+=(wantedRoll-p.roll)*Math.min(1,dt*3.8);
 const pitchAuthority=clamp(p.speed/105,.25,1);
 const wantedPitch=clamp(Number(i.pitch)||0,-1,1)*.52*pitchAuthority;
 const maxPitchChange=pitchRateLimit(p)*dt;
 p.pitch+=clamp((wantedPitch-p.pitch)*Math.min(1,dt*1.8),-maxPitchChange,maxPitchChange);
 p.yaw=angle(p.yaw+(Math.sin(p.roll)*.62+clamp(Number(i.yaw)||0,-1,1)*.17)*dt*clamp(p.speed/100,.35,1.3)*turnAuthority(p.speed,p));
 }
 const f=forward(p);updatePilotG(p,before,f,dt,wasGrounded);advanceFlightEnergy(p,i,dt,{freeflight:g.mode==='freeflight'});
 if(p.departureHold)p.speed=0;
 if(p.grounded&&!p.landed)p.flightState=p.speed>1?'takeoff':'parked';
 if(!p.human&&!p.grounded&&p.pos.y>(AIRFIELDS[p.runwayId]?.elevation||0)+35)p.gearDown=false;
 if(!p.grounded&&p.departureActive&&p.pos.y>(AIRFIELDS[p.runwayId]?.elevation||0)+260)p.departureActive=false;
 p.pos.x+=f.x*p.speed*dt;p.pos.z+=f.z*p.speed*dt;
 if(!p.grounded)p.pos.y+=f.y*p.speed*dt-(p.stallSink||0)*dt;
 if(p.grounded){
  const field=AIRFIELDS[p.runwayId]||RUNWAY,local=fieldCoordinates(field,p.pos);
  if(Math.abs(local.across)>field.width||Math.abs(local.along)>field.halfLength){
   if(g.mode!=='freeflight'){
    if(p.speed>45)kill(g,p,'terrain');
    else{p.pos=fieldPoint(field,clamp(local.across,-field.width+2,field.width-2),clamp(local.along,-field.halfLength+2,field.halfLength-2),3);p.speed=0;p.throttle=0;}
   }else if(p.speed<45){p.pos=fieldPoint(field,0,-field.halfLength+180,3);p.yaw=field.heading;p.pitch=0;p.roll=0;p.speed=0;p.throttle=0;emit(g,'recovery',`Back on ${field.shortName} runway ${field.runway}. Up adds power; hold W to lift off.`,{pilotId:p.id});}
   else{p.grounded=false;p.landed=false;p.flightState='airborne';p.pos.y=Math.max(field.elevation+140,surfaceHeight(p.pos.x,p.pos.z)+140);p.pitch=.18;p.roll=0;p.speed=Math.max(110,p.speed);p.throttle=.8;emit(g,'recovery','Runway overrun · safe go-around. Keep climbing and follow the guide.',{pilotId:p.id});if(p.id==='host'){g.flightStage=g.routeIndex>=routeFor(g).length?'approach':'route';g.approachIndex=0;}}
  }
 }
 const landingField=fieldUnder(p.pos),ground=surfaceHeight(p.pos.x,p.pos.z),clearance=landingField?landingField.elevation+3:Math.max(3,ground+3);
 if(!p.dead&&!p.grounded&&p.pos.y<=clearance){
  if(previousHeight>=clearance-.5&&validTouchdown(p,landingField,f.y*p.speed-(p.stallSink||0))){
   p.grounded=true;p.pos.y=landingField.elevation+3;p.landed=true;p.flightState='landed';p.departureActive=false;p.runwayId=landingField.id;p.pitch=0;p.roll=0;
   const finished=g.mode==='freeflight'&&g.routeIndex>=routeFor(g).length&&landingField.id===g.destinationId;
   if(g.mode==='freeflight'&&p.id==='host')g.flightStage=finished?'landed':'practice';
   emit(g,'landed',g.mode!=='freeflight'?`Touchdown at ${landingField.shortName}. Reduce power and brake to repair. Missiles cannot hit you; guns still can.`:finished?'Touchdown! Hold brakes and roll to a stop.':`Practice landing at ${landingField.shortName}. The route is still open.`,{pilotId:p.id});
  }else if(g.mode==='freeflight'){
   p.pos.y=Math.max(100,ground+140);p.pitch=.18;p.speed=Math.max(110,p.speed);p.throttle=.8;emit(g,'recovery',!landingField?'TERRAIN · safe recovery. Climb above the ridge before turning.':!p.gearDown?(p.maneuverAssist?'GEAR UP · go around. Press G to lower gear before landing.':'Go around · slow down on your HOME approach for automatic gear.'):landingField&&landingField.id!==p.homeBaseId?'NOT YOUR BASE · only your HOME runway accepts landings.':'Go around · align with your HOME runway, gear down and below 224 knots.',{pilotId:p.id});
   if(p.id==='host'){g.flightStage=g.routeIndex>=routeFor(g).length?'approach':'route';g.approachIndex=0;}
  }else kill(g,p,'terrain');
 }
 p.pos.y=Math.max(p.grounded?(AIRFIELDS[p.runwayId]?.elevation||0)+3:0,Math.min(6000,p.pos.y));
 if(p.dead||p.blackedOut||p.objectiveRole==='transport')return;
 if(i.fireGun&&g.time>=(p.spawnProtectedUntil||0))fireGunRound(g,p);
 if(g.mode!=='freeflight'){
 const q=selectTarget(g,p);if(q&&!p.grounded&&!missileImmune(q)&&q.id===p.targetId)p.lock=Math.min(3,p.lock+dt);else{p.targetId=q?.id||null;p.lock=q&&!p.grounded&&!missileImmune(q)?dt:0}
 if(!p.bomber&&i.fireHeat)launch(g,p,'heat');if(!p.bomber&&i.fireRadar)launch(g,p,'radar');if(i.flare)counter(g,p,'flare');if(i.chaff)counter(g,p,'chaff');
 if(i.bomb&&p.bomber&&p.bombs>0&&p.bombCD<=0){p.bombs--;p.bombCD=1;g.bombs.push({id:++g.serial,ownerId:p.id,pos:{...p.pos},vel:{x:f.x*p.speed,y:f.y*p.speed,z:f.z*p.speed},age:0});emit(g,'bomb','Bomb released',{pilotId:p.id})}
 }
}
export const MISSILE=Object.freeze({
 heat:Object.freeze({maxSpeed:820,acceleration:145,turnRate:.42,seekerAngle:1.05,seekerMemory:.32,damage:48}),
 radar:Object.freeze({maxSpeed:980,acceleration:165,turnRate:.34,seekerAngle:1.12,seekerMemory:.45,damage:60})
});
const vectorDot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
function unitVector(v){const n=Math.hypot(v.x,v.y,v.z)||1;return{x:v.x/n,y:v.y/n,z:v.z/n}}
function turnMissile(direction,desired,maxAngle){
 const dot=clamp(vectorDot(direction,desired),-1,1),theta=Math.acos(dot);
 if(theta<1e-7||theta<=maxAngle)return{...desired};
 // An explicit angular limit is independent of frame rate and cannot snap onto
 // a target that crosses the nose during a close, high-speed break.
 let tangent={x:desired.x-direction.x*dot,y:desired.y-direction.y*dot,z:desired.z-direction.z*dot};
 if(Math.hypot(tangent.x,tangent.y,tangent.z)<1e-7)tangent={x:direction.z,y:0,z:-direction.x};
 tangent=unitVector(tangent);const c=Math.cos(maxAngle),sn=Math.sin(maxAngle);
 return unitVector({x:direction.x*c+tangent.x*sn,y:direction.y*c+tangent.y*sn,z:direction.z*c+tangent.z*sn});
}
function updateMissiles(g,dt,previous){
 for(const m of g.missiles){
  m.age+=dt;if(m.age>=m.life)continue;
  const groundedTarget=g.pilots.find(p=>p.id===m.targetId&&!p.dead);
  if(groundedTarget&&missileImmune(groundedTarget)){m.seekerLost=true;m.targetId=null;}
  const specs=MISSILE[m.type]||MISSILE.heat,target=g.pilots.find(p=>p.id===m.targetId&&!p.dead&&g.time>=(p.spawnProtectedUntil||0)),from={...m.pos};
  if(target&&!missileImmune(target)&&!m.decoyed&&!m.seekerLost){
   const appropriate=m.type==='heat'?'flare':'chaff',d=dist(m.pos,target.pos);
   const decoy=m.type==='heat'?tryHeatFlare(m,target,g.countermeasures,()=>random(g)):g.countermeasures.find(c=>c.ownerId===target.id&&c.type===appropriate&&c.age<2.2&&dist(c.pos,m.pos)<1100);
   if(decoy){m.decoyed=true;m.decoyPos={...decoy.pos};emit(g,'evade',`${appropriate==='flare'?'Heat seeker':'Radar missile'} defeated`,{pilotId:target.id});}
   else{
    const sight=unitVector({x:target.pos.x-m.pos.x,y:target.pos.y-m.pos.y,z:target.pos.z-m.pos.z});
    const interference=seekerInterference(m,target,sight),environmentLost=advanceSeekerInterference(m,interference,dt,()=>random(g));
    m.offBoresight=Math.acos(clamp(vectorDot(m.dir,sight),-1,1));
    const owner=g.pilots.find(p=>p.id===m.ownerId),unsupported=m.type==='radar'&&(!owner||owner.dead||owner.targetId!==target.id||owner.lock<.3);
    m.lostTime=(m.offBoresight>specs.seekerAngle||unsupported)?(m.lostTime||0)+dt:Math.max(0,(m.lostTime||0)-dt*2);
    if(m.lostTime>specs.seekerMemory||environmentLost){m.seekerLost=true;emit(g,'evade',environmentLost?(m.type==='radar'?'Radar missile lost the track in ground clutter':'Heat seeker lost the track in sun glare'):'Missile lost the track',{pilotId:target.id});}
    else{
     const lead=Math.min(2.5,d/Math.max(180,m.speed))*.68,f=forward(target);
     const aim=unitVector({x:target.pos.x+f.x*target.speed*lead-m.pos.x,y:target.pos.y+f.y*target.speed*lead-m.pos.y,z:target.pos.z+f.z*target.speed*lead-m.pos.z});
     m.dir=turnMissile(m.dir,aim,specs.turnRate*interference.turnScale*dt);
    }
   }
  }
  if(m.decoyed&&m.decoyPos)m.dir=turnMissile(m.dir,unitVector({x:m.decoyPos.x-m.pos.x,y:m.decoyPos.y-m.pos.y,z:m.decoyPos.z-m.pos.z}),specs.turnRate*dt);
  m.speed=Math.min(specs.maxSpeed,m.speed+dt*specs.acceleration);
  m.pos.x+=m.dir.x*m.speed*dt;m.pos.y+=m.dir.y*m.speed*dt;m.pos.z+=m.dir.z*m.speed*dt;
  // Relative swept proximity fuzing catches fast passes without granting a
  // perfect turn or letting missiles hit airframes after their seeker is lost.
  if(target&&!missileImmune(target)&&!m.decoyed&&!m.seekerLost){
   const old=previous?.get(target.id)||target.pos,t=sweptSphereHit(from,m.pos,old,target.pos,collisionRadius(target)+10);
   if(t!==null){target.hp=Math.max(0,target.hp-specs.damage);recordDamage(g,target,m.type,m.ownerId,specs.damage,from);m.age=m.life;const impact={x:from.x+(m.pos.x-from.x)*t,y:from.y+(m.pos.y-from.y)*t,z:from.z+(m.pos.z-from.z)*t};g.effects.push({id:++g.serial,type:'hit',pos:impact,age:0,life:.8});emit(g,'hit',m.type==='radar'?'Radar missile hit':'Heat missile hit',{pilotId:m.ownerId,targetId:target.id});if(target.hp<=0)kill(g,target,m.ownerId);}
  }
  if(m.pos.y<Math.max(0,surfaceHeight(m.pos.x,m.pos.z)))m.age=m.life;
 }
 g.missiles=g.missiles.filter(m=>m.age<m.life);
}
// One actionable warning: the most urgent incoming missile, otherwise an enemy
// acquiring a weapons lock. Bearing uses the simulation's positive-left yaw.
export function threatFor(g,pilot){
 const p=typeof pilot==='string'?g.pilots.find(q=>q.id===pilot):pilot;if(!p||p.dead||missileImmune(p))return null;
 const incoming=[];
 for(const m of g.missiles){if(m.targetId!==p.id||m.decoyed||m.seekerLost||m.age>=m.life)continue;
  const distance=dist(p.pos,m.pos),line=unitVector({x:p.pos.x-m.pos.x,y:p.pos.y-m.pos.y,z:p.pos.z-m.pos.z}),f=forward(p);
  const closing=vectorDot(m.dir,line)*m.speed-vectorDot(f,line)*p.speed,acceleration=MISSILE[m.type]?.acceleration||145;
  const timeToImpact=(-closing+Math.sqrt(closing*closing+2*acceleration*distance))/acceleration;
  incoming.push({kind:m.type,sourceId:m.ownerId,missileId:m.id,bearing:angle(desiredHeading(p,m.pos)-p.yaw),distance,timeToImpact,locked:true});
 }
 if(incoming.length)return incoming.sort((a,b)=>a.timeToImpact-b.timeToImpact)[0];
 const lockers=g.pilots.filter(q=>!q.dead&&q.team!==p.team&&q.targetId===p.id&&q.lock>0).sort((a,b)=>b.lock-a.lock||dist(a.pos,p.pos)-dist(b.pos,p.pos));
 if(!lockers.length)return null;const q=lockers[0];
 return{kind:'lock',sourceId:q.id,bearing:angle(desiredHeading(p,q.pos)-p.yaw),distance:dist(p.pos,q.pos),timeToImpact:null,locked:q.lock>=.45,lockProgress:clamp(q.lock/1.45,0,1)};
}
function finishCombatMission(g,winner,title,text){g.status='complete';g.result={winner,title,text};}
function updateCombatMission(g){
 const m=g.combatMission;if(!m)return false;
 const own=g.pilots.some(p=>p.team===0&&!p.dead),enemy=g.pilots.some(p=>p.team===1&&!p.dead);
 if(g.missionId==='ambush'){
  if(!own)finishCombatMission(g,1,'Ambush lost','The ambushed squad was lost before it reached safety. Retry the same mission.');
  else if(g.time>=m.deadline||!enemy)finishCombatMission(g,0,'Ambush survived',enemy?'Your squad stayed airborne until the escape window opened.':'Your squad eliminated every attacker.');
  return true;
 }
 const transport=g.pilots.find(p=>p.objectiveRole==='transport');
 if(!transport||transport.dead){finishCombatMission(g,1-m.transportTeam,'Transport intercepted','The transport was destroyed before it reached the exit corridor.');return true;}
 const waypoint=m.route[m.routeIndex];
 if(waypoint&&horizontal(transport.pos,waypoint)<280&&Math.abs(transport.pos.y-waypoint.y)<250){
  m.routeIndex++;
  if(m.routeIndex>=m.route.length){finishCombatMission(g,m.transportTeam,'Transport escaped','The transport reached the exit corridor safely.');return true;}
  emit(g,'mission','Transport passed a route checkpoint.');
 }
 if(g.time>=m.deadline)finishCombatMission(g,1-m.transportTeam,'Route blocked','The transport did not reach the exit corridor before the mission deadline.');
 return true;
}
function mission(g,dt){
 if(updateCombatMission(g))return;
 if(g.mode==='freeflight'){
  const p=g.pilots.find(p=>p.id==='host')||g.pilots[0],route=routeFor(g),destination=destinationFor(g),approach=approachFor(g);
  if(g.flightStage==='route'){const waypoint=route[g.routeIndex];if(waypoint&&dist(p.pos,waypoint)<360){g.routeIndex++;emit(g,'gate',g.routeIndex<route.length?`Route gate ${g.routeIndex} cleared`:`Route complete. Approach ${destination.shortName} runway ${destination.runway}.`);if(g.routeIndex>=route.length){g.flightStage='approach';g.approachIndex=0}}}
  if(g.flightStage==='approach'){
   if(g.approachIndex<approach.length&&dist(p.pos,approach[g.approachIndex])<230)g.approachIndex++;
   const local=fieldCoordinates(destination,p.pos);
   if(g.approachIndex>=approach.length&&local.along>destination.halfLength&&p.pos.y>destination.elevation+12){g.approachIndex=0;emit(g,'recovery','Missed approach · set up another pass.',{pilotId:p.id})}
  }
  if(g.flightStage==='landed'&&g.routeIndex>=route.length&&p.runwayId===g.destinationId&&p.speed<5){g.status='complete';g.result={title:'Beautiful landing',text:g.routeId==='local'?'Route flown, runway reached, aircraft safely stopped.':`Route flown. Landed safely at ${destination.name}.`,winner:0}}
  return;
 }
 if(g.mode==='strike'){const bomber=g.pilots.find(p=>p.bomber);if(bomber?.dead){g.status='complete';g.result={title:bomber.team===0?'Strike intercepted':'Interceptor victory',text:'The bomber was stopped before reaching its escape zone.',winner:1-bomber.team};return}if(g.bombed&&bomber&&horizontal(bomber.pos,ESCAPE)<ESCAPE.radius&&bomber.pos.y>100){g.escaped=true;g.status='complete';g.result={title:bomber.team===0?'Clean getaway':'Bomber escaped',text:'The target was destroyed and the strike aircraft reached safety.',winner:bomber.team};return}}
 const alive=g.teamSizes.map((_,team)=>g.pilots.some(p=>!p.dead&&p.team===team)),survivors=alive.map((up,team)=>up?team:null).filter(team=>team!==null);
 if(g.mode==='dogfight'&&!g.skirmish&&survivors.length<=1){const winner=survivors[0]??(g.teamSizes.length===2?1:null);g.status='complete';g.result={title:winner===0?'Air superiority':winner===null?'No aircraft remaining':'Squadron defeated',text:winner===0?'The skies are yours. Every opposing aircraft is down.':winner===null?'Both formations were lost. Launch another sortie.':'Your squadron has been intercepted. Try another sortie.',winner}}
 if(g.skirmish&&g.time>=COMBAT_LIMITS.matchSeconds){const high=Math.max(...g.scores),winners=g.scores.map((score,team)=>score===high?team:null).filter(team=>team!==null);g.status='complete';g.result={title:'Skirmish complete',text:`Squad scores: ${g.scores.join(' / ')}. Return to base.`,winner:winners.length===1?winners[0]:null};return}
 if(g.time>480){g.status='complete';g.result={title:'Sortie complete',text:'Fuel reserve reached. The squadron is returning to base.',winner:null}}
}
export function step(g,inputs={},dt=1/60){if(g.status!=='playing')return;dt=clamp(dt,0,.05);g.time+=dt;g.tick++;for(const p of g.pilots)if(p.dead&&!p.human&&g.skirmish&&g.time>=(p.respawnAt??Infinity))respawnPilot(g,p.id);const previous=new Map(g.pilots.filter(p=>!p.dead).map(p=>[p.id,{...p.pos}]));for(const p of g.pilots)if(!p.dead)updatePilot(g,p,p.human?(inputs[p.id]||{}):ai(g,p,dt),dt);updateAircraftCollisions(g,previous);updateMissiles(g,dt,previous);advanceGunRounds(g,dt,{ground:surfaceHeight,canHit:p=>g.time>=(p.spawnProtectedUntil||0),onHit:(round,target)=>{recordDamage(g,target,'gun',round.ownerId,GUN.damage,round.pos);emit(g,'gun-hit','Machine gun hit',{pilotId:round.ownerId,targetId:target.id});},onKill:(target,owner)=>kill(g,target,owner)});
 for(const c of g.countermeasures){c.age+=dt;c.pos.x+=c.vel.x*dt;c.pos.y+=c.vel.y*dt;c.pos.z+=c.vel.z*dt;c.vel.y-=12*dt}g.countermeasures=g.countermeasures.filter(c=>c.age<c.life);
 for(const b of g.bombs){b.age+=dt;b.vel.y-=45*dt;b.pos.x+=b.vel.x*dt;b.pos.y+=b.vel.y*dt;b.pos.z+=b.vel.z*dt;if(b.pos.y<=Math.max(4,surfaceHeight(b.pos.x,b.pos.z))){if(horizontal(b.pos,TARGET)<330&&!g.bombed){g.targetHp=0;g.bombed=true;emit(g,'target','Target destroyed. Turn toward ESCAPE.');g.effects.push({id:++g.serial,type:'target',pos:{...TARGET},age:0,life:8})}else emit(g,'miss','Bomb missed. Circle back for another pass.');b.pos.y=-999}}g.bombs=g.bombs.filter(b=>b.pos.y>-100);
 // Service surviving aircraft after this tick's damage; never revive a loss.
 for(const p of g.pilots){repairAtAirport(g,p,dt);const field=resupplyAtAirfield(g,p);if(field&&p.human)emit(g,'resupply',`${field.shortName} resupply · all weapons, flares and chaff restocked`,{pilotId:p.id,fieldId:field.id});}
 for(const e of g.effects)e.age+=dt;g.effects=g.effects.filter(e=>e.age<e.life);mission(g,dt);
}
export function snapshot(g){return JSON.parse(JSON.stringify(g))}
export function applySnapshot(g,s){
 if(combatMissionBlocked(s))return false;
 if(!s||s.version!==2||!Array.isArray(s.pilots)||s.pilots.length<1||s.pilots.length>COMBAT_LIMITS.maxPilots)return false;
 const ids=new Set();
 for(const p of s.pilots){
  if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||!Number.isInteger(p.team)||p.team<0||p.team>=COMBAT_LIMITS.maxTeams)return false;
  if(!p.pos||!['x','y','z'].every(key=>Number.isFinite(p.pos[key]))||!['yaw','pitch','roll','speed','hp','throttle'].every(key=>Number.isFinite(p[key])))return false;
  if(p.speed<0||p.speed>10000||p.hp<0||p.hp>100||p.throttle<0||p.throttle>1)return false;
  ids.add(p.id);
 }
 Object.assign(g,s);return true;
}

export const APPROACH=approachFor('local');
function routeGuidanceAngles(g,p){
 let input={pitch:0,roll:0,yaw:0,throttle:0,brake:false},target,desiredPower=.7;
 const runway=AIRFIELDS[p.runwayId]||AIRFIELDS.home,destination=destinationFor(g),approach=approachFor(g),route=routeFor(g);
 if(p.grounded&&!p.landed){const local=fieldCoordinates(runway,p.pos),headingError=angle(runway.heading-p.yaw);input.pitch=p.speed>76?.6:0;input.roll=clamp(-local.across*.02+headingError*1.8,-.4,.4);input.throttle=p.throttle<.7?1:p.throttle>.72?-1:0;return input}
 if(p.grounded&&p.landed)return{...input,throttle:-1,brake:true};
 if(g.flightStage==='route')target=route[g.routeIndex];
 if(g.flightStage==='approach'){
  desiredPower=g.approachIndex===0?.75:.54;if(g.approachIndex<approach.length)target=approach[g.approachIndex];
  else{const local=fieldCoordinates(destination,p.pos),ahead=local.along+420,height=Math.max(2,(-150-ahead)*.17);target=fieldPoint(destination,0,ahead,height);desiredPower=p.pos.y<destination.elevation+18?.32:.42;input.brake=p.speed>103;}
 }
 if(target){const heading=angle(desiredHeading(p,target)-p.yaw),distance=horizontal(p.pos,target),desiredPitch=Math.atan2(target.y-p.pos.y,Math.max(120,distance));if(g.flightStage==='route')desiredPower=clamp(.7+Math.max(0,desiredPitch)*.22,.7,.82);input.roll=clamp(heading*1.8,-1,1);input.pitch=clamp(desiredPitch/.52+(desiredPitch-p.pitch)*2,-1,1);if(g.flightStage==='approach'&&g.approachIndex>=approach.length&&p.pos.y<destination.elevation+12)input.pitch=-.025/.52;}
 input.throttle=p.throttle<desiredPower-.01?.5:p.throttle>desiredPower+.01?-.5:0;return input;
}


export function routeGuidance(g,p){const wantGear=p.grounded||g.flightStage==='approach'||g.flightStage==='landed';return {...routeGuidanceAngles(g,p),autopilot:true,toggleGear:!p.grounded&&!!p.gearDown!==wantGear};}
