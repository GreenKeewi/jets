import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createAircraft,animateAircraft} from '../aircraft.js';
import {aircraftDefinition,defaultLoadout} from '../loadouts.js';
import {Renderer} from '../render.js';

function tailVertices(model,lod){
 model.updateMatrixWorld(true);const points=[];
 model.userData[lod].traverse(node=>{const p=node.geometry?.attributes.position;if(!p||node===model.userData.vapor)return;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld);if(v.y>3.5&&v.z<0)points.push(v)}});return points;
}
test('both levels of detail preserve the three distinct original airframe silhouettes',()=>{
 const models=['f16','fa18e','su37'].map(id=>createAircraft(0,false,id));
 assert.deepEqual(models.map(m=>m.userData.nozzles.length),[1,2,2]);
 assert.deepEqual(models.map(m=>m.userData.surfaces.filter(s=>s.kind==='canard').length),[0,0,2]);
 assert.deepEqual(models.map(m=>m.userData.prototype),[false,false,true]);
 for(const lod of ['detailed','distant']){
  const tails=models.map(m=>tailVertices(m,lod));assert(tails.every(points=>points.length>10));
  assert(tails[0].every(v=>Math.abs(v.x)<.34),'F-16 has one center fin');
  for(const points of tails.slice(1)){assert(points.some(v=>v.x>2.5));assert(points.some(v=>v.x< -2.5))}
  const spans=models.map(m=>new THREE.Box3().setFromObject(m.userData[lod]).getSize(new THREE.Vector3()).x);
  assert(spans[1]>spans[0]+3);assert(spans[2]>spans[1]+2);
 }
 const hornet=models[1].userData.nozzles,flanker=models[2].userData.nozzles;
 assert(flanker[1].position.x-flanker[0].position.x>hornet[1].position.x-hornet[0].position.x+2);
});

test('all selected stores occupy allowed station coordinates and follow remaining ammunition',()=>{
 for(const id of ['f16','fa18e','su37']){
  const model=createAircraft(0,false,id),loadout=defaultLoadout(id);
  for(const s of aircraftDefinition(id).stations)if(s.allowed.includes('tank'))loadout.stations[s.id]='tank';
  const pilot={aircraftId:id,loadout,heat:4,radar:id==='f16'?2:4,throttle:.7};
  animateAircraft(model,pilot,0,1/60);const stores=model.userData.stores;
  const tanks=id==='su37'?0:3;assert.equal(stores.meshes.heat.count,4);assert.equal(stores.meshes.radar.count,pilot.radar);assert.equal(stores.meshes.tank.count,tanks);
  for(const type of ['heat','radar','tank']){
   const visible=stores.records.filter(s=>s.type===type&&s.visible),matrix=new THREE.Matrix4();
   visible.forEach((record,i)=>{stores.meshes[type].getMatrixAt(i,matrix);assert(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(record.position.x,record.position.y,record.position.z))<1e-5)});
  }
  pilot.heat=1;pilot.radar=0;animateAircraft(model,pilot,1,1/60);
  assert.equal(stores.meshes.heat.count,1);assert.equal(stores.meshes.radar.count,0);assert.equal(stores.meshes.radar.visible,false);assert.equal(stores.meshes.tank.count,tanks);assert.equal(stores.pylons.count,tanks+1);
  pilot.loadout.stations['wingtip-l']='radar';pilot.heat=20;pilot.radar=20;animateAircraft(model,pilot,2,1/60);
  assert.equal(stores.records.find(s=>s.id==='wingtip-l').type,'empty');
  assert.equal(stores.meshes.heat.count,3);assert.equal(stores.meshes.radar.count,id==='f16'?2:4);
 }
});

test('Su-37 nozzle motion is bounded and returns to neutral without moving fixed F-16 exhaust',()=>{
 const prototype=createAircraft(0,false,'su37'),f16=createAircraft();
 for(let i=0;i<120;i++){animateAircraft(prototype,{controlInput:{pitch:999}},i/60,1/60);animateAircraft(f16,{controlInput:{pitch:999}},i/60,1/60)}
 assert(prototype.userData.nozzles.every(n=>n.rotation.x<-.17&&n.rotation.x>=-.18));assert.equal(f16.userData.nozzles[0].rotation.x,0);
 for(let i=0;i<180;i++)animateAircraft(prototype,{controlInput:{}},i/60,1/60);
 assert(prototype.userData.nozzles.every(n=>Math.abs(n.rotation.x)<1e-8));
});

test('bomber geometry remains a clean flying wing for every selected fighter id',()=>{
 for(const id of ['f16','fa18e','su37']){
  const model=createAircraft(0,true,id);assert.equal(model.userData.stores,undefined);assert.equal(model.userData.nozzles.length,0);assert.equal(model.userData.prototype,false);
  assert(new THREE.Box3().setFromObject(model.userData.distant).getSize(new THREE.Vector3()).x>=64);
 }
});

test('renderer replaces an existing pilot model when aircraft id changes and updates stores in place',()=>{
 const renderer={jets:new Map(),scene:new THREE.Scene(),view:'chase',shadow:new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial()),updateVortex(){},disposeAircraft:Renderer.prototype.disposeAircraft};
 const p={id:'host',team:0,bomber:false,aircraftId:'f16',pos:{x:0,y:1000,z:0},yaw:0,pitch:0,roll:0,throttle:0,heat:4,radar:2,loadout:defaultLoadout('f16')},game={pilots:[p],time:0};
 Renderer.prototype.updateAircraft.call(renderer,game,p,1/60);const old=renderer.jets.get(p.id);let disposed=0;for(const mesh of [...Object.values(old.userData.stores.meshes),old.userData.stores.pylons])mesh.addEventListener('dispose',()=>disposed++);
 p.aircraftId='fa18e';p.loadout=defaultLoadout('fa18e');Renderer.prototype.updateAircraft.call(renderer,game,p,1/60);
 const current=renderer.jets.get(p.id);assert.notEqual(current,old);assert.equal(old.parent,null);assert.equal(current.userData.aircraftId,'fa18e');assert.equal(disposed,4,'release per-instance GPU buffers on model replacement');
 p.heat=1;Renderer.prototype.updateAircraft.call(renderer,game,p,1/60);assert.equal(renderer.jets.get(p.id),current);assert.equal(current.userData.stores.meshes.heat.count,1);
});
