import test from 'node:test';
import assert from 'node:assert/strict';
import {ActionQueue,keyboardInput} from '../controls.js';
import {createGame,step,snapshot,applySnapshot} from '../sim.js';
import {fullWeaponStores,resupplyAtAirfield} from '../airfield-resupply.js';
import {fieldPoint,AIRFIELDS} from '../missions.js';
import {burstChanceScale,tryHeatFlare,tryRadarChaff} from '../heat-seeker.js';
import {createInputBuffer} from '../server/protocol.js';
import {createInputGuard} from '../network.js';
function air(){const g=createGame({mode:'dogfight',seed:42});for(const [i,p]of g.pilots.entries())Object.assign(p,{human:true,grounded:false,departureActive:false,pos:{x:i*15000,y:3000,z:0},speed:230,throttle:.7});return g;}
test('held counters never repeat; every queued discrete press survives frame drain',()=>{
 const queue=new ActionQueue();for(let n=0;n<10;n++){queue.add('flare');queue.add('chaff');}
 for(let n=0;n<10;n++){const i=keyboardInput(new Set(['KeyF','KeyC']),queue);assert(i.flare&&i.chaff);queue.consume();}
 assert.equal(keyboardInput(new Set(['KeyF','KeyC']),queue).flare,false);assert.equal(queue.size,0);
 queue.add('flare');queue.clear();assert.equal(queue.bursts.flare,0);
});
test('rapid releases have no cooldown, finite separate stores, bounded visuals and snapshot inventory',()=>{
 for(const dt of [1/30,1/60,1/144]){const g=air(),p=g.pilots[0];for(let n=0;n<65;n++)step(g,{host:{flare:true}},dt);assert.equal(p.flares,0);assert.equal(p.chaff,60);assert.equal(p.flareCD,0);assert(g.countermeasures.length<=240);assert.equal(g.events.filter(e=>e.text==='Flares out').length<=60,true);
 const clone=air();applySnapshot(clone,JSON.parse(JSON.stringify(snapshot(g))));assert.equal(clone.pilots[0].flares,0);assert.equal(clone.pilots[0].chaff,60);}
 assert.deepEqual([fullWeaponStores({bomber:true}).flares,fullWeaponStores({bomber:true}).chaff],[120,120]);
});
test('home restock replenishes each aircraft-specific counter inventory',()=>{
 for(const bomber of [false,true]){const g=air(),p=g.pilots[0];Object.assign(p,{bomber,flares:0,chaff:0,homeBaseId:'home',resupplyLatched:false,resupplyReadyAt:0,pos:fieldPoint(AIRFIELDS.home,0,0,10)});assert(resupplyAtAirfield(g,p));assert.equal(p.flares,bomber?120:60);assert.equal(p.chaff,bomber?120:60);}
});
test('fresh bursts increase cumulative opportunities with diminishing per-burst odds, not immunity',()=>{
 const target={id:'host',throttle:1},cloud=(id,type)=>({burstId:id,type,ownerId:'host',pos:{x:0,y:0,z:0},age:0}),m={type:'heat',pos:{x:0,y:0,z:0}};let rolls=0;
 assert.equal(tryHeatFlare(m,target,[cloud(1,'flare'),cloud(1,'flare')],()=>{rolls++;return .99}),null);assert.equal(rolls,1);
 assert.equal(tryHeatFlare(m,target,[cloud(1,'flare')],()=>{throw Error('stale reroll')}),null);
 assert(tryHeatFlare(m,target,[cloud(2,'flare')],()=>.1));assert(burstChanceScale(1)<burstChanceScale(0));assert(burstChanceScale(2)<burstChanceScale(1));
 const radar={type:'radar',pos:{x:0,y:0,z:0}};assert.equal(tryRadarChaff(radar,target,[cloud(1,'flare')],()=>0),null);assert.equal(tryRadarChaff(radar,target,[cloud(1,'chaff')],()=>.99),null);assert(tryRadarChaff(radar,target,[cloud(2,'chaff')],()=>0));
 const failures={type:'heat',pos:{x:0,y:0,z:0}};assert.equal(tryHeatFlare(failures,target,Array.from({length:60},(_,i)=>cloud(i,'flare')),()=>.999),null);
});
test('server buffer and peer guard accept rapid counters without merging or replaying pulses',()=>{
 const buffer=createInputBuffer(),guard=createInputGuard(()=>1000);
 for(let q=0;q<30;q++){assert(buffer.accept({t:'input',q,input:{flare:true,chaff:true}},1000+q));assert.equal(guard({t:'actions',q,input:{flare:true,chaff:true}},'actions').flare,true);}
 for(let n=0;n<30;n++){const i=buffer.take(1020+n*17);assert(i.flare&&i.chaff);}assert.equal(buffer.take(1020).flare,false);
 assert.equal(buffer.accept({t:'input',q:29,input:{flare:true}},1021),false);
});
test('AI consumes one pending defensive burst rather than holding the dispenser every frame',()=>{
 const g=air(),p=g.pilots[0],q=g.pilots[1];g.time=20;Object.assign(p,{human:false,aiFlarePending:true,aiDefend:20,throttle:.6});
 g.missiles.push({id:999,type:'heat',ownerId:q.id,team:q.team,targetId:p.id,pos:{x:0,y:3000,z:-1000},dir:{x:0,y:0,z:1},speed:450,age:0,life:10,decoyed:false,seekerLost:false});
 for(let n=0;n<60;n++)step(g,{},1/60);assert.equal(p.flares,59);assert.equal(p.chaff,60);
});
