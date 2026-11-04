import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,snapshot,applySnapshot,configurePlayers,respawnPilot,equipPilot,bombSolution,worldVelocity,strikeTarget,strikeEscape} from '../sim.js';
import {AIRFIELDS,fieldPoint} from '../missions.js';
import {AIRCRAFT_DEFINITIONS,defaultLoadout,strikeLoadout,loadoutStores,normalizeAircraftId} from '../loadouts.js';
import {initializeFuel,advanceFlightEnergy,pitchRateLimit} from '../flight.js';
import {aoaEnvelope,estimatedAoa,maximumAirspeed,sweepHandling} from '../aerodynamics.js';
import {CameraLook} from '../camera-look.js';
import {createAircraft,animateAircraft} from '../aircraft.js';
import {resupplyAtAirfield} from '../airfield-resupply.js';
const air=p=>Object.assign(p,{grounded:false,departureActive:false,gearDown:false,gearManual:true,pos:{x:0,y:3500,z:0},yaw:0,pitch:0,roll:0,speed:250,throttle:.78});
const equipment=(aircraftId,startingFuel=.75)=>({aircraftId,loadout:defaultLoadout(aircraftId),startingFuel});

test('Su-37 selections migrate to a rebuilt Su-27 without canards or moving nozzles',()=>{
 assert.equal(normalizeAircraftId('su37'),'su27');assert(!AIRCRAFT_DEFINITIONS.su37);const m=createAircraft(0,false,'su27');assert.equal(m.userData.prototype,false);assert(m.userData.camouflage.includes('blue'));assert(!m.userData.surfaces.some(s=>s.kind==='canard'));animateAircraft(m,{controlInput:{pitch:1},speed:200},0,1);assert(m.userData.nozzles.every(n=>n.rotation.x===0));assert.equal(m.userData.nozzles.length,2);
});
test('F-14 sweep is bounded, moves in both LODs, affects handling and is forced forward with gear down',()=>{
 const g=createGame({mode:'freeflight',aircraftId:'f14'}),p=air(g.pilots[0]);for(let n=0;n<4;n++)step(g,{host:{sweepIn:true}});for(let n=0;n<300;n++)step(g,{});assert(p.wingSweep>.99);assert.equal(p.wingSweepTarget,1);
 const m=createAircraft(0,false,'f14');animateAircraft(m,p,0,.1);assert.equal(m.userData.swingWings.length,2);assert(m.userData.swingWings.every(w=>Math.abs(w.node.rotation.y)>.8));m.userData.detailed.visible=false;m.userData.distant.visible=true;assert(m.userData.swingWings.every(w=>w.node.parent.visible));
 assert(sweepHandling({aircraftId:'f14',wingSweep:0,speed:140})>sweepHandling({aircraftId:'f14',wingSweep:1,speed:140}));assert(sweepHandling({aircraftId:'f14',wingSweep:1,speed:450})>sweepHandling({aircraftId:'f14',wingSweep:0,speed:450}));
 p.gearDown=true;for(let n=0;n<300;n++)step(g,{});assert.equal(p.wingSweep,0);assert.equal(p.wingSweepTarget,0);
 const bad=snapshot(g);bad.pilots[0].wingSweep=2;assert.equal(applySnapshot(g,bad),false);
});
test('per-jet published speed approximations cap indicated and actual world speed in burner and dives',()=>{
 for(const aircraftId of Object.keys(AIRCRAFT_DEFINITIONS)){const p=initializeFuel({aircraftId,wingSweep:1,pos:{y:6000},speed:999,throttle:1.1,pitch:-1.2,normalLoad:1,grounded:false});for(let n=0;n<120;n++)advanceFlightEnergy(p,{},1/60);assert(p.speed<=maximumAirspeed(p));const v=worldVelocity(p);assert(Math.hypot(v.x,v.y,v.z)<=maximumAirspeed(p)+1);}
});
test('AoA is lift/airspeed dependent rather than pitch angle; override helps low-speed alpha without 17 G turns',()=>{
 for(const aircraftId of ['fa18e','su27']){const p=initializeFuel({aircraftId,speed:120,pos:{y:1000},pitch:0,normalLoad:4,grounded:false},.5);const normal=aoaEnvelope(p);p.aoaLimiterOff=true;const off=aoaEnvelope(p);assert(off.max>normal.max);assert(off.max<=off.structural);assert(estimatedAoa(p)>15);const alpha=estimatedAoa(p);p.pitch=1.4;assert.equal(estimatedAoa(p),alpha);p.speed=400;assert(estimatedAoa(p)<alpha);assert(aoaEnvelope(p).max<=9);}
});
test('A/D only roll; W pitches through the bank without automatic yaw',()=>{
 for(const direction of [-1,1]){const g=createGame({mode:'freeflight'}),p=air(g.pilots[0]);for(let n=0;n<35;n++)step(g,{host:{roll:direction}},1/60);assert(Math.abs(p.roll)>.6);assert(Math.abs(p.yaw)<1e-8);const roll=p.roll;for(let n=0;n<30;n++)step(g,{});assert(Math.abs(p.roll-roll)<1e-7);for(let n=0;n<60;n++)step(g,{host:{pitch:1}});assert(Math.abs(p.yaw)>.1);assert(p.yaw*direction>0);}
});
test('trackpad/drag camera look is bounded and smoothly recenters after interaction stops',()=>{
 let now=0;const look=new CameraLook(()=>now);look.nudge(200,-80);const previous=look.yaw;look.update(.1);assert.equal(look.yaw,previous);now=300;for(let n=0;n<120;n++)look.update(1/60);assert.equal(look.yaw,0);assert.equal(look.pitch,0);look.dragging=true;look.nudge(999999,999999);assert(Math.abs(look.yaw)<=1.5);look.update(3);assert.equal(Math.abs(look.yaw),1.5);look.reset();assert.equal(look.dragging,false);
});
test('both strike sides use fighters with two twin bomb racks; defence enemies start airborne',()=>{
 for(const role of ['attack','defend'])for(const aircraftId of Object.keys(AIRCRAFT_DEFINITIONS)){const g=createGame({mode:'strike',role,aircraftId}),p=g.pilots.find(p=>p.strikeAttacker);assert(g.pilots.every(p=>!p.bomber));assert.equal(p.bombs,4);assert.equal(Object.values(p.loadout.stations).filter(t=>t==='bomb').length,2);assert.equal(p.heat+p.radar,loadoutStores(aircraftId,defaultLoadout(aircraftId)).missiles-2);assert.equal(p.grounded,role==='attack');assert(g.pilots.find(q=>q.team===0).grounded);const m=createAircraft(0,false,aircraftId);animateAircraft(m,p,0,.1);assert.equal(m.userData.stores.meshes.bomb.count,4);}
});
test('three physical bomb impacts are required, followed by a genuine friendly runway landing',()=>{
 const g=createGame({mode:'strike'}),p=air(g.pilots[0]);for(const q of g.pilots.slice(1))q.human=true;const target=strikeTarget(g);
 for(let hit=1;hit<=3;hit++){g.bombs.push({id:1000+hit,ownerId:p.id,team:p.team,pos:{...target,y:target.y+.01},vel:{x:0,y:-30,z:0},age:0});step(g,{});assert.equal(g.bombHits,hit);assert.equal(g.bombed,hit===3);assert.equal(g.status,'playing');}
 assert(Math.hypot(strikeEscape(g).x-AIRFIELDS.home.x,strikeEscape(g).z-AIRFIELDS.home.z)<1);
 Object.assign(p,{gearDown:true,pos:fieldPoint(AIRFIELDS.home,0,0,3.01),yaw:Math.PI,pitch:-.08,roll:0,speed:110,throttle:0});step(g,{});assert(p.landed);assert.equal(g.status,'complete');assert.equal(g.result.winner,p.team);
});
test('HOME replenishes bombs after misses; defence victory and defeat require the correct outcomes',()=>{
 const a=createGame({mode:'strike'}),p=air(a.pilots[0]);p.bombs=0;a.time=20;Object.assign(p,{pos:fieldPoint(AIRFIELDS.home,0,0,50),resupplyLatched:false});assert(resupplyAtAirfield(a,p));assert.equal(p.bombs,4);
 const win=createGame({mode:'strike',role:'defend'});for(const q of win.pilots.filter(q=>q.strikeAttacker)){q.dead=true;q.hp=0;}step(win,{});assert.equal(win.result.winner,0);
 const lose=createGame({mode:'strike',role:'defend'});lose.bombHits=3;lose.bombed=true;step(lose,{});assert.equal(lose.result.winner,1);
});
test('independent equipment survives host assignment, snapshots and respawns without touching other pilots',()=>{
 const selections={host:equipment('f14',.5),p1:equipment('su27',1)},g=createGame({teamSize:2,skirmish:true,playerEquipment:selections});configurePlayers(g,['host','p1'],{host:0,p1:0});const host=g.pilots.find(p=>p.id==='host'),guest=g.pilots.find(p=>p.id==='p1');assert.equal(host.aircraftId,'f14');assert.equal(guest.aircraftId,'su27');assert.equal(host.startingFuelFraction,.5);assert.equal(guest.startingFuelFraction,1);const saved=JSON.stringify(host.loadout);guest.loadout.stations['wingtip-l']='empty';guest.heat--;assert.equal(JSON.stringify(host.loadout),saved);
 const copy=createGame();assert(applySnapshot(copy,snapshot(g)));assert.equal(copy.pilots.find(p=>p.id==='p1').aircraftId,'su27');guest.dead=true;guest.hp=0;guest.respawnAt=0;g.time=5;assert(respawnPilot(g,'p1'));assert.equal(guest.aircraftId,'su27');assert.equal(guest.loadout.stations['wingtip-l'],'heat');assert.equal(host.aircraftId,'f14');
});
