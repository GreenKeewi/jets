import test from 'node:test';
import assert from 'node:assert/strict';
import {AIRCRAFT_DEFINITIONS,aircraftDefinition,normalizeAircraftId,defaultLoadout,normalizeLoadout,validLoadout,loadoutStores,loadoutCapacity} from '../loadouts.js';
import {initializeFuel,advanceFuel,advanceFlightEnergy,pitchRateLimit,fuelMassRatio} from '../flight.js';
const tanks=(id,count=3)=>{const loadout=defaultLoadout(id);for(const station of aircraftDefinition(id).hardpoints.filter(s=>s.allowed.includes('tank')).slice(0,count))loadout.stations[station.id]='tank';return loadout;};
test('F-16 bounded stations carry at most six compatible missiles and three tanks',()=>{
 const a=aircraftDefinition('f16'),loadout=tanks('f16'),stores=loadoutStores('f16',loadout);
 assert.equal(a.maxMissiles,6);assert.equal(stores.heat,4);assert.equal(stores.radar,2);assert.equal(stores.missiles,6);assert.equal(stores.tanks,3);
 for(const station of a.hardpoints.filter(s=>s.id.startsWith('wingtip')))assert.deepEqual(station.allowed,['empty','heat']);
 for(const station of a.hardpoints.filter(s=>s.id.startsWith('outerwing')||s.id.startsWith('midwing')))assert.deepEqual(station.allowed,['empty','heat','radar']);
});
test('normalization drops arbitrary counts, unknown station IDs, nested objects and incompatible stores',()=>{
 const malformed={heat:100,radar:100,tanks:100,stations:{'wingtip-l':'radar','wingtip-r':{type:'heat',count:20},'outerwing-l':'radar','midwing-l':'tank',centerline:'tank',extra:'heat'}};
 const normalized=normalizeLoadout('f16',malformed),stores=loadoutStores('f16',normalized);
 assert.equal(stores.heat,0);assert.equal(stores.radar,1);assert.equal(stores.tanks,1);assert.equal(normalized.stations['wingtip-l'],'empty');assert(!('extra' in normalized.stations));
 for(const value of [[],42,'heat',{heat:99},{stations:['heat']},{stations:{'outerwing-l':Infinity}}])assert.equal(loadoutStores('f16',normalizeLoadout('f16',value)).missiles,0);
});
test('remote validation rejects malformed maps before canonical normalization',()=>{
 assert(validLoadout('f16',defaultLoadout('f16')));assert(validLoadout('f16',{stations:{'outerwing-l':'radar'}}));
 for(const value of [null,[],{stations:[]},{stations:{'wingtip-l':'radar'}},{stations:{cheat:'heat'}},{stations:{},heat:100},{stations:{'midwing-l':2}}])assert.equal(validLoadout('f16',value),false);
 assert.equal(validLoadout('bad',defaultLoadout('f16')),false);
});
test('new aircraft are distinct and every simplified layout has bounded compatible tank positions',()=>{
 assert.equal(normalizeAircraftId('fa18e'),'fa18e');assert.equal(normalizeAircraftId('su37'),'su37');assert.equal(normalizeAircraftId('__proto__'),'f16');assert.equal(aircraftDefinition(null).id,'f16');
 for(const id of Object.keys(AIRCRAFT_DEFINITIONS)){
  const a=aircraftDefinition(id),stores=loadoutStores(id,tanks(id));assert.equal(stores.tanks,a.maxTanks);assert(stores.missiles<=a.maxMissiles);assert(a.dryMass>0);assert(a.internalFuelCapacity>0);
  assert.equal(new Set(a.hardpoints.map(s=>s.id)).size,a.hardpoints.length);for(const s of a.hardpoints)for(const coordinate of Object.values(s.position))assert(Number.isFinite(coordinate));
 }
 assert.notEqual(aircraftDefinition('fa18e').dryMass,aircraftDefinition('su37').dryMass);assert.notEqual(aircraftDefinition('fa18e').tuning.maxSpeed,aircraftDefinition('f16').tuning.maxSpeed);
 assert.equal(aircraftDefinition('su37').maxTanks,0);assert.match(aircraftDefinition('su37').description,/prototype/);
});
test('each tank adds exactly twenty percent internal capacity; selected internal fuel and full tanks add separately',()=>{
 for(const id of Object.keys(AIRCRAFT_DEFINITIONS))for(let count=0;count<=aircraftDefinition(id).maxTanks;count++){
  const a=aircraftDefinition(id),p=initializeFuel({aircraftId:id,loadout:tanks(id,count)},.25);
  assert.equal(loadoutCapacity(id,p.loadout),a.internalFuelCapacity*(1+.2*count));assert.equal(p.fuelCapacityKg,loadoutCapacity(id,p.loadout));
  assert(Math.abs(p.fuelKg-a.internalFuelCapacity*(.25+.2*count))<1e-8);assert.equal(p.startingFuelFraction,.25);assert.equal(p.massKg,a.dryMass+p.fuelKg);assert.equal(p.fuelFraction,p.fuelKg/p.fuelCapacityKg);
 }
});
test('burning and refueling preserve external capacity and include extra fuel in mass',()=>{
 const p=initializeFuel({aircraftId:'f16',loadout:tanks('f16'),throttle:1.1},.5),capacity=p.fuelCapacityKg,initial=p.fuelKg;
 for(let i=0;i<100;i++)advanceFuel(p,.1);assert(p.fuelKg<initial);assert(p.fuelKg>3200);assert.equal(p.fuelCapacityKg,capacity);assert.equal(p.massKg,aircraftDefinition('f16').dryMass+p.fuelKg);
 p.fuelKg=capacity+500;advanceFuel(p,0);assert.equal(p.fuelKg,capacity);assert.equal(p.fuelFraction,1);assert.equal(p.fuelCapacityKg,5120);
 const clean=initializeFuel({aircraftId:'f16',loadout:defaultLoadout('f16')},.5);assert(fuelMassRatio(clean)>fuelMassRatio(p));
});
test('fighter tuning is distinct while bombers ignore fighter type and external tank assignments',()=>{
 const speeds=[];for(const id of Object.keys(AIRCRAFT_DEFINITIONS)){const p=initializeFuel({aircraftId:id,loadout:defaultLoadout(id),pos:{y:1000},speed:240,pitch:0,throttle:1.1},.5);advanceFlightEnergy(p,{},.1);speeds.push(p.speed);}
 assert.equal(new Set(speeds).size,3);
 const bomber=initializeFuel({bomber:true,aircraftId:'su37',loadout:tanks('su37'),throttle:1.1},.25);assert.equal(bomber.fuelCapacityKg,65000);assert.equal(bomber.fuelKg,16250);assert.equal(bomber.massKg,72000+16250);advanceFuel(bomber,.1);assert.equal(bomber.afterburnerActive,false);
});
test('limiter override affects only F/A-18E and Su-37 while advanced mode stays independent',()=>{
 for(const aircraftId of ['fa18e','su37']){
  const p=initializeFuel({aircraftId,speed:300},.5),normal=pitchRateLimit(p);p.maneuverAssist=true;assert.equal(pitchRateLimit(p),normal);
  p.aoaLimiterOff=true;assert(pitchRateLimit(p)>normal);assert(pitchRateLimit(p)<=.9);
 }
 for(const extra of [{aircraftId:'f16'},{},{aircraftId:'unknown'},{aircraftId:'fa18e',bomber:true},{aircraftId:'su37',bomber:true}]){
  const p=initializeFuel({...extra,speed:300},.5),normal=pitchRateLimit(p);p.aoaLimiterOff=true;assert.equal(pitchRateLimit(p),normal);
 }
});
