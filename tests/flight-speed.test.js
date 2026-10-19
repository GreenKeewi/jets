import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,FLIGHT,fighterTargetSpeed} from '../sim.js';

test('fighter power curve supports 500–600 knot cruise and actual Mach 2',()=>{
 assert(fighterTargetSpeed(.78)*1.944>=500&&fighterTargetSpeed(.78)*1.944<=600);
 assert.equal(fighterTargetSpeed(1),FLIGHT.soundSpeed*2);
 let last=0;for(let n=0;n<=1000;n++){const speed=fighterTargetSpeed(n/1000);assert(speed>=last);last=speed;}
 assert.equal(fighterTargetSpeed(-10),0);assert.equal(fighterTargetSpeed(10),686);
});
test('simulated airspeed converges to the power curve without relabeling the HUD',()=>{
 for(const power of [.78,1]){const g=createGame(),p=g.pilots[0];g.pilots.forEach(p=>p.human=true);g.pilots[1].pos={x:20000,y:3000,z:0};Object.assign(p,{pos:{x:0,y:3000,z:0},speed:285,throttle:power});for(let n=0;n<40*60;n++)step(g,{});assert(Math.abs(p.speed-fighterTargetSpeed(power))<.04);if(power===1)assert(Math.abs(p.speed/FLIGHT.soundSpeed-2)<.001);}
});
test('freeflight preserves low-power taxi and approach speeds while allowing full afterburner',()=>{
 for(const power of [0,.32,.42,.54,.7])assert(Math.abs(fighterTargetSpeed(power,{freeflight:true})-210*power)<1e-8);
 assert.equal(fighterTargetSpeed(1,{freeflight:true}),686);
 const g=createGame({mode:'strike'}),b=g.pilots.find(p=>p.bomber);g.pilots.forEach(p=>p.human=true);b.pos.y=3000;b.throttle=1;for(let n=0;n<40*60;n++)step(g,{});assert(b.speed<173);assert.equal(b.bomber,true);
});
