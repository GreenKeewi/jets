import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeFuel,advanceFlightEnergy} from '../flight.js';
const plane=(speed,extra={})=>initializeFuel({speed,throttle:0,pitch:0,normalLoad:1,pos:{y:1000},grounded:false,gearDown:false,...extra});
function run(p,seconds,brake,dt=1/60){for(let n=0;n<Math.round(seconds/dt);n++)advanceFlightEnergy(p,{brake},dt);return p;}
test('airborne airbrake builds gradually and remains weaker across aircraft and speeds',()=>{
 for(const bomber of [false,true])for(const speed of [100,150,250,bomber?309:600]){
  const coast=plane(speed,{bomber}),braked=plane(speed,{bomber});
  advanceFlightEnergy(coast,{},1/60);advanceFlightEnergy(braked,{brake:true},1/60);
  assert(coast.speedAcceleration-braked.speedAcceleration<.6,'first-frame drag must ramp, not jump by28m/s²');
  run(coast,2,false);run(braked,2,true);
  const loss=coast.speed-braked.speed;assert(loss>3&&loss<26,`${bomber} ${speed}: extra loss ${loss}`);
  assert(braked.airbrakeDeployment>.98);
  const deployed=braked.airbrakeDeployment;run(braked,1,false);assert(braked.airbrakeDeployment<deployed*.14,'retract smoothly');
 }
});
test('approach airbrake helps slow down without dumping landing speed in one second',()=>{
 for(const bomber of [false,true]){
  const coast=plane(115,{bomber,gearDown:true}),braked=plane(115,{bomber,gearDown:true});
  run(coast,1,false);run(braked,1,true);
  assert(braked.speed>100,'safe approach retains a usable speed margin');assert(braked.speed<coast.speed-1);
 }
});
test('ground wheel brakes retain original18m/s² additional braking',()=>{
 for(const bomber of [false,true])for(const speed of [20,80,110]){
  const coast=plane(speed,{bomber,grounded:true}),braked=plane(speed,{bomber,grounded:true});
  advanceFlightEnergy(coast,{},1/60);advanceFlightEnergy(braked,{brake:true},1/60);
  assert(Math.abs(coast.speedAcceleration-braked.speedAcceleration-18)<1e-9);
  run(braked,8,true);assert.equal(braked.speed,0);
 }
});
test('gradual airbrake response is consistent at30/60/144Hz',()=>{
 const speeds=[30,60,144].map(hz=>run(plane(250),5,true,1/hz).speed);
 assert(Math.max(...speeds)-Math.min(...speeds)<.3,JSON.stringify(speeds));
});

test('new-jet surface deployment advances on the ground and stays continuous at liftoff',()=>{
 for(const aircraftId of ['fa18e','su37']){
  const p=plane(100,{aircraftId,grounded:true,airbrake:true});run(p,.5,true);
  assert(p.airbrakeDeployment>.6&&p.airbrakeDeployment<.7);const before=p.airbrakeDeployment;
  p.grounded=false;advanceFlightEnergy(p,{brake:true},1/60);assert(p.airbrakeDeployment>before&&p.airbrakeDeployment-before<.03);
  p.grounded=true;p.airbrake=false;run(p,1,false);assert(p.airbrakeDeployment<.1);
 }
});
test('full-power braking spends meaningful energy on new jets while thrust can still overcome drag',()=>{
 for(const aircraftId of ['fa18e','su37'])for(const throttle of [1,1.1])for(const dt of [1/30,1/60,1/144]){
  const coast=initializeFuel({aircraftId,speed:315,throttle,pitch:0,normalLoad:1,pos:{y:1000},grounded:false,gearDown:false},.5),braked=structuredClone(coast);
  advanceFlightEnergy(coast,{},dt);advanceFlightEnergy(braked,{brake:true},dt);assert(coast.speedAcceleration-braked.speedAcceleration<1.1);
  run(coast,5,false,dt);run(braked,5,true,dt);
  assert(coast.speed-braked.speed>45);assert(coast.speed-braked.speed<70);assert(braked.speed>250);
  if(throttle===1)assert(braked.speed<315);else assert(braked.speed>315,'full afterburner may still accelerate against brake drag');
 }
});
test('new-jet deployment and speed remain consistent across timesteps',()=>{
 for(const aircraftId of ['fa18e','su37']){
  const results=[30,60,144].map(hz=>{const p=plane(315,{aircraftId,throttle:1});run(p,2,true,1/hz);run(p,1,false,1/hz);return p;});
  assert(Math.max(...results.map(p=>p.speed))-Math.min(...results.map(p=>p.speed))<.3);
  assert(Math.max(...results.map(p=>p.airbrakeDeployment))-Math.min(...results.map(p=>p.airbrakeDeployment))<1e-10);
 }
});
