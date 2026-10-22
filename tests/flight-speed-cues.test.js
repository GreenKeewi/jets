import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {AIRCRAFT_PALETTES,aircraftPower,createAircraft,animateAircraft} from '../aircraft.js';
import {flightFov,FlightAirMotion,AIR_MOTION_BUDGET} from '../render.js';
import {flightSound} from '../audio.js';
import {Scenery} from '../scenery.js';

const pilot=(values={})=>({id:'host',pos:{x:0,y:700,z:0},yaw:0,pitch:0,roll:0,speed:285,throttle:.78,grounded:false,dead:false,...values});
const makeCamera=()=>{const c=new THREE.PerspectiveCamera(70,16/9,.8,45000);c.position.set(0,700,0);c.lookAt(0,700,100);return c};

test('fighter FOV increases modestly through the full speed envelope and respects reduced motion',()=>{
 for(const view of ['chase','cockpit']){
  const base=flightFov(0,view),cruise=flightFov(285,view),maximum=flightFov(686,view);
  assert(cruise>base&&maximum>cruise);assert.equal(maximum-base,9.5);
  assert.equal(flightFov(10000,view),maximum);assert.equal(flightFov(686,view,true),base);
 }
});

test('near-air motion has a fixed GPU budget and stays anchored to physical world positions',()=>{
 const scene=new THREE.Scene(),air=new FlightAirMotion(scene),camera=makeCamera(),p=pilot();
 air.update(p,camera,0);const original=Array.from(air.points),buffer=air.geometry.attributes.position.array;
 assert.equal(scene.children.length,1);assert.equal(air.geometry.drawRange.count,AIR_MOTION_BUDGET*2);
 camera.position.z+=2;camera.lookAt(0,700,102);air.update(p,camera,1/60);
 assert.deepEqual(Array.from(air.points),original,'nearby air does not travel along with the camera');
 assert.equal(air.geometry.attributes.position.array,buffer,'updates reuse the allocated GPU buffer');
 for(let i=0;i<100;i++){camera.position.z+=12;camera.lookAt(0,700,camera.position.z+100);air.update(p,camera,i+1)}
 assert(air.points.every(Number.isFinite));assert.equal(air.points.length,AIR_MOTION_BUDGET*3);
 air.update(p,camera,102,false,.65);assert.equal(air.geometry.drawRange.count,48);
 air.update(p,camera,103,true);assert.equal(air.lines.visible,false);
 air.update(pilot({grounded:true}),camera,104);assert.equal(air.lines.visible,false);
 air.update(pilot({dead:true}),camera,105);assert.equal(air.lines.visible,false);
});

test('motion reseeds safely when aircraft changes or sortie time rewinds',()=>{
 const air=new FlightAirMotion(new THREE.Scene()),camera=makeCamera();air.update(pilot(),camera,10);
 camera.position.set(12000,800,-11000);camera.lookAt(12000,800,-10900);air.update(pilot({id:'wingman'}),camera,11);
 const positions=Array.from(air.points);assert(positions.every(Number.isFinite));assert(positions[0]>11000);
 air.update(pilot({id:'wingman'}),camera,0);assert.notDeepEqual(Array.from(air.points),positions);
});

test('dry cruise, afterburner and narrow transonic vapor match the new speed scale',()=>{
 assert.equal(aircraftPower(pilot()).burner,0);assert.equal(aircraftPower(pilot({throttle:1,afterburnerActive:true})).burner,1);
 assert.equal(aircraftPower(pilot({throttle:1,bomber:true})).burner,0);
 assert(aircraftPower(pilot({speed:343,roll:.6})).vapor>.5);
 assert.equal(aircraftPower(pilot({speed:686})).vapor,0);
 assert.equal(aircraftPower(pilot({speed:343,grounded:true})).vapor,0);
 assert.equal(aircraftPower(pilot({speed:343,dead:true})).vapor,0);
 assert.equal(new Set(AIRCRAFT_PALETTES.map(p=>p.accent)).size,3);
});

test('procedural audio keeps gaining wind intensity through Mach 2 without clipping-scale gain',()=>{
 const slow=flightSound(pilot({speed:110})),cruise=flightSound(pilot()),fast=flightSound(pilot({speed:686,throttle:1,afterburnerActive:true}));
 assert(slow.wind<cruise.wind&&cruise.wind<fast.wind);assert(fast.wind<.5);
 assert(fast.jet>cruise.jet);assert(fast.engine>cruise.engine);
 assert(flightSound(pilot({speed:686}),true).wind<flightSound(pilot({speed:686})).wind);
 assert(flightSound(pilot({speed:100000})).wind<=.5);
});

test('team 2 aircraft animates its reusable vapor and exhaust without geometry allocation',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};
 try{
  const model=createAircraft(2,false),d=model.userData,geometry=d.vapor.geometry;
  animateAircraft(model,pilot({speed:343,throttle:1,roll:.6,afterburnerActive:true}),1,1/60);
  assert.equal(d.team,2);assert(d.vapor.visible);assert(d.flames[0].scale.z>2);
  animateAircraft(model,pilot({speed:686,throttle:.78}),2,1/60);
  assert(!d.vapor.visible);assert(d.flames[0].scale.z<.6);assert.equal(d.vapor.geometry,geometry);
 }finally{globalThis.document=previous}
});

test('whitecaps use bounded instancing, stable grid locations and low-quality culling',()=>{
 const s=Object.create(Scenery.prototype);s.scene=new THREE.Scene();s.setupSurfaceDetail();const camera=makeCamera();camera.position.set(13000,200,-6000);
 s.updateSurfaceDetail(camera,1);assert(s.whitecaps.count>0&&s.whitecaps.count<=625);assert.equal(s.scene.children.length,1);
 const matrices=s.whitecaps.instanceMatrix.array.slice();s.updateSurfaceDetail(camera,1);assert.deepEqual(s.whitecaps.instanceMatrix.array,matrices);
 camera.position.x+=110;s.updateSurfaceDetail(camera,1);assert(s.whitecaps.count<=625);assert(s.whitecaps.instanceMatrix.array.every(Number.isFinite));
 s.updateSurfaceDetail(camera,.65);assert.equal(s.whitecaps.visible,false);
 camera.position.y=2000;s.updateSurfaceDetail(camera,1);assert.equal(s.whitecaps.visible,false);
});
