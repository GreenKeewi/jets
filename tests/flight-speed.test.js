import test from 'node:test';
import assert from 'node:assert/strict';
import {FLIGHT,fighterTargetSpeed,initializeFuel,advanceFlightEnergy} from '../flight.js';

test('fighter power curve supports faster 600–630 knot cruise and actual Mach 2',()=>{
 assert(fighterTargetSpeed(.78)*1.944>=600&&fighterTargetSpeed(.78)*1.944<=630);
 assert.equal(fighterTargetSpeed(1),FLIGHT.soundSpeed*2);
 let last=0;for(let n=0;n<=1000;n++){const speed=fighterTargetSpeed(n/1000);assert(speed>=last);last=speed;}
 assert.equal(fighterTargetSpeed(-10),0);assert.equal(fighterTargetSpeed(10),686);
});
test('actual fighter speed follows energy and timed thrust rather than a speed servo',()=>{
 const p=initializeFuel({speed:285,throttle:.78,pitch:0,normalLoad:1,pos:{y:0},grounded:false});
 for(let n=0;n<40*60;n++)advanceFlightEnergy(p,{},1/60);
 assert(p.speed>310&&p.speed<320,'dry cruise remains in the authored cruise range');
 p.throttle=1;let peak=p.speed;
 for(let n=0;n<40*60;n++){advanceFlightEnergy(p,{},1/60);peak=Math.max(peak,p.speed);}
 assert(peak>450&&peak<FLIGHT.maxFighterSpeed,'burner adds energy but cannot instantly reach the Mach 2 envelope');
 assert(p.speed<peak);assert.equal(p.afterburnerActive,false);assert.equal(p.afterburnerNeedsRelease,true);
});
test('reference low-power curve remains usable and B-2-inspired bomber cruises subsonically',()=>{
 for(const power of [0,.32,.42,.54,.7])assert(Math.abs(fighterTargetSpeed(power,{freeflight:true})-210*power)<1e-8);
 assert.equal(fighterTargetSpeed(1,{freeflight:true}),686);
 const b=initializeFuel({bomber:true,speed:245,throttle:.78,pitch:0,normalLoad:1,pos:{y:0},grounded:false});
 for(let n=0;n<60*60;n++)advanceFlightEnergy(b,{},1/60);assert(b.speed>235&&b.speed<255);
 b.throttle=1;for(let n=0;n<180*60;n++)advanceFlightEnergy(b,{},1/60);
 assert(b.speed>290&&b.speed<=FLIGHT.maxBomberSpeed);assert.equal(b.afterburnerActive,false);
});
