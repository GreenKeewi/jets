import test from 'node:test';
import assert from 'node:assert/strict';
import {flightSound,FlightAudio,nearbyJetSound} from '../audio.js';
const pilot=(overrides={})=>({id:'host',pos:{x:0,y:1000,z:0},yaw:0,pitch:0,roll:0,speed:300,throttle:1,fuelKg:100,engineHealth:1,...overrides});
test('destroyed or fuel-starved engines lose powered beds but retain aerodynamic wind',()=>{
 for(const override of [{engineHealth:0},{fuelKg:0},{dead:true}]){
  const s=flightSound(pilot({...override,afterburnerActive:true}));
  for(const key of ['jet','engine','turbine','harmonic'])assert.equal(s[key],0,key);
  assert(s.wind>0);
 }
});
test('afterburner and cockpit have distinct bounded mixes',()=>{
 const dry=flightSound(pilot()),wet=flightSound(pilot({throttle:1.1,afterburnerActive:true})),inside=flightSound(pilot(),true);
 assert(wet.jet>dry.jet&&wet.rumble>dry.rumble);assert(inside.jet<dry.jet&&inside.wind<dry.wind);assert(inside.engine>dry.engine);
 for(const speed of [0,100,343,686])for(const inside of [true,false])for(const v of Object.values(flightSound(pilot({speed}),inside)))assert(Number.isFinite(v));
});
test('nearby mix attenuates distance and pans opposite sides',()=>{
 const p=pilot(),left=nearbyJetSound(p,pilot({id:'other',pos:{x:100,y:1000,z:0}})),right=nearbyJetSound(p,pilot({id:'other',pos:{x:-100,y:1000,z:0}}));
 assert.equal(left.pan,-right.pan);assert(left.gain>nearbyJetSound(p,pilot({pos:{x:1000,y:1000,z:0}})).gain);
});
test('cockpit system transitions and threat priority schedule cues without repeated spam',()=>{
 const a=new FlightAudio(),bursts=[],beeps=[];a.burst=(...v)=>bursts.push(v);a.beep=(...v)=>beeps.push(v);
 let p=pilot({gearDown:true});a.updateSystems(p,true,true,0,false);assert.equal(bursts.length,0);
 p={...p,gearDown:false,airbrake:true,afterburnerActive:true};a.updateSystems(p,true,true,1,false);assert.equal(bursts.length,3);
 a.updateSystems(p,true,true,2,false);assert.equal(bursts.length,3);
 p={...p,fuelFraction:.01};const before=beeps.length;a.updateSystems(p,true,true,3,true);assert.equal(beeps.length,before);
 a.updateSystems(p,true,true,4,false);assert.equal(beeps.length,before+2);
 a.updateSystems(p,true,true,5,false);assert.equal(beeps.length,before+2);
 a.updateSystems(p,false,true,6,false);assert.equal(a.previousSystems,null);
});
