import test from 'node:test';
import assert from 'node:assert/strict';
import {freshPilotG,signedPilotLoad,advancePilotPhysiology,physicalVelocity,updatePilotG,limitFlightEnvelope,pilotGInput,advanceAirframeWear,G_EFFECTS} from '../pilot-g.js';
import {advanceAttitude} from '../attitude.js';
import {viewAxes} from '../view-axes.js';
import {createGame,step,snapshot,applySnapshot} from '../sim.js';
import {repairAtAirport,groundSpawn} from '../airport-operations.js';
const near=(a,b,e=1e-5)=>assert(Math.abs(a-b)<e,`${a} vs ${b}`);
const p=()=>({...freshPilotG(),speed:400,pitch:0,roll:0,yaw:0,grounded:false,maneuverAssist:true,human:true});
test('signed specific force gives level 1 G, steady climb cos(pitch), free fall zero and 60 degree coordinated turn 2 G',()=>{
 const velocity={x:0,y:0,z:200},dt=.02;
 near(signedPilotLoad(velocity,velocity,{x:0,y:1,z:0},dt),1);
 near(signedPilotLoad(velocity,velocity,{x:0,y:Math.cos(.4),z:-Math.sin(.4)},dt),Math.cos(.4));
 near(signedPilotLoad(velocity,{...velocity,y:-9.81*dt},{x:0,y:1,z:0},dt),0);
 const bank=Math.PI/3,up={x:Math.sin(bank),y:Math.cos(bank),z:0};
 near(signedPilotLoad(velocity,{...velocity,x:9.81*Math.tan(bank)*dt},up,dt),2);
 near(signedPilotLoad(velocity,{...velocity,y:-4*9.81*dt},{x:0,y:1,z:0},dt),-3);
});
test('physical load uses changing speed and stall sink, never world-travel scaling',()=>{
 const plane=p();plane.pitch=.3;const before=physicalVelocity(plane);plane.speed=420;plane.stallSink=4;
 updatePilotG(plane,before,physicalVelocity(plane),.1,false,{velocities:true});
 near(plane.normalLoad,Math.cos(.3)*(1-40/9.81));
});
test('advanced flight commands stay inside signed envelope at multiple frame rates',()=>{
 for(const dt of [1/30,1/60,1/144])for(const bomber of [false,true])for(const sign of [-1,1]){
 const plane={...p(),bomber,speed:686};let peak=-Infinity,low=Infinity;
 for(let t=0;t<4;t+=dt){const before=physicalVelocity(plane);advanceAttitude(plane,{pitch:sign,roll:.5,yaw:.6},dt);updatePilotG(plane,before,physicalVelocity(plane),dt,false,{velocities:true});peak=Math.max(peak,plane.normalLoad);low=Math.min(low,plane.normalLoad);}
 assert(peak<=(bomber?3.5:9)+1e-4,`${dt} ${peak}`);assert(low>=(bomber?-1.5:-3)-1e-4,`${dt} ${low}`);
 }
});
test('normal control flight-path limiter changes actual turn instead of clipping telemetry',()=>{
 const plane=p(),previous={...plane};plane.yaw=.2;plane.pitch=.15;plane.roll=.8;
 limitFlightEnvelope(plane,previous,1/60);assert(plane.envelopeLimited);assert(plane.yaw<.2);
 const measured=signedPilotLoad(physicalVelocity(previous),physicalVelocity(plane),viewAxes(plane,plane.roll).up,1/60);assert(measured<=9+1e-5);
});
test('all loads and durations retain controls with only a light bounded vignette',()=>{
 for(const dt of [1/30,1/60,1/144])for(const load of [1,6,9,-3,-40,40]){
  const plane={...p(),blackedOut:true,gRedout:1,gNeedsRelease:true,gVision:1,gUnloading:true};
  const input={pitch:1,roll:-1,yaw:1,fireGun:true,flare:true,bomb:true};
  for(let n=0;n<120/dt;n++){advancePilotPhysiology(plane,load,dt);assert.deepEqual(pilotGInput(plane,input),input);}
  assert(plane.gVision<=.12);assert.equal(plane.blackedOut,undefined);assert.equal(plane.gRedout,undefined);
  for(let n=0;n<3/dt;n++)advancePilotPhysiology(plane,1,dt);assert(plane.gVision<.001);
 }
});
test('wear is delayed, gradual, nonlethal, capped and frame-rate independent',()=>{
 for(const dt of [1/30,1/60,1/144]){
  for(const load of [1,3,6,7.5,-1,-2]){const plane={...p(),hp:100,normalLoad:load};for(let n=0;n<60/dt;n++)advanceAirframeWear(plane,dt);assert.equal(plane.hp,100);}
  const plane={...p(),hp:100,normalLoad:9};for(let n=0;n<4/dt;n++)advanceAirframeWear(plane,dt);assert.equal(plane.hp,100);
  for(let n=0;n<11/dt;n++)advanceAirframeWear(plane,dt);near(plane.hp,98.5,.006);assert(plane.gWearActive);
  for(let n=0;n<120/dt;n++)advanceAirframeWear(plane,dt);near(plane.hp,90,.006);assert(plane.airframeWear<=10);
  plane.hp=1;for(let n=0;n<20/dt;n++)advanceAirframeWear(plane,dt);assert.equal(plane.hp,1);assert(!plane.dead);
 }
});
test('home landing repairs high-G wear through existing service',()=>{
 const game=createGame(),plane=game.pilots[0];Object.assign(plane,groundSpawn(game,plane),{landed:true,hp:96,airframeWear:4,gWearTime:30});game.time=100;
 repairAtAirport(game,plane,1);assert.equal(plane.hp,100);assert.equal(plane.airframeWear,0);assert.equal(plane.gWearTime,0);assert(plane.repairing);
});
test('legacy snapshot blackout and redout cannot re-enable removed behavior',()=>{
 const game=createGame(),s=snapshot(game);Object.assign(s.pilots[0],{blackedOut:true,gRedout:1,gNeedsRelease:true,gVision:1});assert(applySnapshot(game,s));
 assert.equal(game.pilots[0].blackedOut,undefined);assert.equal(game.pilots[0].gRedout,undefined);assert(game.pilots[0].gVision<=G_EFFECTS.maxVision);
});
test('contact impulses do not cause sustained wear',()=>{
 const plane={...p(),hp:100,grounded:true};updatePilotG(plane,{x:0,y:-12,z:100},{x:0,y:0,z:90},1/60,false,{velocities:true});advanceAirframeWear(plane,1/60);
 assert(plane.contactLoad>40);assert.equal(plane.normalLoad,1);assert.equal(plane.hp,100);
});
