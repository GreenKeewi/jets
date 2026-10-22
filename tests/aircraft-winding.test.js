import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createAircraft} from '../aircraft.js';

for (const bomber of [false,true]) {
 for (const lod of ['detailed','distant']) {
  test(`${bomber?'bomber':'fighter'} ${lod} fuselage faces and normals point outward`,()=>{
   const model=createAircraft(0,bomber);
   const radius=bomber?1.8:.78, rear=bomber?-9:-13;
   let hull;
   model.userData[lod].traverse(node=>{
    const p=node.geometry?.attributes.position;
    if(p&&Math.abs(p.getX(0)-radius)<1e-6&&Math.abs(p.getY(0))<1e-6&&p.getZ(0)===rear)hull=node.geometry;
   });
   assert.ok(hull,'locate actual batched fuselage by first section vertex');
   const p=hull.attributes.position,n=hull.attributes.normal,index=hull.index;
   // batchStatic retains the body as the first chunk, followed by the wings.
   const triangleCount=(bomber?4:6)*18*2;
   for(let t=0;t<triangleCount;t++){
    const ids=[0,1,2].map(i=>index?index.getX(t*3+i):t*3+i);
    const [a,b,c]=ids.map(i=>new THREE.Vector3().fromBufferAttribute(p,i));
    const center=a.clone().add(b).add(c).multiplyScalar(1/3);
    const radial=new THREE.Vector3(center.x,center.y,0);
    const face=b.clone().sub(a).cross(c.clone().sub(a));
    assert.ok(face.dot(radial)>0,`triangle ${t} must face away from the fuselage axis`);
    for(const id of ids){
     const vertex=new THREE.Vector3().fromBufferAttribute(p,id);
     const normal=new THREE.Vector3().fromBufferAttribute(n,id);
     assert.ok(normal.dot(new THREE.Vector3(vertex.x,vertex.y,0))>0,`vertex ${id} normal must face outward`);
    }
   }
  });
 }
}

test('main gear struts reach wing height while wheels retain their original ground contact',()=>{
 for(const bomber of [false,true]){
  const gear=createAircraft(0,bomber).userData.gear;let joined=false;
  gear.traverse(node=>{const p=node.geometry?.attributes.position;if(!p)return;for(let i=0;i<p.count;i++){const x=Math.abs(p.getX(i)),y=p.getY(i);if(Math.abs(x-(bomber?4.4:1.9))<.11&&Math.abs(y)<.02)joined=true;}});
  assert(joined,'strut top reaches wing attachment surface');
  const bounds=new THREE.Box3().setFromObject(gear);assert(bounds.min.y>-3.61&&bounds.min.y<-3.55);
 }
});
