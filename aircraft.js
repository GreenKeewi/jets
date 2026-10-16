import * as THREE from './vendor/three.module.js';
import {batchStatic} from './geometry.js?v=gun5-1016';
const paint=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.52,metalness:.34,...extra});
function block(w,h,d,material,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);return m}
function panel(points,material,thickness=.12){
 const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
 const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false}));mesh.material=material;mesh.rotation.x=Math.PI/2;return mesh;
}
function body(sections,material){
 const vertices=[],indices=[],sides=18;
 for(const [z,w,h,offset=0]of sections)for(let n=0;n<sides;n++){const a=n/sides*Math.PI*2;vertices.push(Math.cos(a)*w,Math.sin(a)*h+offset,z)}
 for(let row=0;row<sections.length-1;row++)for(let n=0;n<sides;n++){const a=row*sides+n,b=row*sides+(n+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return new THREE.Mesh(geometry,material);
}
function decalTexture(text,color){const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='bold 53px monospace';ctx.textAlign='center';ctx.fillText(text,128,82);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex}
function axisCylinder(radius,length,mat,x,y,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,16),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);return m}
export function createAircraft(team=0,bomber=false){
 const root=new THREE.Group(),main=paint(team===0?0xaabcc5:0xc8aa8c),upper=paint(team===0?0x708b9b:0x9d7c66),belly=paint(0x344c5b),seam=paint(0x516b79),accent=paint(team===0?0x8bdfd1:0xec9568),black=paint(0x182d39,{roughness:.82}),glass=paint(0x1c5266,{metalness:.68,roughness:.12}),metal=paint(0x63747b,{metalness:.8,roughness:.4});
 const length=bomber?18:15,tail=bomber?-16:-12;
 root.add(body(bomber?[[-18,.45,.6],[-14,1.9,1.8],[-6,2.7,2.4],[4,2.5,2.5],[12,1.6,1.7],[18,.1,.15]]:[[-13,.6,.7],[-10,1.7,1.25],[-4,2.0,1.6],[2,1.8,1.6],[7,1.25,1.15],[12,.5,.55],[16,.02,.02]],main));
 // A dark dorsal spine and inlet shoulders break up the silhouette and the flat paint.
 root.add(body(bomber?[[-14,.8,.8,.8],[-3,1.3,1.0,1.7],[8,.9,.6,1.6],[13,.1,.1,1]]:[[-11,.65,.5,1],[-3,.85,.7,1.2],[5,.6,.4,1.3],[10,.1,.1,.8]],upper));
 const canopy=new THREE.Mesh(new THREE.SphereGeometry(1,24,14),glass);canopy.position.set(0,bomber?2:1.75,bomber?9:6);canopy.scale.set(bomber?1.75:1.05,bomber?1.05:.95,bomber?3.6:3.5);root.add(canopy);
 const canopyFrame=block(.10,.12,bomber?6.5:6.2,metal,0,bomber?3:2.65,bomber?9:6);root.add(canopyFrame);
 const surfaces=[],flames=[],wingtips=[];
 for(const side of[-1,1]){
  const span=bomber?31:13.5;
  root.add(panel(bomber?[[side*1.5,5],[side*31,-8],[side*30,-12],[side*2,-6]]:[[side*1.3,6],[side*13.5,-5.6],[side*12.7,-9.2],[side*2.0,-7]],main,.34));
  const stripe=panel(bomber?[[side*25,-6.9],[side*30.6,-8.6],[side*30,-10],[side*24.6,-8.4]]:[[side*10.5,-3.5],[side*13.3,-5.8],[side*13.0,-7],[side*10.2,-4.9]],accent,.04);stripe.position.y=.04;root.add(stripe);
  // Elevons and flaps are hinged, and follow the actual bank/pitch state.
  const aileronPivot=new THREE.Group();aileronPivot.position.set(side*(bomber?22:9),-.04,bomber?-9.5:-7.4);const aileron=block(bomber?10:5.2,.18,1.4,upper);aileron.position.z=-.65;aileronPivot.add(aileron);root.add(aileronPivot);surfaces.push({node:aileronPivot,side,kind:'aileron'});
  const stabilizer=new THREE.Group();stabilizer.position.set(side*.9,.5,tail+1);stabilizer.add(panel([[0,1],[side*(bomber?10:7),-3],[side*(bomber?10:6.7),-5],[0,-3]],upper,.2));root.add(stabilizer);surfaces.push({node:stabilizer,side,kind:'elevator'});
  if(!bomber){const intake=body([[-7,.75,.8],[-1,1.0,.85],[3,.75,.62],[4,.65,.52]],belly);intake.position.set(side*2.05,-.65,0);root.add(intake);const mouth=block(1.3,1.1,.16,black,side*2.05,-.65,4.1);root.add(mouth);const lip=block(1.5,.1,.2,metal,side*2.05,-.02,4.15);root.add(lip);root.add(block(.24,.15,4.3,seam,side*6.7,.04,-3.5));}
  const nozzleX=side*(bomber?1.35:.92);root.add(axisCylinder(bomber?.95:.69,2.8,metal,nozzleX,-.1,tail-.2));root.add(axisCylinder(bomber?.77:.54,2.9,black,nozzleX,-.1,tail-.4));
  const plume=new THREE.Group();plume.position.set(nozzleX,-.1,tail-1.8);
  for(let ring=0;ring<3;ring++){const flame=new THREE.Mesh(new THREE.ConeGeometry((bomber?.72:.5)*(1-ring*.19),5.8-ring*.8,12),new THREE.MeshBasicMaterial({color:ring===0?0x3d9fff:ring===1?0x8ce7ff:0xe2f7ff,transparent:true,opacity:.45,depthWrite:false}));flame.rotation.x=-Math.PI/2;flame.position.z=-2-ring*.3;plume.add(flame)}root.add(plume);flames.push(plume);
  const light=new THREE.Mesh(new THREE.SphereGeometry(.18,7,5),new THREE.MeshBasicMaterial({color:side===1?0x72e7a4:0xff6f58}));light.position.set(side*span,.1,bomber?-10.8:-7.8);root.add(light);wingtips.push(light.position.clone());
  const pylon=block(.22,.5,3.8,belly,side*(bomber?12:7.2),-.7,bomber?-7:-3.4);root.add(pylon);
  const missile=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,3.6,8),paint(0xe0e7df));missile.rotation.x=Math.PI/2;missile.position.set(pylon.position.x,-1.1,pylon.position.z+.3);root.add(missile);
 }
 // Canted twin fins for the fighter; one broad fin gives the bomber a separate profile.
 for(const side of(bomber?[0]:[-1,1])){const fin=new THREE.Group();fin.position.set(side*(bomber?0:1.35),.85,tail+.4);fin.rotation.z=-side*.19;const mesh=panel([[0,1],[0,7.2],[5,3.8],[6.5,0]],upper,.25);mesh.rotation.set(0,Math.PI/2,0);fin.add(mesh);const cap=block(.3,1.1,2.1,accent,0,5.2,1.6);fin.add(cap);root.add(fin);}
 const gear=new THREE.Group();for(const[x,z]of[[0,bomber?11:8],[-2.2,-4],[2.2,-4]]){gear.add(block(.22,1.7,.22,metal,x,-2.1,z));const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.63,.63,.48,12),black);wheel.rotation.z=Math.PI/2;wheel.position.set(x,-3,z);gear.add(wheel)}root.add(gear);
 const mark=new THREE.Mesh(new THREE.PlaneGeometry(bomber?6:4.5,2.3),new THREE.MeshBasicMaterial({map:decalTexture(bomber?'B—04':'K—07',team===0?'#35515f':'#6d4f40'),transparent:true,depthWrite:false}));mark.rotation.x=-Math.PI/2;mark.rotation.z=-Math.PI/2;mark.position.set(bomber?18:7,.2,bomber?-8:-4.4);root.add(mark);
 const beacon=new THREE.Mesh(new THREE.SphereGeometry(.14,6,5),new THREE.MeshBasicMaterial({color:0xffdba6}));beacon.position.set(0,2.2,-4);root.add(beacon);
 root.userData={flames,gear,surfaces,wingtips,beacon,gearAmount:1,bomber,team};batchStatic(gear);batchStatic(root,new Set([gear,beacon,...flames,...surfaces.map(s=>s.node)]));
 const detailed=new THREE.Group();for(const node of[...root.children])detailed.add(node);root.add(detailed);
 const distant=new THREE.Group();distant.add(body(bomber?[[-18,.5,.6],[-5,2.7,2.4],[11,1.8,1.7],[18,.05,.05]]:[[-13,.7,.8],[-4,1.9,1.6],[7,1.2,1.1],[16,.02,.02]],main));for(const side of[-1,1]){distant.add(panel(bomber?[[side*1.5,5],[side*31,-8],[side*30,-12],[side*2,-6]]:[[side*1.3,6],[side*13.5,-5.6],[side*12.7,-9.2],[side*2,-7]],main,.2));const fin=panel([[0,0],[0,6],[5,2],[6,0]],upper,.2);fin.rotation.set(0,Math.PI/2,0);fin.position.set(side*(bomber?.4:1.35),.8,tail+.3);distant.add(fin)}batchStatic(distant);distant.visible=false;root.add(distant);root.userData.detailed=detailed;root.userData.distant=distant;return root;
}
export function animateAircraft(model,p,time,dt){
 const d=model.userData;const desiredGear=p.grounded||p.pos.y<130?1:0;d.gearAmount+=(desiredGear-d.gearAmount)*Math.min(1,dt*2.5);d.gear.visible=d.gearAmount>.025;d.gear.scale.y=Math.max(.05,d.gearAmount);
 for(const surface of d.surfaces){const target=surface.kind==='aileron'?p.roll*surface.side*.21:-p.pitch*.42;surface.node.rotation.x+=(target-surface.node.rotation.x)*Math.min(1,dt*9)}
 for(let i=0;i<d.flames.length;i++){const plume=d.flames[i],burner=Math.max(0,(p.throttle-.72)/.28);plume.scale.set(1,1,.35+p.throttle*.45+burner*.7+Math.sin(time*37+i)*.06);plume.visible=p.throttle>.13;plume.children.forEach((f,j)=>{f.material.opacity=(.25-j*.03)+burner*.25;f.material.color.setHex(burner>.4?[0x607bff,0xc6bdff,0xffdeb2][j]:[0x3d9fff,0x8ce7ff,0xe2f7ff][j])})}
 d.beacon.visible=Math.sin(time*3.2)>.83;
}
