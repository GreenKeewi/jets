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
