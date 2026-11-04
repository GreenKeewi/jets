import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,MISSILE,snapshot,applySnapshot} from '../sim.js';
import {worldSpeed} from '../arcade-travel.js';
import {FLIGHT} from '../flight.js';
import {radarChaffChance,tryRadarChaff,tryHeatFlare} from '../heat-seeker.js';
import {RADAR_CLUTTER,seekerInterference,advanceSeekerInterference,terrainOccluded} from '../seeker-environment.js';
import {surfaceHeight,NORTHPOINT_SHIFT} from '../world.js';

function airborne({speed=686,throttle=1.1}={}){
 const g=createGame({mode:'dogfight',seed:94});
 for(const p of g.pilots)Object.assign(p,{human:true,grounded:false,gearDown:false,gearManual:true,departureActive:false,pos:{x:-28000,y:5000,z:-18000},yaw:0,pitch:0,roll:0,speed,throttle,spawnProtectedUntil:0,collisionGraceUntil:0});
 return g;
}
const seeded=(seed=17)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

test('both missile types intercept sustained maximum-afterburner world-speed tail chases',()=>{
 for(const type of ['heat','radar'])for(const dt of [1/30,1/60,1/144])for(const distance of [900,2500,3500]){
  const g=airborne(),[shooter,target]=g.pilots;shooter.pos.z-=distance;shooter.targetId=target.id;shooter.lock=3;
  assert.equal(worldSpeed(target),670.56);
  step(g,{host:{[type==='heat'?'fireHeat':'fireRadar']:true}},dt);assert.equal(g.missiles.length,1);
  const missile=g.missiles[0];
  while(g.time<10&&target.hp===100)step(g,{},dt);
  assert.equal(target.hp,100-MISSILE[type].damage,`${type} ${distance}m ${dt}s`);
  assert(g.time<7,`${type} should close before its motor expires`);assert(g.time>1);
  assert.equal(target.afterburnerActive,true);assert.equal(target.speed,670.56);
  assert(missile.speed<=MISSILE[type].maxSpeed);
 }
});

test('heat missile closes from cruise launcher speed against a full-burner target',()=>{
 const g=airborne(),[shooter,target]=g.pilots;shooter.speed=315;shooter.pos.z-=3500;shooter.targetId=target.id;shooter.lock=3;
 step(g,{host:{fireHeat:true}},1/60);for(let n=0;n<9*60&&target.hp===100;n++)step(g,{},1/60);
 assert.equal(target.hp,52);assert(g.time<8.5);assert.equal(target.afterburnerActive,true);
});

test('missile motor exhaustion removes energy and lifetime still ends a distant pursuit',()=>{
 for(const type of ['heat','radar'])for(const dt of [1/30,1/144]){
  const g=airborne(),spec=MISSILE[type],p=g.pilots[0];g.pilots[1].pos.x-=10000;
  const m={id:999,type,ownerId:p.id,targetId:null,pos:{...p.pos},dir:{x:0,y:0,z:1},speed:spec.maxSpeed,age:spec.motorSeconds,life:spec.life,seekerLost:true};g.missiles=[m];
  const before=m.speed;for(let n=0;n<1/dt;n++)step(g,{},dt);
  assert(m.speed<before-30);assert(Math.abs(m.speed-(before-spec.coastDrag))<2);
  for(let n=0;n<spec.life/dt;n++)step(g,{},dt);assert.equal(g.missiles.length,0);
 }
});

function crossingShot(dt,maneuver){
 const g=airborne({speed:315,throttle:.78}),[target,owner]=g.pilots;target.maneuverAssist=true;owner.pos.x-=6000;
 const speed=1000,distance=1600,v=worldSpeed(target),bearing=150*Math.PI/180;
 const pos={x:target.pos.x+Math.sin(bearing)*distance,y:target.pos.y,z:target.pos.z+Math.cos(bearing)*distance};
 const rx=target.pos.x-pos.x,rz=target.pos.z-pos.z,a=v*v-speed*speed,b=2*rz*v;
 const time=(-b-Math.sqrt(b*b-4*a*distance*distance))/(2*a),length=speed*time;
 const m={id:999,type:'heat',ownerId:owner.id,targetId:target.id,pos,dir:{x:rx/length,y:0,z:(rz+v*time)/length},speed,age:9,life:13,decoyed:false,seekerLost:false};g.missiles=[m];
 for(let n=0;n<6/dt;n++)step(g,{[target.id]:maneuver&&g.time<3?{pitch:1}:{}},dt);
 return{target,m};
}
test('bounded guidance and finite coast energy leave a crossing break escape while straight flight is hit',()=>{
 for(const dt of [1/30,1/60,1/144]){
  const straight=crossingShot(dt,false),turn=crossingShot(dt,true);
  assert.equal(straight.target.hp,52);assert.equal(turn.target.hp,100);assert.equal(turn.m.seekerLost,true);
  assert.equal(turn.target.flares,60);assert.equal(turn.target.blackedOut,false);
 }
});

test('radar chaff has weaker bounded fresh-burst odds and persists failed history across snapshots',()=>{
 const target={id:'target',throttle:1},cloud=(id,type='chaff')=>({burstId:id,type,ownerId:target.id,pos:{x:0,y:0,z:0},age:0});
 assert.equal(radarChaffChance(0),.12);assert(radarChaffChance(1)<radarChaffChance(0));assert(radarChaffChance(59)<.001);
 let single=0,many=0,flares=0;const random=seeded(),trials=5000;
 for(let n=0;n<trials;n++){
  const missile=type=>({type,pos:{x:0,y:0,z:0}});
  if(tryRadarChaff(missile('radar'),target,[cloud(1)],random))single++;
  if(tryRadarChaff(missile('radar'),target,Array.from({length:60},(_,i)=>cloud(i)),random))many++;
  if(tryHeatFlare(missile('heat'),target,[cloud(1,'flare')],random))flares++;
 }
 assert(single/trials>.09&&single/trials<.15);assert(many>single&&many/trials<.35);assert(single<flares*.3);
 const m={type:'radar',pos:{x:0,y:0,z:0}},duplicates=Array.from({length:6},()=>cloud(1));let rolls=0;
 assert.equal(tryRadarChaff(m,target,duplicates,()=>{rolls++;return .99;}),null);assert.equal(rolls,1);
 const clone=JSON.parse(JSON.stringify(m));assert.equal(tryRadarChaff(clone,target,duplicates,()=>{throw Error('old burst rerolled');}),null);
 assert(tryRadarChaff(clone,target,[cloud(2)],()=>0));
});

test('low terrain-relative flight is a stronger radar escape opportunity than chaff, never immunity',()=>{
 const pos={x:-28000,y:surfaceHeight(-28000,-18000)+25,z:-18000},target={id:'target',pos,grounded:false},sight={x:0,y:0,z:1},random=seeded(81);
 const missile=()=>({type:'radar',pos:{...pos,z:pos.z-1000}}),low=seekerInterference(missile(),target,sight);
 assert.equal(low.strength,1);assert(Math.abs(low.turnScale-RADAR_CLUTTER.minTurnScale)<1e-10);
 assert.equal(seekerInterference(missile(),{...target,pos:{...pos,y:surfaceHeight(pos.x,pos.z)+180}},sight).strength,0);
 const middle=seekerInterference(missile(),{...target,pos:{...pos,y:surfaceHeight(pos.x,pos.z)+100}},sight);assert(middle.strength>0&&middle.strength<1);
 let lost=0;for(let n=0;n<5000;n++){const m=missile();if(advanceSeekerInterference(m,low,2,random))lost++;}
 assert(lost>3000&&lost<4500,'low flight should be useful but leave successful radar tracks');
 const grounded=seekerInterference(missile(),{...target,grounded:true},sight);assert.equal(grounded.lossRate,low.lossRate);
 const m=missile();assert.equal(advanceSeekerInterference(m,low,.5,()=>.99),false);
 const roundtrip=JSON.parse(JSON.stringify(m));assert.equal(advanceSeekerInterference(roundtrip,low,.5,()=>{throw Error('threshold rerolled');}),false);
});

test('a close radar missile can hit a low airborne target outside runway protection',()=>{
 const g=airborne({speed:315,throttle:1.1}),[owner,target]=g.pilots;target.pos.y=20;owner.pos.y=20;owner.pos.z-=1000;owner.targetId=target.id;owner.lock=3;
 g.missiles=[{id:999,type:'radar',ownerId:owner.id,targetId:target.id,pos:{...target.pos,z:target.pos.z-100},dir:{x:0,y:0,z:1},speed:1400,age:1,life:17,environmentLossThreshold:100,seekerLost:false}];
 for(let n=0;n<30&&target.hp===100;n++)step(g,{},1/60);
 assert.equal(target.hp,40);assert.equal(target.dead,false);
});

test('solid terrain occludes radar sight while clear high sight remains available',()=>{
 const from={x:0,y:100,z:0},to={x:1000,y:100,z:0};
 assert(terrainOccluded(from,to,x=>x>400&&x<600?200:0));assert.equal(terrainOccluded(from,to,()=>40),false);
 const x=NORTHPOINT_SHIFT.x,z=7200+NORTHPOINT_SHIFT.z,peak=surfaceHeight(x,z);
 assert(terrainOccluded({x:x-1500,y:peak-80,z},{x:x+1500,y:peak-80,z}));
 assert.equal(terrainOccluded({x:x-1500,y:peak+1000,z},{x:x+1500,y:peak+1000,z}),false);
});

test('missile propulsion and interference replay identically after network snapshot',()=>{
 const game=airborne(),[p,t]=game.pilots;p.pos.z-=2500;p.targetId=t.id;p.lock=3;
 step(game,{host:{fireHeat:true}},1/60);for(let n=0;n<60;n++)step(game,{},1/60);
 const clone=createGame();assert(applySnapshot(clone,JSON.parse(JSON.stringify(snapshot(game)))));
 for(let n=0;n<240;n++){step(game,{},1/60);step(clone,{},1/60);}assert.deepEqual(snapshot(game),snapshot(clone));
});

test('a radar track behind an authored ridge expires through its finite seeker memory',()=>{
 const g=airborne({speed:100,throttle:.7}),[owner,target]=g.pilots,x=NORTHPOINT_SHIFT.x,z=7200+NORTHPOINT_SHIFT.z,y=surfaceHeight(x,z)-80;
 Object.assign(owner,{pos:{x:x-1700,y,z},yaw:Math.PI/2,targetId:target.id,lock:3});
 Object.assign(target,{pos:{x:x+1500,y,z},yaw:Math.PI/2});
 const m={id:999,type:'radar',ownerId:owner.id,targetId:target.id,pos:{x:x-1500,y,z},dir:{x:1,y:0,z:0},speed:120,age:1,life:17,environmentLossThreshold:100,seekerLost:false};g.missiles=[m];
 for(let n=0;n<36;n++)step(g,{},1/60);
 assert.equal(m.seekerLost,true);assert(m.lostTime>MISSILE.radar.seekerMemory);assert.equal(target.hp,100);
});
