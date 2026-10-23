import * as THREE from './vendor/three.module.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
// Original low-poly cockpit. Eye-space rendering keeps near geometry independent
// of the world's kilometre-scale depth range and the speed-dependent outside FOV.
export class CockpitInterior{
 constructor(){
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(58,1,.05,20);this.root=new THREE.Group();this.scene.add(this.root);
  this.scene.add(new THREE.HemisphereLight(0xc6e8e6,0x19232c,2.2));const light=new THREE.DirectionalLight(0xffe8c7,2);light.position.set(-3,5,1);this.scene.add(light);
  const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.9,metalness:.15});
  const shell=mat(0x1b2b32),edge=mat(0x4c6267),cloth=mat(0x59644d),seam=mat(0x82876c),boot=mat(0x3b4544),metal=mat(0x87958c),black=mat(0x101a20),amber=mat(0xc99651);
  const box=(parent,size,pos,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(...size),m);o.position.set(...pos);parent.add(o);return o};
  const rod=(parent,a,b,r,m)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,av.distanceTo(bv),10),m);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());parent.add(o);return o};
  box(this.root,[2.5,.1,2],[0,-1.05,-1.3],shell);
  box(this.root,[2.5,.85,.08],[0,-.82,-2.55],shell);
  for(const side of [-1,1]){
   box(this.root,[.43,.23,1.8],[side*.88,-.77,-1.25],shell);
   rod(this.root,[side*1.12,-.58,-.45],[side*.96,-.22,-2.5],.045,edge);
   // Fabric thighs, bent knees, shins and independent boots on rudder pedals.
   rod(this.root,[side*.29,-.92,-.65],[side*.35,-.63,-1.3],.16,cloth);
   rod(this.root,[side*.35,-.63,-1.3],[side*.28,-.69,-2.1],.12,cloth);
   box(this.root,[.22,.035,.19],[side*.35,-.49,-1.27],seam);
   const foot=new THREE.Group();foot.position.set(side*.28,-.70,-2.12);this.root.add(foot);
   box(foot,[.24,.16,.4],[0,0,0],boot);box(foot,[.26,.025,.43],[0,-.09,0],metal);(this.feet??=[]).push(foot);
   for(let j=0;j<5;j++){box(this.root,[.07,.04,.07],[side*.9,-.635,-1.9+j*.13],j===0?amber:metal);}
  }
  box(this.root,[.32,.08,.6],[-.68,-.62,-1.1],black);
  this.throttle=new THREE.Group();this.throttle.position.set(-.68,-.59,-.95);this.root.add(this.throttle);
  rod(this.throttle,[0,0,0],[0,.19,0],.025,metal);box(this.throttle,[.23,.1,.14],[0,.22,0],black);box(this.throttle,[.16,.015,.08],[0,.278,0],amber);
  box(this.root,[.28,.12,.32],[0,-.88,-1.1],black);
  this.stick=new THREE.Group();this.stick.position.set(0,-.82,-1.1);this.root.add(this.stick);
  rod(this.stick,[0,0,0],[0,.34,0],.035,metal);rod(this.stick,[0,.3,0],[0,.47,0],.065,black);box(this.stick,[.035,.025,.035],[.025,.49,0],amber);
  // Narrow side walls imply a seated enclosure without covering the aiming area.
  this.pose={pitch:0,roll:0,yaw:0,throttle:0};
  this.fighterRoot=this.root;this.bomber=buildBomber();this.scene.add(this.bomber.root);this.bomber.root.visible=false;this.activeType='fighter';
 }
 update(p,dt=1/60){
  this.activeType=p.bomber?'bomber':'fighter';this.fighterRoot.visible=!p.bomber;this.bomber.root.visible=!!p.bomber;
  const input=p.controlInput||{},a=1-Math.exp(-Math.max(0,dt)*16);
  for(const key of ['pitch','roll','yaw'])this.pose[key]+=(clamp(input[key],-1,1)-this.pose[key])*a;
  this.pose.throttle+=(clamp(p.throttle,0,1)-this.pose.throttle)*a;
  this.stick.rotation.x=this.pose.pitch*.24;this.stick.rotation.z=this.pose.roll*.27;
  this.throttle.position.z=-.88-this.pose.throttle*.34;
  for(const stick of this.bomber.sticks){stick.rotation.x=this.pose.pitch*.20;stick.rotation.z=this.pose.roll*.24;}
  for(const throttle of this.bomber.throttles)throttle.rotation.x=-.35+this.pose.throttle*.7;
  this.bomber.feet.forEach((foot,i)=>{foot.position.z=-2.05+(i?1:-1)*this.pose.yaw*.08;foot.rotation.x=(i?1:-1)*this.pose.yaw*.1;});
  this.feet.forEach((foot,i)=>{foot.position.z=-2.12+(i?1:-1)*this.pose.yaw*.09;foot.rotation.x=(i?1:-1)*this.pose.yaw*.12;});
 }
 render(renderer,p,aspect,dt){
  this.camera.aspect=aspect;this.camera.updateProjectionMatrix();this.root.scale.x=Math.min(1,aspect/1.4);this.bomber.root.scale.x=Math.min(1,aspect/1.5);this.update(p,dt);
  const autoClear=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(this.scene,this.camera);renderer.autoClear=autoClear;
 }
}

// Separate broad flight deck, viewed from the left seat. Original geometry;
// no fighter tub or fighter canopy is used for the bomber.
function buildBomber(){
 const root=new THREE.Group(),sticks=[],throttles=[],feet=[];
 const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.9,metalness:.12});
 const shell=mat(0x242a2e),rim=mat(0x60676a),black=mat(0x0d1115),cloth=mat(0x5b6254),strap=mat(0x8b9180),metal=mat(0x98a29c),amber=mat(0xe3b870);
 const box=(parent,size,pos,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(...size),m);o.position.set(...pos);parent.add(o);return o};
 const rod=(parent,a,b,r,m)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,av.distanceTo(bv),10),m);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());parent.add(o);return o};
 box(root,[3.7,.1,2.1],[.5,-1.02,-1.5],shell);
 box(root,[3.8,.8,.15],[.45,-.78,-2.5],shell);
 box(root,[3.9,.09,.32],[.45,-.32,-2.48],black);
 // Angled, split front windows. The center post is right of the pilot sightline.
 rod(root,[-1.48,-.28,-2.5],[-1.08,.86,-2.15],.052,rim);
 rod(root,[.73,-.28,-2.5],[.59,.86,-2.15],.043,shell);
 rod(root,[2.25,-.28,-2.5],[1.88,.86,-2.15],.052,rim);
 rod(root,[-1.08,.86,-2.15],[1.88,.86,-2.15],.065,shell);
 box(root,[3.4,.4,.6],[.4,1.12,-2.05],shell);
 // Central pedestal and an unoccupied right seat make the side-by-side layout legible.
 box(root,[.48,.35,1.3],[.64,-.84,-1.37],shell);
 for(let row=0;row<5;row++)for(let col=0;col<3;col++)box(root,[.055,.025,.045],[.5+col*.12,-.65,-1.8+row*.12],row===0?amber:metal);
 const seat=new THREE.Group();seat.position.set(1.04,-.92,-1.8);root.add(seat);
 box(seat,[.54,.15,.64],[0,.04,0],black);box(seat,[.55,.65,.14],[0,.4,.28],black);
 box(seat,[.12,.5,.025],[-.12,.4,.19],strap);box(seat,[.12,.5,.025],[.12,.4,.19],strap);
 for(const side of [-1,1]){
  rod(root,[side*.23,-.94,-.65],[side*.29,-.67,-1.34],.135,cloth);
  rod(root,[side*.29,-.67,-1.34],[side*.22,-.7,-2.02],.095,cloth);
  const foot=new THREE.Group();foot.position.set(side*.22,-.72,-2.05);root.add(foot);feet.push(foot);
  box(foot,[.21,.15,.34],[0,0,0],black);box(foot,[.23,.025,.37],[0,-.085,0],metal);
 }
 for(const x of [0,1.14]){
  const stick=new THREE.Group();stick.position.set(x,-.9,-1.42);root.add(stick);sticks.push(stick);
  rod(stick,[0,0,0],[0,.39,.03],.028,rim);rod(stick,[0,.36,.03],[0,.5,.035],.047,black);box(stick,[.025,.02,.03],[.018,.52,.035],amber);
 }
 // Each station has a compact bank of four levers on its left side; the game
 // commands them together because its bomber has one throttle axis.
 for(const x of [-.64,.58]){
  box(root,[.31,.12,.52],[x,-.71,-1.24],shell);
  for(let n=0;n<4;n++){
   const lever=new THREE.Group();lever.position.set(x+(n-1.5)*.065,-.64,-1.24);root.add(lever);throttles.push(lever);
   rod(lever,[0,0,0],[0,.18,0],.012,metal);box(lever,[.055,.045,.09],[0,.2,0],black);box(lever,[.038,.008,.065],[0,.225,0],amber);
  }
 }
 return{root,sticks,throttles,feet,seat};
}
