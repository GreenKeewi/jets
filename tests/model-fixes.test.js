import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createAircraft,animateAircraft} from '../aircraft.js';
import {aircraftDefinition,defaultLoadout} from '../loadouts.js';

const visibleBounds=model=>{const box=new THREE.Box3();model.updateMatrixWorld(true);function visit(node){if(!node.visible)return;if(node.isMesh){node.geometry.computeBoundingBox();box.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld))}for(const child of node.children)visit(child)}visit(model);return box;};
const pilot=(id,extra={})=>({aircraftId:id,throttle:0,speed:250,grounded:false,gearDown:false,loadout:{stations:{}},heat:0,radar:0,...extra});

test('Su-37 has Flanker proportions, forward low canopy, spaced nacelles and foreplanes in both LODs',()=>{
 const model=createAircraft(0,false,'su37');animateAircraft(model,pilot('su37'),0,1);
 for(const lod of ['detailed','distant']){
  model.userData.detailed.visible=lod==='detailed';model.userData.distant.visible=lod==='distant';const size=visibleBounds(model).getSize(new THREE.Vector3());
  assert(size.z/size.x>1.45&&size.z/size.x<1.62,`${lod} length/span should read as a long Flanker, got ${size.z/size.x}`);
 }
 const nozzles=model.userData.nozzles;assert(nozzles[1].position.x-nozzles[0].position.x>6);
 const canards=model.userData.surfaces.filter(s=>s.kind==='canard');assert.equal(canards.length,2);assert(canards.every(s=>s.node.position.z>6));
 let canopy;model.userData.detailed.traverse(n=>{if(n.material?.color?.getHex()===0x26586c)canopy=n});assert(canopy);assert(canopy.position.z>10.5);assert(canopy.scale.y<1);
 assert(model.userData.nozzles.every(n=>n.position.z< -18));assert.equal(model.userData.stores.stations.some(s=>s.allowed.includes('tank')),false);
});

test('all eight tank combinations keep baked ellipsoids at real station instances in menu and both LODs',()=>{
 for(const id of ['f16','fa18e'])for(let mask=0;mask<8;mask++){
  const model=createAircraft(mask%3,false,id),tankStations=aircraftDefinition(id).stations.filter(s=>s.allowed.includes('tank')),loadout=defaultLoadout(id);
  tankStations.forEach((s,i)=>loadout.stations[s.id]=mask&(1<<i)?'tank':'empty');
  const p=pilot(id,{loadout,heat:4,radar:id==='f16'?2:4,grounded:true,gearDown:true});animateAircraft(model,p,0,1/60);
  const mesh=model.userData.stores.meshes.tank,geometry=mesh.geometry;geometry.computeBoundingBox();const size=geometry.boundingBox.getSize(new THREE.Vector3());
  assert(size.z>6.7);assert(size.z/size.x>4.5);assert(size.z/size.y>4.5);assert(Math.abs(size.x-size.y)<.05);assert.equal(mesh.count,tankStations.filter((_,i)=>mask&(1<<i)).length);
  const matrix=new THREE.Matrix4();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);const instanceSize=geometry.boundingBox.clone().applyMatrix4(matrix).getSize(new THREE.Vector3());assert(instanceSize.z/instanceSize.x>4.5);assert(instanceSize.z/instanceSize.y>4.5)}
  for(const lod of ['detailed','distant']){model.userData.detailed.visible=lod==='detailed';model.userData.distant.visible=lod==='distant';assert.equal(mesh.geometry,geometry);assert.equal(mesh.parent.visible,true);assert.equal(mesh.visible,mask!==0)}
 }
});

test('Su-37 dorsal airbrake rises above the spine and follows canonical staged deployment exactly',()=>{
 const model=createAircraft(0,false,'su37'),brakes=model.userData.airbrakes;assert.equal(brakes.length,1);assert.equal(brakes[0].kind,'dorsal');const board=brakes[0];
 for(const amount of [0,.25,.5,1]){animateAircraft(model,pilot('su37',{airbrake:false,airbrakeDeployment:amount}),0,1/144);assert.equal(model.userData.brakeAmount,amount);assert(Math.abs(board.node.rotation.x-board.rest-board.angle*amount)<1e-10)}
 model.updateMatrixWorld(true);const rear=new THREE.Vector3(0,0,-6).applyMatrix4(board.node.matrixWorld);assert(rear.y>6.5,'trailing edge must lift clear of the fuselage');
 model.userData.detailed.visible=false;model.userData.distant.visible=true;assert.equal(board.node.parent,model.userData.sharedControls);assert.equal(board.node.parent.visible,true);
 animateAircraft(model,pilot('su37',{airbrake:true,airbrakeDeployment:0}),0,1/60);assert.equal(board.node.rotation.x,board.rest);
});

test('Super Hornet brakes use exposed LEX spoilers, opposite rudder deflections and coordinated wing surfaces',()=>{
 const model=createAircraft(0,false,'fa18e'),brakes=model.userData.airbrakes;
 assert.deepEqual(brakes.map(b=>b.kind).sort(),['lex-spoiler','lex-spoiler','rudder','rudder','trailing-flap','trailing-flap']);
 const rudders=brakes.filter(b=>b.kind==='rudder');animateAircraft(model,pilot('fa18e',{airbrakeDeployment:0}),0,1);model.updateMatrixWorld(true);const stowed=rudders.map(b=>new THREE.Vector3(0,2,-2).applyMatrix4(b.node.matrixWorld));
 for(let i=0;i<60;i++)animateAircraft(model,pilot('fa18e',{airbrakeDeployment:1}),i/60,1/60);model.updateMatrixWorld(true);
 rudders.forEach((b,i)=>{const deployed=new THREE.Vector3(0,2,-2).applyMatrix4(b.node.matrixWorld);assert((deployed.x-stowed[i].x)*b.side>.5,'trailing edges move outward in the represented braking configuration')});
 for(const b of brakes.filter(b=>b.kind==='lex-spoiler')){assert(new THREE.Vector3(0,0,-2.25).applyMatrix4(b.node.matrixWorld).y>1.9);assert(b.node.rotation.x>1)}
 assert(model.userData.surfaces.filter(s=>s.kind==='aileron').every(s=>s.node.rotation.x>.45));assert(brakes.filter(b=>b.kind==='trailing-flap').every(b=>b.node.rotation.x<-.37));
 animateAircraft(model,pilot('fa18e',{airbrake:true,airbrakeDeployment:0}),0,1);assert(brakes.every(b=>b.node.rotation[b.axis]===b.rest));
});

test('variant braking remains bounded without growing the scene and legacy F-16/bomber boards remain intact',()=>{
 for(const id of ['fa18e','su37']){
  const model=createAircraft(0,false,id),before=[];model.traverse(n=>before.push(n.uuid));
  for(const amount of [999,-999,0,.5,1,0])animateAircraft(model,pilot(id,{airbrakeDeployment:amount}),0,1/60);
  const after=[];model.traverse(n=>after.push(n.uuid));assert.deepEqual(after,before);assert.equal(model.userData.brakeAmount,0);
  animateAircraft(model,pilot(id,{airbrake:true}),0,.1);assert(model.userData.brakeAmount>.4&&model.userData.brakeAmount<.6,'legacy visual fixtures retain a gradual fallback');
 }
 for(const bomber of [false,true]){const model=createAircraft(0,bomber,'f16');assert.equal(model.userData.airbrakes.length,4);assert(model.userData.airbrakes.every(b=>b.kind===(bomber?'drag-rudder':'split-aft')));animateAircraft(model,{bomber,airbrake:true,throttle:0},0,1);assert(model.userData.airbrakes.every(b=>Math.abs(b.node.rotation.x-(bomber?.65:.82)*b.vertical)<1e-10))}
});
