import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,configurePlayers,step,respawnPilot,snapshot,applySnapshot,AIRFIELDS,fieldPoint} from '../sim.js';

function fixture(options={}){
 const g=createGame({teamSizes:[2,2],enemyRespawnSeconds:180,coopTeam:0,...options});
 configurePlayers(g,['host','friend'],{host:g.coopTeam??0,friend:g.coopTeam??0});
 return g;
}
function crash(g,p){Object.assign(p,{grounded:false,departureActive:false,pos:{x:30000+p.slot*1000,y:-100,z:30000},speed:200,collisionGraceUntil:0});step(g);assert.equal(p.dead,true);}
function killEnemies(g){for(const p of g.pilots.filter(p=>p.team!==g.coopTeam))crash(g,p);}

test('respawn settings only enable supported two-team co-op dogfights',()=>{
 for(const options of [{mode:'strike'},{mode:'freeflight'},{skirmish:true},{coopTeam:null},{coopTeam:2},{enemyRespawnSeconds:1},{enemyRespawnSeconds:'180'},{teamSizes:[2,2,2]}])assert.equal(fixture(options).enemyRespawnSeconds,0);
 for(const delay of [120,180,300])assert.equal(fixture({enemyRespawnSeconds:delay}).enemyRespawnSeconds,delay);
});
test('enemy deaths schedule exactly once, preserve elimination until reinforcement, and snapshot timers',()=>{
 const g=fixture();killEnemies(g);assert.equal(g.status,'playing');
 const p=g.pilots.find(p=>p.team===1),timer=p.respawnAt;
 assert.equal(timer,180+g.events.find(e=>e.type==='kill'&&e.pilotId===p.id).t);
 step(g);assert.equal(p.respawnAt,timer);assert.equal(p.deaths,1);
 const guest=createGame();assert.equal(applySnapshot(guest,snapshot(g)),true);
 assert.equal(guest.enemyRespawnSeconds,180);assert.equal(guest.coopTeam,0);assert.equal(guest.pilots.find(q=>q.id===p.id).respawnAt,timer);
});
test('timer follows simulation seconds at 20, 30, 60 and 144 fps, returning once on airport ground',()=>{
 for(const fps of [20,30,60,144]){
  const g=fixture();killEnemies(g);const p=g.pilots.find(p=>p.team===1);
  g.time=p.respawnAt-1;const due=p.respawnAt;
  for(let n=0;n<fps-1;n++)step(g,{},1/fps);
  assert.equal(p.dead,true);assert.equal(respawnPilot(g,p.id),false);
  for(let n=0;n<3&&p.dead;n++)step(g,{},1/fps);
  assert.equal(p.dead,false);assert.ok(g.time>=due&&g.time<due+2/fps);
  assert.equal(p.grounded,true);assert.equal(p.departureActive,true);assert.equal(p.runwayId,'northpoint');
  assert.equal(p.respawnAt,null);assert.equal(p.deaths,1);assert.equal(respawnPilot(g,p.id),false);
  assert.equal(g.events.filter(e=>e.type==='respawn'&&e.pilotId===p.id).length,1);
 }
});
test('human and friendly bot seats never become enemy reinforcement after disconnect',()=>{
 const g=fixture({teamSizes:[3,2]});const friendBot=g.pilots.find(p=>p.team===0&&!p.human);crash(g,friendBot);assert.equal(friendBot.respawnAt,null);
 const human=g.pilots.find(p=>p.id==='friend');crash(g,human);assert.equal(human.respawnAt,null);human.human=false;assert.equal(respawnPilot(g,human.id),false);
 const enemy=g.pilots.find(p=>p.team===1);enemy.human=true;step(g);enemy.human=false;crash(g,enemy);assert.equal(enemy.enemyRespawnEligible,false);assert.equal(enemy.respawnAt,null);
});
test('team one can own the co-op, respawning enemies at team zero airport',()=>{
 const g=fixture({coopTeam:1});killEnemies(g);const enemy=g.pilots.find(p=>p.team===0);
 g.time=enemy.respawnAt;assert.equal(respawnPilot(g,enemy.id),true);assert.equal(enemy.runwayId,'home');assert.equal(enemy.team,0);
});
test('blocked airport queues the same dead pilot and retries without duplicate spawn',()=>{
 const g=fixture();killEnemies(g);const p=g.pilots.find(p=>p.team===1),field=AIRFIELDS.northpoint;
 const blockers=Array.from({length:6},(_,i)=>({...g.pilots[0],id:`blocker${i}`,human:true,bomber:true,dead:false,pos:fieldPoint(field,0,-field.halfLength+152.5+i*210,3)}));
 g.pilots.push(...blockers);g.time=p.respawnAt;
 assert.equal(respawnPilot(g,p.id),false);assert.equal(p.respawnBlocked,true);assert.equal(p.dead,true);const length=g.pilots.length;
 for(const blocker of blockers)blocker.dead=true;
 assert.equal(respawnPilot(g,p.id),true);assert.equal(g.pilots.length,length);assert.equal(p.respawnBlocked,false);assert.equal(respawnPilot(g,p.id),false);
});
test('disabled retains elimination; co-op loss, deadline and restart terminate pending respawns',()=>{
 const off=fixture({enemyRespawnSeconds:0});for(const p of off.pilots.filter(p=>p.team===1))crash(off,p);assert.equal(off.status,'complete');assert.equal(off.result.winner,0);assert.ok(off.pilots.every(p=>p.respawnAt===null));
 const g=fixture();killEnemies(g);for(const p of g.pilots.filter(p=>p.team===0))crash(g,p);assert.equal(g.status,'complete');assert.equal(g.result.winner,1);g.time=300;assert.equal(respawnPilot(g,g.pilots[2].id),false);
 const end=fixture();killEnemies(end);end.time=480;step(end);assert.equal(end.status,'complete');assert.ok(end.pilots.filter(p=>p.team===1).every(p=>p.dead));
 const reverse=fixture({coopTeam:1});for(const p of reverse.pilots.filter(p=>p.team===1))crash(reverse,p);assert.equal(reverse.result.winner,0);assert.equal(reverse.result.title,'Squadron defeated');
 const restart=fixture();assert.equal(restart.time,0);assert.ok(restart.pilots.every(p=>!p.dead&&p.respawnAt===null));
});
