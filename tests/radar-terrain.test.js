import test from 'node:test';
import assert from 'node:assert/strict';
import {RADAR_MAP,terrainTransform,sampleRadarTerrain,RadarTerrain} from '../radar-terrain.js';
import {radarPoint} from '../view-axes.js';
import {terrainHeight,SEA_LEVEL} from '../world.js';
import {valleyPoint} from '../arenas.js';
test('terrain transform agrees with contacts across headings and player movement',()=>{
 for(const yaw of [0,.5,Math.PI/2,Math.PI,-2.1])for(const pos of [{x:0,z:0},{x:1780,z:-900}]){
  const p={yaw,pos},center={x:400,z:700},m=terrainTransform(p,center);
  for(const [x,y] of [[0,0],[23,-31],[-40,21]]){
   const q={x:center.x+x*80,z:center.z+y*80},r=radarPoint(p,q,.025,Infinity);
   assert(Math.abs(m[0]*x+m[2]*y+m[4]-95-r.x)<1e-9);
   assert(Math.abs(m[1]*x+m[3]*y+m[5]-95-r.y)<1e-9);
  }
 }
});
test('raster follows actual island and valley heights, transparent water and restrained relief',()=>{
 for(const center of [{x:-1800,z:-2000},{x:10500,z:11000},valleyPoint(-8000,0,0)]){
  const pixels=sampleRadarTerrain(center),n=RADAR_MAP.size;
  for(let y=0;y<n;y+=7)for(let x=0;x<n;x+=7){const h=terrainHeight(center.x+(x+.5-n/2)*80,center.z+(y+.5-n/2)*80),a=pixels[(y*n+x)*4+3];assert.equal(a>0,h>SEA_LEVEL);assert(a<=100);}
 }
});
test('cache reuses raster through motion and headings; rebuild only outside safe margin',()=>{
 let samples=0,clips=0;const ctx=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),clip:()=>clips++},{get:(o,k)=>k in o?o[k]:()=>{}});
 const map=new RadarTerrain(()=>({getContext:()=>ctx}),()=>{samples++;return 20});
 map.draw(ctx,{pos:{x:0,z:0},yaw:0});const initial=samples;
 for(let i=0;i<100;i++)map.draw(ctx,{pos:{x:i*10,z:200},yaw:i/10});assert.equal(samples,initial);assert.equal(map.builds,1);
 map.draw(ctx,{pos:{x:2100,z:0},yaw:0});assert.equal(map.builds,2);assert.equal(clips,102);
 assert(RADAR_MAP.size*RADAR_MAP.cell/2-RADAR_MAP.recenter>RADAR_MAP.radius/RADAR_MAP.scale);
});
