import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,snapshot,applySnapshot,configurePlayers,respawnPilot,threatFor,dist,forward,angle,COMBAT_LIMITS,AIRCRAFT_RADIUS,collisionRadius,sweptSphereHit,MISSILE} from '../sim.js';

function run(g,seconds,input={}){for(let n=0;n<seconds*60&&g.status==='playing';n++)step(g,typeof input==='function'?input(g):input);return g;}
function humanFixture(options={}){const g=createGame(options);g.pilots.forEach((p,i)=>Object.assign(p,{human:true,pos:{x:i*5000,y:3000,z:0},speed:285,throttle:.78,yaw:0,pitch:0,roll:0,collisionGraceUntil:0,spawnProtectedUntil:0}));return g;}
function missileFixture({type='heat',distance=600,speed=450}={}){
 const g=humanFixture({skirmish:true}),p=g.pilots[0],q=g.pilots[1];p.speed=speed;p.throttle=speed===285?.78:1;q.pos.z=-5000;
 const m={id:1000,type,ownerId:q.id,team:q.team,targetId:p.id,pos:{x:0,y:3000,z:-distance},dir:{x:0,y:0,z:1},speed:650,age:1,life:13,decoyed:false,seekerLost:false};
 g.missiles.push(m);q.targetId=p.id;q.lock=2;return{g,p,q,m};
}

test('asymmetric squads are bounded at three teams, four pilots each, twelve total',()=>{
 for(const sizes of [[1,2],[1,3],[3,2,3],[4,4,4]]){const g=createGame({teamSizes:sizes,skirmish:true});assert.deepEqual(g.teamSizes,sizes);assert.equal(g.pilots.length,sizes.reduce((a,b)=>a+b,0));sizes.forEach((size,team)=>assert.equal(g.pilots.filter(p=>p.team===team).length,size));assert.equal(g.pilots.filter(p=>p.human).length,1);}
 assert.deepEqual(createGame({teamSizes:[20,-5,Infinity,4]}).teamSizes,[4,1,4]);
 assert.deepEqual(createGame({teamSizes:[]}).teamSizes,[1,1]);
 assert.deepEqual(createGame({teamSizes:[NaN]}).teamSizes,[1,1]);
 assert.deepEqual(createGame({teamSize:3}).teamSizes,[3,3]);
 assert.deepEqual(createGame({mode:'strike',teamSize:2,teamSizes:[4,4,4],skirmish:true}).teamSizes,[2,2]);
 assert.equal(createGame({mode:'strike',skirmish:true}).skirmish,false);
 assert.equal(createGame({mode:'freeflight',teamSizes:[4,4,4]}).pilots.length,1);
 assert.equal(COMBAT_LIMITS.maxPilots,12);
});

test('every squad starts in a compact safe V or echelon with common heading',()=>{
 for(const mode of ['dogfight','strike'])for(const seed of [0,42,100,1337]){
  const g=createGame({mode,teamSize:3,teamSizes:[4,4,4],seed});
  for(const team of g.teamSizes.keys()){
   const squad=g.pilots.filter(p=>p.team===team),lead=squad[0];
   for(const p of squad){assert.equal(p.yaw,lead.yaw);assert.equal(p.pos.y,lead.pos.y);assert(dist(p.pos,lead.pos)<350);}
   for(let i=0;i<squad.length;i++)for(let j=i+1;j<squad.length;j++)assert(dist(squad[i].pos,squad[j].pos)>collisionRadius(squad[i])+collisionRadius(squad[j])+15);
  }
 }
 assert.equal(AIRCRAFT_RADIUS.fighter,16);assert.equal(AIRCRAFT_RADIUS.bomber,32);
});

test('formations stay together for the opening seconds before engagement',()=>{
 for(const mode of ['dogfight','strike']){
  const g=createGame({mode,teamSize:3,teamSizes:[4,4,4],seed:42});g.pilots.forEach(p=>p.human=false);
  const original=g.pilots.map(p=>({...p.pos}));run(g,3.5);
  for(const team of g.teamSizes.keys()){
   const squad=g.pilots.filter(p=>p.team===team),lead=squad[0],leadIndex=g.pilots.indexOf(lead);
   for(const p of squad){const index=g.pilots.indexOf(p);assert.equal(p.dead,false);assert(Math.abs((p.pos.x-lead.pos.x)-(original[index].x-original[leadIndex].x))<5);assert(Math.abs((p.pos.z-lead.pos.z)-(original[index].z-original[leadIndex].z))<8);}
  }
  assert.equal(g.missiles.length,0);
 }
});

test('seeded enemy packages approach from ahead, behind and both sides without scattering',()=>{
 const sectors=new Set();
 for(let seed=0;seed<64;seed++){
  const g=createGame({teamSizes:[3,4,4],seed}),a=g.pilots[0];
  for(const team of [1,2]){
   const squad=g.pilots.filter(p=>p.team===team),lead=squad[0],bearing=Math.atan2(lead.pos.x-a.pos.x,lead.pos.z-a.pos.z);
   sectors.add((Math.round(bearing/(Math.PI/2))+4)%4);
   const f=forward(lead),dx=a.pos.x-lead.pos.x,dz=a.pos.z-lead.pos.z;assert((f.x*dx+f.z*dz)/Math.hypot(dx,dz)>.98);
   assert(squad.every(p=>dist(p.pos,lead.pos)<220));
  }
 }
 assert.deepEqual([...sectors].sort(),[0,1,2,3]);
});

test('expanded formations replay deterministically and snapshots roundtrip all twelve aircraft',()=>{
 const a=createGame({teamSizes:[4,4,4],skirmish:true,seed:821}),b=createGame({teamSizes:[4,4,4],skirmish:true,seed:821});
 for(const g of [a,b]){g.pilots.forEach(p=>p.human=false);run(g,45);}
 assert.deepEqual(snapshot(a),snapshot(b));
 const copy=createGame();assert.equal(applySnapshot(copy,snapshot(a)),true);assert.deepEqual(snapshot(copy),snapshot(a));
 assert.equal(applySnapshot(copy,{...snapshot(a),pilots:[...snapshot(a).pilots,snapshot(a).pilots[0]]}),false);
});

test('legacy connected seats still alternate teams and custom seats fill round-robin',()=>{
 const old=createGame({teamSize:3});configurePlayers(old,['host','p1','p2','p3','p4','p5']);assert.deepEqual(old.pilots.map(p=>p.id),['host','p2','p4','p1','p3','p5']);
 const custom=createGame({teamSizes:[1,3,2]});configurePlayers(custom,['host','a','b','c','d','e']);assert.deepEqual(custom.pilots.map(p=>p.id),['host','a','c','e','b','d']);
});

test('relative swept airframe contact catches crossing endpoints and rejects clean near misses',()=>{
 const a0={x:-40,y:1000,z:0},a1={x:40,y:1000,z:0},b0={x:0,y:1000,z:-40},b1={x:0,y:1000,z:40};
 assert.notEqual(sweptSphereHit(a0,a1,b0,b1,32),null);
 assert.equal(sweptSphereHit(a0,a1,{...b0,y:1033},{...b1,y:1033},32),null);
 assert.equal(sweptSphereHit(a0,a0,a0,a0,32),0);
});

test('Mach-2 head-on collisions kill both human/bot and same-team aircraft without tunneling',()=>{
 for(const sameTeam of [false,true]){
  const g=humanFixture({teamSizes:[2,1],skirmish:true}),p=g.pilots[0],q=g.pilots[sameTeam?1:2];g.pilots.forEach(x=>x.pos.x=10000+g.pilots.indexOf(x)*2000);
  Object.assign(p,{pos:{x:0,y:3000,z:-34},speed:686,throttle:1,yaw:0});Object.assign(q,{pos:{x:0,y:3000,z:34},speed:686,throttle:1,yaw:Math.PI});
  step(g,{},.05);assert(p.dead&&q.dead);assert.equal(g.status,'playing');assert(g.events.some(e=>e.type==='collision'));assert(g.effects.some(e=>e.type==='collision'));assert.deepEqual(g.scores,[0,0]);
 }
});

test('opening collision grace and safe high-speed near-misses preserve aircraft',()=>{
 const grace=humanFixture({skirmish:true});grace.pilots.forEach(p=>{p.pos={x:0,y:3000,z:0};p.collisionGraceUntil=2.5;});step(grace,{},.05);assert(grace.pilots.every(p=>!p.dead));
 const g=humanFixture({skirmish:true}),[p,q]=g.pilots;Object.assign(p,{pos:{x:0,y:3000,z:-34},speed:686,throttle:1,yaw:0});Object.assign(q,{pos:{x:33,y:3000,z:34},speed:686,throttle:1,yaw:Math.PI});step(g,{},.05);assert(g.pilots.every(p=>!p.dead));
});

test('player loss keeps the skirmish live and delayed respawn preserves identity, time and score',()=>{
 const g=humanFixture({teamSizes:[1,2],skirmish:true}),p=g.pilots[0];p.pos.y=1;step(g);assert.equal(p.dead,true);assert.equal(g.status,'playing');assert.equal(g.result,null);assert(p.respawnAt>=g.time+2.99);assert.equal(respawnPilot(g,p.id),false);
 const clock=g.time,scores=[...g.scores];run(g,3.05);assert.equal(p.dead,true);assert(g.time>clock);assert.equal(respawnPilot(g,'host'),true);assert.equal(p.dead,false);assert.equal(p.id,'host');assert.equal(p.human,true);assert.equal(p.team,0);assert.equal(p.hp,100);assert.equal(p.deaths,1);assert.deepEqual(g.scores,scores);assert(p.spawnProtectedUntil>g.time+2.4);assert(g.pilots.filter(q=>q!==p&&!q.dead).every(q=>dist(q.pos,p.pos)>1000));assert.equal(respawnPilot(g,p.id),false);
});

test('dead bots reinforce automatically; player death cannot silently reset the eight-minute match',()=>{
 const g=humanFixture({skirmish:true}),bot=g.pilots[1];bot.human=false;bot.pos.y=1;step(g);assert(bot.dead);const due=bot.respawnAt;run(g,8.1);assert(g.time>due);assert.equal(bot.dead,false);assert.equal(bot.deaths,1);assert(g.events.some(e=>e.type==='respawn'&&e.pilotId===bot.id));
 g.time=COMBAT_LIMITS.matchSeconds-.01;g.scores=[3,1];step(g);assert.equal(g.status,'complete');assert.equal(g.result.winner,0);assert.equal(respawnPilot(g,'host'),false);
});

test('respawn protection blocks guns, missiles, incoming hits and collisions during rejoin',()=>{
 const g=humanFixture({skirmish:true}),[p,q]=g.pilots;p.dead=true;p.hp=0;p.respawnAt=0;assert(respawnPilot(g,p.id));q.pos={...p.pos,z:p.pos.z+500};q.yaw=Math.PI;p.yaw=0;p.targetId=q.id;p.lock=3;
 const ammo=p.gunAmmo,heat=p.heat;step(g,{host:{fireGun:true,fireHeat:true}});assert.equal(p.gunAmmo,ammo);assert.equal(p.heat,heat);
 g.bullets=[{id:500,ownerId:q.id,team:q.team,pos:{...p.pos,z:p.pos.z-100},dir:{x:0,y:0,z:1},speed:10000,age:0,life:1}];
 g.missiles=[{id:501,ownerId:q.id,team:q.team,targetId:p.id,type:'heat',pos:{...p.pos,z:p.pos.z-20},dir:{x:0,y:0,z:1},speed:800,age:1,life:13}];q.pos={...p.pos};step(g,{},.05);assert.equal(p.hp,100);assert.equal(p.dead,false);assert.equal(q.dead,false);
});

test('legacy elimination and strike objectives still finish rather than offering respawn',()=>{
 const g=humanFixture(),enemy=g.pilots[1];enemy.pos.y=1;step(g);assert.equal(g.status,'complete');assert.equal(g.result.winner,0);assert.equal(respawnPilot(g,enemy.id),false);
 const custom=humanFixture({teamSizes:[1,1,1]});custom.pilots[0].pos.y=1;step(custom);assert.equal(custom.status,'playing');custom.pilots[1].pos.y=1;step(custom);assert.equal(custom.result.winner,2);
});

test('threat warnings distinguish acquisition from incoming heat/radar and report direction and ETA',()=>{
 const g=humanFixture(),[p,q]=g.pilots;q.pos={x:800,y:3000,z:0};q.targetId=p.id;q.lock=.2;
 let t=threatFor(g,p);assert.equal(t.kind,'lock');assert.equal(t.locked,false);assert(Math.abs(t.bearing-Math.PI/2)<1e-8);assert.equal(t.timeToImpact,null);
 q.lock=2;assert.equal(threatFor(g,p.id).locked,true);
 const fixture=missileFixture({distance:1200});t=threatFor(fixture.g,fixture.p);assert.equal(t.kind,'heat');assert.equal(t.sourceId,fixture.q.id);assert(Math.abs(Math.abs(t.bearing)-Math.PI)<1e-8);assert(t.timeToImpact>1&&t.timeToImpact<5);
 fixture.m.type='radar';assert.equal(threatFor(fixture.g,fixture.p).kind,'radar');fixture.m.seekerLost=true;fixture.q.targetId=null;assert.equal(threatFor(fixture.g,fixture.p),null);
});

test('target locks need a forward cone and missile launch cooldowns remain unchanged',()=>{
 const g=humanFixture(),[p,q]=g.pilots;q.pos={x:0,y:3000,z:1500};q.yaw=0;run(g,.5);assert(p.lock>=.45);step(g,{host:{fireHeat:true}});assert.equal(p.heat,5);assert.equal(p.heatCD,1.65);step(g,{host:{fireHeat:true}});assert.equal(p.heat,5);
 run(g,1);step(g,{host:{fireRadar:true}});assert.equal(p.radar,3);assert.equal(p.radarCD,2.5);
 q.pos={x:2000,y:3000,z:p.pos.z};step(g);assert.equal(p.lock,0);assert.equal(p.targetId,null);
});

test('missile turns are bounded per frame and cannot instantaneously snap onto a crossing target',()=>{
 const {g,p,m}=missileFixture();p.pos.x=400;const before={...m.dir};step(g,{},.05);const turned=Math.acos(Math.max(-1,Math.min(1,before.x*m.dir.x+before.y*m.dir.y+before.z*m.dir.z)));assert(turned<=MISSILE.heat.turnRate*.05+1e-8);assert(turned>0);
});

test('an energetic break evades a missile that hits the identical straight-flying aircraft',()=>{
 const straight=missileFixture(),evade=missileFixture();run(straight.g,8);run(evade.g,8,{host:{roll:1,pitch:1}});
 assert.equal(straight.p.hp,52);assert.equal(evade.p.hp,100);assert(evade.g.events.some(e=>e.type==='evade'&&e.text.includes('lost')));assert.equal(evade.p.flares,6);
});

test('a warning leaves time for a matching flare; wrong counters do not fool a heat seeker',()=>{
 const {g,p,m}=missileFixture({distance:1200,speed:285});assert(threatFor(g,p).timeToImpact>1);run(g,.7);step(g,{host:{chaff:true}});assert.equal(m.decoyed,false);step(g,{host:{flare:true}});assert.equal(m.decoyed,true);run(g,5);assert.equal(p.hp,100);assert.equal(threatFor(g,p),null);
});

test('radar guidance loses the track when its supporting shooter stops locking',()=>{
 const {g,p,q,m}=missileFixture({type:'radar',distance:1800});q.targetId=null;q.lock=0;run(g,.6);assert.equal(m.seekerLost,true);run(g,4);assert.equal(p.hp,100);
});

test('a rear squad threatens straight cruise as a coordinated package with a real reaction window',()=>{
 const g=createGame({teamSizes:[1,3],skirmish:true,seed:3}),p=g.pilots[0],lead=g.pilots[1];assert(lead.pos.z<p.pos.z-1400);assert(dist(p.pos,lead.pos)<1950);
 let locking=false,incoming=null;
 for(let n=0;n<20*60;n++){step(g);const t=threatFor(g,p);if(t?.kind==='lock')locking=true;if(t&&t.kind!=='lock'){incoming=t;break;}}
 assert(locking);assert(incoming);assert(g.time>COMBAT_LIMITS.formationSeconds&&g.time<15);assert(incoming.timeToImpact>2);assert.equal(p.hp,100);
});

test('gun effects and events share unique authoritative serial IDs even around protected pilots',()=>{
 const g=humanFixture({teamSizes:[1,2],skirmish:true}),[p,q,shield]=g.pilots;q.pos={x:0,y:3000,z:450};shield.pos={x:0,y:3000,z:180};shield.spawnProtectedUntil=5;
 const seen=new Set();let previousSerial=g.serial;
 for(let n=0;n<100;n++){
  step(g,{host:{fireGun:true}});const newlyCreated=[...g.bullets,...g.effects,...g.events].filter(item=>item.id>previousSerial);
  for(const item of newlyCreated){assert(!seen.has(item.id),`duplicate serial ${item.id}`);seen.add(item.id);}previousSerial=g.serial;
 }
 assert.equal(shield.hp,100);assert(q.hp<100);assert(g.events.some(e=>e.type==='gun-hit'));
});

test('snapshots reject nonfinite positions, speed, orientation and duplicate identities atomically',()=>{
 const target=createGame(),before=snapshot(target);
 for(const mutate of [s=>s.pilots[0].pos.x=NaN,s=>s.pilots[0].pos.z=Infinity,s=>s.pilots[0].speed=-1,s=>s.pilots[0].yaw='north',s=>s.pilots[0].pitch=undefined,s=>s.pilots[1].id=s.pilots[0].id]){
  const bad=snapshot(target);mutate(bad);assert.equal(applySnapshot(target,bad),false);assert.deepEqual(snapshot(target),before);
 }
});

test('swept contact includes bot-to-bot collisions and protection expires without a hidden immunity',()=>{
 const g=humanFixture({skirmish:true}),[p,q]=g.pilots;g.time=10;g.pilots.forEach(p=>p.human=false);
 Object.assign(p,{pos:{x:0,y:3000,z:-34},speed:686,throttle:1,yaw:0,spawnProtectedUntil:9});Object.assign(q,{pos:{x:0,y:3000,z:34},speed:686,throttle:1,yaw:Math.PI,spawnProtectedUntil:9});
 step(g,{},.05);assert(p.dead&&q.dead);assert(g.events.some(e=>e.type==='collision'));
});

test('an empty aircraft snapshot is rejected before it can remove the camera pilot',()=>{
 const g=createGame(),before=snapshot(g);assert.equal(applySnapshot(g,{...snapshot(g),pilots:[]}),false);assert.deepEqual(snapshot(g),before);
});
