import test from 'node:test';
import assert from 'node:assert/strict';
import {ISLANDS,SEA_LEVEL,TERRAIN_TILE_SIZE,TERRAIN_LOD_SEGMENTS,terrainHeight,coastPoint} from '../world.js';
import {WORLD_BOUNDS,AIRFIELDS,ROUTES,fieldPoint,destinationFor,approachFor} from '../missions.js';
import {terrainTileCenters,terrainTileGeometry} from '../scenery.js';

test('expanded archipelago has eight distinct islands within a 72 km square',()=>{
 assert.equal(ISLANDS.length,8);assert.equal(new Set(ISLANDS.map(i=>i.id)).size,8);
 assert.equal(WORLD_BOUNDS.maxX-WORLD_BOUNDS.minX,72000);assert.equal(WORLD_BOUNDS.maxZ-WORLD_BOUNDS.minZ,72000);
 for(const island of ISLANDS){assert.ok(terrainHeight(island.x,island.z)>SEA_LEVEL+10,island.id);assert.ok(island.x-island.rx>WORLD_BOUNDS.minX&&island.x+island.rx<WORLD_BOUNDS.maxX);assert.ok(island.z-island.rz>WORLD_BOUNDS.minZ&&island.z+island.rz<WORLD_BOUNDS.maxZ)}
 for(const island of ISLANDS.slice(3)){assert.ok(Math.hypot(island.x,island.z)>22000,island.id);for(let n=0;n<32;n++){const p=coastPoint(n/32*Math.PI*2,0,island.id);assert.ok(Math.abs(terrainHeight(p.x,p.z)-SEA_LEVEL)<.05,`${island.id}: ${n}`)}}
});

test('original airport coordinates and protected runway foundations are preserved',()=>{
 assert.deepEqual(Object.values(AIRFIELDS).map(f=>[f.id,f.x,f.z,f.elevation,f.heading]),[['home',-1800,-2000,0,0],['northpoint',4200,10300,72,0],['westhaven',-9900,4200,8,Math.PI/2]]);
 for(const field of Object.values(AIRFIELDS))for(let along=-field.halfLength;along<=field.halfLength;along+=100)for(const across of[-field.width,0,field.width]){const p=fieldPoint(field,across,along);assert.equal(terrainHeight(p.x,p.z),field.elevation+2,`${field.id}: ${across},${along}`)}
});

test('scenic routes retain remote gates but always return to the home airport',()=>{
 for(const route of Object.values(ROUTES)){assert.equal(destinationFor(route.id).id,'home');assert.match(route.description,/return/i);const last=route.gates.at(-1);assert.ok(Math.hypot(last.x-AIRFIELDS.home.x,last.z-AIRFIELDS.home.z)<3200);const firstApproach=approachFor(route.id)[0];assert.ok(Math.hypot(last.x-firstApproach.x,last.z-firstApproach.z)<2000)}
 assert.ok(ROUTES.northpoint.gates.some(g=>g.z>12000));assert.ok(ROUTES.westhaven.gates.some(g=>g.x<-12000));
});

test('terrain tiles cover all distant islands and keep the ocean mesh budget bounded',()=>{
 const tiles=terrainTileCenters();assert.ok(tiles.length>=25&&tiles.length<=55,`${tiles.length} land tiles`);
 for(const island of ISLANDS)assert.ok(tiles.some(tile=>Math.abs(tile.x-island.x)<=TERRAIN_TILE_SIZE/2&&Math.abs(tile.z-island.z)<=TERRAIN_TILE_SIZE/2),island.id);
 assert.ok(tiles.every(tile=>tile.x>=WORLD_BOUNDS.minX&&tile.x<=WORLD_BOUNDS.maxX&&tile.z>=WORLD_BOUNDS.minZ&&tile.z<=WORLD_BOUNDS.maxZ));
});

const boundary=(geometry,axis,value)=>{const p=geometry.attributes.position,result=new Map();for(let i=0;i<p.count;i++)if(Math.abs(p[axis==='x'?'getX':'getZ'](i)-value)<.001){const other=p[axis==='x'?'getZ':'getX'](i);result.set(other,p.getY(i))}return [...result.entries()].sort((a,b)=>a[0]-b[0])};
test('all terrain LOD vertices agree with collision heights and normals face upward',()=>{
 for(const segments of TERRAIN_LOD_SEGMENTS){const g=terrainTileGeometry(21000,3000,segments),p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getY(i)-terrainHeight(21000+p.getX(i),3000+p.getZ(i)))<.001);assert.ok(n.getY(i)>0)}assert.ok(g.index.count/3<13000);g.dispose()}
});

test('neighboring terrain tiles share full-resolution edges at every LOD',()=>{
 const fine=terrainTileGeometry(21000,3000,TERRAIN_LOD_SEGMENTS[0]),edge=boundary(fine,'x',3000);assert.equal(edge.length,81);
 for(const segments of TERRAIN_LOD_SEGMENTS){const other=terrainTileGeometry(27000,3000,segments);assert.deepEqual(boundary(other,'x',-3000),edge);other.dispose()}
 const far=terrainTileGeometry(21000,9000,TERRAIN_LOD_SEGMENTS[2]);assert.deepEqual(boundary(far,'z',-3000),boundary(fine,'z',3000));assert.ok(far.index.count<fine.index.count/10);fine.dispose();far.dispose();
});

test('airport upgrade geometry is finite and keeps tall new buildings outside runway strips',async t=>{
 const {Scenery}=await import('../scenery.js'),THREE=await import('../vendor/three.module.js');
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
 t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous});
 for(const field of Object.values(AIRFIELDS)){
  const scene=new THREE.Scene();Scenery.prototype.buildAirfieldDetails.call({scene},field);scene.updateMatrixWorld(true);
  const group=scene.children[0];assert.equal(group.name,`${field.id}-airfield-details`);assert.ok(group.children.length>50);
  let approachLights=0;group.traverse(node=>{if(!node.isMesh)return;const p=node.geometry.attributes.position;assert.ok(p);for(const v of p.array)assert.ok(Number.isFinite(v));if(node.isInstancedMesh){approachLights+=node.count;return}const bounds=new THREE.Box3().setFromObject(node);if(bounds.max.y>field.elevation+35){const center=bounds.getCenter(new THREE.Vector3()),dx=center.x-field.x,dz=center.z-field.z,across=dx*Math.cos(field.heading)-dz*Math.sin(field.heading);assert.ok(across>field.width+170,`${field.id}: tall obstacle inside runway protected strip`)}});
  assert.ok(approachLights>=80);
 }
});
