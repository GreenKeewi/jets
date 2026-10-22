import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Scenery} from '../scenery.js';
import {AIRFIELDS,fieldCoordinates} from '../missions.js';
import {createGame,placePilotOnRunway} from '../sim.js';

test('every initial squad slot lies inside the actual rendered runway pavement',t=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
 t.after(()=>{if(old===undefined)delete globalThis.document;else globalThis.document=old});
 const scene=new THREE.Scene();Scenery.prototype.buildAirport.call({scene,animated:[]});for(const field of Object.values(AIRFIELDS))if(field.id!=='home')Scenery.prototype.buildRemoteAirport.call({scene},field);scene.updateMatrixWorld(true);
 for(const arenaId of ['coast','valley'])for(const mode of ['dogfight','strike','freeflight'])for(const role of ['attack','defend']){
  const g=createGame({mode,role,arenaId,teamSize:3,players:['one','two','three','four','five','six']});
  for(const p of g.pilots){const field=AIRFIELDS[p.homeBaseId],mesh=scene.getObjectByName(`${field.id}-runway-pavement`);assert(mesh,field.id);const local=mesh.worldToLocal(new THREE.Vector3(p.pos.x,field.elevation+3,p.pos.z));mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox;assert(local.x>bounds.min.x+16&&local.x<bounds.max.x-16);assert(local.z>bounds.min.z+16&&local.z<bounds.max.z-16,`${mode}/${role}/${field.id}/${p.slot} must spawn on visible pavement`);assert.equal(p.grounded,true);assert.equal(p.gearDown,true);assert.equal(p.speed,0);}
 }
});

test('late runway placement preserves resources and clears airborne control state',()=>{
 const g=createGame({mode:'dogfight',teamSize:1}),p=g.pilots[1];Object.assign(p,{grounded:false,pos:{x:0,y:1200,z:0},speed:310,throttle:1,gearDown:false,airbrake:true,maneuverAssist:true,health:61,fuel:.31});const ammo=JSON.stringify(p.ammo);assert(placePilotOnRunway(g,p));assert.equal(p.health,61);assert.equal(p.fuel,.31);assert.equal(JSON.stringify(p.ammo),ammo);assert.equal(p.speed,0);assert.equal(p.gearDown,true);assert.equal(p.airbrake,false);assert.equal(p.maneuverAssist,false);const f=AIRFIELDS[p.homeBaseId],q=fieldCoordinates(f,p.pos);assert(Math.abs(q.along)<f.halfLength&&Math.abs(q.across)<f.width);
});
