import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {menuCameraPose,Renderer} from '../render.js';
test('actual menu aircraft is framed right of the menu with stable reduced motion',()=>{
 for(const bomber of [false,true]){
  const p={pos:{x:-1800,y:3,z:-1850},yaw:0,bomber},pose=menuCameraPose(p,0,true);
  assert.deepEqual(menuCameraPose(p,100,true),pose);
  const camera=new THREE.PerspectiveCamera(pose.fov,16/9,.8,45000);camera.position.set(...Object.values(pose.position));camera.lookAt(...Object.values(pose.target));camera.updateMatrixWorld();
  const projected=new THREE.Vector3(p.pos.x,p.pos.y,p.pos.z).project(camera);
  assert(projected.x>.2&&projected.x<.65,`aircraft should stay in clear right half: ${projected.x}`);assert(Math.abs(projected.y)<.5);assert(projected.z<1);
  for(const time of [10,50,100]){const next=menuCameraPose(p,time,false);assert(next.position.y>p.pos.y+20);assert.equal(next.fov,46);}
 }
});

test('menu preview remains visible after returning from cockpit and swaps airframes',()=>{
 const r={jets:new Map(),scene:new THREE.Scene(),view:'cockpit',menuPreview:true,shadow:new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial()),updateVortex(){},disposeAircraft:Renderer.prototype.disposeAircraft};
 const p={id:'host',team:0,bomber:false,pos:{x:-1800,y:3,z:-1850},yaw:0,pitch:0,roll:0,speed:0,grounded:true,gearDown:true,throttle:0};
 const g={pilots:[p],time:0};Renderer.prototype.updateAircraft.call(r,g,p,1/60);assert.equal(r.jets.get('host').visible,true);r.jets.get('host').updateMatrixWorld(true);const wheels=new THREE.Box3().setFromObject(r.jets.get('host').userData.gear);assert(Math.abs(wheels.min.y-3.5)<.03,`parked wheels should contact pavement, match the elevated runway top at3.5m: ${wheels.min.y}`);
 p.bomber=true;Renderer.prototype.updateAircraft.call(r,g,p,1/60);assert.equal(r.jets.get('host').userData.bomber,true);
 r.menuPreview=false;Renderer.prototype.updateAircraft.call(r,g,p,1/60);assert.equal(r.jets.get('host').visible,false);
});
