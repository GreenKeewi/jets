import test from 'node:test';
import assert from 'node:assert/strict';
import {freshPilotG,signedPilotLoad,advancePilotPhysiology,physicalVelocity,updatePilotG,limitFlightEnvelope} from '../pilot-g.js';
import {advanceAttitude} from '../attitude.js';
import {viewAxes} from '../view-axes.js';
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
test('brief loads do not blackout, sustained load does, unloading recovers and negative G is distinct',()=>{
 for(const dt of [1/30,1/60,1/144]){
 const brief=p(),sustained=p(),negative=p();
 for(let t=0;t<.2-dt/2;t+=dt)advancePilotPhysiology(brief,9,dt);
 assert(!brief.blackedOut);assert(brief.gExposure<.08);
 for(let t=0;t<5-dt/2;t+=dt){advancePilotPhysiology(sustained,9,dt);advancePilotPhysiology(negative,-3,dt);}
 assert(sustained.blackedOut);assert(sustained.gVision>.9);assert(negative.blackedOut);assert(negative.gRedout>.9);assert.equal(negative.gExposure,0);
 for(let t=0;t<5-dt/2;t+=dt){advancePilotPhysiology(sustained,1,dt);advancePilotPhysiology(negative,1,dt);}
 assert(!sustained.blackedOut);assert(sustained.gVision<.05);assert(!negative.blackedOut);assert(negative.gRedout<.05);
 }
});
test('contact transitions are reported separately from sustained flight exposure',()=>{
 const plane={...p(),grounded:true};updatePilotG(plane,{x:0,y:-12,z:100},{x:0,y:0,z:90},1/60,false,{velocities:true});
 assert(plane.contactLoad>40);assert.equal(plane.normalLoad,1);assert.equal(plane.gExposure,0);
});
