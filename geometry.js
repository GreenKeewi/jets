import * as THREE from './vendor/three.module.js';
// Bake compatible static pieces together. Moving groups and their descendants stay separate.
export function batchStatic(root,excluded=new Set(),cellSize=0){
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),groups=new Map();
 function walk(node){if(excluded.has(node)||!node.visible||node.isInstancedMesh)return;if(node.isMesh&&!Array.isArray(node.material)){
  const position=node.getWorldPosition(new THREE.Vector3()),cell=cellSize?`${Math.floor(position.x/cellSize)},${Math.floor(position.z/cellSize)}`:'';const m=node.material,key=cell+':' +[m.type,m.color?.getHex(),m.emissive?.getHex(),m.roughness,m.metalness,m.map?.uuid,m.normalMap?.uuid,m.vertexColors,m.side,m.transparent,m.opacity,m.depthWrite,Object.keys(node.geometry.attributes).sort().join(',')].join(':');
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(node);
 }for(const child of node.children)walk(child)}for(const child of root.children)walk(child);
 for(const nodes of groups.values()){if(nodes.length<2)continue;const chunks=nodes.map(node=>{const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();g.applyMatrix4(inverse.clone().multiply(node.matrixWorld));return g});const geometry=new THREE.BufferGeometry();for(const name of Object.keys(chunks[0].attributes)){const array=new Float32Array(chunks.reduce((n,g)=>n+g.attributes[name].array.length,0));let offset=0;for(const g of chunks){array.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length}geometry.setAttribute(name,new THREE.BufferAttribute(array,chunks[0].attributes[name].itemSize))}geometry.computeBoundingSphere();root.add(new THREE.Mesh(geometry,nodes[0].material));nodes.forEach(node=>node.removeFromParent());chunks.forEach(g=>g.dispose())}
}
