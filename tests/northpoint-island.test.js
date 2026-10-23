import test from 'node:test';
import assert from 'node:assert/strict';
import {AIRFIELDS,ROUTES,fieldPoint} from '../missions.js';
import {terrainHeight,SEA_LEVEL,coastPoint,ISLANDS} from '../world.js';
import {strikeTarget,createGame,horizontal} from '../sim.js';

test('Northpoint is modestly farther away with a substantial open-water transit',()=>{
 const a=AIRFIELDS.home,b=AIRFIELDS.northpoint,distance=horizontal(a,b),oldDistance=Math.hypot(4200-a.x,10300-a.z);
 assert(distance>oldDistance*1.2&&distance<oldDistance*1.4);
 let run=0,longest=0;
 for(let i=0;i<=1000;i++){const x=a.x+(b.x-a.x)*i/1000,z=a.z+(b.z-a.z)*i/1000;run=terrainHeight(x,z)<=SEA_LEVEL?run+1:0;longest=Math.max(longest,run);}
 assert(longest*distance/1000>2500,'at least 2.5 km of continuous water lies between bases');
});
test('Northpoint terrain, runway, depot and scenic gates moved together',()=>{
 const f=AIRFIELDS.northpoint,island=ISLANDS.find(i=>i.id==='northpoint'),target=strikeTarget(createGame({mode:'strike'}));
 assert(horizontal(f,island)<3000);assert.equal(target.x,f.x+280);assert.equal(target.z,f.z+1550);assert(terrainHeight(target.x,target.z)>SEA_LEVEL+20);
 for(let along=-f.halfLength;along<=f.halfLength;along+=100){const p=fieldPoint(f,0,along);assert.equal(terrainHeight(p.x,p.z),f.elevation+2);}
 assert(ROUTES.northpoint.gates.some(g=>horizontal(g,f)<4000&&g.z>f.z));assert.equal(ROUTES.northpoint.destination,'home');
});
test('shore finder brackets the first ocean crossing, not a second island',()=>{
 for(const id of ['home','northpoint']){const island=ISLANDS.find(i=>i.id===id);for(let i=0;i<60;i++){
  const theta=i/60*Math.PI*2,p=coastPoint(theta,0,id),radius=horizontal(p,island);
  assert(Math.abs(terrainHeight(p.x,p.z)-SEA_LEVEL)<.05);
  for(let r=80;r<radius-80;r+=80)assert(terrainHeight(island.x+Math.sin(theta)*r,island.z+Math.cos(theta)*r)>SEA_LEVEL,`${id} skipped an ocean gap`);
 }}
});

test('home and enemy shorelines remain separated by a visible sea channel',()=>{
 const shore=id=>Array.from({length:120},(_,i)=>coastPoint(i/120*Math.PI*2,0,id));let gap=Infinity;
 for(const a of shore('home'))for(const b of shore('northpoint'))gap=Math.min(gap,horizontal(a,b));
 assert(gap>2800,`sampled minimum shoreline gap ${gap} m`);
});
