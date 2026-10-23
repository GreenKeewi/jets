import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAVEL,travelMultiplier,worldSpeed,worldVelocity} from '../arcade-travel.js';
import {createGame,step,bombSolution,snapshot,applySnapshot,MISSILE} from '../sim.js';
import {flightForward} from '../view-axes.js';
import {updatePilotG} from '../pilot-g.js';
import {advanceFlightEnergy} from '../flight.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);
const airframe=()=>({speed:260,yaw:.3,pitch:.1,grounded:false,gearDown:false,departureActive:false,stallSink:0,pos:{x:18000,y:1500,z:18000}});
test('cruise covers 50% more world distance without mutating airspeed or signed G',()=>{
 const p={...airframe(),gLoad:-2,normalLoad:-2},before=structuredClone(p),f=flightForward(p),v=worldVelocity(p);
 near(worldSpeed(p),390);near(v.x,f.x*390);near(v.y,f.y*390);near(v.z,f.z*390);assert.deepEqual(p,before);
 for(const reason of['grounded','gearDown','departureActive','travelApproach'])assert.equal(travelMultiplier({...p,[reason]:true}),1);
 assert.equal(travelMultiplier({...p,speed:120}),1);assert.equal(travelMultiplier({...p,speed:170}),1.25);assert.equal(travelMultiplier({...p,speed:220}),1.5);
});
test('actual simulation translation boosts travel while energy, G and vision stay on airspeed',()=>{
 const g=createGame({mode:'freeflight'}),p=g.pilots[0];g.flightStage='practice';Object.assign(p,airframe(),{maneuverAssist:true,throttle:.78});
 const initial=structuredClone(p),before=flightForward(p),dt=.02,input={pitch:.4,roll:.2};step(g,{host:input},dt);
 const expected={...initial,yaw:p.yaw,pitch:p.pitch,roll:p.roll};updatePilotG(expected,before,flightForward(p),dt,false);advanceFlightEnergy(expected,input,dt);
 near(p.speed,expected.speed);near(p.gLoad,expected.gLoad);near(p.normalLoad,expected.normalLoad);near(p.gVision,expected.gVision);near(p.gExposure,expected.gExposure);near(p.fuelKg,expected.fuelKg);
 const velocity=worldVelocity(p);near(p.pos.x-initial.pos.x,velocity.x*dt);near(p.pos.y-initial.pos.y,velocity.y*dt);near(p.pos.z-initial.pos.z,velocity.z*dt);
 near(Math.hypot(p.pos.x-initial.pos.x,p.pos.y-initial.pos.y,p.pos.z-initial.pos.z),p.speed*dt*1.5);
});
test('ground, low-speed landing and guided approach retain normal travel',()=>{
 for(const patch of[{grounded:true},{gearDown:true},{speed:100},{travelApproach:true}]){const p={...airframe(),pitch:0,...patch};near(worldSpeed(p),p.speed);}
 const p={...airframe(),stallSink:17};near(worldVelocity(p).y,Math.sin(p.pitch)*390-17);
 const g=createGame({mode:'freeflight'}),pilot=g.pilots[0];Object.assign(pilot,airframe());g.flightStage='approach';step(g,{host:{}},.02);assert.equal(pilot.travelApproach,true);assert.equal(travelMultiplier(pilot),1);
});
test('bomb prediction uses boosted launch velocity including climb and dive',()=>{
 for(const pitch of[-.2,0,.2]){const p={...airframe(),pitch},v=worldVelocity(p),impact=bombSolution(p),t=(v.y+Math.sqrt(v.y*v.y+90*(p.pos.y-4)))/45;near(impact.x,p.pos.x+v.x*t,.1);near(impact.z,p.pos.z+v.z*t,.1);near(p.pos.y+v.y*t-22.5*t*t,4);}
});
test('weapon caps can catch maximum boosted jets and snapshots retain travel state',()=>{
 assert(MISSILE.heat.maxSpeed>686*TRAVEL.maxMultiplier);assert(MISSILE.radar.maxSpeed>686*TRAVEL.maxMultiplier);
 const a=createGame({mode:'freeflight'}),b=createGame({mode:'freeflight'});Object.assign(a.pilots[0],airframe(),{travelApproach:true});assert.equal(applySnapshot(b,snapshot(a)),true);assert.deepEqual(worldVelocity(b.pilots[0]),worldVelocity(a.pilots[0]));
});
test('a launched heat missile can catch a straight maximum-speed boosted fighter',()=>{
 const g=createGame({mode:'dogfight',teamSize:1,seed:94}),[p,target]=g.pilots;
 for(const q of g.pilots)Object.assign(q,airframe(),{human:true,pitch:0,yaw:0,roll:0,speed:686,throttle:1,spawnProtectedUntil:0,collisionGraceUntil:0});
 target.pos={...target.pos,z:target.pos.z+900};p.targetId=target.id;p.lock=2;
 step(g,{host:{fireHeat:true}},1/60);assert.equal(g.missiles.length,1);
 for(let n=0;n<600&&target.hp===100;n++)step(g,{},1/60);
 assert(target.hp<100,'boosted fighter must not outrun the matched weapon model');
});
