import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetwork} from '../network.js';
import {rosterConfig} from '../controls.js';
import {createGame,configurePlayers,step,snapshot} from '../sim.js';
import {FixturePeer,pairFixture,settle} from './helpers/rtc-fixture.js';

test('two friends share one team against four AI and preserve 30-second reinforcements',()=>{
 const ids=['host','p1'],c=rosterConfig({mode:'dogfight',teamSize:2,enemyTeamSize:4,enemyRespawnSeconds:30,role:'attack'},ids,{host:0,p1:0}),g=createGame(c);configurePlayers(g,ids,c.playerTeams);
 assert.deepEqual(g.teamSizes,[2,4]);assert.equal(g.pilots.length,6);assert.equal(g.pilots.filter(p=>p.human&&p.team===0).length,2);
 const enemies=g.pilots.filter(p=>p.team===1);assert(enemies.every(p=>!p.human&&p.enemyRespawnEligible));
 const e=enemies[0];Object.assign(e,{dead:true,hp:0,respawnAt:30});g.time=29.9;step(g);assert(e.dead);g.time=30;step(g);assert(!e.dead);assert(e.grounded);assert.equal(e.hp,100);
 const copy=snapshot(g);assert.equal(copy.enemyRespawnSeconds,30);assert.deepEqual(copy.teamSizes,[2,4]);
});
test('host owns synchronized match settings, locks them during sortie, and late joins retain them',async()=>{
 const old=globalThis.RTCPeerConnection;globalThis.RTCPeerConnection=FixturePeer;FixturePeer.all=[];
 const host=createNetwork(),guest=createNetwork(),late=createNetwork();
 try{host.host();assert(host.setMatchSettings({teamSize:2,enemyTeamSize:4}));assert.equal(host.setMatchSettings({enemyTeamSize:5}),false);assert(host.setEnemyRespawn(30));await pairFixture(host,guest);host.setTeam('p1',0);await settle();assert.deepEqual(guest.state.matchSettings,{teamSize:2,enemyTeamSize:4});assert.equal(guest.setMatchSettings({enemyTeamSize:1}),false);
 const config=rosterConfig({mode:'dogfight',role:'attack',...host.state.matchSettings,enemyRespawnSeconds:30},host.getPlayerIds(),host.getTeams());host.broadcastControl({type:'start',config});await settle();assert.equal(host.setMatchSettings({teamSize:3}),false);await pairFixture(host,late);assert.deepEqual(late.state.matchSettings,host.state.matchSettings);assert(late.state.teamsLocked);assert.equal(late.state.enemyRespawnSeconds,30);
 host.broadcastControl({type:'return'});await settle();assert(host.setMatchSettings({enemyTeamSize:3}));await settle();assert.equal(guest.state.matchSettings.enemyTeamSize,3);
 }finally{host.disconnect();guest.disconnect();late.disconnect();globalThis.RTCPeerConnection=old;}
});

test('asymmetric elimination co-op keeps a late friend on the allied team with respawns off',async()=>{
 const old=globalThis.RTCPeerConnection;globalThis.RTCPeerConnection=FixturePeer;FixturePeer.all=[];
 const host=createNetwork(),friend=createNetwork(),late=createNetwork();
 try{
  host.host();host.setMatchSettings({teamSize:3,enemyTeamSize:4});await pairFixture(host,friend);host.setTeam('p1',0);await settle();
  const config=rosterConfig({mode:'dogfight',role:'attack',...host.state.matchSettings,enemyRespawnSeconds:0},host.getPlayerIds(),host.getTeams());
  const game=createGame(config);configurePlayers(game,host.getPlayerIds(),config.playerTeams);
  assert.equal(game.coopTeam,0);assert.equal(game.enemyRespawnSeconds,0);assert.deepEqual(game.teamSizes,[3,4]);
  host.broadcastControl({type:'start',config});await pairFixture(host,late);await settle();
  assert.deepEqual(host.getTeams(),{host:0,p1:0,p2:0});assert.equal(late.state.teams.p2,0);assert.equal(late.state.enemyRespawnSeconds,0);assert(late.state.teamsLocked);
  assert(game.pilots.filter(p=>p.team===1).every(p=>!p.human&&!p.enemyRespawnEligible));
 }finally{host.disconnect();friend.disconnect();late.disconnect();globalThis.RTCPeerConnection=old;}
});
