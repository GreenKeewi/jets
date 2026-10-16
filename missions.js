// Authored airfields and routes. Coordinates, headings and elevation are shared by rules and scenery.
export const AIRFIELDS={
 home:{id:'home',name:'Coastal Air Base',shortName:'Coastal',x:-1800,z:-2000,elevation:0,heading:0,halfLength:1000,width:100,runway:'36'},
 northpoint:{id:'northpoint',name:'Northpoint Ridge',shortName:'Northpoint',x:4200,z:10300,elevation:72,heading:0,halfLength:850,width:85,runway:'36'},
 westhaven:{id:'westhaven',name:'Westhaven Island',shortName:'Westhaven',x:-9900,z:4200,elevation:8,heading:Math.PI/2,halfLength:850,width:85,runway:'09'},
};
export const ROUTES={
 local:{id:'local',name:'Local loop',destination:'home',description:'Five scenic gates. Return to Coastal Air Base.',duration:'2–3 min',gates:[{x:-1800,y:300,z:-200},{x:0,y:650,z:1300},{x:2100,y:600,z:0},{x:300,y:480,z:-2100},{x:-1800,y:260,z:-3500}]},
 northpoint:{id:'northpoint',name:'Northpoint Ridge',destination:'northpoint',description:'Tour the northern ridges and land in a mountain valley.',duration:'4–5 min',gates:[{x:-1800,y:340,z:-200},{x:-900,y:850,z:2200},{x:800,y:1050,z:4500},{x:-1800,y:1250,z:7000},{x:800,y:1500,z:11800},{x:6000,y:1250,z:12600},{x:7400,y:950,z:9300},{x:3500,y:850,z:6000},{x:3500,y:650,z:6800}]},
 westhaven:{id:'westhaven',name:'Westhaven Island',destination:'westhaven',description:'Follow the western coast to a remote island runway.',duration:'3–4 min',gates:[{x:-1800,y:340,z:-200},{x:-3400,y:800,z:1800},{x:-5300,y:950,z:2000},{x:-7600,y:900,z:1800},{x:-9000,y:850,z:2800},{x:-7400,y:950,z:5700},{x:-9500,y:1050,z:7300},{x:-12200,y:650,z:6000},{x:-12300,y:500,z:5300}]},
};
export const WORLD_BOUNDS={minX:-16000,maxX:14000,minZ:-8000,maxZ:18000};
export const routeDefinition=g=>ROUTES[typeof g==='string'?g:g?.routeId]||ROUTES.local;
export const routeFor=g=>routeDefinition(g).gates;
export const destinationFor=g=>AIRFIELDS[routeDefinition(g).destination];
export function fieldPoint(field,across,along,height=0){return{x:field.x+Math.cos(field.heading)*across+Math.sin(field.heading)*along,y:field.elevation+height,z:field.z-Math.sin(field.heading)*across+Math.cos(field.heading)*along}}
export function fieldCoordinates(field,point){const dx=point.x-field.x,dz=point.z-field.z;return{across:dx*Math.cos(field.heading)-dz*Math.sin(field.heading),along:dx*Math.sin(field.heading)+dz*Math.cos(field.heading)}}
export function fieldUnder(point){return Object.values(AIRFIELDS).find(field=>{const p=fieldCoordinates(field,point);return Math.abs(p.across)<field.width&&Math.abs(p.along)<field.halfLength})||null}
export function approachFor(g){const f=destinationFor(g);return[fieldPoint(f,-650,-2800,420),fieldPoint(f,0,-2800,360),fieldPoint(f,0,-1750,280)]}
