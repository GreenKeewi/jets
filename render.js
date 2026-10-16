import * as THREE from './vendor/three.module.js';
import {RUNWAY,ROUTE,TARGET,ESCAPE,forward,bombSolution,canBomb,clamp} from './sim.js?v=world2-1016';
import {surfaceHeight} from './world.js?v=world2-1016';
import {routeFor,destinationFor,fieldPoint} from './missions.js?v=world2-1016';
import {Scenery} from './scenery.js?v=world2-1016';
import {createAircraft,animateAircraft} from './aircraft.js?v=world2-1016';
import {batchStatic} from './geometry.js?v=world2-1016';
export const makeJet=createAircraft;
const COLORS={mint:0x9cead6,orange:0xffac7a};
function canvasTexture(width,height,draw){const c=document.createElement('canvas');c.width=width;c.height=height;draw(c.getContext('2d'),width,height);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex}
function label(text,color='#c0f8e6',size=75){const map=canvasTexture(512,96,(c,w,h)=>{c.fillStyle='rgba(11,36,46,.8)';c.beginPath();c.roundRect(0,0,w,h,18);c.fill();c.fillStyle=color;c.font='bold 40px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2)});const node=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false}));node.scale.set(size,size*96/512,1);return node}
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(68,1,.8,45000);this.scenery=new Scenery(this.scene);
  batchStatic(this.scene,new Set([this.scenery.sky,this.scenery.water,this.scenery.depot,...this.scenery.animated.map(o=>o.node)]),2800);
  this.jets=new Map();this.effects=new Map();this.vortices=new Map();this.view='chase';this.followReady=false;this.slowFrames=0;this.adaptiveQuality=1;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.effectsGroup=new THREE.Group();this.scene.add(this.effectsGroup);this.dotGeometry=new THREE.SphereGeometry(1,10,7);this.missileGeometry=new THREE.CylinderGeometry(.45,.45,5.2,8);this.missileGeometry.rotateX(Math.PI/2);
  this.effectTexture=canvasTexture(128,128,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,248,217,1)');g.addColorStop(.27,'rgba(255,180,72,.95)');g.addColorStop(.65,'rgba(229,91,35,.65)');g.addColorStop(1,'rgba(118,67,42,0)');c.fillStyle=g;c.fillRect(0,0,w,h)});
  const shadowMap=canvasTexture(128,128,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,5,w/2,h/2,w/2);g.addColorStop(0,'rgba(12,36,41,.55)');g.addColorStop(.5,'rgba(12,36,41,.18)');g.addColorStop(1,'rgba(12,36,41,0)');c.fillStyle=g;c.fillRect(0,0,w,h)});this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
  this.rings=[];this.activeRouteId=null;
  this.targetMarker=this.marker(TARGET,'TARGET',COLORS.orange,155);this.escapeMarker=this.marker(ESCAPE,'ESCAPE',COLORS.mint,350);this.landingMarker=this.marker({x:RUNWAY.x,y:160,z:-3100},'RUNWAY 36',COLORS.mint,145);
  this.aim=new THREE.Mesh(new THREE.RingGeometry(36,40,48),new THREE.MeshBasicMaterial({color:COLORS.orange,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));this.aim.rotation.x=-Math.PI/2;this.scene.add(this.aim);
  window.addEventListener('resize',()=>this.resize());this.resize();
 }
 resize(){this.needsRender=true;this.renderer.setSize(innerWidth,innerHeight,false);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix()}
 setView(view){this.view=view;this.followReady=false;this.needsRender=true}
 marker(point,text,color,radius){const group=new THREE.Group(),ring=new THREE.Mesh(new THREE.TorusGeometry(radius,2.4,6,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65}));ring.rotation.x=Math.PI/2;group.add(ring);group.position.set(point.x,Math.max(10,point.y),point.z);this.scene.add(group);return group}

 updateRoute(game){if(this.activeRouteId===game.routeId)return;this.activeRouteId=game.routeId;for(const ring of this.rings)this.disposeAircraft(ring);this.rings=routeFor(game).map(point=>{const group=new THREE.Group(),ring=new THREE.Mesh(new THREE.TorusGeometry(140,3.5,8,64),new THREE.MeshBasicMaterial({color:COLORS.mint,transparent:true,opacity:.85}));group.add(ring);group.position.set(point.x,point.y,point.z);this.scene.add(group);return group});const destination=destinationFor(game),point=fieldPoint(destination,0,-1100,160);this.landingMarker.position.set(point.x,point.y,point.z);}

 updateCamera(p,dt){
  const f=forward(p),desired=new THREE.Vector3(),look=new THREE.Vector3();
  if(this.view==='cockpit'){desired.set(p.pos.x+f.x*7,p.pos.y+3.1+f.y*7,p.pos.z+f.z*7);look.copy(desired).addScaledVector(new THREE.Vector3(f.x,f.y,f.z),200)}
  else{const distance=p.bomber?64:45;desired.set(p.pos.x-f.x*distance,p.pos.y+12-f.y*distance,p.pos.z-f.z*distance);look.set(p.pos.x+f.x*95,p.pos.y+f.y*95+2,p.pos.z+f.z*95)}
  if(!this.followReady||this.lastFollowId!==p.id){this.camera.position.copy(desired);this.followReady=true}else{this.camera.position.x+=p.pos.x-this.lastFollowPosition.x;this.camera.position.y+=p.pos.y-this.lastFollowPosition.y;this.camera.position.z+=p.pos.z-this.lastFollowPosition.z;this.camera.position.lerp(desired,1-Math.exp(-dt*(this.view==='cockpit'?28:6)))}
  this.lastFollowId=p.id;this.lastFollowPosition={...p.pos};const tilt=this.reducedMotion?0:this.view==='cockpit'?p.roll*.48:0;this.camera.up.set(Math.sin(tilt),Math.cos(tilt),0);this.camera.lookAt(look);const desiredFov=(this.view==='cockpit'?76:67)+clamp((p.speed-95)/22,0,5);this.camera.fov+=(desiredFov-this.camera.fov)*Math.min(1,dt*4);this.camera.updateProjectionMatrix();
 }
 updateAircraft(g,p,dt){
  for(const pilot of g.pilots){let model=this.jets.get(pilot.id);if(model&&(model.userData.bomber!==pilot.bomber||model.userData.team!==pilot.team)){this.disposeAircraft(model);this.jets.delete(pilot.id);model=null}if(!model){model=createAircraft(pilot.team,pilot.bomber);this.scene.add(model);this.jets.set(pilot.id,model)}model.visible=!pilot.dead&&!(pilot.id===p.id&&this.view==='cockpit');model.position.set(pilot.pos.x,pilot.pos.y+(pilot.grounded?4:0),pilot.pos.z);model.rotation.set(-pilot.pitch,pilot.yaw,-pilot.roll,'YXZ');animateAircraft(model,pilot,g.time,dt);const detailed=pilot.id===p.id||Math.hypot(pilot.pos.x-p.pos.x,pilot.pos.y-p.pos.y,pilot.pos.z-p.pos.z)<1600;model.userData.detailed.visible=detailed;model.userData.distant.visible=!detailed;this.updateVortex(pilot,model,g.time)}
  for(const[id,model]of this.jets)if(!g.pilots.some(p=>p.id===id)){this.disposeAircraft(model);this.jets.delete(id)}
  const ground=surfaceHeight(p.pos.x,p.pos.z),height=p.pos.y-ground;this.shadow.visible=!p.dead&&height<230;this.shadow.position.set(p.pos.x+height*.45,ground+.6,p.pos.z+height*.35);this.shadow.scale.set(p.bomber?70:42,p.bomber?65:45,1);this.shadow.material.opacity=Math.max(0,.6-height/350);
 }
 disposeAircraft(model){const geometries=new Set(),materials=new Set(),textures=new Set();model.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.material)for(const m of(Array.isArray(node.material)?node.material:[node.material])){materials.add(m);if(m.map)textures.add(m.map)}});model.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose())}
 updateVortex(p,model,time){
  if(!this.vortices.has(p.id)){const pair=[];for(let side=0;side<2;side++){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(54*3),3));geometry.setDrawRange(0,0);const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xe6eee5,transparent:true,opacity:.25,depthWrite:false}));this.scene.add(line);pair.push({line,points:[],last:-1})}this.vortices.set(p.id,pair)}
  const active=!p.dead&&!p.grounded&&p.speed>115&&Math.abs(p.roll)>.25;
  const pair=this.vortices.get(p.id);model.updateMatrixWorld();for(let side=0;side<2;side++){const item=pair[side];if(time-item.last>.055){item.last=time;if(active){const point=model.userData.wingtips[side].clone().applyMatrix4(model.matrixWorld);item.points.unshift({point,time})}}item.points=item.points.filter(q=>time-q.time<1.8).slice(0,54);const pos=item.line.geometry.attributes.position;item.points.forEach((q,i)=>pos.setXYZ(i,q.point.x,q.point.y,q.point.z));pos.needsUpdate=true;item.line.geometry.setDrawRange(0,item.points.length);item.line.geometry.computeBoundingSphere();item.line.visible=item.points.length>1;item.line.material.opacity=active?.27:.13}
 }
 effectObject(key,type){let object=this.effects.get(key);if(object)return object;if(type==='line'){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(6),3));object=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xf0edda,transparent:true,opacity:.65,depthWrite:false}))}else if(type==='explosion')object=new THREE.Sprite(new THREE.SpriteMaterial({map:this.effectTexture,transparent:true,depthWrite:false}));else object=new THREE.Mesh(type==='missile'?this.missileGeometry:this.dotGeometry,new THREE.MeshBasicMaterial({color:0xffe4b3,transparent:true,depthWrite:false}));this.effectsGroup.add(object);this.effects.set(key,object);return object}
 updateEffects(g){
  const live=new Set();for(const missile of g.missiles){const key='missile'+missile.id;live.add(key);const node=this.effectObject(key,'missile');node.position.set(missile.pos.x,missile.pos.y,missile.pos.z);node.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(missile.dir.x,missile.dir.y,missile.dir.z));node.material.color.setHex(missile.type==='radar'?0xc9e5e5:0xf3dbc1);const lineKey='trail'+missile.id;live.add(lineKey);const line=this.effectObject(lineKey,'line'),a=line.geometry.attributes.position;a.setXYZ(0,missile.pos.x,missile.pos.y,missile.pos.z);a.setXYZ(1,missile.pos.x-missile.dir.x*125,missile.pos.y-missile.dir.y*125,missile.pos.z-missile.dir.z*125);a.needsUpdate=true;line.geometry.computeBoundingSphere();}
  for(const c of g.countermeasures){const key='counter'+c.id;live.add(key);const node=this.effectObject(key,'dot');node.position.set(c.pos.x,c.pos.y,c.pos.z);node.scale.setScalar(c.type==='flare'?2.3:1.1);node.material.color.setHex(c.type==='flare'?0xfff1b4:0xcfe1e4);node.material.opacity=1-c.age/c.life}
  for(const b of g.bombs){const key='bomb'+b.id;live.add(key);const node=this.effectObject(key,'dot');node.position.set(b.pos.x,b.pos.y,b.pos.z);node.scale.set(1.2,1.2,3);node.material.color.setHex(0x3b4b4c)}
  for(const e of g.effects){const key='effect'+e.id;live.add(key);const node=this.effectObject(key,'explosion'),size=(e.type==='target'?210:65)*Math.min(1,e.age*3);node.position.set(e.pos.x,e.pos.y,e.pos.z);node.scale.set(size,size,1);node.material.opacity=Math.max(0,1-e.age/e.life);node.material.color.setHex(e.age>e.life*.5?0x7d8b83:0xffffff)}
  for(const[key,node]of this.effects)if(!live.has(key)){node.removeFromParent();node.material.dispose();if(node.isLine)node.geometry.dispose();this.effects.delete(key)}
 }
 render(g,localId='host',dt=1/60){
  if(dt>.045)this.slowFrames++;else this.slowFrames=Math.max(0,this.slowFrames-1);if(this.slowFrames>45&&this.adaptiveQuality>.65){this.adaptiveQuality=.65;this.renderer.setPixelRatio(.65);this.resize()}
  if(this.lastGameTime!==undefined&&g.time<this.lastGameTime-.2)for(const pair of this.vortices.values())for(const item of pair){item.points=[];item.last=-1}this.lastGameTime=g.time;for(const[id,pair]of this.vortices)if(!g.pilots.some(p=>p.id===id)){pair.forEach(item=>{item.line.removeFromParent();item.line.geometry.dispose();item.line.material.dispose()});this.vortices.delete(id)}this.updateRoute(g);const p=g.pilots.find(q=>q.id===localId)||g.pilots[0];this.updateAircraft(g,p,dt);this.updateCamera(p,dt);this.scenery.update(g.time,this.camera);this.updateEffects(g);
  this.rings.forEach((ring,index)=>{ring.visible=g.mode==='freeflight'&&g.flightStage==='route'&&index>=g.routeIndex&&index<=g.routeIndex+1;ring.children[0].material.opacity=index===g.routeIndex?.85:.13;ring.lookAt(this.camera.position.x,ring.position.y,this.camera.position.z)});
  this.targetMarker.visible=g.mode==='strike'&&!g.bombed;this.escapeMarker.visible=g.mode==='strike'&&g.bombed;this.landingMarker.visible=g.mode==='freeflight'&&['approach','landed'].includes(g.flightStage);this.scenery.depot.scale.y=g.bombed?.25:1;
  this.aim.visible=g.mode==='strike'&&p.bomber&&!g.bombed;if(this.aim.visible){const impact=bombSolution(p);this.aim.position.set(impact.x,Math.max(4,surfaceHeight(impact.x,impact.z))+.65,impact.z);this.aim.material.color.setHex(canBomb(g,p)?COLORS.mint:COLORS.orange)}
  this.renderer.render(this.scene,this.camera);this.needsRender=false;return p;
 }
 project(point){const v=new THREE.Vector3(point.x,point.y,point.z).project(this.camera);return{x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight,visible:v.z<1&&v.z>-1&&Math.abs(v.x)<1.2&&Math.abs(v.y)<1.2,z:v.z}}
}
