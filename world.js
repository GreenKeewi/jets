import {AIRFIELDS,fieldCoordinates} from './missions.js?v=skybreak14-1023';
import {valleyTerrain} from './arenas.js?v=skybreak14-1023';
export const SEA_LEVEL=-5;
// Translate the whole authored island with its airfield, keeping runway relief coherent.
export const NORTHPOINT_SHIFT=Object.freeze({x:AIRFIELDS.northpoint.x-4200,z:AIRFIELDS.northpoint.z-10300});
// Original coastal region plus five distant islands, all inside a 72 × 72 km sea.
// These definitions drive both shore meshes and the actual collision heightfield.
export const ISLANDS=Object.freeze([
 {id:'home',name:'Coastal Island',x:-300,z:0,rx:4200,rz:4600,biome:'temperate'},
 {id:'northpoint',name:'Northpoint',x:1800+NORTHPOINT_SHIFT.x,z:8900+NORTHPOINT_SHIFT.z,rx:6400,rz:4100,biome:'alpine'},
 {id:'westhaven',name:'Westhaven',x:-9600,z:4500,rx:3300,rz:3600,biome:'temperate'},
 {id:'cinder',name:'Cinder Caldera',x:21900,z:4600,rx:4800,rz:4100,rotation:.3,peak:1180,biome:'volcanic',seed:31},
 {id:'fern',name:'Fern Reach',x:-23500,z:-11800,rx:4900,rz:3500,rotation:-.5,peak:570,biome:'temperate',seed:43},
 {id:'southreach',name:'Southreach',x:-4500,z:-23500,rx:6000,rz:3700,rotation:.24,peak:740,biome:'dry',seed:57},
 {id:'needles',name:'The Needles',x:-15100,z:25500,rx:5800,rz:2800,rotation:-.58,peak:1450,biome:'alpine',seed:71},
 {id:'crescent',name:'Crescent Isle',x:23100,z:24600,rx:5000,rz:4700,rotation:.62,peak:970,biome:'temperate',seed:89},
].map(Object.freeze));
export const TERRAIN_TILE_SIZE=6000;
export const TERRAIN_EDGE_SEGMENTS=80;
export const TERRAIN_LOD_SEGMENTS=Object.freeze([78,26,13]);
export function worldNoise(x,z){return Math.sin(x*.0017)*Math.cos(z*.0013)*.5+Math.sin(x*.0043+z*.0014)*.22+Math.sin(z*.0061-x*.0012)*.13}
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
function homeIsland(x,z){const radial=Math.sqrt(((x+300)/4200)**2+(z/4600)**2),coast=(1-radial)*4200+worldNoise(x*.78+500,z*.78-1000)*210+Math.sin(x*.002+z*.001)*55-1400*Math.exp(-((x-2700)**2/360000+(z+1550)**2/1250000));const mountains=430*Math.exp(-((x+2550)**2+(z-1750)**2)/1650000)+370*Math.exp(-((x-1850)**2+(z-2650)**2)/1450000),inland=10+mountains*(.60+worldNoise(x,z))+Math.max(0,worldNoise(x*1.6,z*1.6))*14;return coast<-160?-24:coast<110?-24+smooth(-160,110,coast)*Math.min(40,inland+24):inland}
export const northernRidgeHeight=(x,z)=>northernRidgeLocal(x-NORTHPOINT_SHIFT.x,z-NORTHPOINT_SHIFT.z);
function northernRidgeLocal(x,z){const localZ=z-7200,envelope=Math.max(0,1-Math.abs(localZ)/2600),peaks=580+380*Math.sin(x*.0013)+210*Math.sin(x*.0031+1)+180*Math.cos(x*.005);return Math.max(-24,Math.pow(envelope,1.5)*(peaks+worldNoise(x*2,localZ*2)*320))}
function northIsland(x,z){x-=NORTHPOINT_SHIFT.x;z-=NORTHPOINT_SHIFT.z;const radial=Math.sqrt(((x-1800)/6400)**2+((z-8900)/4100)**2),coast=(1-radial)*4100+worldNoise(x*.9,z*.9)*170;if(coast<-140)return-24;const h=30+Math.max(0,northernRidgeLocal(x,z))+330*Math.exp(-((x-800)**2+(z-10500)**2)/3800000);return coast<90?-24+smooth(-140,90,coast)*Math.min(65,h+24):h}
function westIsland(x,z){const radial=Math.sqrt(((x+9600)/3300)**2+((z-4500)/3600)**2),coast=(1-radial)*3300+worldNoise(x*.9,z*.9)*150;if(coast<-130)return-24;const h=15+420*Math.exp(-((x+8900)**2+(z-5600)**2)/2900000)*(.68+worldNoise(x,z));return coast<110?-24+smooth(-130,110,coast)*Math.min(60,h+24):h}
function distantIslandHeight(island,x,z){
 const dx=x-island.x,dz=z-island.z;
 // Most physics samples are over the original islands: reject cheaply before trig.
 if(Math.abs(dx)>island.rx+island.rz||Math.abs(dz)>island.rx+island.rz)return -24;
 const c=Math.cos(island.rotation),s=Math.sin(island.rotation),u=(dx*c-dz*s)/island.rx,v=(dx*s+dz*c)/island.rz,r=Math.hypot(u,v);
 if(r>1.12)return -24;
 let coast=(1-r)*Math.min(island.rx,island.rz)+worldNoise(dx+island.seed*900,dz-island.seed*500)*150;
 if(island.id==='crescent')coast-=3000*Math.exp(-((u-.72)**2/.13+v*v/.3));
 if(coast<-160)return -24;
 const noise=worldNoise(dx*.85+island.seed*100,dz*.85);
 let relief=Math.exp(-((u+.16)**2*3.9+(v-.12)**2*4.8))*(.8+noise*.3);
 if(island.id==='cinder')relief=.13+.87*Math.exp(-(((r-.42)/.19)**2));
 if(island.id==='needles')relief=Math.exp(-v*v*10)*( .5+.5*Math.sin(u*8+1.2)**2)*Math.max(0,1-u*u);
 const inland=18+island.peak*relief+Math.max(0,noise)*35;
 return -24+smooth(-160,420,coast)*(inland+24);
}
export function islandHeight(id,x,z){
 if(id==='home')return homeIsland(x,z);if(id==='northpoint')return northIsland(x,z);if(id==='westhaven')return westIsland(x,z);
 const island=ISLANDS.find(island=>island.id===id);return island?distantIslandHeight(island,x,z):-24;
}
export function terrainHeight(x,z){
 let land=Math.max(homeIsland(x,z),northIsland(x,z),westIsland(x,z));
 for(let i=3;i<ISLANDS.length;i++)land=Math.max(land,distantIslandHeight(ISLANDS[i],x,z));
 let h=valleyTerrain(land,x,z);
 for(const field of Object.values(AIRFIELDS)){const p=fieldCoordinates(field,{x,z}),airportEdge=Math.max(Math.abs(p.across-230)-770,Math.abs(p.along+20)-(field.halfLength+390));if(airportEdge<170)h=field.elevation+2+(h-field.elevation-2)*smooth(0,170,airportEdge);
  // A naturally low approach valley leaves the northern ridges beside the final, not across it.
  if(field.id!=='home'&&p.along<-950&&p.along>-3600){const acrossBlend=1-smooth(340,1000,Math.abs(p.across)),alongBlend=smooth(-3600,-3200,p.along)*(1-smooth(-1100,-950,p.along)),cap=field.elevation+26+Math.max(0,-p.along-1800)*.025;h=h+(Math.min(h,cap)-h)*acrossBlend*alongBlend;}
 }
 const depotDistance=Math.hypot(x,z-700);h=4+(h-4)*smooth(270,430,depotDistance);return h;
}
export const surfaceHeight=(x,z)=>Math.max(SEA_LEVEL,terrainHeight(x,z));
export function coastPoint(theta,offset=0,id='home'){
 const island=ISLANDS.find(island=>island.id===id)||ISLANDS[0],cx=island.x,cz=island.z;
 let low=0,high=0;
 const height=r=>terrainHeight(cx+Math.sin(theta)*r,cz+Math.cos(theta)*r);
 // Find the first shore, not a later island on the same ray. Binary-searching
 // a large initial bracket can jump a water gap and join separate shore meshes.
 const stride=80;
 do{low=high;high+=stride;}while(height(high)>SEA_LEVEL&&high<48000);
 for(let n=0;n<24;n++){const r=(low+high)/2;if(height(r)>SEA_LEVEL)low=r;else high=r}
 const r=(low+high)/2+offset;return{x:cx+Math.sin(theta)*r,z:cz+Math.cos(theta)*r};
}
