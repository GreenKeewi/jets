import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createAircraft,animateAircraft} from '../aircraft.js';
import {stationLayout} from '../loadout-editor.js';
import {AIRCRAFT_DEFINITIONS} from '../loadouts.js';

test('Tomcat rudders are mounted on the aft nacelle fins and move with yaw input',()=>{
 const model=createAircraft(0,false,'f14'),rudders=model.userData.surfaces.filter(s=>s.kind==='rudder');assert.equal(rudders.length,2);model.updateMatrixWorld(true);
 for(const rudder of rudders){const position=rudder.node.getWorldPosition(new THREE.Vector3());assert(position.z>-15&&position.z< -12);assert(Math.abs(Math.abs(position.x)-2.7)<.1);assert(rudder.node.parent!==model.userData.detailed);}
 animateAircraft(model,{aircraftId:'f14',controlInput:{yaw:.8}},0,.1);assert(rudders.every(r=>r.node.rotation.y>.2));
});
test('Tomcat sweep keeps connected wings and reaches the reference span ratio in both detail modes',()=>{
 const model=createAircraft(0,false,'f14'),span=()=>{model.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const wing of model.userData.swingWings)bounds.union(new THREE.Box3().setFromObject(wing.node.getObjectByName('tomcat-wing-skin'),true));return bounds.getSize(new THREE.Vector3()).x;};animateAircraft(model,{wingSweep:0},0,.1);const extended=span();animateAircraft(model,{wingSweep:1},0,.1);const swept=span();assert(extended>38);assert(swept/extended>.56&&swept/extended<.64);for(const wing of model.userData.swingWings)assert(Math.abs(wing.node.position.x)===6);model.userData.detailed.visible=false;model.userData.distant.visible=true;assert(model.userData.swingWings.every(w=>w.node.parent.visible));
});
test('Tomcat uses paired roll spoilers on the wing surfaces rather than floating generic ailerons',()=>{
 const model=createAircraft(0,false,'f14'),spoilers=model.userData.surfaces.filter(s=>s.kind==='roll-spoiler');assert.equal(spoilers.length,2);assert(!model.userData.surfaces.some(s=>s.kind==='aileron'));animateAircraft(model,{controlInput:{roll:1},wingSweep:.5},0,1/9);assert(spoilers.some(s=>s.node.rotation.x>.6));assert(spoilers.some(s=>s.node.rotation.x===0));assert(spoilers.every(s=>model.userData.swingWings.some(w=>s.node.parent===w.node)));
});
test('visual station labels stay unique and preserve every canonical hardpoint on each aircraft',()=>{
 for(const id of Object.keys(AIRCRAFT_DEFINITIONS)){const stations=stationLayout(id);assert.equal(stations.length,AIRCRAFT_DEFINITIONS[id].stations.length);assert.equal(new Set(stations.map(s=>s.id)).size,stations.length);assert.deepEqual(stations.map(s=>s.number),Array.from({length:stations.length},(_,i)=>i+1));}
});
