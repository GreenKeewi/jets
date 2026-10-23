import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceHeight} from '../world.js';
import {createGame,step,strikeTarget,strikeEscape,horizontal,AIRFIELDS,STRIKE_SAM,bombSolution,worldVelocity} from '../sim.js';

for(const role of ['attack','defend'])test(`strike depot lies beyond the enemy runway: ${role}`,()=>{
 const g=createGame({mode:'strike',role}),target=strikeTarget(g),enemy=role==='attack'?AIRFIELDS.northpoint:AIRFIELDS.home,origin=role==='attack'?AIRFIELDS.home:AIRFIELDS.northpoint;
 assert(horizontal(target,enemy)<2000);assert(Math.abs(target.z-enemy.z)>enemy.halfLength);
 assert(horizontal(target,origin)>14000);assert(horizontal(target,strikeEscape(g))>10000);
});
function encounter(seed=23){const g=createGame({mode:'strike',teamSize:1,seed}),p=g.pilots[0],t=strikeTarget(g);g.pilots=[p];Object.assign(p,{pos:{x:t.x,y:t.y+800,z:t.z-3000},grounded:false,departureActive:false,gearDown:false,speed:230,throttle:.8,pitch:0,roll:0,human:true});g.time=20;return{g,p,t};}
test('airfield SAMs are sparse, mission-only and target airborne bombers',()=>{
 const {g,p,t}=encounter();step(g);assert.equal(g.missiles.filter(m=>m.arcadeSam).length,1);assert.equal(g.strikeSam.launches,1);
 for(let n=0;n<30*60;n++){p.pos={x:t.x,y:t.y+800,z:t.z-3000};step(g,{[p.id]:{flare:true}})}
 assert.equal(g.strikeSam.launches,1);assert(g.strikeSam.nextAt>=20+STRIKE_SAM.cooldown);
 g.time=g.strikeSam.nextAt;step(g);assert.equal(g.strikeSam.launches,2);
 g.time+=120;g.missiles=[];step(g);assert.equal(g.strikeSam.launches,2);
 const fighter=createGame({mode:'dogfight'});fighter.time=30;step(fighter);assert(!fighter.missiles.some(m=>m.arcadeSam));
});
for(const dt of [1/30,1/60,1/120])test(`bomber flares always defeat cinematic SAM before impact at ${1/dt} Hz`,()=>{
 for(let seed=1;seed<=20;seed++){
  const {g,p}=encounter(seed);step(g,{},dt);const m=g.missiles.find(m=>m.arcadeSam);assert(m);
  // The guarantee is independent of range, random seed and bomber power.
  p.throttle=1;const hp=p.hp,flares=p.flares;step(g,{[p.id]:{flare:true}},dt);
  assert.equal(m.decoyed,true);assert.equal(p.hp,hp);assert.equal(p.flares,flares-1);
  assert.equal(p.heat,0);assert.equal(p.radar,0);assert.equal(p.bombs,3);
 }
});

test('bomb solution intersects elevated terrain using boosted launch velocity',()=>{
 const {g,p,t}=encounter();p.pos={x:t.x,y:t.y+700,z:t.z-3000};p.pitch=.08;
 const predicted=bombSolution(p),v=worldVelocity(p);let pos={...p.pos},age=0;
 // Independently integrate a much finer ballistic path against the real terrain.
 for(;age<40;age+=.001){pos={x:p.pos.x+v.x*age,y:p.pos.y+v.y*age-22.5*age*age,z:p.pos.z+v.z*age};if(pos.y<=Math.max(4,surfaceHeight(pos.x,pos.z)))break;}
 assert(age<40);assert(horizontal(predicted,pos)<3,'prediction follows physical terrain impact');assert(predicted.y>4,'target island is above sea level');
});
