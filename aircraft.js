import * as THREE from './vendor/three.module.js';
import {batchStatic} from './geometry.js?v=skybreak120-1104';
import {aircraftDefinition,normalizeLoadout} from './loadouts.js?v=skybreak120-1104';
import {usesSimulationAirbrakeDeployment} from './aircraft-capabilities.js?v=skybreak120-1104';
// Simplified original visual models. Layout cues only, not manufacturer geometry.
// USAF: 183wg.ang.af.mil/RESOURCES/Fact-Sheets/Article/459577/f-16-fighting-falcon/
// NAVAIR: navair.navy.mil/product/FA-18EF-Super-Hornet
// Su-27 rebuild: conventional Flanker without foreplanes or vectored nozzles.
// Original blue-grey procedural camouflage; references are in aircraft-reference.md.
// Super Hornet surface-braking reference: Tommy H. Thomason's annotated photo,
// thanlont.blogspot.com/2021/11/a-brief-history-of-usnavy-jet-speed.html
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
 su27:{hull:[[-17.5,.65,.42,.35],[-12,1.75,.68,.45],[-5,2.8,.82,.5],[2,3.0,1,.6],[7,2.1,1.2,.6],[12,1.18,1.15,.35],[16.6,.9,.76,.15]],span:14.7,wing:[[2.4,5.1],[14.7,-5.1],[14.5,-7.7],[7,-8.9],[3.1,-8.8]],lerx:[[1.05,13.6],[2.5,9],[4.9,3.5],[3.2,-4],[1.7,-3]],engineX:[-3.1,3.1],engineY:-.7,engineZ:-17.8,tailX:3.1,tailZ:-15,tailSpan:6.6},
 f14:{hull:[[-16,1.4,.65],[-11,3.3,1],[-3,3.6,1.25],[4,2.6,1.35],[9,1.3,1.1],[15,.8,.65],[20.5,.01,.01]],span:19.5,wing:[[4,3],[19.5,-2.5],[18.8,-5.5],[4,-4]],lerx:[[1.1,9],[6.9,1],[5.5,-3],[2,-3]],engineX:[-2.7,2.7],engineY:-.25,engineZ:-15.6,tailX:2.7,tailZ:-12.6,tailSpan:6.4},
};

const mirrored=(points,side)=>points.map(([x,z])=>[side*x,z]);
function wingOutline(side,bomber,id='f16'){return bomber?[[0,12.8],[side*32,-7.8],[side*27,-10.3],[side*21,-7.7],[side*15,-10.2],[side*9,-7.1],[side*4,-9.4],[0,-7.4]]:mirrored(profiles[id].wing,side)}
function singleFin(mat){const fin=panel([[-11,0],[-10,6.3],[-6.8,6.0],[-3,0]],mat,.22);fin.rotation.set(0,-Math.PI/2,0);fin.position.set(-.11,.9,0);return fin}
function addFins(root,id,mat,sharedControls,airbrakes,surfaces){
 if(id==='f16'){root.add(singleFin(mat));return}
 if(id==='f14'){
  for(const side of [-1,1]){
   const assembly=new THREE.Group();assembly.position.set(side*2.7,.85,0);assembly.rotation.z=-side*.08;root.add(assembly);
   const fin=panel([[-13.6,0],[-12.8,5.2],[-11.3,5.6],[-7.4,0]],mat,.18);fin.rotation.set(0,-Math.PI/2,0);assembly.add(fin);
   const rudder=new THREE.Group();rudder.position.z=-13.2;assembly.add(rudder);const skin=panel([[-2,0],[-.8,4.9],[.3,5.2],[.6,0]],mat,.18);skin.rotation.set(0,-Math.PI/2,0);rudder.add(skin);rudder.name=`tomcat-rudder-${side}`;surfaces?.push({node:rudder,side,kind:'rudder'});
  }return;
 }
 for(const side of [-1,1]){
  const pivot=new THREE.Group(),fin=panel((id==='fa18e'||id==='f14')?[[-9,0],[-10.2,5.7],[-8.4,5.9],[-4.6,0]]:[[-18.8,0],[-17.6,6.3],[-14.2,7],[-8.2,0]],mat,.22);fin.rotation.set(0,-Math.PI/2,0);pivot.position.set(side*(id==='f14'?3.2:id==='fa18e'?2.0:3.65),id==='fa18e'?.9:.75,0);pivot.rotation.z=-side*(id==='fa18e'?.29:id==='f14'?.08:.04);pivot.add(fin);root.add(pivot);
  if(id==='fa18e'&&sharedControls){
   const assembly=new THREE.Group();assembly.position.copy(pivot.position);assembly.rotation.copy(pivot.rotation);sharedControls.add(assembly);
   const rudder=new THREE.Group();rudder.position.z=-10;assembly.add(rudder);const skin=panel([[-2.8,0],[-2.1,5.4],[-.2,5.7],[1,0]],mat,.22);skin.rotation.set(0,-Math.PI/2,0);rudder.add(skin);rudder.name=`rudder-${side<0?'left':'right'}`;airbrakes.push({node:rudder,kind:'rudder',axis:'y',angle:-side*.43,rest:0,side});
  }
 }
}
function addEnginePods(root,id,main,black){
 if(id==='f16')return;
 const p=profiles[id];for(const x of p.engineX){const pod=body(id==='f14'?[[-15.5,1.05,.85,-.25],[-9,1.25,1.05,-.2],[0,1.3,1.05,-.3],[6,1.1,.82,-.4]]:id==='fa18e'?[[-14.1,.9,.8,-.15],[-8,1.03,1.02,-.25],[-1,1.06,.85,-.4],[4.4,.92,.75,-.5]]:[[-18.5,1.05,.9,-.65],[-14,1.2,1.05,-.65],[-7,1.35,1.25,-.75],[0,1.3,1.35,-.8],[4.2,1.13,1.05,-.8]],main);pod.position.x=x;root.add(pod);const mouth=block(id==='fa18e'?1.7:2.05,id==='fa18e'?1.12:1.45,.12,black,x,id==='fa18e'?-.64:id==='f14'?-.72:-.95,id==='f14'?6.15:4.48);mouth.rotation.x=-.12;root.add(mouth)}
}
function addEngine(root,x,y,z,metal,black,flames,nozzles,radius=.84){
 const nozzle=new THREE.Group();nozzle.position.set(x,y,z);root.add(nozzle);nozzles.push(nozzle);
 nozzle.add(axisCylinder(radius,1.7,metal,0,0,0));nozzle.add(axisCylinder(radius===.84?.69:radius*.82,1.76,black,0,0,-.05));
 const plume=new THREE.Group();plume.position.z=-1;
 for(let ring=0;ring<3;ring++){const flame=new THREE.Mesh(new THREE.ConeGeometry(.67*(1-ring*.20),5.8-ring*.8,14),new THREE.MeshBasicMaterial({color:0x8ce7ff,transparent:true,opacity:.45,depthWrite:false}));flame.rotation.x=-Math.PI/2;flame.position.z=-2.6-ring*.3;plume.add(flame)}nozzle.add(plume);flames.push(plume);
}
function addAftStructure(root,id,material){
 if(id==='su27')return; // Su-27 uses its long centre stinger.
 if(id==='f14'){root.add(body([[-17.8,.5,.13,.1],[-15.6,1.8,.24,.2],[-11,2,.5,.35]],material));return;}
 if(id==='f16')for(const side of [-1,1]){const rail=body([[-15.6,.05,.08],[-13.6,.22,.2],[-10,.3,.35]],material);rail.position.set(side*1.05,.2,0);root.add(rail);}
 else root.add(body([[-18.4,.04,.09,.4],[-16,.35,.3,.45],[-12,.65,.5,.5]],material));
}
function addFlightRudders(root,id,mat,surfaces){
 if(id==='f14')return; // Rudders hinge directly on the Tomcat's nacelle-mounted fins.
 for(const side of (id==='f16'?[0]:[-1,1])){
  const pivot=new THREE.Group();pivot.position.set(side*(id==='su27'?3.65:2),1,id==='f16'?-10.5:id==='fa18e'?-10.8:-18.8);
  pivot.add(block(.16,id==='su27'?4.3:3.8,1.25,mat,0,2,-.55));root.add(pivot);surfaces.push({node:pivot,side,kind:'rudder'});
 }
}
function addSu27Center(root,upper,radome){
 // Flattened blended centre and the tail stinger between separated engines.
 root.add(body([[-21.7,.03,.06,.35],[-19.8,.24,.2,.4],[-16,.52,.34,.45],[-12,1,.48,.5]],upper));
 root.add(body([[16.6,.9,.76,.15],[20,.55,.47,.05],[22.1,.01,.01]],radome));
}
function addVariantBrakes(root,id,upper,metal,airbrakes){
 const add=(kind,position,outline,angle,rest=0,side)=>{const hinge=new THREE.Group();hinge.name=kind+(side?`-${side<0?'left':'right'}`:'');hinge.position.set(...position);hinge.rotation.x=rest;hinge.add(panel(outline,upper,.10));root.add(hinge);airbrakes.push({node:hinge,kind,axis:'x',angle,rest,side});return hinge};
 if(id==='su27'){
  // Forward hinge, trailing edge lifts above the spine behind the cockpit.
  const board=add('dorsal',[0,1.98,6],[[-1.15,0],[1.15,0],[1.65,-6],[-1.65,-6]],.98,-.07);board.add(block(2.35,.14,.17,metal,0,0,0));
 }else if(id==='f14'){add('aft-speedbrake',[0,1,-9],[[-1.2,0],[1.2,0],[1.5,-4],[-1.5,-4]],.85);
 }else if(id==='fa18e'){
  // Distributed surface braking; fixed readable angles approximate the real
  // speed-brake FCS schedule, which varies with the flight condition.
  for(const side of [-1,1]){
   add('lex-spoiler',[side*3.15,.12,3.6],[[-.7,0],[.7,0],[.78,-2.25],[-.78,-2.25]],1.02,0,side);
   add('trailing-flap',[side*5.4,.015,-5.25],mirrored([[0,0],[2.5,.55],[2.4,-.85],[0,-1.45]],side),-.38,0,side);
  }
 }
}
function storeGeometry(type){
 const m=paint(0xc8d1d1),g=new THREE.Group(),tank=type==='tank',radius=tank?1.02:type==='bomb'?.32:type==='radar'?.21:.15,length=tank?9.2:type==='bomb'?3.8:type==='radar'?4.2:3.4;
 // A one-mesh batch keeps its object transform. Bake the ellipsoid into the
 // buffer itself, because InstancedMesh receives geometry, not that object.
 if(tank){g.add(new THREE.Mesh(new THREE.SphereGeometry(1,20,12).scale(radius,radius,length*.5),m))}
 else{g.add(axisCylinder(radius,length-.6,m,0,0,-.12));const nose=new THREE.Mesh(new THREE.ConeGeometry(radius,.6,10),m);nose.rotation.x=Math.PI/2;nose.position.z=length*.5-.3;g.add(nose);for(const side of [-1,1]){g.add(panel([[side*radius,-length*.36],[side*(radius+.38),-length*.47],[side*radius,-length*.12]],m,.035));const fin=panel([[side*radius,-length*.36],[side*(radius+.38),-length*.47],[side*radius,-length*.12]],m,.035);fin.rotation.z=Math.PI/2;g.add(fin)}}
 const originals=g.children.map(n=>n.geometry);batchStatic(g);const geometry=g.children.find(n=>n.isMesh).geometry;for(const original of originals)if(original!==geometry)original.dispose();m.dispose();return geometry;
}
function buildStores(root,id,metal){
 const stations=aircraftDefinition(id).stations,storesRoot=new THREE.Group(),meshes={},material=paint(0xc7d1d0,{roughness:.67});root.add(storesRoot);
 for(const type of ['heat','radar','tank','bomb']){const mesh=new THREE.InstancedMesh(storeGeometry(type),material,stations.length*2);mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.name=`${type}-stores`;storesRoot.add(mesh);meshes[type]=mesh}
 const pylons=new THREE.InstancedMesh(new THREE.BoxGeometry(.18,.42,1.45),metal,stations.length);pylons.count=0;pylons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);storesRoot.add(pylons);
 return{root:storesRoot,meshes,pylons,stations,records:[],signature:null};
}
export function syncAircraftStores(model,p={}){
 const {stores,aircraftId}=model.userData;if(!stores)return;
 const ammo={bomb:Number.isFinite(p.bombs)?Math.max(0,Math.floor(p.bombs)):Infinity,heat:Number.isFinite(p.heat)?Math.max(0,Math.floor(p.heat)):Infinity,radar:Number.isFinite(p.radar)?Math.max(0,Math.floor(p.radar)):Infinity};
 const signature=JSON.stringify([p.loadout?.stations,ammo.heat,ammo.radar,ammo.bomb]);if(stores.signature===signature)return;stores.signature=signature;stores.records=[];const loadout=normalizeLoadout(aircraftId,p.loadout);
 for(const mesh of Object.values(stores.meshes))mesh.count=0;stores.pylons.count=0;
 const transform=new THREE.Object3D();
 for(const station of stores.stations){const type=loadout.stations[station.id],visible=type==='tank'||((type==='heat'||type==='radar'||type==='bomb')&&ammo[type]-->0);stores.records.push({id:station.id,type,visible,position:station.position});if(!visible)continue;
  const {x,y,z}=station.position,mesh=stores.meshes[type];transform.position.set(x,y,z);transform.scale.set(1,1,1);transform.updateMatrix();mesh.setMatrixAt(mesh.count++,transform.matrix);if(type==='bomb'){if(ammo.bomb-->0){transform.position.x=x+.44;transform.position.y=y-.2;transform.updateMatrix();mesh.setMatrixAt(mesh.count++,transform.matrix);}}
  const tip=station.id.startsWith('wingtip');transform.position.y=y+(tip?.1:.38);transform.scale.set(1,tip?.35:1,tip?2.2:1);transform.updateMatrix();stores.pylons.setMatrixAt(stores.pylons.count++,transform.matrix);
 }
 for(const mesh of [...Object.values(stores.meshes),stores.pylons]){mesh.instanceMatrix.needsUpdate=true;mesh.visible=mesh.count>0;if(mesh.count)mesh.computeBoundingSphere()}
}
function applyBlueCamouflage(root,materials){
 const size=256,data=new Uint8Array(size*size*4),colors=[[165,194,210],[94,137,171],[57,98,139]];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const v=Math.sin(x*.053+Math.sin(y*.041)*2)+Math.cos(y*.047-x*.02)+.5*Math.sin(x*.11+y*.04),color=colors[v>.55?2:v<-.4?0:1];data.set([...color,255],(y*size+x)*4);}
 const texture=new THREE.DataTexture(data,size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;texture.magFilter=THREE.LinearFilter;
 for(const mat of materials){mat.map=texture;mat.roughness=.78;mat.metalness=.16;}
 root.updateMatrixWorld(true);root.traverse(node=>{if(!node.isMesh||!materials.has(node.material))return;const positions=node.geometry.attributes.position,uv=new Float32Array(positions.count*2),v=new THREE.Vector3();for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld);uv[i*2]=(v.x+17)/34;uv[i*2+1]=(v.z+23)/47;}node.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));});root.userData.camouflage='Original procedural blue-grey Flanker pattern';
}
export function createAircraft(team=0,bomber=false,aircraftId='f16'){
 aircraftId=aircraftDefinition(aircraftId).id;const profile=profiles[aircraftId]||profiles.f16;
 const palette=aircraftId==='su27'?{main:0xffffff,upper:0xffffff,accent:0x75a0c1}:AIRCRAFT_PALETTES[team]||AIRCRAFT_PALETTES[0],root=new THREE.Group(),main=paint(bomber?0x46535b:palette.main),upper=paint(bomber?0x29343c:palette.upper),belly=paint(0x34434d),accent=paint(palette.accent),black=paint(0x101b23,{roughness:.82}),glass=paint(0x26586c,{metalness:.7,roughness:.12}),metal=paint(0x7c888d,{metalness:.8,roughness:.4});
 const wingDetails=[],swingWings=[],sweepRoot=new THREE.Group(),surfaces=[],flames=[],wingtips=[],airbrakes=[],nozzles=[],sharedControls=new THREE.Group();sharedControls.name='shared-braking-surfaces';
 root.add(body(bomber?bomberHull:profile.hull,main));
 if(bomber){
  // Shallow blended centre section and flush forward glazing, no tail or stores.
  root.add(body([[-6,2,.3,.55],[0,2.3,.55,1.1],[6,1.6,.4,1.1],[9,.1,.1,.65]],upper));
  for(const side of[-1,1]){const windshield=panel([[side*.12,9],[side*1.4,7],[side*1.8,5.9],[side*.12,6.1]],glass,.04);windshield.position.y=1.65;root.add(windshield);root.add(block(1.9,.12,3,black,side*3.2,1.05,0));root.add(block(2.5,.13,.8,metal,side*3.5,.65,-6.3));}
 }else{
  addAftStructure(root,aircraftId,upper);addFlightRudders(root,aircraftId,upper,surfaces);
  if(aircraftId==='su27')addSu27Center(root,upper,paint(0xcbd2cd,{roughness:.8,metalness:.1}));else root.add(body([[-10,.5,.45,1],[-2,.65,.6,1.2],[5,.45,.3,1.2]],upper));
  const canopy=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),glass);canopy.position.set(0,aircraftId==='su27'?1.95:aircraftId==='f14'?1.9:1.7,aircraftId==='f16'?5.1:aircraftId==='su27'?11.7:aircraftId==='f14'?10:7);canopy.scale.set(aircraftId==='f16'?1:aircraftId==='su27'?1.02:1.12,aircraftId==='su27'?.87:aircraftId==='f14'?.9:1.2,aircraftId==='su27'?2.65:aircraftId==='f14'?4.2:3.35);root.add(canopy);
  // Bubble canopy: unobstructed forward glass, aft bow only.
  root.add(block(aircraftId==='f16'?1.85:2.05,.12,.22,metal,0,1.84,aircraftId==='f16'?2.15:aircraftId==='su27'?8.65:4.0));
  if(aircraftId==='f14'){
   for(const z of [7.1,11.5]){const points=Array.from({length:17},(_,i)=>{const a=i/16*Math.PI;return new THREE.Vector3(Math.cos(a)*1.13,1.9+Math.sin(a)*.91,z)});root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.055,6,false),metal));}
   for(const side of [-1,1]){const ventral=block(.14,.9,2.3,upper,side*2.7,-1.1,-12.4);ventral.rotation.z=side*.14;root.add(ventral);}
  }
  if(aircraftId==='f16'){
   const intake=body([[-8,.75,.55,-.8],[-2,1.1,.72,-1.15],[4,1.02,.67,-1.02]],belly);root.add(intake);
   const lip=axisCylinder(1.06,.23,metal,0,-1.04,4.05);lip.scale.z=.68;root.add(lip);
   const mouth=axisCylinder(.90,.25,black,0,-1.04,4.19);mouth.scale.z=.65;root.add(mouth);
  }else{
   addEnginePods(root,aircraftId,belly,black);
   // Open rectangular mouths ahead of the twin nacelles, with a visible lip.
   for(const x of profile.engineX){const su=aircraftId==='su27',tomcat=aircraftId==='f14',inletZ=tomcat?6.18:4.52,width=su?2.3:tomcat?2.3:1.95,top=su?-.16:-.03,bottom=su?-1.72:tomcat?-1.4:-1.25;root.add(block(width,.13,.23,metal,x,top,inletZ));root.add(block(width,.13,.23,metal,x,bottom,inletZ));for(const side of [-1,1])root.add(block(.13,bottom*-1+top,.23,metal,x+side*(su?1.1:.91),(top+bottom)*.5,inletZ))}
  }
  addFins(root,aircraftId,upper,sharedControls,airbrakes,surfaces);
  for(const x of profile.engineX)addEngine(root,x,profile.engineY,profile.engineZ,metal,black,flames,nozzles,aircraftId==='su27'?1.02:.84);
  addVariantBrakes(sharedControls,aircraftId,upper,metal,airbrakes);
 }
 for(const side of[-1,1]){
  if(!bomber&&aircraftId==='f14'){const pivot=new THREE.Group();pivot.position.set(side*6,0,2.8);const skin=panel(mirrored([[0,0],[13.5,-4.9],[12.9,-7.5],[0,-6.8]],side),main,.19);skin.name='tomcat-wing-skin';pivot.add(skin);sweepRoot.add(pivot);swingWings.push({node:pivot,side});}else root.add(panel(wingOutline(side,bomber,aircraftId),main,bomber?.36:.19));
  if(!bomber){
   root.add(panel(mirrored(profile.lerx,side),upper,.12));
   const stabilizer=new THREE.Group();stabilizer.position.set(side*profile.tailX,.2,profile.tailZ);stabilizer.add(panel([[0,2],[side*profile.tailSpan,-.8],[side*(profile.tailSpan-.4),-3],[0,-2]],upper,.15));root.add(stabilizer);surfaces.push({node:stabilizer,side,kind:'elevator'});
   // Ventrals below the aft fuselage are not additional vertical tails.
   if(aircraftId==='f16'){const ventral=block(.12,1.2,2.9,upper,side*.92,-1.0,-10);ventral.rotation.z=side*.3;root.add(ventral)}

   const tipZ=aircraftId==='f16'?-5:aircraftId==='fa18e'?-3.7:aircraftId==='f14'?-4:-6.5;const rail=block(.18,.17,3.4,metal,side*(profile.span-.05),-.05,tipZ);if(aircraftId!=='f14')root.add(rail);else{rail.geometry.dispose();}
   const stripe=panel(mirrored([[profile.span-2.6,tipZ+2.5],[profile.span-.2,tipZ+.8],[profile.span-.3,tipZ-.1],[profile.span-2.6,tipZ+1.4]],side),accent,.03);stripe.position.y=.04;root.add(stripe);if(aircraftId==='f14')wingDetails.push({node:stripe,side});
  }
  const aileronPivot=new THREE.Group();aileronPivot.position.set(side*(bomber?20:aircraftId==='f14'?12:profile.span-2.6),.04,bomber?-7.3:aircraftId==='f14'?-1.8:aircraftId==='su27'?-7.7:-5.8);aileronPivot.add(block(bomber?8:3.5,.14,bomber?1.9:1.1,upper,0,0,bomber?-.85:-.45));root.add(aileronPivot);surfaces.push({node:aileronPivot,side,kind:aircraftId==='f14'&&!bomber?'roll-spoiler':'aileron'});
  const flap=new THREE.Group();flap.position.set(side*(bomber?11:aircraftId==='f14'?8.6:profile.span*.42),.04,bomber?-8:aircraftId==='f14'?-3.8:aircraftId==='su27'?-8.7:-6.4);flap.add(block(bomber?7:3.2,.13,1.45,upper,0,0,-.65));root.add(flap);surfaces.push({node:flap,side,kind:'flap'});
  // Fighter split aft speed brakes; flying wing split drag rudders at the tips.
  if(bomber||aircraftId==='f16')for(const vertical of[-1,1]){const hinge=new THREE.Group();hinge.position.set(side*(bomber?27:1.55),bomber?0:.05,bomber?-8.4:profile.engineZ+2.4);const brake=block(bomber?5.2:1.6,.10,bomber?2:2.6,upper,side*(bomber?0:.55),0,bomber?-.9:-1.15);hinge.add(brake);root.add(hinge);airbrakes.push({node:hinge,vertical,kind:bomber?'drag-rudder':'split-aft',axis:'x',rest:0,angle:vertical*(bomber?.65:.82)})}
  const light=new THREE.Mesh(new THREE.SphereGeometry(.14,7,5),new THREE.MeshBasicMaterial({color:side===1?0x72e7a4:0xff6f58}));light.position.set(side*(bomber?31.7:aircraftId==='f14'?19.2:profile.span),.1,bomber?-7.8:aircraftId==='f14'?-3.5:aircraftId==='fa18e'?-3.7:aircraftId==='su27'?-6.5:-5.3);root.add(light);wingtips.push(light.position.clone());if(aircraftId==='f14')wingDetails.push({node:light,side,tipIndex:wingtips.length-1});
 }
 const gear=new THREE.Group();for(const[x,z]of[[0,bomber?6:4.8],[-(bomber?4.4:1.9),-3.8],[(bomber?4.4:1.9),-3.8]]){gear.add(block(.19,2.9,.19,metal,x,-1.45,z));gear.add(block(.65,.09,1.5,upper,x,-1.25,z));for(const offset of(bomber&&x!==0?[-.4,.4]:[0])){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.59,.59,.42,14),black);wheel.rotation.z=Math.PI/2;wheel.position.set(x+offset,-3,z);gear.add(wheel)}}root.add(gear);
 const beacon=new THREE.Mesh(new THREE.SphereGeometry(.13,6,5),new THREE.MeshBasicMaterial({color:0xffdba6}));beacon.position.set(0,bomber?1.8:1.95,-4);root.add(beacon);
 const vapor=new THREE.Mesh(new THREE.ConeGeometry(bomber?24:10,11,24,1,true),new THREE.MeshBasicMaterial({color:0xe8f5f5,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));vapor.rotation.x=Math.PI/2;vapor.position.z=-3;vapor.visible=false;root.add(vapor);
 if(aircraftId==='f14'){root.updateMatrixWorld(true);sweepRoot.updateMatrixWorld(true);for(const wing of swingWings)for(const surface of [...surfaces.filter(s=>s.side===wing.side&&['aileron','roll-spoiler','flap'].includes(s.kind)),...wingDetails.filter(s=>s.side===wing.side)])wing.node.attach(surface.node);}
 root.userData={wingDetails,swingWings,flames,nozzles,gear,surfaces,wingtips,airbrakes,beacon,vapor,sharedControls,gearAmount:1,brakeAmount:0,bomber,team,aircraftId,visualModel:'Simplified original visual model',prototype:false};batchStatic(gear);batchStatic(root,new Set([gear,beacon,vapor,...nozzles,...surfaces.map(s=>s.node),...airbrakes.map(s=>s.node)]));
 const detailed=new THREE.Group();for(const node of[...root.children])detailed.add(node);root.add(detailed);
 const distant=new THREE.Group();distant.add(body(bomber?bomberHull:profile.hull,main));for(const side of[-1,1]){if(aircraftId!=='f14')distant.add(panel(wingOutline(side,bomber,aircraftId),main,.2));if(!bomber){const tail=panel([[side*profile.tailX,profile.tailZ+2],[side*(profile.tailX+profile.tailSpan),profile.tailZ-.8],[side*(profile.tailX+profile.tailSpan-.4),profile.tailZ-3],[side*profile.tailX,profile.tailZ-2]],upper,.15);distant.add(tail);distant.add(panel(mirrored(profile.lerx,side),upper,.1));}}if(!bomber){addAftStructure(distant,aircraftId,upper);addFins(distant,aircraftId,upper);addEnginePods(distant,aircraftId,belly,black);if(aircraftId==='su27')addSu27Center(distant,upper,paint(0xcbd2cd,{roughness:.8,metalness:.1}))}batchStatic(distant);distant.visible=false;root.add(distant);root.add(sharedControls);root.add(sweepRoot);if(aircraftId==='su27')applyBlueCamouflage(root,new Set([main,upper]));root.userData.detailed=detailed;root.userData.distant=distant;
 if(!bomber){root.userData.stores=buildStores(root,aircraftId,metal);syncAircraftStores(root)}return root;
}
export function animateAircraft(model,p,time,dt){
 const d=model.userData;for(const wing of d.swingWings||[]){wing.node.rotation.y=wing.side*bounded(p.wingSweep)*48*Math.PI/180;wing.node.updateMatrix();}for(const detail of d.wingDetails||[])if(detail.tipIndex!==undefined)d.wingtips[detail.tipIndex].copy(detail.node.position).applyMatrix4(detail.node.parent.matrix);const power=aircraftPower(p),desiredGear=p.gearDown===undefined?(p.grounded?1:0):(p.gearDown?1:0);d.gearAmount+=(desiredGear-d.gearAmount)*Math.min(1,dt*2.5);d.gear.visible=d.gearAmount>.025;d.gear.scale.y=Math.max(.05,d.gearAmount);
 if(usesSimulationAirbrakeDeployment(d)&&Number.isFinite(p.airbrakeDeployment))d.brakeAmount=bounded(p.airbrakeDeployment);else d.brakeAmount+=((p.airbrake?1:0)-d.brakeAmount)*Math.min(1,Math.max(0,dt)*5);
 for(const brake of d.airbrakes)brake.node.rotation[brake.axis]=(brake.rest||0)+brake.angle*d.brakeAmount;
 const input=p.controlInput||{},pitch=bounded(input.pitch,-1,1),roll=bounded(input.roll,-1,1),yaw=bounded(input.yaw,-1,1);
 for(const surface of d.surfaces){if(surface.kind==='rudder'){const target=yaw*.4+roll*.12;surface.node.rotation.y+=(target-surface.node.rotation.y)*Math.min(1,dt*9);continue;}const target=surface.kind==='roll-spoiler'?Math.max(0,roll*surface.side)*.72:surface.kind==='flap'?(p.gearDown?-.42:0)-Math.max(0,pitch)*.12:surface.kind==='aileron'?roll*surface.side*.42-(d.bomber?pitch*.24:0)+(d.aircraftId==='fa18e'?d.brakeAmount*.46:0):pitch*(surface.kind==='canard'?.4:-.48);surface.node.rotation.x+=(target-surface.node.rotation.x)*Math.min(1,dt*9)}

 for(const plume of d.flames){const{burner,throttle}=power;plume.scale.set(1+burner*.17,1+burner*.17,.15+throttle*.24+burner*1.7+Math.sin(time*37)*.025);plume.visible=!p.dead&&throttle>.13;plume.children.forEach((f,j)=>{f.material.opacity=(.09-j*.02)+burner*.44;f.material.color.setHex(burner?[0xff6c12,0xffa52b,0xffdc83][j]:[0x3d9fff,0x8ce7ff,0xe2f7ff][j])})}
 d.vapor.visible=power.vapor>.035;d.vapor.material.opacity=power.vapor*.14;d.vapor.scale.setScalar(.93+power.vapor*.13);d.beacon.visible=Math.sin(time*3.2)>.83;syncAircraftStores(model,p);
}
