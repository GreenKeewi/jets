import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetwork} from '../network.js';
import {FixturePeer,pairFixture,settle} from './helpers/rtc-fixture.js';

async function session(run){
  const oldRTC=globalThis.RTCPeerConnection,oldPerformance=globalThis.performance;
  let time=1000;globalThis.performance={now:()=>time};globalThis.RTCPeerConnection=FixturePeer;
  FixturePeer.all=[];
  const controls=[];const host=createNetwork(),guest=createNetwork({onControl:m=>controls.push(m)});
  try{host.host();const pcs=await pairFixture(host,guest);await run({host,guest,pcs,controls,advance:n=>time+=n});}
  finally{host.disconnect();guest.disconnect();globalThis.RTCPeerConnection=oldRTC;globalThis.performance=oldPerformance;}
}
const config={mode:'dogfight',teamSize:1,role:'attack',seed:5};

test('a fresh sortie clears previous guest controls and queued action pulses',()=>session(async({host,guest})=>{
  guest.submitInput({pitch:.7,flare:true});await settle();
  host.broadcastControl({type:'start',config});await settle();
  const input=host.consumeInputs().p1;
  assert.ok(!input||input.pitch===0,'the first new-sortie step must not reuse old pitch');
  assert.ok(!input||input.flare===false,'the first new-sortie step must not spend a countermeasure queued in the old sortie');
}));
test('reliable action traffic cannot keep stale realtime axes active',()=>session(async({host,guest,pcs,advance})=>{
  guest.submitInput({pitch:.8});await settle();assert.equal(host.consumeInputs().p1.pitch,.8);
  const realtime=pcs.guest.channels.find(c=>c.label==='realtime');realtime.bufferedAmount=200000;
  for(let i=0;i<4;i++){advance(300);guest.submitInput({pitch:.8,flare:true});await settle();}
  assert.equal(host.consumeInputs().p1.pitch,0,'axes must expire based on the last axes packet, independently of reliable actions');
}));
test('a buffer-full exception during reliable queue flush preserves the command for retry',()=>session(async({host,pcs,controls})=>{
  const control=pcs.host.channels.find(c=>c.label==='control');control.bufferedAmount=200000;
  host.broadcastControl({type:'start',config});
  assert.equal(host.getDiagnostics().transport[0].queuedControl,1);
  control.failSends=1;control.low();await settle();
  assert.equal(host.getDiagnostics().transport[0].queuedControl,1,'failed send must leave the command queued');
  control.low();await settle();assert.equal(controls.at(-1)?.type,'start');
  assert.equal(controls.filter(c=>c.type==='start').length,1);
}));
test('late events from a removed connection cannot recreate its input state',()=>session(async({host,guest,pcs})=>{
  guest.submitInput({pitch:.8});await settle();
  const handler=pcs.host.channels.find(c=>c.label==='realtime').onmessage;
  host.removePeer('p1');await settle();
  handler({data:JSON.stringify({t:'axes',q:999,g:host.state.inputGeneration,input:{pitch:1}})});
  assert.deepEqual(host.consumeInputs(),{},'removed peers must stay removed even if their queued event runs later');
}));
test('old in-flight axes and weapon actions cannot affect a new sortie',()=>session(async({host,guest,pcs,advance})=>{
  const axes=pcs.guest.channels.find(c=>c.label==='realtime'),actions=pcs.guest.channels.find(c=>c.label==='control');
  axes.hold=actions.hold=true;guest.submitInput({pitch:.9,flare:true});await settle();
  const priorGeneration=host.state.inputGeneration;
  host.broadcastControl({type:'start',config});await settle();
  assert.ok(host.state.inputGeneration>priorGeneration);
  axes.release();actions.release();await settle();assert.deepEqual(host.consumeInputs(),{});
  axes.hold=actions.hold=false;advance(10);guest.submitInput({pitch:-.4,flare:true});await settle();
  const fresh=host.consumeInputs().p1;assert.equal(fresh.pitch,-.4);assert.equal(fresh.flare,true);
}));
test('old world snapshots cannot roll a guest back after a new sortie begins',()=>session(async({host,guest,pcs,advance})=>{
  const realtime=pcs.host.channels.find(c=>c.label==='realtime');realtime.hold=true;
  host.broadcastSnapshot({pilots:[{id:'host',pos:{x:99,y:100,z:0}}]});
  host.broadcastControl({type:'start',config});await settle();
  realtime.release();await settle();assert.equal(guest.sampleSnapshot(),null);
  realtime.hold=false;advance(50);host.broadcastSnapshot({pilots:[{id:'host',pos:{x:2,y:100,z:0}}]});await settle();
  assert.equal(guest.sampleSnapshot().pilots[0].pos.x,2);
}));
test('pause/resume drops pending inputs and rejects even current-generation input while paused',()=>session(async({host,guest,advance})=>{
  host.broadcastControl({type:'start',config});await settle();guest.submitInput({pitch:.8,flare:true});await settle();
  host.broadcastControl({type:'pause'});await settle();advance(300);guest.submitInput({pitch:1,chaff:true});await settle();
  host.broadcastControl({type:'resume'});await settle();assert.deepEqual(host.consumeInputs(),{});
  guest.submitInput({pitch:-.3});await settle();assert.equal(host.consumeInputs().p1.pitch,-.3);
}));
test('a direct reliable send buffer exception queues and retries the command exactly once',()=>session(async({host,pcs,controls})=>{
  const control=pcs.host.channels.find(c=>c.label==='control');control.failSends=1;
  host.broadcastControl({type:'start',config});assert.equal(host.getDiagnostics().transport[0].queuedControl,1);
  control.low();await settle();assert.equal(controls.filter(c=>c.type==='start').length,1);
}));
test('a peer that never drains reliable control is removed before its queue can grow without bound',()=>session(async({host,pcs})=>{
  const control=pcs.host.channels.find(c=>c.label==='control');control.bufferedAmount=200000;
  for(let i=0;i<65;i++)host.broadcastControl({type:i%2?'resume':'pause'});
  assert.equal(host.state.peers.length,0);assert.deepEqual(host.getPlayerIds(),['host']);
  assert.match(host.state.diagnostic,/stopped reading control/);
}));
test('normal and ace difficulty are carried in authoritative start settings and invalid values are rejected',()=>session(async({host,controls})=>{
  for(const difficulty of ['normal','ace']){host.broadcastControl({type:'start',config:{...config,difficulty}});await settle();assert.equal(controls.at(-1).config.difficulty,difficulty);}
  for(const difficulty of ['hard',42,{},null])assert.throws(()=>host.broadcastControl({type:'start',config:{...config,difficulty}}),/Unsupported host game command/);
}));
test('only supported host-selected routes reach guests and late-join settings',()=>session(async({host,controls})=>{
  for(const routeId of ['local','northpoint','westhaven']){host.broadcastControl({type:'start',config:{...config,mode:'freeflight',routeId}});await settle();assert.equal(controls.at(-1).config.routeId,routeId);}
  for(const routeId of ['other',42,{},null])assert.throws(()=>host.broadcastControl({type:'start',config:{...config,mode:'freeflight',routeId}}),/Unsupported host game command/);
  host.broadcastControl({type:'pause'});const lateControls=[],late=createNetwork({onControl:message=>lateControls.push(message)});
  try{await pairFixture(host,late);assert.equal(lateControls[0].config.mode,'freeflight');assert.equal(lateControls[0].config.routeId,'westhaven');assert.equal(lateControls.at(-1).type,'pause');assert.equal(late.state.inputGeneration,host.state.inputGeneration);}
  finally{late.disconnect();}
}));
