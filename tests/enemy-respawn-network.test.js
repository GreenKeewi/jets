import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetwork} from '../network.js';
import {rosterConfig} from '../controls.js';
import {FixturePeer,pairFixture,settle} from './helpers/rtc-fixture.js';

test('respawns are configured only for same-team dogfight humans',()=>{
 const base={mode:'dogfight',teamSize:2,role:'attack',enemyRespawnSeconds:30};
 for(const team of [0,1])assert.deepEqual(rosterConfig(base,['host','p1'],{host:team,p1:team}),{...base,playerTeams:{host:team,p1:team},coopTeam:team});
 for(const config of [{...base,mode:'strike'}, {...base,mode:'freeflight'}, {...base,enemyRespawnSeconds:1}])assert.equal(rosterConfig(config,['host','p1'],{host:0,p1:0}).enemyRespawnSeconds,0);
 const mixed=rosterConfig({...base,coopTeam:0},['host','p1'],{host:0,p1:1});assert.equal(mixed.enemyRespawnSeconds,0);assert.equal(mixed.coopTeam,undefined);
});

test('host respawn setting synchronizes, locks, survives restart and latejoin; guest cannot mutate',async()=>{
 const old=globalThis.RTCPeerConnection;globalThis.RTCPeerConnection=FixturePeer;FixturePeer.all=[];
 const host=createNetwork(),guest=createNetwork(),late=createNetwork();
 try{
  assert.equal(host.setEnemyRespawn(30),false);host.host();assert.equal(host.getEnemyRespawn(),0);
  for(const invalid of [-1,45,Infinity,'30',null])assert.equal(host.setEnemyRespawn(invalid),false);
  assert.equal(host.setEnemyRespawn(30),true);
  const pcs=await pairFixture(host,guest);assert.equal(guest.state.enemyRespawnSeconds,30);
  assert.equal(guest.setEnemyRespawn(0),false);
  pcs.guest.channels.find(c=>c.label==='control').send(JSON.stringify({t:'roster',ids:['p1'],teams:{host:0,p1:0},locked:false,enemyRespawnSeconds:0}));await settle();assert.equal(host.getEnemyRespawn(),30);
  host.setTeam('p1',0);await settle();
  const config=rosterConfig({mode:'dogfight',teamSize:3,role:'attack',enemyRespawnSeconds:host.getEnemyRespawn()},host.getPlayerIds(),host.getTeams());
  for(const invalid of [{...config,enemyRespawnSeconds:2},{...config,coopTeam:2},{...config,coopTeam:1},{...config,mode:'strike'}])assert.throws(()=>host.broadcastControl({type:'start',config:invalid}));
  host.broadcastControl({type:'start',config});await settle();
  for(const command of ['pause','resume','restart']){host.broadcastControl({type:command});await settle();assert.equal(host.setEnemyRespawn(60),false);assert.equal(guest.state.teamsLocked,true);assert.equal(guest.getEnemyRespawn(),30);}
  await pairFixture(host,late);assert.equal(late.state.enemyRespawnSeconds,30);assert.equal(late.state.teamsLocked,true);assert.equal(host.getTeams().p2,0);
  guest.disconnect();await settle();await pairFixture(host,guest);assert.equal(guest.getEnemyRespawn(),30);assert.equal(guest.state.teamsLocked,true);assert.equal(host.getTeams().p1,0);
  host.broadcastControl({type:'return'});await settle();assert.equal(host.setEnemyRespawn(60),true);await settle();assert.equal(guest.getEnemyRespawn(),60);
  assert.equal(host.setEnemyRespawn(0),true);await settle();assert.equal(late.getEnemyRespawn(),0);
  host.disconnect();assert.equal(host.getEnemyRespawn(),0);
 }finally{host.disconnect();guest.disconnect();late.disconnect();globalThis.RTCPeerConnection=old;}
});

test('legacy minute selections migrate to 30 seconds, preserving Off',()=>{
 const host=createNetwork();host.host();
 for(const legacy of [120,180,300]){
  assert.equal(host.setEnemyRespawn(legacy),true);assert.equal(host.getEnemyRespawn(),30);
  assert.equal(rosterConfig({mode:'dogfight',teamSize:2,enemyRespawnSeconds:legacy},['host'],{host:0}).enemyRespawnSeconds,30);
 }
 assert.equal(host.setEnemyRespawn(0),true);assert.equal(host.getEnemyRespawn(),0);host.disconnect();
});
