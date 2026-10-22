import {viewAxes,gunMuzzle} from './view-axes.js?v=skybreak3-1022';
import {GUN} from './guns.js?v=skybreak3-1022';
import * as THREE from './vendor/three.module.js';
import {RUNWAY,ROUTE,TARGET,ESCAPE,forward,bombSolution,canBomb,clamp} from './sim.js?v=skybreak3-1022';
import {surfaceHeight} from './world.js?v=skybreak3-1022';
import {routeFor,destinationFor,fieldPoint} from './missions.js?v=skybreak3-1022';
import {Scenery} from './scenery.js?v=skybreak3-1022';
import {createAircraft,animateAircraft} from './aircraft.js?v=skybreak3-1022';
import {batchStatic} from './geometry.js?v=skybreak3-1022';
export const makeJet=createAircraft;
const COLORS={mint:0x9cead6,orange:0xffac7a};
function canvasTexture(width,height,draw){const c=document.createElement('canvas');c.width=width;c.height=height;draw(c.getContext('2d'),width,height);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex}
function label(text,color='#c0f8e6',size=75){const map=canvasTexture(512,96,(c,w,h)=>{c.fillStyle='rgba(11,36,46,.8)';c.beginPath();c.roundRect(0,0,w,h,18);c.fill();c.fillStyle=color;c.font='bold 40px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2)});const node=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false}));node.scale.set(size,size*96/512,1);return node}
// One draw call, no growing particle lists, and no camera-attached speed tunnel.
// Each wisp stays at its actual world position until it leaves the local air volume.
export const AIR_MOTION_BUDGET=48;
export function flightFov(speed,view='chase',reducedMotion=false){
 const base=view==='cockpit'?76:67,v=Number.isFinite(speed)?speed:0,t=clamp((v-100)/243,0,1),supersonic=clamp((v-343)/343,0,1);
 // Most of the peripheral opening happens on the way to Mach 1, not Mach 2.
 return base+(reducedMotion?0:(view==='cockpit'?8:10)*t*(2-t)+1.5*supersonic);
}
const airHash=n=>{const h=Math.sin(n*127.1+311.7)*43758.5453;return h-Math.floor(h)};
export class FlightAirMotion{
 constructor(scene){
  this.points=new Float64Array(AIR_MOTION_BUDGET*3);this.cycles=new Uint32Array(AIR_MOTION_BUDGET);this.ready=false;this.lastPosition=new THREE.Vector3();
  this.right=new THREE.Vector3();this.up=new THREE.Vector3();this.forward=new THREE.Vector3();this.direction=new THREE.Vector3();
  this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(AIR_MOTION_BUDGET*6),3).setUsage(THREE.DynamicDrawUsage));this.geometry.setDrawRange(0,0);
  this.material=new THREE.LineBasicMaterial({color:0xd2e8ea,transparent:true,opacity:0,depthWrite:false});this.lines=new THREE.LineSegments(this.geometry,this.material);this.lines.frustumCulled=false;scene.add(this.lines);
 }
 update(p,camera,time,reducedMotion=false,quality=1){
  const speed=Math.max(0,p.speed||0);this.lines.visible=!p.dead&&!p.grounded&&!reducedMotion&&speed>75;
  if(!this.lines.visible){this.ready=false;return}
  const origin=camera.position,count=quality<.8?24:AIR_MOTION_BUDGET,reset=!this.ready||this.pilotId!==p.id||time<this.lastTime||origin.distanceToSquared(this.lastPosition)>360000;
  camera.updateMatrixWorld();this.right.setFromMatrixColumn(camera.matrixWorld,0);this.up.setFromMatrixColumn(camera.matrixWorld,1);this.forward.setFromMatrixColumn(camera.matrixWorld,2).negate();
  const axes=forward(p);this.direction.set(axes.x,axes.y,axes.z);const aspect=camera.aspect,spread=Math.tan(camera.fov*Math.PI/360),positions=this.geometry.attributes.position,length=clamp(speed/80,.7,8.6);
  for(let i=0;i<count;i++){
   const k=i*3,dx=this.points[k]-origin.x,dy=this.points[k+1]-origin.y,dz=this.points[k+2]-origin.z,depth=dx*this.forward.x+dy*this.forward.y+dz*this.forward.z;
   if(reset||depth<12||depth>390||dx*dx+dy*dy+dz*dz>360000){
    // A sparse near-air layer gives readable parallax; these points still stay
    // fixed in world space and are passed at the aircraft's actual m/s.
    const seed=i+this.cycles[i]++*AIR_MOTION_BUDGET,near=i%3===0,z=near?55+airHash(seed+19)*55:reset?100+airHash(seed+19)*225:220+airHash(seed+19)*105,angle=airHash(seed+83)*Math.PI*2,radius=(near?.5:.36)+airHash(seed+179)*(near?.42:.67),x=Math.cos(angle)*z*spread*aspect*radius,y=Math.sin(angle)*z*spread*radius;
    this.points[k]=origin.x+this.forward.x*z+this.right.x*x+this.up.x*y;this.points[k+1]=origin.y+this.forward.y*z+this.right.y*x+this.up.y*y;this.points[k+2]=origin.z+this.forward.z*z+this.right.z*x+this.up.z*y;
   }
   // A short exposure streak describes real travelled distance, not a speed multiplier.
   positions.setXYZ(i*2,this.points[k],this.points[k+1],this.points[k+2]);positions.setXYZ(i*2+1,this.points[k]-this.direction.x*length,this.points[k+1]-this.direction.y*length,this.points[k+2]-this.direction.z*length);
  }
  positions.needsUpdate=true;this.geometry.setDrawRange(0,count*2);this.material.opacity=.035+clamp((speed-75)/268,0,1)*.12;
  this.ready=true;this.pilotId=p.id;this.lastTime=time;this.lastPosition.copy(origin);
 }
}
// Two fixed-buffer draws for confirmed impact sparks and damaged-airframe smoke.
// Smoke is world-anchored, with twelve reusable puffs per supported aircraft.
export const DAMAGE_SPARK_BUDGET=96;
export const DAMAGE_SMOKE_BUDGET=144;
const DAMAGE_AIRCRAFT_BUDGET=12,SMOKE_PER_AIRCRAFT=DAMAGE_SMOKE_BUDGET/DAMAGE_AIRCRAFT_BUDGET;
class DamageVisuals{
 constructor(scene){
  this.sparkGeometry=new THREE.BufferGeometry();
  this.sparkGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(DAMAGE_SPARK_BUDGET*6),3).setUsage(THREE.DynamicDrawUsage));
  this.sparkGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(DAMAGE_SPARK_BUDGET*6),3).setUsage(THREE.DynamicDrawUsage));
  this.sparkGeometry.setDrawRange(0,0);
  this.sparks=new THREE.LineSegments(this.sparkGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,toneMapped:false,depthWrite:false}));
  this.sparks.frustumCulled=false;scene.add(this.sparks);
  this.smokeGeometry=new THREE.BufferGeometry();
  this.smokeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(DAMAGE_SMOKE_BUDGET*3),3).setUsage(THREE.DynamicDrawUsage));
  this.smokeGeometry.setAttribute('puffSize',new THREE.Float32BufferAttribute(new Float32Array(DAMAGE_SMOKE_BUDGET),1).setUsage(THREE.DynamicDrawUsage));
  this.smokeGeometry.setAttribute('puffOpacity',new THREE.Float32BufferAttribute(new Float32Array(DAMAGE_SMOKE_BUDGET),1).setUsage(THREE.DynamicDrawUsage));
  this.smokeGeometry.setDrawRange(0,0);
  this.smokeMaterial=new THREE.ShaderMaterial({
   uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{pointScale:{value:1}}]),
   transparent:true,depthWrite:false,fog:true,
   vertexShader:`
    attribute float puffSize;
    attribute float puffOpacity;
    uniform float pointScale;
    varying float vOpacity;
    #include <fog_pars_vertex>
    void main(){
     vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
     gl_Position=projectionMatrix*mvPosition;
     gl_PointSize=clamp(puffSize*pointScale*projectionMatrix[1][1]/max(1.0,-mvPosition.z),1.0,80.0);
     vOpacity=puffOpacity;
     #include <fog_vertex>
    }`,
   fragmentShader:`
    varying float vOpacity;
    #include <fog_pars_fragment>
    void main(){
     float radius=length(gl_PointCoord-vec2(0.5))*2.0;
     float opacity=(1.0-smoothstep(0.12,1.0,radius))*vOpacity;
     if(opacity<0.008)discard;
     gl_FragColor=vec4(0.052,0.062,0.069,opacity);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
     #include <fog_fragment>
    }`
  });
  this.smoke=new THREE.Points(this.smokeGeometry,this.smokeMaterial);this.smoke.frustumCulled=false;scene.add(this.smoke);
  this.origins=new Float32Array(DAMAGE_SMOKE_BUDGET*3);this.born=new Float64Array(DAMAGE_SMOKE_BUDGET);this.life=new Float32Array(DAMAGE_SMOKE_BUDGET);this.severity=new Float32Array(DAMAGE_SMOKE_BUDGET);
  this.ids=new Array(DAMAGE_AIRCRAFT_BUDGET).fill(null);this.next=new Uint16Array(DAMAGE_AIRCRAFT_BUDGET);this.lastEmission=new Float64Array(DAMAGE_AIRCRAFT_BUDGET);this.lastPositions=new Float32Array(DAMAGE_AIRCRAFT_BUDGET*3);
  this.born.fill(-1);this.lastEmission.fill(-Infinity);this.lastTime=-1;this.game=null;
 }
 clearSlot(slot,id=null){
  this.born.fill(-1,slot*SMOKE_PER_AIRCRAFT,(slot+1)*SMOKE_PER_AIRCRAFT);this.next[slot]=0;this.lastEmission[slot]=-Infinity;this.ids[slot]=id;
 }
 updateSparks(g,camera,low){
  const positions=this.sparkGeometry.attributes.position,colors=this.sparkGeometry.attributes.color,budget=low?DAMAGE_SPARK_BUDGET/2:DAMAGE_SPARK_BUDGET,rangeSquared=(low?2200:3600)**2;
  let count=0;
  // Derive every streak from its confirmed host effect: no local hit prediction,
  // particle objects, or re-triggering when a network snapshot repeats an effect.
  for(let i=g.effects.length-1;i>=0&&count<budget;i--){
   const e=g.effects[i],gun=e.type==='gun-hit';if(!gun&&e.type!=='hit'&&e.type!=='collision')continue;
   const life=Math.min(e.life,gun?.16:.34),age=Math.max(0,e.age);if(age>=life)continue;
   const dx=e.pos.x-camera.position.x,dy=e.pos.y-camera.position.y,dz=e.pos.z-camera.position.z;if(dx*dx+dy*dy+dz*dz>rangeSquared)continue;
   const number=low?(gun?3:6):(gun?6:12),fade=(1-age/life)**2;
   for(let j=0;j<number&&count<budget;j++,count++){
    const seed=e.id*19+j*7,y=airHash(seed+3)*2-1,angle=airHash(seed+11)*Math.PI*2,radius=Math.sqrt(1-y*y),speed=(gun?24:48)+airHash(seed+29)*(gun?28:58),vx=Math.cos(angle)*radius*speed,vy=y*speed,vz=Math.sin(angle)*radius*speed,tail=Math.max(0,age-.032);
    positions.setXYZ(count*2,e.pos.x+vx*age,e.pos.y+vy*age-14*age*age,e.pos.z+vz*age);
    positions.setXYZ(count*2+1,e.pos.x+vx*tail,e.pos.y+vy*tail-14*tail*tail,e.pos.z+vz*tail);
    colors.setXYZ(count*2,fade,fade*.72,fade*.25);colors.setXYZ(count*2+1,fade*.7,fade*.24,fade*.045);
   }
  }
  positions.needsUpdate=true;colors.needsUpdate=true;this.sparkGeometry.setDrawRange(0,count*2);this.sparks.visible=count>0;
 }
 updateSmoke(g,camera,low,height){
  const positions=this.smokeGeometry.attributes.position,sizes=this.smokeGeometry.attributes.puffSize,opacities=this.smokeGeometry.attributes.puffOpacity,perAircraft=low?SMOKE_PER_AIRCRAFT/2:SMOKE_PER_AIRCRAFT,range=low?2200:3600;
  let count=0;
  for(let slot=0;slot<DAMAGE_AIRCRAFT_BUDGET;slot++){
   const p=g.pilots[slot],start=slot*SMOKE_PER_AIRCRAFT,k=slot*3;
   if(!p||p.dead||p.hp>=75||p.hp<=0){this.clearSlot(slot,p?.id??null);continue;}
   const dx=p.pos.x-camera.position.x,dy=p.pos.y-camera.position.y,dz=p.pos.z-camera.position.z,distance=Math.hypot(dx,dy,dz);
   if(distance>range){this.clearSlot(slot,p.id);continue;}
   // Changing seats, respawning, replaying or teleporting cannot join old trails.
   if(this.ids[slot]!==p.id||Math.hypot(p.pos.x-this.lastPositions[k],p.pos.y-this.lastPositions[k+1],p.pos.z-this.lastPositions[k+2])>700)this.clearSlot(slot,p.id);
   this.lastPositions[k]=p.pos.x;this.lastPositions[k+1]=p.pos.y;this.lastPositions[k+2]=p.pos.z;
   if(low)this.born.fill(-1,start+perAircraft,start+SMOKE_PER_AIRCRAFT);
   const damage=clamp((75-p.hp)/65,0,1),interval=low?.22:.13;
   if(g.time-this.lastEmission[slot]>=interval){
    const index=start+this.next[slot]%perAircraft,o=index*3,pitch=Math.cos(p.pitch),back=p.bomber?16:11;
    this.origins[o]=p.pos.x-Math.sin(p.yaw)*pitch*back;this.origins[o+1]=p.pos.y-Math.sin(p.pitch)*back+1;this.origins[o+2]=p.pos.z-Math.cos(p.yaw)*pitch*back;
    this.born[index]=g.time;this.life[index]=low?1.25:1.65;this.severity[index]=damage;this.next[slot]=(this.next[slot]+1)%perAircraft;this.lastEmission[slot]=g.time;
   }
   const distanceFade=1-clamp((distance-range*.7)/(range*.3),0,1);
   for(let j=0;j<perAircraft;j++){
    const index=start+j,age=g.time-this.born[index];if(this.born[index]<0||age<0||age>=this.life[index])continue;
    const o=index*3,t=age/this.life[index],strength=this.severity[index],drift=airHash(index+9)-.5;
    positions.setXYZ(count,this.origins[o]+drift*age*5,this.origins[o+1]+age*(3+strength*4),this.origins[o+2]+age*2);
    sizes.setX(count,(3+strength*3)+age*(6+strength*4));opacities.setX(count,(.2+strength*.25)*(1-t)*(1-t)*distanceFade);count++;
   }
  }
  positions.needsUpdate=true;sizes.needsUpdate=true;opacities.needsUpdate=true;this.smokeGeometry.setDrawRange(0,count);this.smoke.visible=count>0;this.smokeMaterial.uniforms.pointScale.value=height*.5;
 }
 update(g,camera,reducedMotion,quality,height){
  if(this.game!==g||g.time<this.lastTime||g.time-this.lastTime>2.5){for(let slot=0;slot<DAMAGE_AIRCRAFT_BUDGET;slot++)this.clearSlot(slot);}
  this.game=g;this.lastTime=g.time;
  // Keep the existing hit flash/HUD for reduced motion, without extra particles.
  if(reducedMotion){this.sparks.visible=false;this.smoke.visible=false;for(let slot=0;slot<DAMAGE_AIRCRAFT_BUDGET;slot++)this.clearSlot(slot);return;}
  const low=quality<.8;this.updateSparks(g,camera,low);this.updateSmoke(g,camera,low,height);
 }
}
// Attract camera uses the same aircraft and airport scene as gameplay, never a prerendered image.
export function menuCameraPose(p,time=0,reducedMotion=false){
 const a=(p.yaw||0)-.65+(reducedMotion?0:Math.sin(time*.07)*.1),radius=p.bomber?135:78,offset=p.bomber?34:20,right={x:Math.cos(a),z:-Math.sin(a)};
 return{position:{x:p.pos.x+Math.sin(a)*radius,y:p.pos.y+(p.bomber?38:24),z:p.pos.z+Math.cos(a)*radius},target:{x:p.pos.x-right.x*offset,y:p.pos.y+7,z:p.pos.z-right.z*offset},fov:46};
}
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.maxPixelRatio=Math.min(devicePixelRatio,1.5);this.pixelRatio=this.maxPixelRatio;this.renderer.setPixelRatio(this.pixelRatio);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(68,1,.8,45000);this.scenery=new Scenery(this.scene);
  batchStatic(this.scene,new Set([this.scenery.sky,this.scenery.water,this.scenery.depot,...this.scenery.terrainTiles,...this.scenery.animated.map(o=>o.node)]),2800);
  this.jets=new Map();this.effects=new Map();this.vortices=new Map();this.view='chase';this.menuPreview=false;this.menuTime=0;this.followReady=false;this.frameAverage=1/60;this.slowSeconds=0;this.fastSeconds=0;this.qualityCooldown=4;this.adaptiveQuality=1;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.gunGeometry=new THREE.BufferGeometry();this.gunGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(GUN.maxRounds*6),3).setUsage(THREE.DynamicDrawUsage));this.gunGeometry.setDrawRange(0,0);this.gunTracers=new THREE.LineSegments(this.gunGeometry,new THREE.LineBasicMaterial({color:0xffed9c,transparent:true,opacity:1,toneMapped:false,depthWrite:false}));this.gunTracers.frustumCulled=false;this.scene.add(this.gunTracers);
  this.airMotion=new FlightAirMotion(this.scene);this.damageVisuals=new DamageVisuals(this.scene);this.muzzleFlashes=new Map();this.effectsGroup=new THREE.Group();this.scene.add(this.effectsGroup);this.dotGeometry=new THREE.SphereGeometry(1,10,7);this.missileGeometry=new THREE.CylinderGeometry(.45,.45,5.2,8);this.missileGeometry.rotateX(Math.PI/2);
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
  if(this.menuPreview){this.menuTime+=dt;const pose=menuCameraPose(p,this.menuTime,this.reducedMotion);this.camera.position.set(pose.position.x,pose.position.y,pose.position.z);this.camera.up.set(0,1,0);this.camera.lookAt(pose.target.x,pose.target.y,pose.target.z);this.camera.fov=pose.fov;this.camera.updateProjectionMatrix();this.followReady=false;return;}
  const f=forward(p),desired=new THREE.Vector3(),look=new THREE.Vector3();
  if(this.view==='cockpit'){desired.set(p.pos.x+f.x*7,p.pos.y+3.1+f.y*7,p.pos.z+f.z*7);look.copy(desired).addScaledVector(new THREE.Vector3(f.x,f.y,f.z),200)}
  else{const distance=p.bomber?64:45;desired.set(p.pos.x-f.x*distance,p.pos.y+12-f.y*distance,p.pos.z-f.z*distance);look.set(p.pos.x+f.x*95,p.pos.y+f.y*95+2,p.pos.z+f.z*95)}
  if(!this.followReady||this.lastFollowId!==p.id){this.camera.position.copy(desired);this.followReady=true}else{this.camera.position.x+=p.pos.x-this.lastFollowPosition.x;this.camera.position.y+=p.pos.y-this.lastFollowPosition.y;this.camera.position.z+=p.pos.z-this.lastFollowPosition.z;this.camera.position.lerp(desired,1-Math.exp(-dt*(this.view==='cockpit'?28:6)))}
  this.lastFollowId=p.id;this.lastFollowPosition={...p.pos};const tilt=this.view==='cockpit'?p.roll:0;const up=viewAxes(p,tilt).up;this.camera.up.set(up.x,up.y,up.z);this.camera.lookAt(look);const desiredFov=flightFov(p.speed,this.view,this.reducedMotion);this.camera.fov+=(desiredFov-this.camera.fov)*Math.min(1,dt*4);this.camera.updateProjectionMatrix();
 }
 updateAircraft(g,p,dt){
  for(const pilot of g.pilots){let model=this.jets.get(pilot.id);if(model&&(model.userData.bomber!==pilot.bomber||model.userData.team!==pilot.team)){this.disposeAircraft(model);this.jets.delete(pilot.id);model=null}if(!model){model=createAircraft(pilot.team,pilot.bomber);this.scene.add(model);this.jets.set(pilot.id,model)}model.visible=!pilot.dead&&!(pilot.id===p.id&&this.view==='cockpit'&&!this.menuPreview);model.position.set(pilot.pos.x,pilot.pos.y+(pilot.grounded?4:0),pilot.pos.z);model.rotation.set(-pilot.pitch,pilot.yaw,-pilot.roll,'YXZ');animateAircraft(model,pilot,g.time,dt);const detailed=pilot.id===p.id||Math.hypot(pilot.pos.x-p.pos.x,pilot.pos.y-p.pos.y,pilot.pos.z-p.pos.z)<1600;model.userData.detailed.visible=detailed;model.userData.distant.visible=!detailed;this.updateVortex(pilot,model,g.time)}
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
  for(const p of g.pilots){let flash=this.muzzleFlashes.get(p.id);if(!flash){flash=new THREE.Sprite(new THREE.SpriteMaterial({map:this.effectTexture,color:0xffe7a6,transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));this.scene.add(flash);this.muzzleFlashes.set(p.id,flash)}flash.visible=!p.dead&&p.gunShots>0&&p.gunCD>.045;const muzzle=gunMuzzle(p);flash.position.set(muzzle.x,muzzle.y,muzzle.z);flash.scale.setScalar(1.5+(p.gunCD/.1)*.8);flash.material.opacity=.85;}for(const[id,flash]of this.muzzleFlashes)if(!g.pilots.some(p=>p.id===id)){flash.removeFromParent();flash.material.dispose();this.muzzleFlashes.delete(id)}
  const rounds=(g.bullets||[]).slice(0,GUN.maxRounds),positions=this.gunGeometry.attributes.position;rounds.forEach((r,i)=>{positions.setXYZ(i*2,r.pos.x,r.pos.y,r.pos.z);positions.setXYZ(i*2+1,r.pos.x-r.dir.x*GUN.tracerLength,r.pos.y-r.dir.y*GUN.tracerLength,r.pos.z-r.dir.z*GUN.tracerLength)});positions.needsUpdate=true;this.gunGeometry.setDrawRange(0,rounds.length*2);this.gunTracers.visible=rounds.length>0;
  const live=new Set();for(const missile of g.missiles){const key='missile'+missile.id;live.add(key);const node=this.effectObject(key,'missile');node.position.set(missile.pos.x,missile.pos.y,missile.pos.z);node.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(missile.dir.x,missile.dir.y,missile.dir.z));node.material.color.setHex(missile.type==='radar'?0xc9e5e5:0xf3dbc1);const lineKey='trail'+missile.id;live.add(lineKey);const line=this.effectObject(lineKey,'line'),a=line.geometry.attributes.position;a.setXYZ(0,missile.pos.x,missile.pos.y,missile.pos.z);a.setXYZ(1,missile.pos.x-missile.dir.x*125,missile.pos.y-missile.dir.y*125,missile.pos.z-missile.dir.z*125);a.needsUpdate=true;line.geometry.computeBoundingSphere();}
  for(const c of g.countermeasures){const key='counter'+c.id;live.add(key);const node=this.effectObject(key,'dot');node.position.set(c.pos.x,c.pos.y,c.pos.z);node.scale.setScalar(c.type==='flare'?2.3:1.1);node.material.color.setHex(c.type==='flare'?0xfff1b4:0xcfe1e4);node.material.opacity=1-c.age/c.life}
  for(const b of g.bombs){const key='bomb'+b.id;live.add(key);const node=this.effectObject(key,'dot');node.position.set(b.pos.x,b.pos.y,b.pos.z);node.scale.set(1.2,1.2,3);node.material.color.setHex(0x3b4b4c)}
  for(const e of g.effects){if(e.type==='gun-hit'&&!this.reducedMotion)continue;const key='effect'+e.id;live.add(key);const node=this.effectObject(key,'explosion'),size=(e.type==='target'?210:e.type==='gun-hit'?10:65)*Math.min(1,e.age*3);node.position.set(e.pos.x,e.pos.y,e.pos.z);node.scale.set(size,size,1);node.material.opacity=Math.max(0,1-e.age/e.life);node.material.color.setHex(e.age>e.life*.5?0x7d8b83:0xffffff)}
  for(const[key,node]of this.effects)if(!live.has(key)){node.removeFromParent();node.material.dispose();if(node.isLine)node.geometry.dispose();this.effects.delete(key)}
 }
 updateQuality(seconds){
  // Ignore resume/loading gaps. Sustained sub-30 fps eases resolution one small
  // step at a time; recovery needs a much longer, clearly faster interval.
  if(!Number.isFinite(seconds)||seconds<=0||seconds>.25||document.hidden){this.slowSeconds=0;this.fastSeconds=0;return;}
  this.frameAverage+=(seconds-this.frameAverage)*(1-Math.exp(-seconds/1.2));this.qualityCooldown=Math.max(0,this.qualityCooldown-seconds);
  this.slowSeconds=this.frameAverage>1/30?this.slowSeconds+seconds:Math.max(0,this.slowSeconds-seconds*2);
  this.fastSeconds=this.frameAverage<1/52?this.fastSeconds+seconds:0;
  if(this.qualityCooldown>0)return;
  let next=this.pixelRatio;
  if(this.slowSeconds>2.2)next=Math.max(Math.min(.65,this.maxPixelRatio),next-.15);
  else if(this.fastSeconds>10)next=Math.min(this.maxPixelRatio,next+.1);
  if(Math.abs(next-this.pixelRatio)<.001)return;
  this.pixelRatio=next;this.adaptiveQuality=Math.min(1,next);this.renderer.setPixelRatio(next);this.resize();
  this.slowSeconds=0;this.fastSeconds=0;this.qualityCooldown=5;
 }
 render(g,localId='host',dt=1/60,frameSeconds=dt){
  this.updateQuality(frameSeconds);
  if(this.lastGameTime!==undefined&&g.time<this.lastGameTime-.2)for(const pair of this.vortices.values())for(const item of pair){item.points=[];item.last=-1}this.lastGameTime=g.time;for(const[id,pair]of this.vortices)if(!g.pilots.some(p=>p.id===id)){pair.forEach(item=>{item.line.removeFromParent();item.line.geometry.dispose();item.line.material.dispose()});this.vortices.delete(id)}this.updateRoute(g);const p=g.pilots.find(q=>q.id===localId)||g.pilots[0];this.updateAircraft(g,p,dt);this.updateCamera(p,dt);this.scenery.update(g.time,this.camera,this.adaptiveQuality);this.airMotion.update(p,this.camera,g.time,this.reducedMotion,this.adaptiveQuality);this.updateEffects(g);this.damageVisuals.update(g,this.camera,this.reducedMotion,this.adaptiveQuality,this.canvas.height);
  this.rings.forEach((ring,index)=>{ring.visible=g.mode==='freeflight'&&g.flightStage==='route'&&index>=g.routeIndex&&index<=g.routeIndex+1;ring.children[0].material.opacity=index===g.routeIndex?.85:.13;ring.lookAt(this.camera.position.x,ring.position.y,this.camera.position.z)});
  this.targetMarker.visible=g.mode==='strike'&&!g.bombed;this.escapeMarker.visible=g.mode==='strike'&&g.bombed;this.landingMarker.visible=g.mode==='freeflight'&&['approach','landed'].includes(g.flightStage);this.scenery.depot.scale.y=g.bombed?.25:1;
  this.aim.visible=g.mode==='strike'&&p.bomber&&!g.bombed;if(this.aim.visible){const impact=bombSolution(p);this.aim.position.set(impact.x,Math.max(4,surfaceHeight(impact.x,impact.z))+.65,impact.z);this.aim.material.color.setHex(canBomb(g,p)?COLORS.mint:COLORS.orange)}
  this.renderer.render(this.scene,this.camera);this.needsRender=false;return p;
 }
 project(point){const v=new THREE.Vector3(point.x,point.y,point.z).project(this.camera);return{x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight,visible:v.z<1&&v.z>-1&&Math.abs(v.x)<1.2&&Math.abs(v.y)<1.2,z:v.z}}
}

