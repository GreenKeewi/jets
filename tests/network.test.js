import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, createInputGuard, decodePairing, interpolateSnapshots, serializePacket } from '../network.js';
import {createGame,configurePlayers,step,snapshot} from '../sim.js';

test('untrusted input rejects identity, nonfinite/out-of-range axes and invalid button types', () => {
  for (const input of [{id:'host'}, {pitch:NaN}, {yaw:1.01}, {throttle:-1.01}, {brake:1}, {fireHeat:'yes'}, {fireGun:'yes'}]) assert.equal(validateInput(input),null);
  assert.equal(validateInput({pitch:-.5,throttle:1}).pitch,-.5);
});
test('connection guard rejects replay, identity injection and bursts; cooldown is host-clock based', () => {
  let time=0; const guard=createInputGuard(()=>time);
  assert.equal(guard({t:'axes',q:0,input:{pitch:1}},'axes').pitch,1);
  assert.equal(guard({t:'axes',q:0,input:{pitch:-1}},'axes'),null);
  assert.equal(guard({t:'axes',q:1,input:{},id:'host'},'axes'),null);
  assert.equal(guard({t:'actions',q:0,input:{fireHeat:true}},'actions').fireHeat,true);
  assert.equal(guard({t:'actions',q:1,input:{fireHeat:true}},'actions').fireHeat,false);
  time=300;
  assert.equal(guard({t:'actions',q:2,input:{fireHeat:true}},'actions').fireHeat,true);
  assert.equal(guard({t:'axes',q:1,input:{fireHeat:true}},'axes').fireHeat,false);
  let denied=0; for(let q=2;q<200;q++) if(!guard({t:'axes',q,input:{}},'axes')) denied++;
  assert.ok(denied>80);
});
test('manual pairing rejects malformed, wrong-kind, camera/audio and unreasonable payloads', () => {
  assert.throws(()=>decodePairing('garbage'));
  assert.throws(()=>decodePairing('JETS3.'+'x'.repeat(100001)));
  assert.throws(()=>decodePairing('JETS1.any-previous-code'),/Reload Jets on both devices/);
  assert.throws(()=>decodePairing('JETS2.any-previous-code'),/Reload Jets on both devices/);
  const payload={v:3,type:'offer',session:'s'.repeat(20),pair:'p'.repeat(20),slot:'p1',description:{type:'offer',sdp:'v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n'}};
  const code=()=>`JETS3.${btoa(JSON.stringify(payload))}`;
  assert.equal(decodePairing(code(),'offer').slot,'p1');
  assert.throws(()=>decodePairing(code(),'answer'));
  payload.description.sdp+='m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
  assert.throws(()=>decodePairing(code()));
});
test('snapshot interpolation chooses matching identity and shortest heading arc without mutation', () => {
  const a={pilots:[{id:'p1',pos:{x:0,y:2,z:0},yaw:3.1,speed:10}]};
  const b={pilots:[{id:'p2',pos:{x:50,y:2,z:0},yaw:0,speed:20},{id:'p1',pos:{x:10,y:2,z:0},yaw:-3.1,speed:20}]};
  const frames=[{at:0,value:a},{at:100,value:b}],mid=interpolateSnapshots(frames,50);
  assert.equal(mid.pilots[1].pos.x,5);assert.equal(mid.pilots[0].pos.x,50);
  assert.ok(Math.abs(Math.abs(mid.pilots[1].yaw)-Math.PI)<.001);
  assert.equal(b.pilots[1].pos.x,10);assert.equal(interpolateSnapshots(frames,1000).pilots[1].pos.x,10);
  assert.equal(interpolateSnapshots([],50),null);
});
test('six simultaneous flare/chaff volleys stay within wire budget without changing authoritative state', () => {
  const game=createGame({teamSize:3}),ids=['host','p1','p2','p3','p4','p5'];configurePlayers(game,ids);
  const inputs=Object.fromEntries(ids.map(id=>[id,{flare:true,chaff:true,fireHeat:true,fireRadar:true}]));
  for(let i=0;i<295;i++)step(game,inputs,1/60);
  const state=snapshot(game),packet={t:'snapshot',q:0,value:state},before=JSON.stringify(packet);
  assert.ok(before.length>60000,'reproduces the original six-pilot packet overflow');
  const encoded=serializePacket(packet);assert.ok(encoded);assert.ok(new TextEncoder().encode(encoded).byteLength<=60000);
  assert.equal(JSON.stringify(packet),before,'serialization must not alter host state');
  const decoded=JSON.parse(encoded);assert.deepEqual(decoded.value.pilots.map(p=>p.id),state.pilots.map(p=>p.id));
  assert.equal(decoded.value.tick,state.tick);assert.equal(decoded.value.countermeasures.length<=state.countermeasures.length,true);
  assert.ok(Math.abs(decoded.value.pilots[0].pos.y-state.pilots[0].pos.y)<.0001);
  const massive={...packet,value:{...state,countermeasures:Array(2000).fill(state.countermeasures[0])}};
  const bounded=serializePacket(massive);assert.ok(bounded);assert.ok(new TextEncoder().encode(bounded).byteLength<=60000);
});
