import test from 'node:test';
import assert from 'node:assert/strict';
import {assignTeam,fillTeams,validAssignments} from '../lobby-teams.js';
import {createGame,configurePlayers,step,snapshot} from '../sim.js';
import {rosterConfig} from '../controls.js';
import {createNetwork} from '../network.js';
import {FixturePeer,pairFixture,settle} from './helpers/rtc-fixture.js';

test('team authority rejects invalid IDs, values and fourth human; default roster balanced',()=>{
 const ids=['host','p1','p2','p3','p4','p5'],teams=fillTeams({},ids);assert.equal(Object.values(teams).filter(t=>t===0).length,3);
 assert.equal(assignTeam(teams,ids,'spoof',0),false);assert.equal(assignTeam(teams,ids,'p1',2),false);assert.equal(assignTeam(teams,ids,'p1',0),false);
 assert.equal(validAssignments({host:0,p1:0,p2:0,p3:0},ids),false);
});
test('same-team roster creates enough seats and leaves enemies AI; team switch changes actual aircraft',()=>{
 const ids=['host','p1'],c=rosterConfig({mode:'dogfight',teamSize:1},ids,{host:0,p1:0}),g=createGame(c);configurePlayers(g,ids,c.playerTeams);
 assert.equal(c.teamSize,2);assert.deepEqual(g.pilots.filter(p=>p.human).map(p=>p.team),[0,0]);assert(g.pilots.filter(p=>p.team===1).every(p=>!p.human));assert.equal(new Set(g.pilots.map(p=>p.id)).size,4);
 configurePlayers(g,ids,{host:1,p1:1});assert(g.pilots.filter(p=>p.human).every(p=>p.team===1));
});
test('same-team pilots cannot lock or shoot friends; eliminating AI completes team victory',()=>{
 const ids=['host','p1'],g=createGame({mode:'dogfight',teamSize:2});configurePlayers(g,ids,{host:0,p1:0});
 const [a,b]=g.pilots.filter(p=>p.human);Object.assign(a,{pos:{x:0,y:4000,z:0},grounded:false,speed:100,yaw:0,pitch:0,departureActive:false});Object.assign(b,{pos:{x:0,y:4000,z:250},grounded:false,speed:100,yaw:0,pitch:0,departureActive:false});
 for(const e of g.pilots.filter(p=>p.team===1))Object.assign(e,{pos:{x:20000,y:4000,z:20000},human:true});
 for(let i=0;i<120;i++)step(g,{host:{fireGun:true,fireHeat:true,fireRadar:true},p1:{}},1/60);
 assert.notEqual(a.targetId,b.id);assert.equal(b.hp,100);assert(!g.missiles.some(m=>m.targetId===b.id));
 for(const e of g.pilots.filter(p=>p.team===1)){e.dead=true;e.hp=0;}step(g,{},1/60);assert.equal(g.status,'complete');assert.equal(snapshot(g).result.winner,0);
});
test('peer host validates guest own-team requests, locks teams in flight and replicates lobby changes',async()=>{
 const old=globalThis.RTCPeerConnection;globalThis.RTCPeerConnection=FixturePeer;FixturePeer.all=[];const host=createNetwork(),guest=createNetwork();
 try{host.host();const pcs=await pairFixture(host,guest);assert.equal(guest.state.teams.p1,1);
 guest.setTeam('p1',0);await settle();assert.equal(host.state.teams.p1,0);assert.equal(guest.state.teams.p1,0);
 assert.equal(guest.setTeam('host',1),false);const ch=pcs.guest.channels.find(c=>c.label==='control');ch.send(JSON.stringify({t:'team',team:1,id:'host'}));await settle();assert.equal(host.state.teams.host,0);
 host.broadcastControl({type:'start',config:{mode:'dogfight',teamSize:2,role:'attack',playerTeams:host.getTeams()}});await settle();assert(guest.state.teamsLocked);assert.equal(host.setTeam('p1',1),false);ch.send(JSON.stringify({t:'team',team:1}));await settle();assert.equal(host.state.teams.p1,0);
 guest.disconnect();await settle();await pairFixture(host,guest);assert.equal(guest.state.teams.p1,0);assert(guest.state.teamsLocked);
 host.broadcastControl({type:'return'});await settle();assert(!guest.state.teamsLocked);assert(host.setTeam('p1',1));await settle();assert.equal(guest.state.teams.p1,1);
 guest.disconnect();await settle();assert.deepEqual(host.getTeams(),{host:0});await pairFixture(host,guest);assert.equal(guest.state.teams.p1,1);
 }finally{host.disconnect();guest.disconnect();globalThis.RTCPeerConnection=old;}
});
