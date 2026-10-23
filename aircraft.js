import * as THREE from './vendor/three.module.js';
import {batchStatic} from './geometry.js?v=skybreak9-1023';
// Original stylised airframes. Layout cues only, not manufacturer geometry.
export const AIRCRAFT_PALETTES=Object.freeze([
 {main:0xaabcc5,upper:0x708b9b,accent:0x8bdfd1,mark:'#35515f'},
 {main:0xc8aa8c,upper:0x9d7c66,accent:0xec9568,mark:'#6d4f40'},
 {main:0xb6afd0,upper:0x787494,accent:0xc7a3ff,mark:'#49415f'},
]);
const bounded=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:0));
export function aircraftPower(p){
 const throttle=bounded(p.throttle),mach=bounded(Number.isFinite(p.mach)?p.mach:(p.speed||0)/343,0,3),burner=!p.bomber&&p.afterburnerActive?1:0;
 return{throttle,mach,burner,vapor:p.grounded||p.dead?0:bounded(1-Math.abs(mach-1.01)/.14)*(.3+bounded(Math.abs(p.roll||0)+Math.abs(p.pitch||0))*.7)};
}
const paint=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.52,metalness:.34,...extra});
function block(w,h,d,material,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);return m}
function panel(points,material,thickness=.12){const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false}),material);mesh.rotation.x=Math.PI/2;return mesh}
function body(sections,material){
 const vertices=[],indices=[],sides=18;
 for(const [z,w,h,offset=0]of sections)for(let n=0;n<sides;n++){const a=n/sides*Math.PI*2;vertices.push(Math.cos(a)*w,Math.sin(a)*h+offset,z)}
 for(let row=0;row<sections.length-1;row++)for(let n=0;n<sides;n++){const a=row*sides+n,b=row*sides+(n+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return new THREE.Mesh(geometry,material);
}
function axisCylinder(radius,length,mat,x,y,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,20),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);return m}
const fighterHull=[[-13,.78,.79],[-9,1.4,1.15],[-2,1.65,1.35],[4,1.3,1.2],[9,.95,.88],[13,.44,.48],[16,.015,.015]];
const bomberHull=[[-9,1.8,.25],[-5,3.6,1.0],[2,3.5,1.65],[8,1.7,1.0],[13,.015,.015]];
function wingOutline(side,bomber){return bomber?[[0,12.8],[side*32,-7.8],[side*27,-10.3],[side*21,-7.7],[side*15,-10.2],[side*9,-7.1],[side*4,-9.4],[0,-7.4]]:[[side*1.25,3.4],[side*10.4,-3.8],[side*10.1,-6.8],[side*1.55,-6.2]]}
function singleFin(mat){const fin=panel([[-11,0],[-10,6.3],[-6.8,6.0],[-3,0]],mat,.22);fin.rotation.set(0,-Math.PI/2,0);fin.position.set(-.11,.9,0);return fin}
export function createAircraft(team=0,bomber=false){
 const palette=AIRCRAFT_PALETTES[team]||AIRCRAFT_PALETTES[0],root=new THREE.Group(),main=paint(bomber?0x46535b:palette.main),upper=paint(bomber?0x29343c:palette.upper),belly=paint(0x34434d),accent=paint(palette.accent),black=paint(0x101b23,{roughness:.82}),glass=paint(0x26586c,{metalness:.7,roughness:.12}),metal=paint(0x7c888d,{metalness:.8,roughness:.4});
 const surfaces=[],flames=[],wingtips=[],airbrakes=[];
 root.add(body(bomber?bomberHull:fighterHull,main));
 if(bomber){
  // Shallow blended centre section and flush forward glazing, no tail or stores.
  root.add(body([[-6,2,.3,.55],[0,2.3,.55,1.1],[6,1.6,.4,1.1],[9,.1,.1,.65]],upper));
  for(const side of[-1,1]){const windshield=panel([[side*.12,9],[side*1.4,7],[side*1.8,5.9],[side*.12,6.1]],glass,.04);windshield.position.y=1.65;root.add(windshield);root.add(block(1.9,.12,3,black,side*3.2,1.05,0));root.add(block(2.5,.13,.8,metal,side*3.5,.65,-6.3));}
 }else{
  root.add(body([[-10,.5,.45,1],[-2,.65,.6,1.2],[5,.45,.3,1.2]],upper));
  const canopy=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),glass);canopy.position.set(0,1.7,5.1);canopy.scale.set(1.0,1.2,3.35);root.add(canopy);
  // Bubble canopy: unobstructed forward glass, aft bow only.
  root.add(block(1.85,.12,.22,metal,0,1.84,2.15));
  const intake=body([[-8,.75,.55,-.8],[-2,1.1,.72,-1.15],[4,1.02,.67,-1.02]],belly);root.add(intake);
  const lip=axisCylinder(1.06,.23,metal,0,-1.04,4.05);lip.scale.z=.68;root.add(lip);
  const mouth=axisCylinder(.90,.25,black,0,-1.04,4.19);mouth.scale.z=.65;root.add(mouth);
  root.add(singleFin(upper));
  // One engine exhaust, with a dark nozzle interior and concentric rim.
  root.add(axisCylinder(.84,1.7,metal,0,0,-12.8));root.add(axisCylinder(.69,1.76,black,0,0,-12.85));
  const plume=new THREE.Group();plume.position.set(0,0,-13.8);
  for(let ring=0;ring<3;ring++){const flame=new THREE.Mesh(new THREE.ConeGeometry(.67*(1-ring*.20),5.8-ring*.8,14),new THREE.MeshBasicMaterial({color:0x8ce7ff,transparent:true,opacity:.45,depthWrite:false}));flame.rotation.x=-Math.PI/2;flame.position.z=-2.6-ring*.3;plume.add(flame)}root.add(plume);flames.push(plume);
 }
 for(const side of[-1,1]){
  root.add(panel(wingOutline(side,bomber),main,bomber?.36:.19));
  if(!bomber){
   root.add(panel([[side*.9,7.1],[side*2.6,1.2],[side*1.4,-2.2]],upper,.12));
   const stabilizer=new THREE.Group();stabilizer.position.set(side*.8,.2,-10.3);stabilizer.add(panel([[0,2],[side*5.8,-.8],[side*5.4,-3],[0,-2]],upper,.15));root.add(stabilizer);surfaces.push({node:stabilizer,side,kind:'elevator'});
   // Ventrals below the aft fuselage are not additional vertical tails.
   const ventral=block(.12,1.2,2.9,upper,side*.92,-1.0,-10);ventral.rotation.z=side*.3;root.add(ventral);
   root.add(block(.18,.17,3.4,metal,side*10.35,-.05,-5));
   const stripe=panel([[side*7.8,-2.5],[side*10.2,-4.2],[side*10.1,-5.1],[side*7.8,-3.6]],accent,.03);stripe.position.y=.04;root.add(stripe);
  }
  const aileronPivot=new THREE.Group();aileronPivot.position.set(side*(bomber?20:7.8),0,bomber?-7.3:-5.8);aileronPivot.add(block(bomber?8:3.5,.14,bomber?1.9:1.1,upper,0,0,bomber?-.85:-.45));root.add(aileronPivot);surfaces.push({node:aileronPivot,side,kind:'aileron'});
  // Fighter split aft speed brakes; flying wing split drag rudders at the tips.
  for(const vertical of[-1,1]){const hinge=new THREE.Group();hinge.position.set(side*(bomber?27:1.55),bomber?0:.05,bomber?-8.4:-10.4);const brake=block(bomber?5.2:1.6,.10,bomber?2:2.6,upper,side*(bomber?0:.55),0,bomber?-.9:-1.15);hinge.add(brake);root.add(hinge);airbrakes.push({node:hinge,vertical})}
  const light=new THREE.Mesh(new THREE.SphereGeometry(.14,7,5),new THREE.MeshBasicMaterial({color:side===1?0x72e7a4:0xff6f58}));light.position.set(side*(bomber?31.7:10.4),.1,bomber?-7.8:-5.3);root.add(light);wingtips.push(light.position.clone());
 }
 const gear=new THREE.Group();for(const[x,z]of[[0,bomber?6:4.8],[-(bomber?4.4:1.9),-3.8],[(bomber?4.4:1.9),-3.8]]){gear.add(block(.19,2.9,.19,metal,x,-1.45,z));gear.add(block(.65,.09,1.5,upper,x,-1.25,z));for(const offset of(bomber&&x!==0?[-.4,.4]:[0])){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.59,.59,.42,14),black);wheel.rotation.z=Math.PI/2;wheel.position.set(x+offset,-3,z);gear.add(wheel)}}root.add(gear);
 const beacon=new THREE.Mesh(new THREE.SphereGeometry(.13,6,5),new THREE.MeshBasicMaterial({color:0xffdba6}));beacon.position.set(0,bomber?1.8:1.95,-4);root.add(beacon);
 const vapor=new THREE.Mesh(new THREE.ConeGeometry(bomber?24:10,11,24,1,true),new THREE.MeshBasicMaterial({color:0xe8f5f5,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));vapor.rotation.x=Math.PI/2;vapor.position.z=-3;vapor.visible=false;root.add(vapor);
 root.userData={flames,gear,surfaces,wingtips,airbrakes,beacon,vapor,gearAmount:1,brakeAmount:0,bomber,team};batchStatic(gear);batchStatic(root,new Set([gear,beacon,vapor,...flames,...surfaces.map(s=>s.node),...airbrakes.map(s=>s.node)]));
 const detailed=new THREE.Group();for(const node of[...root.children])detailed.add(node);root.add(detailed);
 const distant=new THREE.Group();distant.add(body(bomber?bomberHull:fighterHull,main));for(const side of[-1,1]){distant.add(panel(wingOutline(side,bomber),main,.2));if(!bomber){const tail=panel([[side*.8,-8.3],[side*6.6,-11.1],[side*6.2,-13.3],[side*.8,-12.3]],upper,.15);distant.add(tail)}}if(!bomber)distant.add(singleFin(upper));batchStatic(distant);distant.visible=false;root.add(distant);root.userData.detailed=detailed;root.userData.distant=distant;return root;
}
export function animateAircraft(model,p,time,dt){
 const d=model.userData,power=aircraftPower(p),desiredGear=p.gearDown===undefined?(p.grounded?1:0):(p.gearDown?1:0);d.gearAmount+=(desiredGear-d.gearAmount)*Math.min(1,dt*2.5);d.gear.visible=d.gearAmount>.025;d.gear.scale.y=Math.max(.05,d.gearAmount);
 d.brakeAmount+=((p.airbrake?1:0)-d.brakeAmount)*Math.min(1,dt*5);for(const brake of d.airbrakes)brake.node.rotation.x=brake.vertical*d.brakeAmount*(d.bomber?.65:.82);
 for(const surface of d.surfaces){const target=surface.kind==='aileron'?(p.roll||0)*surface.side*.21-(d.bomber?(p.pitch||0)*.18:0):-(p.pitch||0)*.42;surface.node.rotation.x+=(target-surface.node.rotation.x)*Math.min(1,dt*9)}
 for(const plume of d.flames){const{burner,throttle}=power;plume.scale.set(1+burner*.17,1+burner*.17,.15+throttle*.24+burner*1.7+Math.sin(time*37)*.025);plume.visible=!p.dead&&throttle>.13;plume.children.forEach((f,j)=>{f.material.opacity=(.09-j*.02)+burner*.44;f.material.color.setHex(burner?[0x626aff,0xb9bcff,0xffe0bb][j]:[0x3d9fff,0x8ce7ff,0xe2f7ff][j])})}
 d.vapor.visible=power.vapor>.035;d.vapor.material.opacity=power.vapor*.14;d.vapor.scale.setScalar(.93+power.vapor*.13);d.beacon.visible=Math.sin(time*3.2)>.83;
}
