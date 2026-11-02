import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,snapshot,applySnapshot} from '../sim.js';
import {AIRFIELDS,fieldPoint} from '../missions.js';
import {defaultLoadout} from '../loadouts.js';
import {jettisonTanks,advanceFuel,initializeFuel,pitchRateLimit} from '../flight.js';
import {airportRelation,validTouchdown} from '../airport-operations.js';
import {mapObjectives} from '../tactical-map.js';
import {advancePilotPhysiology} from '../pilot-g.js';
import {createAircraft,animateAircraft} from '../aircraft.js';
import {keyboardInput} from '../controls.js';
import {validateInput as peerInput} from '../network.js';
import {validateInput as serverInput} from '../server/protocol.js';
import {defaultBindings,loadBindings} from '../keybindings.js';

const airborne=p=>Object.assign(p,{grounded:false,departureActive:false,gearDown:false,gearManual:true,pos:{x:0,y:3000,z:0},speed:250,throttle:.78,pitch:0,roll:0});
const tankLoadout=()=>{const l=defaultLoadout('f16');l.stations.centerline='tank';return l;};
test('external fuel burns first; jettison discards only remaining external fuel and permanently removes tank capacity',()=>{
 const p=initializeFuel({aircraftId:'f16',loadout:tankLoadout(),grounded:true,throttle:1},.5);
 assert.equal(jettisonTanks(p),0);p.grounded=false;advanceFuel(p,.1);const internal=p.fuelKg-p.externalFuelKg;
 assert.equal(jettisonTanks(p),1);assert.equal(p.fuelKg,internal);assert.equal(p.fuelCapacityKg,3200);assert.equal(p.externalFuelKg,0);assert.equal(p.loadout.stations.centerline,'empty');
 const fuel=p.fuelKg;for(let n=0;n<10;n++){assert.equal(jettisonTanks(p),0);advanceFuel(p,.1);}assert(p.fuelKg<fuel);assert.equal(p.fuelCapacityKg,3200);
});
test('tank drop is a validated press action, replicated with stores, fuel and bounded falling geometry',()=>{
 const input=keyboardInput(new Set(),new Set(['jettisonTanks']));assert(peerInput(input));assert(serverInput(input));assert.equal(peerInput({jettisonTanks:1}),null);assert.equal(serverInput({jettisonTanks:1}),null);
 const g=createGame({mode:'freeflight',loadout:tankLoadout()}),p=airborne(g.pilots[0]);step(g,{host:input});assert.equal(p.externalFuelCapacityKg,0);assert(g.effects.some(e=>e.type==='tank-drop'));
 const clone=createGame();assert(applySnapshot(clone,snapshot(g)));assert.deepEqual(clone.pilots[0].loadout,p.loadout);assert.equal(clone.pilots[0].fuelKg,p.fuelKg);
 const model=createAircraft();animateAircraft(model,p,0,.1);assert.equal(model.userData.stores.meshes.tank.count,0);
 for(let n=0;n<360;n++)step(g,{});assert(!g.effects.some(e=>e.type==='tank-drop'));
});
test('saved custom J/T bindings survive addition of new controls without duplicate keys',()=>{
 const old=defaultBindings();delete old.rearView;delete old.jettison;old.gear=['KeyJ'];old.map=['KeyT'];
 const loaded=loadBindings({getItem:()=>JSON.stringify(old),setItem(){}});assert.deepEqual(loaded.gear,['KeyJ']);assert.deepEqual(loaded.map,['KeyT']);assert.notEqual(loaded.rearView[0],'KeyJ');assert.notEqual(loaded.jettison[0],'KeyT');assert.equal(new Set(Object.values(loaded).flat()).size,Object.values(loaded).flat().length);
});
test('gear-down landings allow both directions and wider approach tolerance at all fields',()=>{
 for(const field of Object.values(AIRFIELDS))for(const reverse of [0,Math.PI]){const p={gearDown:true,speed:140,roll:.4,yaw:field.heading+reverse+.4};assert(validTouchdown(p,field,-15));p.gearDown=false;assert(!validTouchdown(p,field,-15));p.gearDown=true;p.speed=180;assert(!validTouchdown(p,field,-15));}
});
test('enemy touchdown is fatal; neutral assistance happens once, HOME remains useful',()=>{
 for(const reverse of [0,Math.PI])for(const field of Object.values(AIRFIELDS)){
  const g=createGame({skirmish:true}),p=airborne(g.pilots[0]);for(const q of g.pilots.slice(1))q.human=true;
  const relation=airportRelation(g,p,field),fuel=100;Object.assign(p,{gearDown:true,pos:fieldPoint(field,0,0,3.01),speed:110,yaw:field.heading+reverse,pitch:-.08,fuelKg:fuel,throttle:0,hp:60});
  step(g,{host:{}});assert(p.grounded,`${field.id} reverse ${reverse}`);
  if(relation==='enemy'){assert(p.dead);assert(g.events.some(e=>e.type==='airport'));continue;}
  assert(!p.dead);if(relation==='neutral'){
   assert(p.fuelKg>fuel+310&&p.fuelKg<fuel+321);assert.match(g.events.findLast(e=>e.type==='landed').text,/take off again/);
   const supplied=p.fuelKg;Object.assign(p,{grounded:false,pos:fieldPoint(field,0,0,3.01),pitch:-.08,speed:110});step(g,{});assert(p.fuelKg<supplied);assert.equal(p.neutralFuelVisits.length,1);
  }else{p.speed=0;p.throttle=0;for(let n=0;n<240;n++)step(g,{});assert(p.hp>60);assert(p.fuelKg>fuel);}
 }
});
test('free flight has no map objectives, route advancement, landing award or time limit',()=>{
 const g=createGame({mode:'freeflight'}),p=g.pilots[0];assert.deepEqual(mapObjectives(g),[]);g.flightStage='route';g.routeIndex=0;p.grounded=false;p.pos={x:-1800,y:300,z:-200};p.speed=100;p.departureActive=false;
 step(g,{});assert.equal(g.routeIndex,0);g.time=20000;g.flightStage='landed';g.routeIndex=5;p.grounded=true;p.landed=true;p.speed=0;p.throttle=0;p.pos=fieldPoint(AIRFIELDS.home,0,0,3);step(g,{});assert.equal(g.status,'playing');assert.equal(g.result,null);
});
test('limiter off increases turn authority and severe tunnel vision without blackout or control suppression',()=>{
 for(const aircraftId of ['fa18e','su37']){const normal={aircraftId,speed:250,controlHealth:1,fuelFraction:.5},off={...normal,aoaLimiterOff:true};assert(pitchRateLimit(off)>pitchRateLimit(normal)*1.6);
  for(let n=0;n<180;n++){advancePilotPhysiology(normal,9,1/60);advancePilotPhysiology(off,9,1/60);}assert(normal.gVision<=.5);assert(off.gVision>.8);assert(!off.blackedOut);assert.equal(off.gRedout,0);
 }
});
test('surfaces follow input even in attitude hold, and afterburner is orange',()=>{
 for(const id of ['f16','fa18e','su37']){const model=createAircraft(0,false,id),p={aircraftId:id,gearDown:true,throttle:1.1,afterburnerActive:true,roll:0,pitch:0,controlInput:{pitch:.8,roll:.7,yaw:.6}};animateAircraft(model,p,0,1/9);
  for(const kind of ['aileron','elevator','flap','rudder'])assert(model.userData.surfaces.some(s=>s.kind===kind&&Math.abs(s.node.rotation[kind==='rudder'?'y':'x'])>.01),`${id} ${kind}`);
  assert.equal(model.userData.flames[0].children[0].material.color.getHex(),0xff6c12);
  animateAircraft(model,{...p,gearDown:false,controlInput:{pitch:0,roll:0,yaw:0}},1,1/9);assert(model.userData.surfaces.filter(s=>s.kind==='aileron').every(s=>Math.abs(s.node.rotation.x)<.001));
 }
});
test('all three airfield pairs are farther apart and within reachable map distances',()=>{
 const fields=Object.values(AIRFIELDS),old=[{x:-1800,z:-2000},{x:10500,z:11000},{x:-9900,z:4200}];for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){const d=Math.hypot(fields[i].x-fields[j].x,fields[i].z-fields[j].z);assert(d>Math.hypot(old[i].x-old[j].x,old[i].z-old[j].z));assert(d<35000);}
});
test('neutral fuel eligibility resets on a new airframe; invalid replicated visit/fuel state is rejected',async()=>{
 const {respawnPilot}=await import('../sim.js');const g=createGame({skirmish:true}),p=g.pilots[0];p.neutralFuelVisits=['westhaven'];p.dead=true;p.hp=0;p.respawnAt=0;g.time=4;assert(respawnPilot(g,p.id));assert.deepEqual(p.neutralFuelVisits,[]);
 for(const visits of ['westhaven',['bogus'],['home','home']]){const s=snapshot(g);s.pilots[0].neutralFuelVisits=visits;assert.equal(applySnapshot(g,s),false);}
 const s=snapshot(g);s.pilots[0].externalFuelKg=Infinity;assert.equal(applySnapshot(g,s),false);
});
