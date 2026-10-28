import * as THREE from './vendor/three.module.js';
import {batchStatic} from './geometry.js?v=skybreak110-1028';
import {aircraftDefinition,normalizeLoadout} from './loadouts.js?v=skybreak110-1028';
// Simplified original visual models. Layout cues only, not manufacturer geometry.
// USAF: 183wg.ang.af.mil/RESOURCES/Fact-Sheets/Article/459577/f-16-fighting-falcon/
// NAVAIR: navair.navy.mil/product/FA-18EF-Super-Hornet
// MAKS retrospective: t.me/s/aviasalonmaks/3010 (2 April, Su-37 first flight).
// Su-37 is the canard-equipped prototype, not the unrelated S-37/Su-47.
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
const profiles={
 f16:{hull:fighterHull,span:10.4,wing:[[1.25,3.4],[10.4,-3.8],[10.1,-6.8],[1.55,-6.2]],lerx:[[.9,7.1],[2.6,1.2],[1.4,-2.2]],engineX:[0],engineY:0,engineZ:-12.8,tailX:.8,tailZ:-10.3,tailSpan:5.8},
 fa18e:{hull:[[-14.5,1.4,1],[-10,2.2,1.25],[-3,2.35,1.4],[5,1.7,1.35],[11,1,.85],[15.5,.5,.45],[18.2,.015,.015]],span:12.5,wing:[[1.7,4.2],[12.5,-1.6],[12.5,-5.3],[4.4,-6.9],[1.6,-5.1]],lerx:[[1.3,10.5],[4.8,1.5],[3.4,-2.6],[1.3,-1]],engineX:[-1.15,1.15],engineY:-.15,engineZ:-14.4,tailX:1.6,tailZ:-11.2,tailSpan:6.2},
 su37:{hull:[[-17.3,1.8,.8],[-12,2.6,1.1],[-5,2.75,1.5],[3,2.1,1.55],[10,1.32,1.05],[15.5,.72,.65],[20,.015,.015]],span:14.3,wing:[[2.1,6],[14.3,-4.8],[14.0,-8.1],[4.3,-7.5],[2.0,-5.8]],lerx:[[1.25,12],[5.5,.5],[3.5,-4],[1.3,-1]],engineX:[-2.5,2.5],engineY:-.5,engineZ:-17.2,tailX:2.0,tailZ:-13.4,tailSpan:7.7},
};
const mirrored=(points,side)=>points.map(([x,z])=>[side*x,z]);
function wingOutline(side,bomber,id='f16'){return bomber?[[0,12.8],[side*32,-7.8],[side*27,-10.3],[side*21,-7.7],[side*15,-10.2],[side*9,-7.1],[side*4,-9.4],[0,-7.4]]:mirrored(profiles[id].wing,side)}
function singleFin(mat){const fin=panel([[-11,0],[-10,6.3],[-6.8,6.0],[-3,0]],mat,.22);fin.rotation.set(0,-Math.PI/2,0);fin.position.set(-.11,.9,0);return fin}
function addFins(root,id,mat){
 if(id==='f16'){root.add(singleFin(mat));return}
 for(const side of [-1,1]){const pivot=new THREE.Group(),fin=panel(id==='fa18e'?[[-12.8,0],[-12.1,5.4],[-8.4,5.9],[-4.6,0]]:[[-16,0],[-15.2,6.5],[-11.2,6.9],[-7.6,0]],mat,.22);fin.rotation.set(0,-Math.PI/2,0);pivot.position.set(side*(id==='fa18e'?2.0:3.1),.9,0);pivot.rotation.z=-side*(id==='fa18e'?.29:.055);pivot.add(fin);root.add(pivot)}
}
function addEnginePods(root,id,main,black){
 if(id==='f16')return;
 const p=profiles[id];for(const x of p.engineX){const pod=body(id==='fa18e'?[[-14.1,.9,.8,-.15],[-8,1.03,1.02,-.25],[-1,1.06,.85,-.4],[4.4,.92,.75,-.5]]:[[-17.0,1.02,.91,-.5],[-10,1.16,1.25,-.5],[-1,1.14,1.04,-.6],[4.2,1.0,.8,-.65]],main);pod.position.x=x;root.add(pod);const mouth=block(id==='fa18e'?1.7:1.85,1.12,.12,black,x,-.64,4.48);mouth.rotation.x=-.12;root.add(mouth)}
}
function addEngine(root,x,y,z,metal,black,flames,nozzles){
 const nozzle=new THREE.Group();nozzle.position.set(x,y,z);root.add(nozzle);nozzles.push(nozzle);
 nozzle.add(axisCylinder(.84,1.7,metal,0,0,0));nozzle.add(axisCylinder(.69,1.76,black,0,0,-.05));
 const plume=new THREE.Group();plume.position.z=-1;
 for(let ring=0;ring<3;ring++){const flame=new THREE.Mesh(new THREE.ConeGeometry(.67*(1-ring*.20),5.8-ring*.8,14),new THREE.MeshBasicMaterial({color:0x8ce7ff,transparent:true,opacity:.45,depthWrite:false}));flame.rotation.x=-Math.PI/2;flame.position.z=-2.6-ring*.3;plume.add(flame)}nozzle.add(plume);flames.push(plume);
}
function storeGeometry(type){
 const m=paint(0xc8d1d1),g=new THREE.Group(),tank=type==='tank',radius=tank?.7:type==='radar'?.21:.15,length=tank?6.8:type==='radar'?4.2:3.4;
 if(tank){const hull=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),m);hull.scale.set(radius,radius,length*.5);g.add(hull)}
 else{g.add(axisCylinder(radius,length-.6,m,0,0,-.12));const nose=new THREE.Mesh(new THREE.ConeGeometry(radius,.6,10),m);nose.rotation.x=Math.PI/2;nose.position.z=length*.5-.3;g.add(nose);for(const side of [-1,1]){g.add(panel([[side*radius,-length*.36],[side*(radius+.38),-length*.47],[side*radius,-length*.12]],m,.035));const fin=panel([[side*radius,-length*.36],[side*(radius+.38),-length*.47],[side*radius,-length*.12]],m,.035);fin.rotation.z=Math.PI/2;g.add(fin)}}
 const originals=g.children.map(n=>n.geometry);batchStatic(g);const geometry=g.children.find(n=>n.isMesh).geometry;for(const original of originals)if(original!==geometry)original.dispose();m.dispose();return geometry;
}
function buildStores(root,id,metal){
 const stations=aircraftDefinition(id).stations,storesRoot=new THREE.Group(),meshes={},material=paint(0xc7d1d0,{roughness:.67});root.add(storesRoot);
 for(const type of ['heat','radar','tank']){const mesh=new THREE.InstancedMesh(storeGeometry(type),material,stations.length);mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.name=`${type}-stores`;storesRoot.add(mesh);meshes[type]=mesh}
 const pylons=new THREE.InstancedMesh(new THREE.BoxGeometry(.18,.42,1.45),metal,stations.length);pylons.count=0;pylons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);storesRoot.add(pylons);
 return{root:storesRoot,meshes,pylons,stations,records:[],signature:null};
}
export function syncAircraftStores(model,p={}){
 const {stores,aircraftId}=model.userData;if(!stores)return;
 const ammo={heat:Number.isFinite(p.heat)?Math.max(0,Math.floor(p.heat)):Infinity,radar:Number.isFinite(p.radar)?Math.max(0,Math.floor(p.radar)):Infinity};
 const signature=JSON.stringify([p.loadout?.stations,ammo.heat,ammo.radar]);if(stores.signature===signature)return;stores.signature=signature;stores.records=[];const loadout=normalizeLoadout(aircraftId,p.loadout);
 for(const mesh of Object.values(stores.meshes))mesh.count=0;stores.pylons.count=0;
 const transform=new THREE.Object3D();
 for(const station of stores.stations){const type=loadout.stations[station.id],visible=type==='tank'||((type==='heat'||type==='radar')&&ammo[type]-->0);stores.records.push({id:station.id,type,visible,position:station.position});if(!visible)continue;
  const {x,y,z}=station.position,mesh=stores.meshes[type];transform.position.set(x,y,z);transform.scale.set(1,1,1);transform.updateMatrix();mesh.setMatrixAt(mesh.count++,transform.matrix);
  const tip=station.id.startsWith('wingtip');transform.position.y=y+(tip?.1:.38);transform.scale.set(1,tip?.35:1,tip?2.2:1);transform.updateMatrix();stores.pylons.setMatrixAt(stores.pylons.count++,transform.matrix);
 }
 for(const mesh of [...Object.values(stores.meshes),stores.pylons]){mesh.instanceMatrix.needsUpdate=true;mesh.visible=mesh.count>0;if(mesh.count)mesh.computeBoundingSphere()}
}
export function createAircraft(team=0,bomber=false,aircraftId='f16'){
 aircraftId=aircraftDefinition(aircraftId).id;const profile=profiles[aircraftId]||profiles.f16;
 const palette=AIRCRAFT_PALETTES[team]||AIRCRAFT_PALETTES[0],root=new THREE.Group(),main=paint(bomber?0x46535b:palette.main),upper=paint(bomber?0x29343c:palette.upper),belly=paint(0x34434d),accent=paint(palette.accent),black=paint(0x101b23,{roughness:.82}),glass=paint(0x26586c,{metalness:.7,roughness:.12}),metal=paint(0x7c888d,{metalness:.8,roughness:.4});
 const surfaces=[],flames=[],wingtips=[],airbrakes=[],nozzles=[];
 root.add(body(bomber?bomberHull:profile.hull,main));
 if(bomber){
  // Shallow blended centre section and flush forward glazing, no tail or stores.
  root.add(body([[-6,2,.3,.55],[0,2.3,.55,1.1],[6,1.6,.4,1.1],[9,.1,.1,.65]],upper));
  for(const side of[-1,1]){const windshield=panel([[side*.12,9],[side*1.4,7],[side*1.8,5.9],[side*.12,6.1]],glass,.04);windshield.position.y=1.65;root.add(windshield);root.add(block(1.9,.12,3,black,side*3.2,1.05,0));root.add(block(2.5,.13,.8,metal,side*3.5,.65,-6.3));}
 }else{
  root.add(body([[-10,.5,.45,1],[-2,.65,.6,1.2],[5,.45,.3,1.2]],upper));
  const canopy=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),glass);canopy.position.set(0,aircraftId==='su37'?1.95:1.7,aircraftId==='f16'?5.1:7.0);canopy.scale.set(aircraftId==='f16'?1:1.12,1.2,aircraftId==='su37'?3.8:3.35);root.add(canopy);
  // Bubble canopy: unobstructed forward glass, aft bow only.
  root.add(block(aircraftId==='f16'?1.85:2.05,.12,.22,metal,0,1.84,aircraftId==='f16'?2.15:4.0));
  if(aircraftId==='f16'){
   const intake=body([[-8,.75,.55,-.8],[-2,1.1,.72,-1.15],[4,1.02,.67,-1.02]],belly);root.add(intake);
   const lip=axisCylinder(1.06,.23,metal,0,-1.04,4.05);lip.scale.z=.68;root.add(lip);
   const mouth=axisCylinder(.90,.25,black,0,-1.04,4.19);mouth.scale.z=.65;root.add(mouth);
  }else{
   addEnginePods(root,aircraftId,belly,black);
   // Open rectangular mouths ahead of the twin nacelles, with a visible lip.
   for(const x of profile.engineX){root.add(block(1.95,.13,.23,metal,x,-.03,4.52));root.add(block(1.95,.13,.23,metal,x,-1.25,4.52));for(const side of [-1,1])root.add(block(.13,1.2,.23,metal,x+side*.91,-.64,4.52))}
  }
  addFins(root,aircraftId,upper);
  for(const x of profile.engineX)addEngine(root,x,profile.engineY,profile.engineZ,metal,black,flames,nozzles);
 }
 for(const side of[-1,1]){
  root.add(panel(wingOutline(side,bomber,aircraftId),main,bomber?.36:.19));
  if(!bomber){
   root.add(panel(mirrored(profile.lerx,side),upper,.12));
   const stabilizer=new THREE.Group();stabilizer.position.set(side*profile.tailX,.2,profile.tailZ);stabilizer.add(panel([[0,2],[side*profile.tailSpan,-.8],[side*(profile.tailSpan-.4),-3],[0,-2]],upper,.15));root.add(stabilizer);surfaces.push({node:stabilizer,side,kind:'elevator'});
   // Ventrals below the aft fuselage are not additional vertical tails.
   if(aircraftId==='f16'){const ventral=block(.12,1.2,2.9,upper,side*.92,-1.0,-10);ventral.rotation.z=side*.3;root.add(ventral)}
   if(aircraftId==='su37'){const canard=new THREE.Group();canard.position.set(side*2.05,.3,6.1);canard.add(panel([[0,2],[side*4.3,-.3],[side*3.6,-2.6],[0,-1.5]],upper,.15));root.add(canard);surfaces.push({node:canard,side,kind:'canard'})}
   const tipZ=aircraftId==='f16'?-5:aircraftId==='fa18e'?-3.7:-6.5;root.add(block(.18,.17,3.4,metal,side*(profile.span-.05),-.05,tipZ));
   const stripe=panel(mirrored([[profile.span-2.6,tipZ+2.5],[profile.span-.2,tipZ+.8],[profile.span-.3,tipZ-.1],[profile.span-2.6,tipZ+1.4]],side),accent,.03);stripe.position.y=.04;root.add(stripe);
  }
  const aileronPivot=new THREE.Group();aileronPivot.position.set(side*(bomber?20:profile.span-2.6),0,bomber?-7.3:aircraftId==='su37'?-7.1:-5.8);aileronPivot.add(block(bomber?8:3.5,.14,bomber?1.9:1.1,upper,0,0,bomber?-.85:-.45));root.add(aileronPivot);surfaces.push({node:aileronPivot,side,kind:'aileron'});
  // Fighter split aft speed brakes; flying wing split drag rudders at the tips.
  for(const vertical of[-1,1]){const hinge=new THREE.Group();hinge.position.set(side*(bomber?27:1.55),bomber?0:.05,bomber?-8.4:profile.engineZ+2.4);const brake=block(bomber?5.2:1.6,.10,bomber?2:2.6,upper,side*(bomber?0:.55),0,bomber?-.9:-1.15);hinge.add(brake);root.add(hinge);airbrakes.push({node:hinge,vertical})}
  const light=new THREE.Mesh(new THREE.SphereGeometry(.14,7,5),new THREE.MeshBasicMaterial({color:side===1?0x72e7a4:0xff6f58}));light.position.set(side*(bomber?31.7:profile.span),.1,bomber?-7.8:aircraftId==='fa18e'?-3.7:aircraftId==='su37'?-6.5:-5.3);root.add(light);wingtips.push(light.position.clone());
 }
 const gear=new THREE.Group();for(const[x,z]of[[0,bomber?6:4.8],[-(bomber?4.4:1.9),-3.8],[(bomber?4.4:1.9),-3.8]]){gear.add(block(.19,2.9,.19,metal,x,-1.45,z));gear.add(block(.65,.09,1.5,upper,x,-1.25,z));for(const offset of(bomber&&x!==0?[-.4,.4]:[0])){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.59,.59,.42,14),black);wheel.rotation.z=Math.PI/2;wheel.position.set(x+offset,-3,z);gear.add(wheel)}}root.add(gear);
 const beacon=new THREE.Mesh(new THREE.SphereGeometry(.13,6,5),new THREE.MeshBasicMaterial({color:0xffdba6}));beacon.position.set(0,bomber?1.8:1.95,-4);root.add(beacon);
 const vapor=new THREE.Mesh(new THREE.ConeGeometry(bomber?24:10,11,24,1,true),new THREE.MeshBasicMaterial({color:0xe8f5f5,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));vapor.rotation.x=Math.PI/2;vapor.position.z=-3;vapor.visible=false;root.add(vapor);
 root.userData={flames,nozzles,gear,surfaces,wingtips,airbrakes,beacon,vapor,gearAmount:1,brakeAmount:0,bomber,team,aircraftId,visualModel:'Simplified original visual model',prototype:!bomber&&aircraftId==='su37'};batchStatic(gear);batchStatic(root,new Set([gear,beacon,vapor,...nozzles,...surfaces.map(s=>s.node),...airbrakes.map(s=>s.node)]));
 const detailed=new THREE.Group();for(const node of[...root.children])detailed.add(node);root.add(detailed);
 const distant=new THREE.Group();distant.add(body(bomber?bomberHull:profile.hull,main));for(const side of[-1,1]){distant.add(panel(wingOutline(side,bomber,aircraftId),main,.2));if(!bomber){const tail=panel([[side*profile.tailX,profile.tailZ+2],[side*(profile.tailX+profile.tailSpan),profile.tailZ-.8],[side*(profile.tailX+profile.tailSpan-.4),profile.tailZ-3],[side*profile.tailX,profile.tailZ-2]],upper,.15);distant.add(tail);distant.add(panel(mirrored(profile.lerx,side),upper,.1));if(aircraftId==='su37')distant.add(panel(mirrored([[2.05,8.1],[6.35,5.8],[5.65,3.5],[2.05,4.6]],side),upper,.15))}}if(!bomber){addFins(distant,aircraftId,upper);addEnginePods(distant,aircraftId,belly,black)}batchStatic(distant);distant.visible=false;root.add(distant);root.userData.detailed=detailed;root.userData.distant=distant;
 if(!bomber){root.userData.stores=buildStores(root,aircraftId,metal);syncAircraftStores(root)}return root;
}
export function animateAircraft(model,p,time,dt){
 const d=model.userData,power=aircraftPower(p),desiredGear=p.gearDown===undefined?(p.grounded?1:0):(p.gearDown?1:0);d.gearAmount+=(desiredGear-d.gearAmount)*Math.min(1,dt*2.5);d.gear.visible=d.gearAmount>.025;d.gear.scale.y=Math.max(.05,d.gearAmount);
 d.brakeAmount+=((p.airbrake?1:0)-d.brakeAmount)*Math.min(1,dt*5);for(const brake of d.airbrakes)brake.node.rotation.x=brake.vertical*d.brakeAmount*(d.bomber?.65:.82);
 for(const surface of d.surfaces){const target=surface.kind==='aileron'?(p.roll||0)*surface.side*.21-(d.bomber?(p.pitch||0)*.18:0):(p.pitch||0)*(surface.kind==='canard'?.25:-.42);surface.node.rotation.x+=(target-surface.node.rotation.x)*Math.min(1,dt*9)}
 if(d.aircraftId==='su37')for(const nozzle of d.nozzles){const target=-bounded(p.controlInput?.pitch,-1,1)*.18;nozzle.rotation.x+=(target-nozzle.rotation.x)*Math.min(1,Math.max(0,dt)*6)}
 for(const plume of d.flames){const{burner,throttle}=power;plume.scale.set(1+burner*.17,1+burner*.17,.15+throttle*.24+burner*1.7+Math.sin(time*37)*.025);plume.visible=!p.dead&&throttle>.13;plume.children.forEach((f,j)=>{f.material.opacity=(.09-j*.02)+burner*.44;f.material.color.setHex(burner?[0x626aff,0xb9bcff,0xffe0bb][j]:[0x3d9fff,0x8ce7ff,0xe2f7ff][j])})}
 d.vapor.visible=power.vapor>.035;d.vapor.material.opacity=power.vapor*.14;d.vapor.scale.setScalar(.93+power.vapor*.13);d.beacon.visible=Math.sin(time*3.2)>.83;syncAircraftStores(model,p);
}
