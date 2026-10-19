// Standalone deterministic eight-minute stress replay; no browser or wall-clock waits.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createGame,step,snapshot,respawnPilot,threatFor} from '../sim.js';
const finiteVector=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k]));
function replay(){
 const g=createGame({teamSizes:[4,4,4],skirmish:true,seed:123904}),p=g.pilots[0],max={missiles:0,bullets:0,countermeasures:0,effects:0},started=performance.now();
 let humanRespawns=0,forcedLoss=75,ticks=0;
 while(g.status==='playing'){
  // Exercise the normal respawn API repeatedly even if defensive flying survives.
  if(g.time>=forcedLoss&&!p.dead){p.pos.y=-1;forcedLoss+=75;}
  if(p.dead&&g.time>=p.respawnAt){if(respawnPilot(g,p.id))humanRespawns++;}
  const threat=threatFor(g,p),input={roll:.64,pitch:Math.max(-.4,Math.min(.6,(1050-p.pos.y)*.006)),fireGun:!p.dead&&ticks%120<45};
  if(threat&&threat.kind!=='lock'&&threat.timeToImpact<2.2)input[threat.kind==='heat'?'flare':'chaff']=true;
  if(p.lock>.6)input.fireHeat=true;
  step(g,{host:input});ticks++;
  assert(g.pilots.length===12);assert(Number.isFinite(g.time));assert(Number.isInteger(g.serial));
  for(const pilot of g.pilots){assert(finiteVector(pilot.pos));for(const k of ['yaw','pitch','roll','speed','hp','throttle'])assert(Number.isFinite(pilot[k]),`${pilot.id}.${k}`);assert(pilot.hp>=0&&pilot.hp<=100);}
  for(const key of Object.keys(max)){max[key]=Math.max(max[key],g[key].length);for(const item of g[key]){assert(finiteVector(item.pos),`${key} position`);assert(Number.isFinite(item.age));if(item.dir)assert(finiteVector(item.dir));if(item.vel)assert(finiteVector(item.vel));}}
  assert(g.missiles.length<=160);assert(g.bullets.length<=96);assert(g.countermeasures.length<=400);assert(g.effects.length<=150);
  assert(ticks<29000);
 }
 const digest=createHash('sha256').update(JSON.stringify(snapshot(g))).digest('hex');
 return{digest,elapsedMs:Math.round(performance.now()-started),ticks,time:g.time,status:g.status,winner:g.result.winner,scores:g.scores,alive:g.teamSizes.map((_,team)=>g.pilots.filter(p=>p.team===team&&!p.dead).length),deaths:g.pilots.reduce((sum,p)=>sum+p.deaths,0),humanRespawns,max};
}
const first=replay(),second=replay();assert.equal(first.digest,second.digest);assert(first.humanRespawns>=5);assert.equal(first.status,'complete');
const report={passed:true,method:'Two full 12-aircraft 480-second deterministic simulation runs, repeated human losses/respawns, live bot combat, per-tick finite-state and bounded-array assertions.',first,second};
if(process.argv.includes('--save')){mkdirSync(new URL('../evidence/new-squadrons/',import.meta.url),{recursive:true});writeFileSync(new URL('../evidence/new-squadrons/sim-soak.json',import.meta.url),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
