import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,snapshot,applySnapshot} from '../sim.js';
import {AIRFIELDS,fieldPoint} from '../missions.js';
import {groundSpawn,validTouchdown,repairAtAirport} from '../airport-operations.js';
import {resupplyAtAirfield,fullWeaponStores} from '../airfield-resupply.js';
import {initializeFuel} from '../flight.js';
import {heatFlareChance,HEAT_SEEKER} from '../heat-seeker.js';
import {validateInput,ACTIONS} from '../network.js';
const airborne=p=>Object.assign(p,{grounded:false,landed:false,pos:{x:-1800,y:2000,z:-1800},speed:220,throttle:.78,pitch:0,roll:0,departureActive:false});
test('airport departures rotate safely for every squad slot and each arena',()=>{
 for(const arenaId of ['coast','valley'])for(const size of [1,2,3,4]){
  const g=createGame({arenaId,teamSizes:[size,size,size],skirmish:true,seed:23});g.pilots.forEach(p=>p.human=false);const departed=new Set();
  for(let n=0;n<1800;n++){step(g,{},1/60);for(const p of g.pilots){if(!p.grounded)departed.add(p.id);assert(!p.dead,`${arenaId} ${size} ${p.id} died during departure at ${g.time}`);}}
  assert.equal(departed.size,g.pilots.length);assert(g.pilots.every(p=>!p.grounded));
 }
});
test('X airbrake, G gear and K maneuver pulses persist and are replicated',()=>{
 const g=createGame({mode:'freeflight'}),p=airborne(g.pilots[0]);step(g,{host:{toggleAirbrake:true,toggleGear:true,toggleManeuver:true}},1/60);
 assert.equal(p.airbrake,true);assert.equal(p.gearDown,false);assert.equal(p.maneuverAssist,true);
 for(let n=0;n<30;n++)step(g,{host:{}},1/60);
 assert.equal(p.airbrake,true);assert.equal(p.braking,true);assert.equal(p.gearDown,false);
 const clone=createGame();applySnapshot(clone,snapshot(g));assert.equal(clone.pilots[0].airbrake,true);assert.equal(clone.pilots[0].maneuverAssist,true);
 for(const k of ['toggleAirbrake','toggleGear','toggleManeuver']){assert(ACTIONS.includes(k));assert.equal(validateInput({[k]:true})[k],true);assert.equal(validateInput({[k]:1}),null);}
});
test('only owned runway with gear down qualifies for landing',()=>{
 const p=createGame().pilots[0];Object.assign(p,{speed:90,roll:0,yaw:AIRFIELDS.home.heading,gearDown:true});
 assert(validTouchdown(p,AIRFIELDS.home,-3));p.gearDown=false;assert(!validTouchdown(p,AIRFIELDS.home,-3));p.gearDown=true;assert(!validTouchdown(p,AIRFIELDS.northpoint,-3));p.roll=Math.PI;assert(!validTouchdown(p,AIRFIELDS.home,-3));
});
test('own-base resupply requires fresh entry and cooldown; enemy base does not service',()=>{
 const g=createGame(),p=airborne(g.pilots[0]);Object.assign(p,{gunAmmo:20,heat:0,radar:0});p.pos=fieldPoint(AIRFIELDS.northpoint,0,0,30);resupplyAtAirfield(g,p);assert.equal(p.gunAmmo,20);
 p.pos=fieldPoint(AIRFIELDS.home,0,0,30);g.time=20;assert.equal(resupplyAtAirfield(g,p).id,'home');assert.equal(p.gunAmmo,fullWeaponStores(p).gunAmmo);
 p.gunAmmo=20;g.time=60;assert.equal(resupplyAtAirfield(g,p),null);assert.equal(p.gunAmmo,20);
 p.pos.y=500;resupplyAtAirfield(g,p);p.pos.y=30;assert(resupplyAtAirfield(g,p));
});
test('landed owned-base stop repairs components and refuels, enemy runway never does',()=>{
 const g=createGame(),p=g.pilots[0];Object.assign(p,{landed:true,grounded:true,hp:50,engineHealth:.5,controlHealth:.5,fuelKg:100,speed:0,throttle:0});repairAtAirport(g,p,1);assert.equal(p.hp,58);assert(p.engineHealth>.5&&p.controlHealth>.5&&p.fuelKg>100);
 const hp=p.hp,fuel=p.fuelKg;p.pos=fieldPoint(AIRFIELDS.northpoint,0,0,3);repairAtAirport(g,p,1);assert.equal(p.hp,hp);assert.equal(p.fuelKg,fuel);
});
test('bomber never carries, replenishes or launches missiles; gun remains functional',()=>{
 const g=createGame({mode:'strike'}),p=airborne(g.pilots.find(p=>p.bomber));assert.equal(p.heat,0);assert.equal(p.radar,0);assert.equal(fullWeaponStores(p).heat,0);
 p.targetId=g.pilots.find(q=>q.team!==p.team).id;p.lock=3;p.heat=6;p.radar=4;step(g,{[p.id]:{fireHeat:true,fireRadar:true,fireGun:true}},1/60);assert.equal(g.missiles.filter(m=>m.ownerId===p.id).length,0);assert(p.gunShots>0);
});
test('flight does not silently replenish ammunition away from home',()=>{
 const g=createGame({mode:'freeflight'}),p=airborne(g.pilots[0]);p.gunAmmo=20;for(let n=0;n<1500;n++)step(g,{host:{}},1/60);assert.equal(p.gunAmmo,20);
});

test('AI bomber departures clear every owned airport at every starting fuel load',()=>{
 for(const arenaId of ['coast','valley'])for(const team of [0,1,2])for(const fuel of [.25,.5,.75,1])for(const slot of [0,3]){
  const g=createGame({arenaId,teamSizes:[1,1,1],skirmish:true,seed:23}),p=g.pilots[team];
  Object.assign(p,{bomber:true,human:false});Object.assign(p,groundSpawn(g,p,slot));initializeFuel(p,fuel);g.pilots=[p];
  for(let n=0;n<3600&&p.grounded;n++){step(g,{},1/60);assert(!p.dead,`${arenaId} team${team} fuel${fuel} died on runway at ${g.time}`);}
  assert(!p.grounded,`${arenaId} team${team} fuel${fuel} failed to rotate`);const field=AIRFIELDS[p.homeBaseId];
  for(let n=0;n<900;n++){step(g,{},1/60);assert(!p.dead,`${arenaId} team${team} fuel${fuel} slot${slot}: departure climb must clear terrain`);}
  assert(p.pos.y>field.elevation+100);assert.equal(p.afterburnerActive,false);
 }
});
test('heat-seeker flare chance uses actual afterburner state during cooldown and exhaustion',()=>{
 const p={bomber:false,throttle:1,afterburnerActive:true};assert.equal(heatFlareChance(p),HEAT_SEEKER.fullAfterburnerFlareChance);
 for(const extra of [{afterburnerCooldown:10},{fuelKg:0}])assert.equal(heatFlareChance({...p,...extra,afterburnerActive:false}),HEAT_SEEKER.militaryFlareChance);
 assert.equal(heatFlareChance({...p,bomber:true}),HEAT_SEEKER.militaryFlareChance);
});
