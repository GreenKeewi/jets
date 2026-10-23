import {SUN_DIRECTION} from './seeker-environment.js?v=skybreak8-1023';
import * as THREE from './vendor/three.module.js';
import {terrainHeight,worldNoise,coastPoint,northernRidgeHeight,SEA_LEVEL,ISLANDS,TERRAIN_TILE_SIZE,TERRAIN_EDGE_SEGMENTS,TERRAIN_LOD_SEGMENTS} from './world.js?v=skybreak8-1023';
import {createAircraft} from './aircraft.js?v=skybreak8-1023';
import {AIRFIELDS,fieldPoint,fieldCoordinates,WORLD_BOUNDS} from './missions.js?v=skybreak8-1023';
const standard=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.88,metalness:.08,...extra});
function box(w,h,d,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return m}
function canvasTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function groundPatch(w,d,x,z,mat,rotation=0){const g=new THREE.PlaneGeometry(w,d,7,7);g.rotateX(-Math.PI/2);g.rotateY(rotation);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,terrainHeight(p.getX(i)+x,p.getZ(i)+z)+.35);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.position.set(x,0,z);return m}
function ribbon(points,width,mat,height=0.6){const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z))),p=[],ix=[],count=220;for(let i=0;i<=count;i++){const q=curve.getPoint(i/count),t=curve.getTangent(i/count);for(const side of[-1,1]){const x=q.x+t.z*side*width/2,z=q.z-t.x*side*width/2;p.push(x,terrainHeight(x,z)+height,z)}if(i<count){const n=i*2;ix.push(n,n+2,n+1,n+1,n+2,n+3)}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(ix);geo.computeVertexNormals();return new THREE.Mesh(geo,mat)}
function roof(width,depth,height,mat){const v=[-width/2,0,-depth/2,width/2,0,-depth/2,0,height,-depth/2,-width/2,0,depth/2,width/2,0,depth/2,0,height,depth/2],ix=[0,2,1,3,4,5,0,3,5,0,5,2,2,5,4,2,4,1];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();return new THREE.Mesh(g,mat)}
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
// All LODs keep the same 75 m edge samples. Only the interior is simplified,
// so adjacent tiles never open cracks when their detail level changes.
export function terrainTileGeometry(cx,cz,segments=TERRAIN_LOD_SEGMENTS[0]){
 const half=TERRAIN_TILE_SIZE/2,edge=TERRAIN_TILE_SIZE/TERRAIN_EDGE_SEGMENTS,inner=half-edge,positions=[],uv=[],colors=[],indices=[],color=new THREE.Color(),grass=new THREE.Color(0x8f9d70);
 function vertex(x,z){
  const wx=cx+x,wz=cz+z,h=terrainHeight(wx,wz),biome=ISLANDS.find(island=>Math.abs(wx-island.x)<island.rx+500&&Math.abs(wz-island.z)<island.rz+500)?.biome;
  positions.push(x,h,z);uv.push((wx-WORLD_BOUNDS.minX)/6000,(wz-WORLD_BOUNDS.minZ)/6000);
  color.setHex(h<SEA_LEVEL?0x689f8d:h<8?0xc8ba8d:h>1180?0xbfc4bc:h>650?0x89988d:h>155?0x718776:0x587e61);
  if(h>8&&biome==='volcanic')color.setHex(h>700?0x727875:0x63716a);
  else if(h>8&&biome==='dry')color.setHex(h>500?0x929184:0x929773);
  else if(h>8&&h<155)color.lerp(grass,Math.max(0,worldNoise(wx*2.6,wz*2.6))*.6);
  color.multiplyScalar(.88+worldNoise(wx*2,wz*2)*.12);colors.push(color.r,color.g,color.b);return positions.length/3-1;
 }
 function triangle(a,b,c){const area=(positions[b*3]-positions[a*3])*(positions[c*3+2]-positions[a*3+2])-(positions[b*3+2]-positions[a*3+2])*(positions[c*3]-positions[a*3]);if(Math.abs(area)>1e-8)indices.push(...(area<0?[a,b,c]:[a,c,b]));}
 const grid=[];for(let z=0;z<=segments;z++)for(let x=0;x<=segments;x++)grid.push(vertex(-inner+2*inner*x/segments,-inner+2*inner*z/segments));
 for(let z=0;z<segments;z++)for(let x=0;x<segments;x++){const a=z*(segments+1)+x,b=a+1,c=a+segments+1,d=c+1;triangle(a,c,b);triangle(b,c,d)}
 for(let side=0;side<4;side++){
  const outer=[],inside=[];for(let n=0;n<=TERRAIN_EDGE_SEGMENTS;n++){const q=-half+2*half*n/TERRAIN_EDGE_SEGMENTS;outer.push(vertex(side<2?q:side===2?-half:half,side<2?(side===0?-half:half):q))}
  for(let n=0;n<=segments;n++)inside.push(side===0?grid[n]:side===1?grid[segments*(segments+1)+n]:side===2?grid[n*(segments+1)]:grid[n*(segments+1)+segments]);
  let a=0,b=0;while(a<TERRAIN_EDGE_SEGMENTS||b<segments){if(b===segments||a<TERRAIN_EDGE_SEGMENTS&&(a+1)/TERRAIN_EDGE_SEGMENTS<=(b+1)/segments){triangle(outer[a],outer[a+1],inside[b]);a++}else{triangle(outer[a],inside[b+1],inside[b]);b++}}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
export function terrainTileCenters(){
 const centers=[],half=TERRAIN_TILE_SIZE/2;
 for(let cx=WORLD_BOUNDS.minX+half;cx<WORLD_BOUNDS.maxX;cx+=TERRAIN_TILE_SIZE)for(let cz=WORLD_BOUNDS.minZ+half;cz<WORLD_BOUNDS.maxZ;cz+=TERRAIN_TILE_SIZE){
  let land=false;for(let x=-half;x<=half&&!land;x+=600)for(let z=-half;z<=half;z+=600)if(terrainHeight(cx+x,cz+z)>SEA_LEVEL+1){land=true;break}
  if(land)centers.push({x:cx,z:cz});
 }
 return centers;
}
export class Scenery{
 constructor(scene){this.scene=scene;this.animated=[];this.setupSky();this.setupWater();this.setupSurfaceDetail();this.buildLand();this.buildAirport();for(const field of[AIRFIELDS.northpoint,AIRFIELDS.westhaven])this.buildRemoteAirport(field);for(const field of Object.values(AIRFIELDS))this.buildAirfieldDetails(field);this.buildVillage();this.buildLandmarks();this.buildRemoteLandmarks();this.buildDepot();}
 setupSky(){
  const scene=this.scene;scene.fog=new THREE.FogExp2(0xb5ced5,.000038);scene.add(new THREE.HemisphereLight(0xc1e3ff,0x70866d,1.7));const sunlight=new THREE.DirectionalLight(0xffe2b4,2.9);sunlight.position.set(-5500,4100,-6500);scene.add(sunlight);
  this.sky=new THREE.Mesh(new THREE.SphereGeometry(44000,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x276fa4)},horizon:{value:new THREE.Color(0xc6d9dc)},sunDir:{value:new THREE.Vector3(SUN_DIRECTION.x,SUN_DIRECTION.y,SUN_DIRECTION.z)}},vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 direction;uniform vec3 top;uniform vec3 horizon;uniform vec3 sunDir;void main(){vec3 d=normalize(direction);float h=max(0.,d.y);vec3 c=mix(horizon,top,pow(h,.38));float disk=pow(max(0.,dot(d,sunDir)),1400.);float halo=pow(max(0.,dot(d,sunDir)),18.)*.22;c+=vec3(1.,.72,.38)*(disk*2.8+halo);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));scene.add(this.sky);
  const cloudTextures=[1,2,3].map(index=>{const texture=new THREE.TextureLoader().load(`assets/cloud-volume-${index}.webp`);texture.colorSpace=THREE.SRGBColorSpace;return texture});
  this.clouds=[];for(let i=0;i<29;i++){const angle=i*2.399,r=3400+i*390;const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTextures[i%3],transparent:true,depthWrite:false,opacity:.82}));cloud.position.set(Math.sin(angle)*r,1450+hash(i)*1600,Math.cos(angle)*r);const width=1500+hash(i+70)*1700;cloud.scale.set(width,width*.47,1);scene.add(cloud);this.clouds.push(cloud)}
 }
 setupWater(){
  const wave=canvasTexture(256,256,(c,w,h)=>{const d=c.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4;d.data[k]=128+Math.sin(x*.29+y*.18)*36+Math.sin(x*.62-y*.39)*15;d.data[k+1]=128+Math.cos(y*.31+x*.12)*28;d.data[k+2]=238;d.data[k+3]=255}c.putImageData(d,0,0)});wave.colorSpace=THREE.NoColorSpace;wave.wrapS=wave.wrapT=THREE.RepeatWrapping;wave.repeat.set(170,170);this.wave=wave;
  const water=new THREE.Mesh(new THREE.PlaneGeometry(180000,180000),standard(0x1e698a,{roughness:.29,metalness:.3,normalMap:wave,normalScale:new THREE.Vector2(.48,.48)}));water.rotation.x=-Math.PI/2;water.position.y=SEA_LEVEL;this.scene.add(water);this.water=water;
  this.shoreMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-3,side:THREE.DoubleSide,uniforms:{time:{value:0}},vertexShader:'varying vec2 shore;varying vec3 point;void main(){shore=uv;point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 shore;varying vec3 point;uniform float time;void main(){float rim=shore.y;float wave=sin(rim*34.+time*1.2+sin(shore.x*90.)*1.8);float foam=smoothstep(.83,.99,wave)*pow(rim,2.)*.38;vec3 c=mix(vec3(.11,.48,.56),vec3(.31,.72,.66),pow(rim,.7));c=mix(c,vec3(.86,.94,.86),foam);gl_FragColor=vec4(c,pow(rim,.8)*.6);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  for(const {id:island} of ISLANDS){const coastGeo=new THREE.BufferGeometry(),points=[],uv=[],indices=[],count=420;for(let i=0;i<=count;i++){const angle=i/count*Math.PI*2;for(const distance of[-4,230]){const p=coastPoint(angle,distance,island);points.push(p.x,SEA_LEVEL+.15,p.z);uv.push(i/count,distance<0?1:0)}if(i<count){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2)}}coastGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));coastGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));coastGeo.setIndex(indices);this.scene.add(new THREE.Mesh(coastGeo,this.shoreMaterial));}
 }

 setupSurfaceDetail(){
  // Sparse 5–17 m whitecaps provide an honest nearby distance reference over water.
  // A fixed 25 × 25 lattice is recycled only on cell boundaries; samples never drift
  // with the camera, and cost remains one instanced draw even at Mach 2.
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,-.15,0,.48,.1,0,-.1,.5,0,.22,.1,0,-.1,-.15,0,.48],3));geometry.computeVertexNormals();
  this.whitecaps=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:0x8ab9bf,transparent:true,opacity:.37,depthWrite:false,side:THREE.DoubleSide}),625);this.whitecaps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.whitecaps.frustumCulled=false;this.whitecapMatrix=new THREE.Matrix4();this.whitecapScale=new THREE.Vector3();this.whitecapPosition=new THREE.Vector3();this.whitecapRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-.55);this.whitecapCell='';this.scene.add(this.whitecaps);
 }
 updateSurfaceDetail(camera,quality){
  this.whitecaps.visible=camera.position.y<1800&&quality>.7;if(!this.whitecaps.visible)return;
  const spacing=110,cx=Math.floor(camera.position.x/spacing),cz=Math.floor(camera.position.z/spacing),key=`${cx},${cz}`;this.whitecaps.material.opacity=.37*Math.max(0,Math.min(1,(1800-camera.position.y)/1000));if(key===this.whitecapCell)return;this.whitecapCell=key;
  let count=0;for(let ix=-12;ix<=12;ix++)for(let iz=-12;iz<=12;iz++){
   const xCell=cx+ix,zCell=cz+iz,seed=xCell*157.7+zCell*311.9,x=(xCell+.5)*spacing+(hash(seed)-.5)*70,z=(zCell+.5)*spacing+(hash(seed+17)-.5)*70;if(terrainHeight(x,z)>SEA_LEVEL-1)continue;
   this.whitecapPosition.set(x,SEA_LEVEL+.25,z);this.whitecapScale.set(5+hash(seed+41)*12,1,1+hash(seed+73)*2);this.whitecapMatrix.compose(this.whitecapPosition,this.whitecapRotation,this.whitecapScale);this.whitecaps.setMatrixAt(count++,this.whitecapMatrix);
  }
  this.whitecaps.count=count;this.whitecaps.instanceMatrix.needsUpdate=true;
 }

 buildLand(){
  const scene=this.scene,groundTex=canvasTexture(256,256,(ctx,w,h)=>{const image=ctx.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4,v=218+hash(x+y*w)*35+Math.sin(x*.07+Math.cos(y*.05))*3;image.data[k]=image.data[k+1]=image.data[k+2]=v;image.data[k+3]=255}ctx.putImageData(image,0,0)});groundTex.wrapS=groundTex.wrapT=THREE.RepeatWrapping;groundTex.repeat.set(30,30);
  const terrainMaterial=new THREE.MeshStandardMaterial({vertexColors:true,map:groundTex,roughness:1,metalness:0});this.terrainTiles=[];
  // Fine nearby terrain, mid-distance ridges and economical far silhouettes.
  // Every vertex is sampled from the same function used by aircraft collision.
  for(const center of terrainTileCenters()){
   const tile=new THREE.LOD();tile.position.set(center.x,0,center.z);tile.autoUpdate=false;
   for(let level=0;level<TERRAIN_LOD_SEGMENTS.length;level++){const mesh=new THREE.Mesh(terrainTileGeometry(center.x,center.z,TERRAIN_LOD_SEGMENTS[level]),terrainMaterial);mesh.visible=level===0;tile.addLevel(mesh,[0,11000,21000][level],.12)}
   scene.add(tile);this.terrainTiles.push(tile);
  }
  this.buildForests();
  const field=[standard(0x8a976c),standard(0x99966b),standard(0x708a63),standard(0x88986c)];for(let i=0;i<38;i++){const x=-930+(i%7)*192,z=-1530+Math.floor(i/7)*188;if(Math.hypot(x,z-700)<470)continue;scene.add(groundPatch(165+hash(i)*18,152,x,z,field[i%4],(hash(i+20)-.5)*.05))}
  scene.add(ribbon([[-1420,-2490],[-1100,-1780],[-880,-650],[-400,250],[560,1100],[1500,1570],[2500,1450]],17,standard(0x9f9d85)));
  scene.add(ribbon([[-1430,-2500],[-1210,-1900],[-930,-820],[-480,220],[530,1070]],1.5,standard(0xd0c7a1),.8));
 }
 buildForests(){
  const cells=new Map(),cellSize=2400,regions=[{x:-4300,z:-4600,w:8500,d:9200,count:2600,seed:0},{x:-4700,z:4600,w:13000,d:8700,count:3000,seed:10000},{x:-13200,z:800,w:7200,d:7600,count:2300,seed:20000},...ISLANDS.slice(3).filter(island=>island.biome!=='volcanic').map((island,index)=>({x:island.x-island.rx,z:island.z-island.rz,w:island.rx*2,d:island.rz*2,count:1200,seed:30000+index*10000}))];
  const palette=[0x345b49,0x426c50,0x52775a,0x638462];
  for(const region of regions)for(let n=0;n<region.count;n++){const i=n+region.seed,x=region.x+hash(i*3+1)*region.w,z=region.z+hash(i*3+2)*region.d,h=terrainHeight(x,z);if(h<9||h>950||worldNoise(x*2.7,z*2.7)<-.05||x>-1000&&x<1600&&z>-1600&&z<1500)continue;
   if(Object.values(AIRFIELDS).some(field=>{const p=fieldCoordinates(field,{x,z});return Math.abs(p.across-200)<970&&Math.abs(p.along)<field.halfLength+600}))continue;
   const key=`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`;if(!cells.has(key))cells.set(key,{cx:(Math.floor(x/cellSize)+.5)*cellSize,cz:(Math.floor(z/cellSize)+.5)*cellSize,crown:[],pine:[],trunk:[]});const cell=cells.get(key),height=11+hash(i+400)*22,pine=n%7===0,color=palette[n%palette.length];cell[pine?'pine':'crown'].push({x:x-cell.cx,y:h+height*(pine?.53:.8),z:z-cell.cz,sx:height*(pine?.32:.49),sy:height*(pine?1:.62),sz:height*(pine?.32:.46),rotation:hash(i+8)*6,color});if(n%2===0)cell.trunk.push({x:x-cell.cx,y:h+height*.3,z:z-cell.cz,sx:1,sy:height*.65,sz:1,rotation:0});
  }
  const geometry={crown:new THREE.IcosahedronGeometry(1,1),pine:new THREE.ConeGeometry(1,1,7),trunk:new THREE.CylinderGeometry(.7,1,1,5)},leaf=standard(0xffffff),wood=standard(0x69715a),matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion();this.forestCells=[];
  for(const cell of cells.values())for(const kind of['crown','pine','trunk']){const instances=cell[kind];if(!instances.length)continue;const mesh=new THREE.InstancedMesh(geometry[kind],kind==='trunk'?wood:leaf,instances.length);mesh.position.set(cell.cx,0,cell.cz);instances.forEach((p,index)=>{quaternion.setFromEuler(new THREE.Euler(0,p.rotation,0));matrix.compose(new THREE.Vector3(p.x,p.y,p.z),quaternion,new THREE.Vector3(p.sx,p.sy,p.sz));mesh.setMatrixAt(index,matrix);if(kind!=='trunk')mesh.setColorAt(index,new THREE.Color(p.color))});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();this.scene.add(mesh);this.forestCells.push(mesh)}
 }
 buildRemoteAirport(field){
  const group=new THREE.Group();group.position.set(field.x,field.elevation,field.z);group.rotation.y=field.heading;
  const asphalt=standard(0x354449),concrete=standard(0x9ba392),paint=standard(0xf0e8cc),yellow=standard(0xd8bf70),dark=standard(0x536b70),glass=standard(0x497e89,{metalness:.5});
  const runway=box(field.width*2,1,field.halfLength*2,asphalt,0,3,0);runway.name=`${field.id}-runway-pavement`;group.add(runway);group.add(box(48,1,field.halfLength*1.7,concrete,field.width+90,3,-50));group.add(box(420,1,340,concrete,310,3,-250));
  for(let z=-field.halfLength+120;z<field.halfLength-80;z+=100)group.add(box(3.5,.1,45,paint,0,3.6,z));for(const side of[-1,1]){group.add(box(2.5,.1,field.halfLength*2-40,paint,side*(field.width-8),3.6,0));for(let z=-field.halfLength;z<=field.halfLength;z+=85){const light=new THREE.Mesh(new THREE.SphereGeometry(1.4,5,4),new THREE.MeshBasicMaterial({color:0xfff1c6}));light.position.set(side*(field.width+4),4,z);group.add(light)}}for(const end of[-field.halfLength+65,field.halfLength-65])for(let n=-2;n<=2;n++)group.add(box(7,.1,65,paint,n*18,3.6,end));
  const texture=canvasTexture(256,256,c=>{c.fillStyle='#eee7cb';c.font='bold 166px sans-serif';c.textAlign='center';c.fillText(field.runway,128,198)}),number=new THREE.Mesh(new THREE.PlaneGeometry(65,65),new THREE.MeshBasicMaterial({map:texture,transparent:true}));number.rotation.x=-Math.PI/2;number.position.set(0,3.7,-field.halfLength+180);group.add(number);group.add(box(1.2,.1,field.halfLength*1.65,yellow,field.width+90,3.6,-50));group.add(box(220,.1,1.2,yellow,220,3.6,-250));
  for(let i=0;i<2;i++){const x=300+i*125;group.add(box(100,32,100,dark,x,19,-450));const r=roof(106,106,12,concrete);r.position.set(x,36,-450);group.add(r);group.add(box(78,24,1,standard(0x263e46),x,16,-399))}
  group.add(box(25,47,25,concrete,230,27,280));group.add(box(48,13,42,glass,230,57,280));group.add(box(52,3,46,dark,230,65,280));
  const parked=createAircraft(0,false);parked.position.set(310,7,-230);parked.rotation.y=Math.PI;parked.userData.flames.forEach(flame=>flame.visible=false);parked.userData.beacon.visible=false;group.add(parked);this.scene.add(group);
 }
 buildAirport(){
  const s=this.scene,asphalt=standard(0x354449),concrete=standard(0x9da596),paint=standard(0xf0e9cc),yellow=standard(0xd8c27c),dark=standard(0x4f6971),metal=standard(0x7e8f8d),glass=standard(0x417a88,{metalness:.55,roughness:.3});
  const field=AIRFIELDS.home,start=field.z-field.halfLength,end=field.z+field.halfLength;const runway=box(field.width*2,1,field.halfLength*2,asphalt,field.x,field.elevation+3,field.z);runway.name="home-runway-pavement";s.add(runway);s.add(box(68,1,1800,concrete,-1570,3,-2100));s.add(box(620,1,460,concrete,-1310,3,-2550));
  for(let z=start+50;z<end-50;z+=110)s.add(box(4,.1,48,paint,-1800,3.6,z));for(const side of[-1,1]){s.add(box(3,.1,field.halfLength*2-60,paint,field.x+side*(field.width-9),field.elevation+3.6,field.z));for(let z=start;z<=end;z+=80){const light=new THREE.Mesh(new THREE.SphereGeometry(1.5,5,4),new THREE.MeshBasicMaterial({color:0xfff1c6}));light.position.set(-1800+side*105,4,z);s.add(light)}}
  for(const threshold of[start+110,end-110])for(let i=-3;i<=3;i++)s.add(box(7,.1,80,paint,-1800+i*17,3.6,threshold));
  const numberTex=canvasTexture(256,256,c=>{c.fillStyle='#eee7cb';c.font='bold 168px sans-serif';c.textAlign='center';c.fillText('36',128,198)}),number=new THREE.Mesh(new THREE.PlaneGeometry(72,72),new THREE.MeshBasicMaterial({map:numberTex,transparent:true}));number.rotation.x=-Math.PI/2;number.position.set(field.x,field.elevation+3.7,start+210);s.add(number);
  s.add(box(1.2,.12,1750,yellow,-1570,3.6,-2100));for(let i=0;i<4;i++){const z=-2820+i*390;s.add(box(150,.1,2,yellow,-1660,3.7,z));}
  for(let i=0;i<4;i++){const x=-1390+i*118;s.add(box(100,35,125,dark,x,21,-2720));const r=roof(106,132,14,metal);r.position.set(x,39,-2720);s.add(r);s.add(box(79,24,1,standard(0x273d48),x,16,-2657));for(let n=0;n<5;n++)s.add(box(1,24,1.2,metal,x-34+n*17,16,-2656));s.add(box(84,2,1,paint,x,31,-2656));}
  s.add(box(36,75,36,concrete,-1510,41,-2220));s.add(box(72,19,62,glass,-1510,88,-2220));s.add(box(78,4,68,dark,-1510,100,-2220));s.add(box(2,19,2,metal,-1510,112,-2220));for(let side of[-1,1])s.add(box(3,20,60,metal,-1510+side*30,88,-2220));
  const parked=createAircraft(0,false);parked.position.set(-1360,7,-2465);parked.rotation.y=Math.PI;parked.userData.flames.forEach(p=>p.visible=false);parked.userData.beacon.visible=false;s.add(parked);const parked2=createAircraft(0,false);parked2.position.set(-1240,7,-2465);parked2.rotation.y=Math.PI;parked2.userData.flames.forEach(p=>p.visible=false);parked2.userData.beacon.visible=false;s.add(parked2);
  for(let i=0;i<3;i++){s.add(box(60,.1,1,yellow,-1360+i*120,3.7,-2480));s.add(box(1,.1,58,yellow,-1360+i*120,3.7,-2475));}
  // Windsock and runway signs reward a close look during takeoff and approach.
  s.add(box(.7,17,.7,metal,-1650,12,-2870));const sock=new THREE.Mesh(new THREE.CylinderGeometry(1.8,.8,12,12,1,true),standard(0xe7a075));sock.rotation.z=Math.PI/2-.12;sock.position.set(-1644,21,-2870);s.add(sock);this.animated.push({node:sock,kind:'windsock'});
  for(const z of[-2920,-1180]){const signTex=canvasTexture(256,80,c=>{c.fillStyle='#d2b567';c.fillRect(0,0,256,80);c.fillStyle='#233c43';c.font='bold 52px sans-serif';c.fillText(z<-2000?'A  →  36':'←  A   18',10,59)});const sign=new THREE.Mesh(new THREE.PlaneGeometry(22,7),new THREE.MeshBasicMaterial({map:signTex,side:THREE.DoubleSide}));sign.position.set(-1666,8,z);s.add(sign)}
 }
 buildAirfieldDetails(field){
  const group=new THREE.Group();group.name=`${field.id}-airfield-details`;group.position.set(field.x,field.elevation,field.z);group.rotation.y=field.heading;
  const paint=standard(0xf4eed8),yellow=standard(0xe4bd54),asphalt=standard(0x344349),concrete=standard(0xa9aea0),dark=standard(0x40555b),glass=standard(0x608c95,{metalness:.5,roughness:.25}),red=standard(0xb15b49),blue=standard(field.id==='northpoint'?0x5c7486:field.id==='westhaven'?0x6a968e:0x628080);
  const half=field.halfLength,width=field.width,home=field.id==='home',reciprocal=String((Number(field.runway)+17)%36+1).padStart(2,'0');
  const textPlane=(text,w,h,background,foreground='#f4edd9')=>{const texture=canvasTexture(Math.max(128,Math.min(1024,Math.round(128*w/h))),128,(c,tw,th)=>{if(background){c.fillStyle=background;c.fillRect(0,0,tw,th)}c.fillStyle=foreground;c.font='bold 72px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,tw/2,th/2)});return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:!background,side:THREE.DoubleSide}))};
  const number=textPlane(reciprocal,65,65);number.rotation.set(-Math.PI/2,0,Math.PI);number.position.set(0,3.72,half-180);group.add(number);
  // Aim-point blocks and paired touchdown marks make the landing zone readable.
  for(const end of[-1,1])for(const side of[-1,1]){
   group.add(box(13,.12,62,paint,side*36,3.7,end*(half-320)));
   for(const distance of[490,640])for(let n=0;n<2;n++)group.add(box(4,.12,30,paint,side*(31+n*10),3.7,end*(half-distance)));
  }
  // Low-profile inset approach and threshold lighting, never tall approach obstacles.
  const lights=[];for(const end of[-1,1]){
   for(let x=-width+8;x<=width-8;x+=15)lights.push({x,z:end*(half-4),color:0x69edab,y:4.1});
   for(let distance=80;distance<=640;distance+=80){const spread=distance===320?5:1;for(let n=-spread;n<=spread;n++){const x=n*11,z=end*(half+distance),world=fieldPoint(field,x,z);lights.push({x,z,y:Math.max(field.elevation+2,terrainHeight(world.x,world.z))-field.elevation+.8,color:0xffefd0})}}
   // PAPI-style visual cue is scenery only; its fixed white/red pattern is not flight guidance.
   for(let n=0;n<4;n++)lights.push({x:-width-42-n*9,z:end*(half-300),y:4.6,color:n<2?0xfff1d4:0xf85d4c});
  }
  const lightMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1.7,6,4),new THREE.MeshBasicMaterial({color:0xffffff}),lights.length),matrix=new THREE.Matrix4();
  lights.forEach((light,index)=>{matrix.makeTranslation(light.x,light.y,light.z);lightMesh.setMatrixAt(index,matrix);lightMesh.setColorAt(index,new THREE.Color(light.color))});lightMesh.instanceMatrix.needsUpdate=true;lightMesh.instanceColor.needsUpdate=true;lightMesh.computeBoundingSphere();group.add(lightMesh);
  // Parallel apron, gate stand markings and a terminal remain well outside the runway strip.
  const terminalX=home?730:650,terminalZ=home?180:170,apronX=home?600:530;
  group.add(box(home?520:420,1,460,concrete,apronX,3,terminalZ));group.add(box(terminalX-width-80,1,46,asphalt,(terminalX+width+80)/2,3,terminalZ-150));
  group.add(box(terminalX-width-80,.12,1.5,yellow,(terminalX+width+80)/2,3.7,terminalZ-150));
  const terminal=new THREE.Group();terminal.position.set(terminalX,0,terminalZ+130);
  terminal.add(box(home?220:180,home?29:23,78,concrete,0,home?18:15,0));terminal.add(box(home?224:184,3,84,blue,0,home?34:28,0));
  terminal.add(box(home?196:156,12,1.2,glass,0,19,-40));
  for(let n=-3;n<=3;n++)terminal.add(box(2,13,2,dark,n*23,19,-41));
  const terminalSign=textPlane(home?'COASTAL AIR BASE':field.shortName.toUpperCase(),home?164:146,13,'#263c46');terminalSign.position.set(0,home?32:28,-43);terminal.add(terminalSign);group.add(terminal);
  for(let n=0;n<3;n++){const x=apronX-120+n*100,z=terminalZ-25;group.add(box(1.5,.1,100,yellow,x,3.7,z));group.add(box(58,.1,1.5,yellow,x,3.7,z-50));group.add(box(20,.1,2,yellow,x,3.7,z+45));const stand=textPlane(String(n+1),14,14);stand.rotation.x=-Math.PI/2;stand.position.set(x,3.8,z+64);group.add(stand)}
  // Dashed hold-short lines sit on taxiway exits, not across the runway itself.
  for(const z of[-half+220,terminalZ-150]){for(const x of[width+38,width+43])group.add(box(1.5,.12,38,yellow,x,3.7,z));for(const x of[width+48,width+53])for(let n=-2;n<=2;n++)group.add(box(1.5,.12,5,yellow,x,3.7,z+n*8));const sign=textPlane(`${field.runway} – ${reciprocal}`,28,8,'#a43d32');sign.position.set(width+72,8,z+34);sign.rotation.y=-Math.PI/2;group.add(sign)}
  // Low service carts, fuel tanks and orange rescue vehicles give each apron scale.
  for(let i=0;i<3;i++){const x=terminalX-70+i*35,z=terminalZ+55;group.add(box(17,5,7,i===0?red:dark,x,6.5,z));group.add(box(6,4,7,glass,x-4,11,z));for(const dx of[-5,5])for(const dz of[-4,4]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,1.3,8),dark);wheel.rotation.x=Math.PI/2;wheel.position.set(x+dx,5,z+dz);group.add(wheel)}}
  if(field.id==='northpoint'){
   // Ridge station: blue-roof maintenance lodge and an off-apron radar dome.
   group.add(box(110,26,76,blue,650,16,-450));const r=roof(116,82,20,concrete);r.position.set(650,29,-450);group.add(r);group.add(box(16,15,16,dark,780,11,-430));const dome=new THREE.Mesh(new THREE.SphereGeometry(11,12,8),paint);dome.position.set(780,27,-430);group.add(dome);
  }else if(field.id==='westhaven'){
   // Island field: sea-green cargo sheds and a low red-and-white water tower.
   for(let i=0;i<3;i++)group.add(box(64,20,80,i===1?concrete:blue,610+i*82,13,-440));group.add(box(16,28,16,concrete,830,17,310));const tank=new THREE.Mesh(new THREE.CylinderGeometry(15,15,12,12),red);tank.position.set(830,36,310);group.add(tank);
  }else{
   // Home field: distinctive hardened maintenance hangar with wide striped doors.
   group.add(box(180,47,140,blue,770,27,-720));const hangarRoof=roof(188,148,22,concrete);hangarRoof.position.set(770,51,-720);group.add(hangarRoof);group.add(box(148,34,1.4,dark,770,23,-649));for(let n=0;n<7;n++)group.add(box(1.3,34,1.6,concrete,704+n*22,23,-648));
  }
  this.scene.add(group);
 }
 buildVillage(){
  const s=this.scene,walls=[standard(0xc5c4ac),standard(0xd0c7b0),standard(0xacb6a5)],roofs=[standard(0x75887f),standard(0x936d58),standard(0x6f8490)],window=standard(0x507d88,{roughness:.5}),street=standard(0x89958a);
  for(let i=0;i<42;i++){const x=420+(i%7)*91+(hash(i)-.5)*18,z=520+Math.floor(i/7)*103+(hash(i+7)-.5)*15,h=10+hash(i+5)*23,w=32+hash(i+18)*24,d=33+hash(i+19)*27,base=terrainHeight(x,z);s.add(box(w,h,d,walls[i%3],x,base+h/2,z));const r=roof(w+3,d+3,7+hash(i+10)*4,roofs[i%3]);r.position.set(x,base+h,z);s.add(r);for(let k=0;k<3;k++)s.add(box(3.8,5,.5,window,x-w*.3+k*w*.3,base+h*.6,z-d/2-.3));}
  for(let i=0;i<6;i++)s.add(groundPatch(650,8,705,470+i*103,street));for(let i=0;i<7;i++)s.add(groundPatch(8,680,375+i*91,770,street));
 }
 buildLandmarks(){
  const s=this.scene,stone=standard(0xa6afa1),white=standard(0xe1ded0),red=standard(0xb96e50),dark=standard(0x3b5965),wood=standard(0x8a8c74);
  const p=coastPoint(1.25,-155),base=terrainHeight(p.x,p.z),tower=new THREE.Group();tower.position.set(p.x,base,p.z);tower.add(new THREE.Mesh(new THREE.CylinderGeometry(7,11,48,16),white));tower.children[0].position.y=24;const band=new THREE.Mesh(new THREE.CylinderGeometry(8,8.6,9,16),red);band.position.y=31;tower.add(band);tower.add(box(18,7,18,dark,0,51,0));const cap=new THREE.Mesh(new THREE.ConeGeometry(15,10,16),red);cap.position.y=60;tower.add(cap);s.add(tower);s.add(box(35,12,25,white,p.x-33,base+6,p.z-15));
  const harbor=coastPoint(1.85,-70),h=terrainHeight(harbor.x,harbor.z);s.add(box(28,8,85,stone,harbor.x,h+3,harbor.z));for(let i=0;i<5;i++){const a=1.85+(i-2)*.024,q=coastPoint(a,75);const boat=new THREE.Group();const hull=new THREE.Mesh(new THREE.SphereGeometry(1,10,7),white);hull.scale.set(3.5,2.2,12);boat.add(hull);boat.add(box(.3,21,.3,dark,0,10,0));const sailGeom=new THREE.BufferGeometry();sailGeom.setAttribute('position',new THREE.Float32BufferAttribute([0,3,0,0,20,0,0,3,9],3));const sail=new THREE.Mesh(sailGeom,new THREE.MeshStandardMaterial({color:0xf0e9d0,side:THREE.DoubleSide}));boat.add(sail);boat.position.set(q.x,SEA_LEVEL+1,q.z);boat.rotation.y=hash(i)*2;s.add(boat);this.animated.push({node:boat,kind:'boat',baseY:boat.position.y,seed:i})}
  const radarBase={x:-2520,z:1710},rh=terrainHeight(radarBase.x,radarBase.z);s.add(box(35,9,25,stone,radarBase.x,rh+4.5,radarBase.z));const dome=new THREE.Mesh(new THREE.SphereGeometry(10,16,12),white);dome.position.set(radarBase.x,rh+16,radarBase.z);s.add(dome);
 }
 buildRemoteLandmarks(){
  const s=this.scene,walls=standard(0xc5c4ae),roofMaterial=standard(0x7a8e83),street=standard(0x929d87),glass=standard(0x4e7b84);
  for(const location of[{x:-9300,z:3500},{x:5400,z:10900}]){for(let i=0;i<18;i++){const x=location.x+(i%6)*75,z=location.z+Math.floor(i/6)*85,base=terrainHeight(x,z),height=12+hash(i+7)*16;s.add(box(38,height,40,walls,x,base+height/2,z));const r=roof(42,44,8,roofMaterial);r.position.set(x,base+height,z);s.add(r);s.add(box(4,5,.6,glass,x,base+height*.6,z-20.3))}s.add(ribbon([[location.x-100,location.z-70],[location.x+250,location.z-70],[location.x+530,location.z+250]],13,street));}
  s.add(ribbon([[-9900,4000],[-8800,4200],[-7800,5600],[-8800,6900]],15,street));s.add(ribbon([[4700,10300],[5500,10800],[6400,11900]],15,street));
  const tip=coastPoint(1.15,-120,'northpoint'),base=terrainHeight(tip.x,tip.z),tower=new THREE.Mesh(new THREE.CylinderGeometry(6,9,38,14),walls);tower.position.set(tip.x,base+19,tip.z);s.add(tower);s.add(box(16,7,16,glass,tip.x,base+42,tip.z));
 }
 buildDepot(){const group=new THREE.Group(),concrete=standard(0x788276),roofMat=standard(0x976d55),metal=standard(0xb2b8a8);group.position.set(0,4,700);group.add(box(245,1,245,standard(0x6f7c70)));group.add(box(170,25,100,concrete,0,13,0));const top=roof(176,106,12,roofMat);top.position.y=26;group.add(top);for(let i=0;i<3;i++){const tank=new THREE.Mesh(new THREE.CylinderGeometry(22,22,35,18),metal);tank.position.set(-115+i*50,18,-95);group.add(tank)}for(let i=0;i<5;i++)group.add(box(14,6,14,standard(0x8b7e61),65+i%2*20,4,-70+Math.floor(i/2)*20));this.depot=group;this.scene.add(group)}
 update(time,camera,quality=1){for(const tile of this.terrainTiles){tile.visible=Math.hypot(tile.position.x-camera.position.x,tile.position.z-camera.position.z)<38000;if(tile.visible)tile.update(camera)}this.updateSurfaceDetail(camera,quality);for(const chunk of this.forestCells){const dx=chunk.position.x-camera.position.x,dz=chunk.position.z-camera.position.z;chunk.visible=dx*dx+dz*dz+camera.position.y*camera.position.y<81000000}this.sky.position.copy(camera.position);this.wave.offset.x=time*.00045;this.wave.offset.y=time*.00013;this.shoreMaterial.uniforms.time.value=time;for(const o of this.animated){if(o.kind==='boat'){o.node.rotation.z=Math.sin(time*.8+o.seed)*.045;o.node.position.y=o.baseY+Math.sin(time*.7+o.seed)*.4}else if(o.kind==='windsock')o.node.rotation.y=Math.sin(time*.55)*.06}}
}

