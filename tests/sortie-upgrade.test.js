import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,snapshot,applySnapshot,respawnPilot,AIRFIELDS,fieldPoint} from '../sim.js';
import {AIRCRAFT_DEFINITIONS,defaultLoadout,normalizeLoadout,loadoutStores} from '../loadouts.js';
import {initializeFuel,advanceFuel} from '../flight.js';
import {resupplyAtAirfield,fullWeaponStores} from '../airfield-resupply.js';
import {defaultBindings,loadBindings,canonicalKey,BINDINGS_KEY} from '../keybindings.js';
import {keyboardInput} from '../controls.js';
import {validateInput as peerInput} from '../network.js';
import {validateInput as serverInput} from '../server/protocol.js';

test('F-16 stores, tank capacity and selected fuel survive respawn and snapshots',()=>{
 const loadout=defaultLoadout('f16');for(const station of AIRCRAFT_DEFINITIONS.f16.stations)if(station.allowed.includes('tank'))loadout.stations[station.id]='tank';
 const g=createGame({skirmish:true,startingFuel:.5,aircraftId:'f16',loadout}),p=g.pilots[0],stores=loadoutStores('f16',loadout);
 assert.equal(stores.heat+stores.radar,6);assert.equal(stores.tanks,3);assert.equal(p.heat+p.radar,6);
 assert.equal(p.fuelKg,p.internalFuelCapacityKg*.5+p.internalFuelCapacityKg*.6);assert.equal(p.fuelCapacityKg,p.internalFuelCapacityKg*1.6);
 const guest=createGame();assert(applySnapshot(guest,snapshot(g)));assert.deepEqual(guest.pilots[0].loadout,p.loadout);assert.equal(guest.pilots[0].fuelKg,p.fuelKg);
 p.dead=true;p.hp=0;p.respawnAt=0;g.time=4;assert(respawnPilot(g,p.id));assert.equal(p.heat+p.radar,6);assert.deepEqual(p.loadout,loadout);assert.equal(p.aoaLimiterOff,false);
});
test('empty missile loadout stays empty on HOME restock and fuel burn retains external capacity',()=>{
 const empty=normalizeLoadout('f16',{stations:{}}),g=createGame({loadout:empty}),p=g.pilots[0];assert.equal(p.heat+p.radar,0);
 Object.assign(p,{hp:70,grounded:false,departureActive:false,resupplyLatched:false,pos:fieldPoint(AIRFIELDS.home,0,0,60)});g.time=20;assert(resupplyAtAirfield(g,p));assert.equal(p.heat+p.radar,0);assert.equal(p.hp,88);
 const tankLoadout=defaultLoadout('f16');const tank=AIRCRAFT_DEFINITIONS.f16.stations.find(s=>s.allowed.includes('tank'));tankLoadout.stations[tank.id]='tank';
 const q=initializeFuel({aircraftId:'f16',loadout:tankLoadout,throttle:1.1},1),capacity=q.fuelCapacityKg;for(let n=0;n<100;n++)advanceFuel(q,.05);assert.equal(q.fuelCapacityKg,capacity);assert(q.fuelKg<capacity);
});
test('HOME flyby repairs once per entry, cooldown consumes early entries, and repeated distinct passes cap at 100',()=>{
 const g=createGame(),p=g.pilots[0];Object.assign(p,{hp:20,engineHealth:.2,controlHealth:.2,grounded:false,departureActive:false,pos:fieldPoint(AIRFIELDS.home,0,0,60),resupplyLatched:false});g.time=20;const fuel=p.fuelKg;
 assert(resupplyAtAirfield(g,p));assert.equal(p.hp,38);assert.equal(p.fuelKg,fuel);
 for(let n=0;n<300;n++){g.time+=.02;assert.equal(resupplyAtAirfield(g,p),null);}assert.equal(p.hp,38);
 p.pos.y=500;resupplyAtAirfield(g,p);p.pos.y=60;assert.equal(resupplyAtAirfield(g,p),null);g.time=60;assert.equal(resupplyAtAirfield(g,p),null);
 for(let n=0;n<4;n++){p.pos.y=500;resupplyAtAirfield(g,p);g.time+=13;p.pos.y=60;assert(resupplyAtAirfield(g,p));}assert.equal(p.hp,100);assert(p.engineHealth<=1&&p.controlHealth<=1);
 p.hp=50;p.pos=fieldPoint(AIRFIELDS.northpoint,0,0,60);g.time+=20;assert.equal(resupplyAtAirfield(g,p),null);assert.equal(p.hp,50);
 p.dead=true;p.hp=0;p.pos=fieldPoint(AIRFIELDS.home,0,0,60);p.resupplyLatched=false;assert.equal(resupplyAtAirfield(g,p),null);assert.equal(p.hp,0);
});
test('AoA key is a discrete rebindable action for F/A-18E and Su-27 only independent from advanced mode',()=>{
 const input=keyboardInput(new Set(),new Set(['toggleAoaLimiter']));assert(input.toggleAoaLimiter);assert(peerInput(input));assert(serverInput(input));assert(!keyboardInput(new Set(['KeyO'])).toggleAoaLimiter);
 const saved=defaultBindings();delete saved.aoaLimiter;saved.gear=['KeyO'];const storage={getItem:key=>key===BINDINGS_KEY?JSON.stringify(saved):null,setItem(){}};const b=loadBindings(storage);assert.deepEqual(b.gear,['KeyO']);assert.notEqual(b.aoaLimiter[0],'KeyO');assert.equal(canonicalKey(b.aoaLimiter[0],b),'KeyO');
 for(const id of ['f16','fa18e','su27']){const g=createGame({aircraftId:id}),p=g.pilots[0];step(g,{host:input});assert.equal(p.aoaLimiterOff,id!=='f16');assert.equal(!!p.maneuverAssist,false);step(g,{host:{toggleManeuver:true}});assert(p.maneuverAssist);assert.equal(p.aoaLimiterOff,id!=='f16');}
});
test('remote snapshots reject incompatible stores and out-of-limit ammunition',()=>{
 const g=createGame(),copy=snapshot(g);copy.pilots[0].loadout.stations.unknown='radar';assert.equal(applySnapshot(g,copy),false);
 const tooMany=snapshot(g);tooMany.pilots[0].heat=20;assert.equal(applySnapshot(g,tooMany),false);
});

test('old F-16, unsupported and bomber override state is cleared on ticks and snapshot apply',()=>{
 for(const aircraftId of ['f16','fa18e','su27'])for(const bomber of [false,true]){
  const g=createGame({aircraftId}),p=g.pilots[0];Object.assign(p,{bomber,aoaLimiterOff:true});
  const clone=createGame();assert(applySnapshot(clone,snapshot(g)));
  const supported=!bomber&&aircraftId!=='f16';assert.equal(clone.pilots[0].aoaLimiterOff,supported);
  step(g,{});assert.equal(p.aoaLimiterOff,supported);
 }
 const legacy=createGame(),copy=snapshot(legacy);delete copy.pilots[0].aircraftId;copy.pilots[0].aoaLimiterOff=true;
 assert(applySnapshot(legacy,copy));assert.equal(legacy.pilots[0].aoaLimiterOff,false);
});
test('new-jet airbrake deployment remains authoritative and bounded through snapshot replication',()=>{
 for(const aircraftId of ['fa18e','su27']){
  const g=createGame({aircraftId}),p=g.pilots[0];step(g,{host:{toggleAirbrake:true}},1/60);
  assert(p.airbrake);assert(p.airbrakeDeployment>0&&p.airbrakeDeployment<1);
  const clone=createGame();assert(applySnapshot(clone,snapshot(g)));assert.equal(clone.pilots[0].airbrakeDeployment,p.airbrakeDeployment);
 }
 for(const invalid of [NaN,Infinity,-.01,1.01,'1']){const g=createGame(),copy=snapshot(g);copy.pilots[0].airbrakeDeployment=invalid;assert.equal(applySnapshot(g,copy),false);}
});

test('stale F-16 override never changes normal or advanced flight paths',()=>{
 for(const maneuverAssist of [false,true]){
  const games=[false,true].map(aoaLimiterOff=>{
   const g=createGame({mode:'freeflight',aircraftId:'f16',seed:112});g.flightStage='practice';
   Object.assign(g.pilots[0],{aoaLimiterOff,maneuverAssist,grounded:false,departureActive:false,gearDown:false,pos:{x:-28000,y:2000,z:-18000},speed:300,throttle:.78});return g;
  });
  for(let n=0;n<60;n++)for(const g of games)step(g,{host:{pitch:.8,roll:.6}},1/60);
  assert.deepEqual(snapshot(games[0]),snapshot(games[1]));
 }
});
