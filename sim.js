import {tryHeatFlare} from './heat-seeker.js?v=highg1-1019';
import {freshPilotG,pilotGInput,updatePilotG} from './pilot-g.js?v=highg1-1019';
import {flightForward} from './view-axes.js?v=highg1-1019';
import {GUN,fireGunRound,advanceGunRounds} from './guns.js?v=highg1-1019';
import {AIRCRAFT_RADIUS,collisionRadius,sweptSphereHit} from './aircraft-collision.js?v=highg1-1019';
export {AIRCRAFT_RADIUS,collisionRadius,sweptSphereHit} from './aircraft-collision.js?v=highg1-1019';
import {FLIGHT,fighterTargetSpeed} from './flight.js?v=highg1-1019';
export {FLIGHT,fighterTargetSpeed} from './flight.js?v=highg1-1019';
import {surfaceHeight} from './world.js?v=highg1-1019';
import {AIRFIELDS,ROUTES,routeFor,destinationFor,approachFor,fieldPoint,fieldCoordinates,fieldUnder,WORLD_BOUNDS} from './missions.js?v=highg1-1019';
export {AIRFIELDS,ROUTES,routeFor,destinationFor,approachFor,fieldPoint,fieldCoordinates} from './missions.js?v=highg1-1019';
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
function createFormations(g){
 const formations=[],attacker=g.role==='defend'?1:0;
 // Discard one LCG value so nearby seeds still produce varied approach sectors.
 random(g);const sector=Math.floor(random(g)*4),turn=Math.floor(random(g)*2)+1;
 for(let team=0;team<g.teamSizes.length;team++){
  let origin={x:0,y:850,z:-1100},yaw=0;
  if(g.mode==='strike'){origin=team===attacker?{x:0,y:450,z:-2450}:{x:1800,y:650,z:300};yaw=team===attacker?0:-Math.PI/2;}
  else if(team>0){const approachSector=(sector+(team-1)*turn)%4,bearing=approachSector*Math.PI/2+(random(g)-.5)*.42,range=(approachSector===2?1550:approachSector%2?2350:3300)+random(g)*(approachSector===2?300:450);
   origin={x:Math.sin(bearing)*range,y:850+team*75,z:-1100+Math.cos(bearing)*range};yaw=angle(bearing+Math.PI);}
  const spacing=(g.mode==='strike'&&team===attacker?AIRCRAFT_RADIUS.bomber:AIRCRAFT_RADIUS.fighter)*3;
  formations.push({team,origin,yaw,spacing,type:team%2?'echelon':'vee',until:COMBAT_LIMITS.formationSeconds});
 }
 return formations;
}
function spawnPilot(g,i,team,slot=0){
 const free=g.mode==='freeflight',strike=g.mode==='strike',attacker=g.role==='defend'?1:0;
 const bomber=strike&&team===attacker&&slot===0,formation=g.formations[team];
 const pos=free?{x:RUNWAY.x,y:3,z:-2720}:formationPoint(formation.origin,formation.yaw,slot,formation.spacing,formation.type);
 return{...freshPilotG(),id:i===0?'host':`bot${i}`,team,slot,human:i===0,bomber,pos,yaw:free?0:formation.yaw,pitch:0,roll:0,speed:free?0:strike?(team===attacker?110:185):FLIGHT.cruiseSpeed,throttle:free?0:strike&&!bomber?(team===attacker?.55:.635):.78,hp:100,gunAmmo:GUN.capacity,gunCD:0,gunShots:0,heat:6,radar:4,flares:6,chaff:6,bombs:bomber?3:0,heatCD:0,radarCD:0,flareCD:0,chaffCD:0,bombCD:0,lock:0,targetId:null,dead:false,grounded:free,landed:false,runwayId:'home',aiTimer:0,aiShot:2+i*.6,aiDefend:0,aiBreak:0,aiNextBreak:7+i*1.9,rearm:0,aiEvade:0,spawnProtectedUntil:0,collisionGraceUntil:g.time+COMBAT_LIMITS.spawnGrace,respawnAt:null,deaths:0,kills:0,trail:[]};
}
export function createGame({mode='dogfight',teamSize=1,teamSizes,skirmish=false,role='attack',seed=64821,difficulty='normal',routeId='local'}={}){
 if(!['dogfight','strike','freeflight'].includes(mode))mode='dogfight';
 if(!Object.hasOwn(ROUTES,routeId))routeId='local';
 const sizes=normalizedTeams(mode,teamSize,teamSizes);
 const g={version:1,mode,routeId,destinationId:ROUTES[routeId].destination,teamSize:sizes[0],teamSizes:sizes,skirmish:mode==='dogfight'&&skirmish===true,scores:sizes.map(()=>0),role:role==='defend'?'defend':'attack',difficulty:difficulty==='ace'?'ace':'normal',rng:seed>>>0,time:0,tick:0,status:'playing',result:null,pilots:[],missiles:[],bullets:[],countermeasures:[],bombs:[],effects:[],events:[],serial:0,targetHp:100,bombed:false,routeIndex:0,flightStage:'takeoff',approachIndex:0,missionMessage:'',escaped:false};
 g.formations=createFormations(g);
 for(let team=0;team<sizes.length;team++)for(let slot=0;slot<sizes[team];slot++)g.pilots.push(spawnPilot(g,g.pilots.length,team,slot));
 emit(g,'start',mode==='freeflight'?'Clear for takeoff. Add power, then gently climb.':mode==='strike'?(g.role==='attack'?'Strike package airborne. Reach the target, then escape.':'Intercept the bomber before it escapes.'):g.skirmish?'Squad skirmish. Stay together, watch your six, and rejoin after a loss.':'Weapons free. Protect your wingmates.');
 return g;
}
export function configurePlayers(g,ids=['host']){
 if(g.mode==='freeflight'){
  for(let i=g.pilots.length;i<Math.min(ids.length,6);i++){const p=spawnPilot(g,i,0,i);p.pos.x+=i%2===1?24:-24;p.pos.z-=Math.ceil(i/2)*75;g.pilots.push(p)}
  g.pilots.forEach((p,i)=>{p.id=ids[i]||`bot${i}`;p.human=!!ids[i]});return;
 }
 const seats=[];
 for(let slot=0;slot<Math.max(...g.teamSizes);slot++)for(let team=0;team<g.teamSizes.length;team++){
  const p=g.pilots.find(p=>p.team===team&&p.slot===slot);if(p)seats.push(p);
 }
 for(let i=0;i<Math.min(ids.length,seats.length);i++){seats[i].id=ids[i];seats[i].human=true}
}
function emit(g,type,text,extra={}){g.events.push({id:++g.serial,type,text,t:g.time,...extra});if(g.events.length>24)g.events.shift()}
function kill(g,p,source){if(p.dead)return;p.hp=0;p.dead=true;p.deaths=(p.deaths||0)+1;p.lock=0;p.targetId=null;
 p.respawnAt=g.skirmish?g.time+(p.human?COMBAT_LIMITS.playerRespawnSeconds:COMBAT_LIMITS.botRespawnSeconds):null;
 const killer=g.pilots.find(q=>q.id===source&&q.team!==p.team);if(killer){killer.kills=(killer.kills||0)+1;g.scores[killer.team]=(g.scores[killer.team]||0)+1;}
 g.effects.push({id:++g.serial,type:'explosion',pos:{...p.pos},age:0,life:2.3});emit(g,'kill',`${p.human?'Pilot':p.bomber?'Bomber':'Bandit'} down`,{pilotId:p.id,source});}
// Rejoin the same running match. The UI remains responsible for the human's choice.
export function respawnPilot(g,id){
 const p=g.pilots.find(p=>p.id===id);
 if(!g.skirmish||g.mode!=='dogfight'||g.status!=='playing'||!p?.dead||g.time<(p.respawnAt??Infinity))return false;
 const allies=g.pilots.filter(q=>!q.dead&&q.team===p.team),anchor=allies[0];
 const fresh=spawnPilot(g,g.pilots.indexOf(p),p.team,p.slot),identity={id:p.id,human:p.human,kills:p.kills||0,deaths:p.deaths||0};
 // Keep reinforcements behind a surviving wingmate, or enter from their squad's
 // original bearing. Search deterministic alternatives rather than stack spawns.
 const origin=anchor?{...anchor.pos}:g.formations[p.team].origin,yaw=anchor?anchor.yaw:g.formations[p.team].yaw;
 let safe=null;
 for(let attempt=0;attempt<24;attempt++){
  const back=anchor?500+attempt*110:700+attempt*120,side=((attempt%3)-1)*300;
  const candidate={x:origin.x-Math.sin(yaw)*back+Math.cos(yaw)*side,y:Math.max(origin.y+90,700),z:origin.z-Math.cos(yaw)*back-Math.sin(yaw)*side};
  candidate.y=Math.max(candidate.y,surfaceHeight(candidate.x,candidate.z)+350);
  if(g.pilots.every(q=>q.dead||dist(candidate,q.pos)>(q.team===p.team?220:1050))){safe=candidate;break}
 }
 if(!safe){p.respawnBlocked=true;return false;}
 Object.assign(p,fresh,identity,{pos:safe,yaw,spawnProtectedUntil:g.time+COMBAT_LIMITS.spawnGrace,respawnAt:null,respawnBlocked:false});
 // Missiles aimed at the previous airframe cannot reacquire the replacement.
 for(const m of g.missiles)if(m.targetId===id){m.seekerLost=true;m.targetId=null;}
 emit(g,'respawn',p.human?'Back in the fight. Your squad is still airborne.':'Squad reinforcement airborne',{pilotId:id});return true;
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
 if(leader===p){const speed=p.bomber?115:g.mode==='strike'?185:FLIGHT.cruiseSpeed;return{roll:clamp(angle(squad.yaw-p.yaw)*2,-1,1),pitch:0,yaw:0,throttle:p.speed<speed-.5?.15:p.speed>speed+.5?-.15:0};}
 const slot=formationPoint(leader.pos,leader.yaw,p.slot,squad.spacing,squad.type),f=forward(leader),lead=Math.max(200,leader.speed*1.2);
 const target={x:slot.x+f.x*lead,y:slot.y+f.y*lead,z:slot.z+f.z*lead},input=steer(p,target);
 const along=(slot.x-p.pos.x)*f.x+(slot.z-p.pos.z)*f.z,desired=leader.speed+clamp(along*.45,-35,35);
 input.throttle=p.speed<desired-1?.25:p.speed>desired+1?-.25:0;return input;
}
export function desiredHeading(p,target){return Math.atan2(target.x-p.pos.x,target.z-p.pos.z)}
function ai(g,p,dt){
 const ace=g.difficulty==='ace';let target;
 const form=g.mode!=='freeflight'?formationInput(g,p):null;if(form)return form;
 if(g.mode==='strike'&&p.bomber){target=g.bombed?ESCAPE:{x:TARGET.x,y:430,z:TARGET.z-350};if(!g.bombed&&horizontal(p.pos,target)<420&&p.bombCD<=0){return{...steer(p,target),bomb:true,throttle:0}}}
 else {const enemies=g.pilots.filter(x=>!x.dead&&x.team!==p.team);target=enemies.sort((a,b)=>dist(p.pos,a.pos)-dist(p.pos,b.pos))[0];if(!target)return{};p.targetId=target.id;target=target.pos}
 let i=steer(p,target);const headingError=Math.abs(angle(desiredHeading(p,target)-p.yaw));p.aiNextBreak-=dt;p.aiBreak=Math.max(0,(p.aiBreak||0)-dt);if(p.aiNextBreak<=0&&headingError>.8){p.aiBreak=(ace?2:3)+random(g)*(ace?1.3:2);p.aiNextBreak=(ace?8:11)+random(g)*(ace?5:6)}if(p.aiBreak>0){i.roll=Math.sin(g.time*.7+p.pos.x*.001)*.12;i.pitch=(600-p.pos.y)*.002}const desiredSpeed=p.bomber?115:g.mode==='strike'?185:ace?290+(g.pilots.indexOf(p)%3)*8:260+(g.pilots.indexOf(p)%3)*12;i.throttle=p.speed<desiredSpeed?.5:-.25;
 const incoming=g.missiles.find(m=>m.targetId===p.id&&!m.decoyed&&!m.seekerLost&&dist(m.pos,p.pos)<(ace?1500:1250));
 p.aiShot=Math.max(0,(p.aiShot||0)-dt);p.aiDefend=Math.max(0,(p.aiDefend||0)-dt);
 p.aiEvade=Math.max(0,p.aiEvade-dt);
 if(incoming&&p.aiDefend<=0){p.aiDefend=(ace?3.2:5)+random(g)*(ace?1.5:2);if(random(g)<(ace?.88:.57)){i.flare=incoming.type==='heat';i.chaff=incoming.type==='radar'}p.aiEvade=2.5+random(g)*1.5}
 if(p.aiEvade>1.5){i.roll+=(p.team===0?0.45:-0.45);i.pitch=clamp(i.pitch+0.15,-1,1)}
 if(g.mode!=='freeflight'&&p.targetId&&p.lock>0.8&&p.aiShot<=0){const enemy=g.pilots.find(q=>q.id===p.targetId);if(enemy&&dist(p.pos,enemy.pos)<(ace?2900:2300)){i.fireHeat=p.heat>0&&(random(g)<.65||p.radar<=0);i.fireRadar=!i.fireHeat&&p.lock>1.45;p.aiShot=(ace?3.5:4.5)+random(g)*(ace?1.8:2.5)}}

 const path=forward(p),aheadGround=surfaceHeight(p.pos.x+path.x*p.speed*4,p.pos.z+path.z*p.speed*4);if(p.pos.y<Math.max(surfaceHeight(p.pos.x,p.pos.z)+170,aheadGround+200))i.pitch=Math.max(.7,i.pitch);
 if(p.pos.y>1700)i.pitch=Math.min(-0.5,i.pitch);
 // Predict relative closest approach early enough to clear real airframes at
 // cruise speed. The stable seat order gives both pilots opposite vertical exits.
 const pf=forward(p),ownIndex=g.pilots.indexOf(p);let imminent=null,best=Infinity;
 for(const q of g.pilots){if(q===p||q.dead||dist(p.pos,q.pos)>1100)continue;
  const qf=forward(q),r={x:q.pos.x-p.pos.x,y:q.pos.y-p.pos.y,z:q.pos.z-p.pos.z},v={x:qf.x*q.speed-pf.x*p.speed,y:qf.y*q.speed-pf.y*p.speed,z:qf.z*q.speed-pf.z*p.speed};
  const vv=v.x*v.x+v.y*v.y+v.z*v.z,t=clamp(-(r.x*v.x+r.y*v.y+r.z*v.z)/Math.max(1,vv),0,2.2);
  const separation=Math.hypot(r.x+v.x*t,r.y+v.y*t,r.z+v.z*t);
  if(separation<collisionRadius(p)+collisionRadius(q)+55&&t<best){best=t;imminent=q;}
 }
 if(imminent){const side=angle(desiredHeading(p,imminent.pos)-p.yaw);i.roll=side>=0?-.8:.8;i.pitch=ownIndex<g.pilots.indexOf(imminent)?.85:-.85;}
 if(p.pos.y<Math.max(surfaceHeight(p.pos.x,p.pos.z)+190,aheadGround+220))i.pitch=Math.max(.85,i.pitch);

 if(p.pos.x<WORLD_BOUNDS.minX||p.pos.x>WORLD_BOUNDS.maxX||p.pos.z<WORLD_BOUNDS.minZ||p.pos.z>WORLD_BOUNDS.maxZ){return steer(p,{x:0,y:650,z:0})}
 return i;
}
export function steer(p,target){const heading=angle(desiredHeading(p,target)-p.yaw),d=horizontal(p.pos,target),pitch=Math.atan2(target.y-p.pos.y,Math.max(100,d));return{roll:clamp(heading*2.1,-1,1),pitch:clamp((pitch-p.pitch)*3.8,-1,1),yaw:clamp(heading*0.12,-0.3,0.3),throttle:0}}
function selectTarget(g,p){let best=null,score=Infinity;const f=forward(p);for(const q of g.pilots){if(q.dead||q.team===p.team||g.time<(q.spawnProtectedUntil||0))continue;const d=dist(p.pos,q.pos);const dot=((q.pos.x-p.pos.x)*f.x+(q.pos.y-p.pos.y)*f.y+(q.pos.z-p.pos.z)*f.z)/Math.max(1,d);const a=Math.acos(clamp(dot,-1,1));if(d<4200&&a<0.58&&d*(a+0.2)<score){best=q;score=d*(a+0.2)}}return best}
function launch(g,p,type){if(g.time<(p.spawnProtectedUntil||0))return;const cd=type==='heat'?'heatCD':'radarCD';if(p[cd]>0||p[type]<=0)return;const target=g.pilots.find(q=>q.id===p.targetId&&!q.dead);if(!target||p.lock<(type==='heat'?0.45:1.45))return;
 p[type]--;p[cd]=type==='heat'?1.65:2.5;const f=forward(p);g.missiles.push({id:++g.serial,type,ownerId:p.id,team:p.team,targetId:target.id,pos:{x:p.pos.x+f.x*18,y:p.pos.y+f.y*18-2,z:p.pos.z+f.z*18},dir:f,speed:p.speed+90,age:0,life:type==='heat'?13:17,decoyed:false,seekerLost:false,lostTime:0});emit(g,'launch',type==='heat'?'Fox two · heat seeker away':'Fox one · radar missile away',{pilotId:p.id});}
export function bombSolution(p){const t=Math.sqrt(Math.max(0,p.pos.y-4)*2/45),f=forward(p);return{x:p.pos.x+f.x*p.speed*t,y:4,z:p.pos.z+f.z*p.speed*t}}
export function canBomb(g,p){return p.bomber&&p.bombs>0&&!g.bombed&&p.pos.y>100&&p.pos.y<1000&&horizontal(bombSolution(p),TARGET)<330}
function counter(g,p,type){const key=type==='flare'?'flares':'chaff',cd=type+'CD';if(!p[key]||p[cd]>0)return;p[key]--;p[cd]=1.2;const burstId=g.serial+1;for(let i=0;i<6;i++)g.countermeasures.push({id:++g.serial,burstId,type,ownerId:p.id,pos:{...p.pos},vel:{x:(random(g)-.5)*60,y:(random(g)-.5)*40-12,z:(random(g)-.5)*60},age:0,life:type==='flare'?3.8:5});emit(g,'counter',type==='flare'?'Flares out':'Chaff out',{pilotId:p.id})}
function updatePilot(g,p,input,dt){
 if(p.dead)return;
 for(const k of ['gunCD','heatCD','radarCD','flareCD','chaffCD','bombCD'])p[k]=Math.max(0,p[k]-dt);
 p.rearm=(p.rearm||0)+dt;if(p.rearm>22){p.rearm=0;p.gunAmmo=Math.min(GUN.capacity,p.gunAmmo+150);if(g.mode!=='freeflight'){p.heat=Math.min(6,p.heat+2);p.radar=Math.min(4,p.radar+1);if(p.human)emit(g,'rearm','Weapons topped up · gun rounds, +2 heat, +1 radar',{pilotId:p.id})}}
 const i=pilotGInput(p,input||{}),before=forward(p),wasGrounded=p.grounded;p.braking=!!i.brake;p.throttle=clamp(p.throttle+(Number(i.throttle)||0)*dt*.38,0,1);
 const maxSpeed=p.bomber?194:FLIGHT.maxFighterSpeed,minSpeed=p.grounded?0:55;
 const targetSpeed=p.bomber?p.throttle*172:fighterTargetSpeed(p.throttle,{freeflight:g.mode==='freeflight'});
 p.speed=clamp(p.speed+(targetSpeed-p.speed)*dt*.24-(i.brake?(p.grounded?45:33):0)*dt-p.pitch*dt*10,minSpeed,maxSpeed);
 if(p.grounded){p.pitch=0;p.roll=0;p.yaw+=clamp(Number(i.roll)||0,-1,1)*dt*(p.speed<60?0.32:0.15)+clamp(Number(i.yaw)||0,-1,1)*dt*.28;
 if(p.speed>72&&Number(i.pitch)>.12){p.grounded=false;p.landed=false;p.pitch=.08;p.pos.y=(AIRFIELDS[p.runwayId]?.elevation||0)+4;emit(g,'takeoff','Positive climb. Gear up — follow the route.',{pilotId:p.id});if(g.mode==='freeflight'&&p.id==='host'){g.flightStage=g.routeIndex>=routeFor(g).length?'approach':'route';if(g.flightStage==='approach')g.approachIndex=0}}
 }else{
 const wantedRoll=clamp(Number(i.roll)||0,-1,1)*1.0;
 p.roll+=(wantedRoll-p.roll)*Math.min(1,dt*3.8);
 const wantedPitch=clamp(Number(i.pitch)||0,-1,1)*.52;
 p.pitch+=(wantedPitch-p.pitch)*Math.min(1,dt*1.8);
 p.yaw=angle(p.yaw+(Math.sin(p.roll)*.62+clamp(Number(i.yaw)||0,-1,1)*.17)*dt*(clamp(p.speed/100,.35,1.3)));
 }
 const f=forward(p);updatePilotG(p,before,f,dt,wasGrounded);p.pos.x+=f.x*p.speed*dt;p.pos.z+=f.z*p.speed*dt;
 if(!p.grounded)p.pos.y+=f.y*p.speed*dt-Math.max(0,83-p.speed)*dt*.48;
 if(g.mode==='freeflight'&&p.grounded){
  const field=AIRFIELDS[p.runwayId]||RUNWAY,local=fieldCoordinates(field,p.pos);
  if(Math.abs(local.across)>field.width+35||Math.abs(local.along)>field.halfLength+80){
   if(p.speed<45){p.pos=fieldPoint(field,0,-field.halfLength+180,3);p.yaw=field.heading;p.pitch=0;p.roll=0;p.speed=0;p.throttle=0;emit(g,'recovery',`Back on ${field.shortName} runway ${field.runway}. Up adds power; hold W to lift off.`,{pilotId:p.id});}
   else{p.grounded=false;p.landed=false;p.pos.y=Math.max(field.elevation+140,surfaceHeight(p.pos.x,p.pos.z)+140);p.pitch=.18;p.roll=0;p.speed=Math.max(110,p.speed);p.throttle=.8;emit(g,'recovery','Runway overrun · safe go-around. Keep climbing and follow the guide.',{pilotId:p.id});if(p.id==='host'){g.flightStage=g.routeIndex>=routeFor(g).length?'approach':'route';g.approachIndex=0;}}
  }
 }
 const landingField=fieldUnder(p.pos),ground=surfaceHeight(p.pos.x,p.pos.z),clearance=landingField?landingField.elevation+3:Math.max(3,ground+3);
 if(!p.grounded&&p.pos.y<=clearance){
  if(g.mode==='freeflight'&&landingField&&p.speed<115&&Math.abs(angle(p.yaw-landingField.heading))<.35&&Math.abs(p.roll)<.35&&p.pitch>-.28){
   p.grounded=true;p.pos.y=landingField.elevation+3;p.landed=true;p.runwayId=landingField.id;p.pitch=0;p.roll=0;
   const finished=g.routeIndex>=routeFor(g).length&&landingField.id===g.destinationId;
   if(p.id==='host')g.flightStage=finished?'landed':'practice';
   emit(g,'landed',finished?'Touchdown! Hold brakes and roll to a stop.':`Practice landing at ${landingField.shortName}. The route is still open.`,{pilotId:p.id});
  }else if(g.mode==='freeflight'){
   p.pos.y=Math.max(100,ground+140);p.pitch=.18;p.speed=Math.max(110,p.speed);p.throttle=.8;emit(g,'recovery','Go around · safe recovery. Follow the landing guide and try again.',{pilotId:p.id});
   if(p.id==='host'){g.flightStage=g.routeIndex>=routeFor(g).length?'approach':'route';g.approachIndex=0;}
  }else kill(g,p,'terrain');
 }
 p.pos.y=Math.max(p.grounded?(AIRFIELDS[p.runwayId]?.elevation||0)+3:0,Math.min(6000,p.pos.y));
 if(p.dead||p.blackedOut)return;
 if(i.fireGun&&g.time>=(p.spawnProtectedUntil||0))fireGunRound(g,p);
 if(g.mode!=='freeflight'){
 const q=selectTarget(g,p);if(q&&q.id===p.targetId)p.lock=Math.min(3,p.lock+dt);else{p.targetId=q?.id||null;p.lock=q?dt:0}
 if(i.fireHeat)launch(g,p,'heat');if(i.fireRadar)launch(g,p,'radar');if(i.flare)counter(g,p,'flare');if(i.chaff)counter(g,p,'chaff');
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
  const specs=MISSILE[m.type]||MISSILE.heat,target=g.pilots.find(p=>p.id===m.targetId&&!p.dead&&g.time>=(p.spawnProtectedUntil||0)),from={...m.pos};
  if(target&&!m.decoyed&&!m.seekerLost){
   const appropriate=m.type==='heat'?'flare':'chaff',d=dist(m.pos,target.pos);
   const decoy=m.type==='heat'?tryHeatFlare(m,target,g.countermeasures,()=>random(g)):g.countermeasures.find(c=>c.ownerId===target.id&&c.type===appropriate&&c.age<2.2&&dist(c.pos,m.pos)<1100);
   if(decoy){m.decoyed=true;m.decoyPos={...decoy.pos};emit(g,'evade',`${appropriate==='flare'?'Heat seeker':'Radar missile'} defeated`,{pilotId:target.id});}
   else{
    const sight=unitVector({x:target.pos.x-m.pos.x,y:target.pos.y-m.pos.y,z:target.pos.z-m.pos.z});
    m.offBoresight=Math.acos(clamp(vectorDot(m.dir,sight),-1,1));
    const owner=g.pilots.find(p=>p.id===m.ownerId),unsupported=m.type==='radar'&&(!owner||owner.dead||owner.targetId!==target.id||owner.lock<.3);
    m.lostTime=(m.offBoresight>specs.seekerAngle||unsupported)?(m.lostTime||0)+dt:Math.max(0,(m.lostTime||0)-dt*2);
    if(m.lostTime>specs.seekerMemory){m.seekerLost=true;emit(g,'evade','Missile lost the track',{pilotId:target.id});}
    else{
     const lead=Math.min(2.5,d/Math.max(180,m.speed))*.68,f=forward(target);
     const aim=unitVector({x:target.pos.x+f.x*target.speed*lead-m.pos.x,y:target.pos.y+f.y*target.speed*lead-m.pos.y,z:target.pos.z+f.z*target.speed*lead-m.pos.z});
     m.dir=turnMissile(m.dir,aim,specs.turnRate*dt);
    }
   }
  }
  if(m.decoyed&&m.decoyPos)m.dir=turnMissile(m.dir,unitVector({x:m.decoyPos.x-m.pos.x,y:m.decoyPos.y-m.pos.y,z:m.decoyPos.z-m.pos.z}),specs.turnRate*dt);
  m.speed=Math.min(specs.maxSpeed,m.speed+dt*specs.acceleration);
  m.pos.x+=m.dir.x*m.speed*dt;m.pos.y+=m.dir.y*m.speed*dt;m.pos.z+=m.dir.z*m.speed*dt;
  // Relative swept proximity fuzing catches fast passes without granting a
  // perfect turn or letting missiles hit airframes after their seeker is lost.
  if(target&&!m.decoyed&&!m.seekerLost){
   const old=previous?.get(target.id)||target.pos,t=sweptSphereHit(from,m.pos,old,target.pos,collisionRadius(target)+10);
   if(t!==null){target.hp-=specs.damage;m.age=m.life;g.effects.push({id:++g.serial,type:'hit',pos:{...target.pos},age:0,life:.8});emit(g,'hit','Missile hit',{pilotId:m.ownerId,targetId:target.id});if(target.hp<=0)kill(g,target,m.ownerId);}
  }
  if(m.pos.y<Math.max(0,surfaceHeight(m.pos.x,m.pos.z)))m.age=m.life;
 }
 g.missiles=g.missiles.filter(m=>m.age<m.life);
}
// One actionable warning: the most urgent incoming missile, otherwise an enemy
// acquiring a weapons lock. Bearing uses the simulation's positive-left yaw.
export function threatFor(g,pilot){
 const p=typeof pilot==='string'?g.pilots.find(q=>q.id===pilot):pilot;if(!p||p.dead)return null;
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
function mission(g,dt){
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
export function step(g,inputs={},dt=1/60){if(g.status!=='playing')return;dt=clamp(dt,0,.05);g.time+=dt;g.tick++;for(const p of g.pilots)if(p.dead&&!p.human&&g.skirmish&&g.time>=(p.respawnAt??Infinity))respawnPilot(g,p.id);const previous=new Map(g.pilots.filter(p=>!p.dead).map(p=>[p.id,{...p.pos}]));for(const p of g.pilots)if(!p.dead)updatePilot(g,p,p.human?(inputs[p.id]||{}):ai(g,p,dt),dt);updateAircraftCollisions(g,previous);updateMissiles(g,dt,previous);advanceGunRounds(g,dt,{ground:surfaceHeight,canHit:p=>g.time>=(p.spawnProtectedUntil||0),onHit:(round,target)=>emit(g,'gun-hit','Machine gun hit',{pilotId:round.ownerId,targetId:target.id}),onKill:(target,owner)=>kill(g,target,owner)});
 for(const c of g.countermeasures){c.age+=dt;c.pos.x+=c.vel.x*dt;c.pos.y+=c.vel.y*dt;c.pos.z+=c.vel.z*dt;c.vel.y-=12*dt}g.countermeasures=g.countermeasures.filter(c=>c.age<c.life);
 for(const b of g.bombs){b.age+=dt;b.vel.y-=45*dt;b.pos.x+=b.vel.x*dt;b.pos.y+=b.vel.y*dt;b.pos.z+=b.vel.z*dt;if(b.pos.y<=Math.max(4,surfaceHeight(b.pos.x,b.pos.z))){if(horizontal(b.pos,TARGET)<330&&!g.bombed){g.targetHp=0;g.bombed=true;emit(g,'target','Target destroyed. Turn toward ESCAPE.');g.effects.push({id:++g.serial,type:'target',pos:{...TARGET},age:0,life:8})}else emit(g,'miss','Bomb missed. Circle back for another pass.');b.pos.y=-999}}g.bombs=g.bombs.filter(b=>b.pos.y>-100);
 for(const e of g.effects)e.age+=dt;g.effects=g.effects.filter(e=>e.age<e.life);mission(g,dt);
}
export function snapshot(g){return JSON.parse(JSON.stringify(g))}
export function applySnapshot(g,s){
 if(!s||s.version!==1||!Array.isArray(s.pilots)||s.pilots.length<1||s.pilots.length>COMBAT_LIMITS.maxPilots)return false;
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
export function routeGuidance(g,p){
 let input={pitch:0,roll:0,yaw:0,throttle:0,brake:false},target,desiredPower=.7;
 const runway=AIRFIELDS[p.runwayId]||AIRFIELDS.home,destination=destinationFor(g),approach=approachFor(g),route=routeFor(g);
 if(p.grounded&&!p.landed){const local=fieldCoordinates(runway,p.pos),headingError=angle(runway.heading-p.yaw);input.pitch=p.speed>76?.6:0;input.roll=clamp(-local.across*.02+headingError*1.8,-.4,.4);input.throttle=p.throttle<.7?1:p.throttle>.72?-1:0;return input}
 if(p.grounded&&p.landed)return{...input,throttle:-1,brake:true};
 if(g.flightStage==='route')target=route[g.routeIndex];
 if(g.flightStage==='approach'){
  desiredPower=.54;if(g.approachIndex<approach.length)target=approach[g.approachIndex];
  else{const local=fieldCoordinates(destination,p.pos),ahead=local.along+420,height=Math.max(2,(-150-ahead)*.17);target=fieldPoint(destination,0,ahead,height);desiredPower=p.pos.y<destination.elevation+18?.32:.42;input.brake=p.speed>103;}
 }
 if(target){const heading=angle(desiredHeading(p,target)-p.yaw),distance=horizontal(p.pos,target),desiredPitch=Math.atan2(target.y-p.pos.y,Math.max(120,distance));input.roll=clamp(heading*1.8,-1,1);input.pitch=clamp(desiredPitch/.52+(desiredPitch-p.pitch)*2,-1,1);if(g.flightStage==='approach'&&g.approachIndex>=approach.length&&p.pos.y<destination.elevation+12)input.pitch=-.025/.52;}
 input.throttle=p.throttle<desiredPower-.01?.5:p.throttle>desiredPower+.01?-.5:0;return input;
}
