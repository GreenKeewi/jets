import test from 'node:test';
import assert from 'node:assert/strict';
import {FLIGHT,initializeFuel,advanceFlightEnergy,advanceFuel,pitchRateLimit,turnAuthority} from '../flight.js';
import {freshPilotG,updatePilotG} from '../pilot-g.js';
const plane=(v={})=>initializeFuel({pos:{y:1000},speed:240,pitch:0,roll:0,yaw:0,throttle:.78,grounded:false,...freshPilotG(),...v});
const advance=(p,time,input={})=>{for(let t=0;t<time-1e-8;t+=.02)advanceFlightEnergy(p,input,.02);return p;};
test('runway thrust is bounded, requires runway, and never servos to Mach 1',()=>{
 const p=plane({grounded:true,speed:0,throttle:1,pos:{y:0}});advance(p,8);
 assert(p.speed>45&&p.speed<90,`8 second speed ${p.speed}`);assert(p.speedAcceleration<11);
 advance(p,12);assert(p.speed<180);assert(p.speed<FLIGHT.soundSpeed);
 const idle=plane({grounded:true,speed:0,throttle:0});advance(idle,10);assert.equal(idle.speed,0);
});
test('potential energy exchange has the correct magnitude and sign',()=>{
 const level=plane({throttle:0}),climb=plane({throttle:0,pitch:Math.PI/6}),dive=plane({throttle:0,pitch:-Math.PI/6});
 for(const p of[level,climb,dive])advanceFlightEnergy(p,{},.02);
 assert(Math.abs(climb.speedAcceleration-level.speedAcceleration+4.905)<1e-7);
 assert(Math.abs(dive.speedAcceleration-level.speedAcceleration-4.905)<1e-7);
});
test('fuel is consumed, lighter aircraft accelerate and turn better, no fuel means no thrust',()=>{
 const heavy=plane({throttle:.82}),light=plane({throttle:.82});initializeFuel(light,.25);
 const start=heavy.fuelKg;advance(heavy,1);advance(light,1);assert(heavy.fuelKg<start);assert(light.speed>heavy.speed);
 assert(pitchRateLimit(light)>pitchRateLimit(heavy));assert(turnAuthority(240,light)>turnAuthority(240,heavy));
 const empty=plane({throttle:1}),coast=plane({throttle:0});initializeFuel(empty,0);initializeFuel(coast,0);advance(empty,1);advance(coast,1);assert.equal(empty.speed,coast.speed);assert(!empty.afterburnerActive);
});
test('burner lasts 15 seconds, cools for 10, and held throttle cannot silently restart it',()=>{
 const p=plane({throttle:1});for(let i=0;i<149;i++)advanceFuel(p,.1);assert(p.afterburnerActive);assert(p.afterburnerRemaining<.101);
 advanceFuel(p,.1);assert(!p.afterburnerActive);assert.equal(p.afterburnerCooldown,10);assert(p.afterburnerNeedsRelease);
 for(let i=0;i<250;i++)advanceFuel(p,.1);assert(!p.afterburnerActive);assert.equal(p.afterburnerCooldown,0);assert.equal(p.afterburnerRemaining,15);
 p.throttle=.8;advanceFuel(p,.1);p.throttle=1;advanceFuel(p,.1);assert(p.afterburnerActive);
});
test('throttle feathering does not replenish an unfinished burner budget',()=>{
 const p=plane({throttle:1});for(let i=0;i<50;i++)advanceFuel(p,.1);const left=p.afterburnerRemaining;
 p.throttle=.5;for(let i=0;i<50;i++)advanceFuel(p,.1);assert.equal(p.afterburnerRemaining,left);
});
test('B-2-inspired bomber is faster but remains subsonic and has no afterburner',()=>{
 const p=plane({bomber:true,throttle:1,speed:200});advance(p,180);assert(p.speed>260,`bomber ${p.speed}`);assert(p.speed<=309);assert(!p.afterburnerActive);
 assert.equal(FLIGHT.bomberCruiseSpeed,245);
});
test('arcade maneuver assist increases pitch authority without free engine power',()=>{
 const normal=plane(),assist=plane({maneuverAssist:true});assert(pitchRateLimit(assist)>pitchRateLimit(normal)*2);advance(normal,1);advance(assist,1);assert.equal(normal.speed,assist.speed);
});
test('engine and control damage affect separate performance dimensions',()=>{
 const healthy=plane({throttle:1}),damaged=plane({throttle:1,engineHealth:0,controlHealth:0});advance(healthy,1);advance(damaged,1);assert(healthy.speed>damaged.speed);
 assert(pitchRateLimit(damaged)<pitchRateLimit(healthy)*.5);assert(turnAuthority(240,damaged)<turnAuthority(240,healthy)*.5);
});
test('pilot load is signed for pull, push and inverted flight',()=>{
 const before={x:0,y:0,z:1};
 const pull=plane(),push=plane(),inverted=plane({roll:Math.PI});
 for(let i=0;i<30;i++){
  updatePilotG(pull,before,{x:0,y:.003,z:Math.sqrt(1-.003**2)},.02,false);
  updatePilotG(push,before,{x:0,y:-.003,z:Math.sqrt(1-.003**2)},.02,false);
  updatePilotG(inverted,before,before,.02,false);
 }
 assert(pull.normalLoad>1&&pull.gLoad>1);assert(push.normalLoad<0&&push.gLoad<0);assert(inverted.gLoad<0);
});

test('faster airborne fighter has strong dry thrust and a finite burner speed advantage',()=>{
 const dry=plane({throttle:.82,gearDown:false}),burner=plane({throttle:1,gearDown:false});
 advance(dry,14);advance(burner,8);
 assert(dry.speed>343&&dry.speed<355,`dry speed after 14 seconds ${dry.speed}`);
 assert(burner.speed>500&&burner.speed<510,`burner speed after 8 seconds ${burner.speed}`);
 advance(burner,7);
 assert(burner.speed>620&&burner.speed<640,`15-second burner peak ${burner.speed}`);
 assert(!burner.afterburnerActive);assert(burner.afterburnerNeedsRelease);
 const peak=burner.speed;advance(burner,10);assert(burner.speed<peak,'dry thrust cannot sustain the burner peak');
});

test('airborne thrust increase leaves both runway accelerations unchanged',()=>{
 const fighter=plane({grounded:true,speed:0,throttle:1,pos:{y:0}});
 const bomber=plane({bomber:true,grounded:true,speed:0,throttle:1,pos:{y:0}});
 advance(fighter,10);advance(bomber,10);
 assert(Math.abs(fighter.speed-80.813)<.02,`fighter runway speed ${fighter.speed}`);
 assert(Math.abs(bomber.speed-34.068)<.02,`bomber runway speed ${bomber.speed}`);
});

test('faster thrust still respects drag, gravity, airbrakes and the Mach 2 hard cap',()=>{
 const level=plane({throttle:1,speed:400,normalLoad:1}),turn=plane({throttle:1,speed:400,normalLoad:8}),braked=plane({throttle:1,speed:400,normalLoad:1});
 advance(level,2);advance(turn,2);advance(braked,2,{brake:true});
 assert(turn.speed<level.speed,'high-load turns must still cost energy');
 assert(braked.speed<level.speed,'airbrakes must still remove energy');
 const dive=plane({throttle:1,speed:685,pitch:-Math.PI/2});advance(dive,2);assert.equal(dive.speed,FLIGHT.maxFighterSpeed);
});
