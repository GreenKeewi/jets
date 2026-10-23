import test from 'node:test';
import assert from 'node:assert/strict';
import {VALLEY,VALLEY_ROUTE,valleyPoint,valleyCenter,valleyHeading,valleyTerrain,inValley} from '../arenas.js';
import {surfaceHeight} from '../world.js';
import {createGame,step} from '../sim.js';

test('mountain corridor links at least eight bends along over 22 km with playable floor clearance',()=>{
 let length=0,bends=0,previousSlope=0;
 for(let i=0;i<VALLEY_ROUTE.length;i++){
  const p=VALLEY_ROUTE[i];assert(inValley(p));assert(p.y-surfaceHeight(p.x,p.z)>190);
  for(const side of[-1,1]){assert(p.y-surfaceHeight(p.x,p.z+side*400)>190);assert(surfaceHeight(p.x,p.z+side*1400)>p.y+400);}
  if(i){const previous=VALLEY_ROUTE[i-1],slope=Math.sign(p.z-previous.z);length+=Math.hypot(p.x-previous.x,p.z-previous.z);if(previousSlope&&slope!==previousSlope)bends++;previousSlope=slope;}
 }
 assert(length>22000&&length<24000);assert(bends>=7);
});
test('centreline radius supports arcade turning and samples match collision terrain',()=>{
 let minRadius=Infinity;
 for(let x=VALLEY.minX+5;x<VALLEY.maxX-5;x+=20){
  const dy=(valleyCenter(x+1)-valleyCenter(x-1))/2,ddy=valleyCenter(x+1)-2*valleyCenter(x)+valleyCenter(x-1),radius=(1+dy*dy)**1.5/Math.abs(ddy);minRadius=Math.min(minRadius,radius);
  assert.equal(surfaceHeight(x,valleyCenter(x)),valleyTerrain(-24,x,valleyCenter(x)));
 }
 assert(minRadius>900,`tightest radius ${minRadius}`);
 // At 240 m/s physical speed and existing 1.5x travel, following this curvature
 // requires less than 9 G; no HUD clamp or hidden position snapping.
 assert(Math.hypot(1,240*360/minRadius/9.80665)<9);
});
test('valley stays north of the separated airport transit channel',()=>{
 for(let x=3000;x<7000;x+=250)for(let z=4000;z<7000;z+=250)assert.equal(valleyTerrain(-24,x,z),-24);
});
for(const entryX of [-12000,-6000,-2000,0,5000])test(`AI follows bends and reverses without contact from ${entryX}`,()=>{
 const g=createGame({mode:'dogfight',arenaId:'valley',teamSize:1,seed:42,skirmish:true}),p=g.pilots[0];Object.assign(g.pilots[1],{human:true,pos:valleyPoint(4000,0,500),grounded:false,departureActive:false,gearDown:false,speed:240});Object.assign(p,{human:false,pos:valleyPoint(entryX),yaw:valleyHeading(entryX),pitch:0,roll:0,grounded:false,departureActive:false,gearDown:false,speed:240,throttle:.78});
 let clearance=Infinity;for(let i=0;i<1200;i++){step(g,{},1/60);clearance=Math.min(clearance,p.pos.y-surfaceHeight(p.pos.x,p.pos.z));assert(!p.dead);}
 assert(g.time>19);assert(clearance>50,`minimum clearance ${clearance}`);
});
