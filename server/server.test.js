import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createGameServer} from './index.js';
import {AIRFIELDS,fieldPoint,fieldCoordinates} from '../missions.js';
import {collisionRadius} from '../aircraft-collision.js';
import {createRoomManager} from './rooms.js';
import {SERVER_PROTOCOL,SIM_BUILD,createInputBuffer,validateInput,validateJoin} from './protocol.js';
import {normalizeEndpoints,probeRegions,selectRegion,createServerClient} from '../server-client.js';
const join = {t:'join',protocol:SERVER_PROTOCOL,build:SIM_BUILD,pool:'global',arenaId:'coast',region:'enam'};
const origin = 'https://greenkeewi.github.io';
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
function nextMessage(ws, type) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',message);reject(new Error(`Timed out waiting for ${type}`));},3000);
    const message=data=>{const p=JSON.parse(data.toString());if(p.t===type){clearTimeout(timer);ws.off('message',message);resolve(p);}};
    ws.on('message',message);
  });
}
async function connect(url, packet=join) {
  const ws = new WebSocket(url,{origin}); await once(ws,'open'); const welcome=nextMessage(ws,'welcome'); ws.send(JSON.stringify(packet)); return {ws,welcome:await welcome};
}

test('inputs reject malicious shape, nonfinite axes, wrong types and spoofed identity',()=>{
  assert.equal(validateInput({pitch:Infinity}),null); assert.equal(validateInput({yaw:2}),null);
  assert.equal(validateInput({fireGun:'yes'}),null); assert.equal(validateInput({id:'victim'}),null);
  assert.equal(validateInput({toggleGear:true}).toggleGear,true);
});
test('join requires compatible build and explicit regional endpoint',()=>{
  assert.deepEqual(validateJoin(join,'enam'),{pool:'global',arenaId:'coast'});
  assert.equal(validateJoin({...join,pool:'regional',region:'weur'},'enam'),null);
  assert.equal(validateJoin({...join,build:'old'},'enam'),null);
});
test('input sequence, pulse consumption, cooldown and stale held controls',()=>{
  const b=createInputBuffer();
  assert.equal(b.accept({t:'input',q:0,input:{throttle:1,fireGun:true,toggleGear:true}},1000),true);
  assert.equal(b.accept({t:'input',q:0,input:{throttle:-1}},1001),false);
  assert.equal(b.take(1002).toggleGear,true); assert.equal(b.take(1003).toggleGear,false);
  assert.equal(b.take(1004).fireGun,true); assert.equal(b.take(1300).fireGun,false); assert.equal(b.take(1300).throttle,0);
});
test('actions survive coalesced neutral packet before next simulation step',()=>{
  const b=createInputBuffer(); b.accept({t:'input',q:0,input:{flare:true}},1000);b.accept({t:'input',q:1,input:{}},1001);
  assert.equal(b.take(1002).flare,true);assert.equal(b.take(1003).flare,false);
});
test('six independent identities share a server-authoritative room; disconnect bot takeover and cleanup',()=>{
  const manager=createRoomManager({region:'enam',maxRooms:1}); const clients=[];
  for(let i=0;i<6;i++){const c={};assert.ok(manager.join(c,join));clients.push(c);}
  assert.equal(manager.rooms.size,1);assert.equal(new Set(clients.map(c=>c.id)).size,6);
  assert.equal(manager.join({},join),null);
  assert.equal(clients[0].room.game.pilots.filter(p=>p.human).length,6);
  const pilot=clients[0].room.game.pilots.find(p=>p.id===clients[0].id);manager.removeClient(clients[0]);assert.equal(pilot.human,false);
  for(const c of clients.slice(1))manager.removeClient(c);assert.equal(manager.rooms.size,0);
});
test('Node HTTP and real WebSocket clients: join, snapshots, authority, stale input, reconnect',async()=>{
  const app=createGameServer({region:'enam',origins:[origin]}); const address=await app.listen(0,'127.0.0.1');
  const base=`http://127.0.0.1:${address.port}`,url=base.replace('http','ws')+'/play';
  try {
    const health=await(await fetch(base+'/health')).json();assert.equal(health.region,'enam');
    assert.equal((await fetch(base+'/health',{headers:{Origin:'https://evil.invalid'}})).status,403);
    const a=await connect(url),b=await connect(url);assert.equal(a.welcome.roomId,b.welcome.roomId);assert.notEqual(a.welcome.id,b.welcome.id);
    const received=nextMessage(a.ws,'snapshot');a.ws.send(JSON.stringify({t:'input',q:0,input:{throttle:1,toggleGear:true}}));
    const snap=await received;assert.ok(snap.value.tick>0);assert.equal(snap.value.pilots.filter(p=>p.human).length,2);
    const rejected=nextMessage(a.ws,'rejected');a.ws.send(JSON.stringify({t:'input',q:1,id:b.welcome.id,input:{throttle:-1}}));await rejected;
    a.ws.close();await once(a.ws,'close');await delay(20);
    const c=await connect(url);assert.notEqual(c.welcome.id,a.welcome.id);assert.equal(c.welcome.roomId,b.welcome.roomId);
    b.ws.close();c.ws.close();
  } finally {await app.close();}
});
test('wrong build, binary and oversized frames fail closed',async()=>{
  const app=createGameServer({region:'enam',origins:[origin]});const a=await app.listen(0,'127.0.0.1');const url=`ws://127.0.0.1:${a.port}/play`;
  try {
    for (const payload of [JSON.stringify({...join,build:'old'}),Buffer.from('binary'),'x'.repeat(4097)]) {
      const ws=new WebSocket(url,{origin});await once(ws,'open');const closed=once(ws,'close');ws.send(payload);const [code]=await closed;assert.ok([1008,1009].includes(code));
    }
  } finally {await app.close();}
});
test('endpoint configuration forbids insecure remote origins, paths and credentials',()=>{
  for(const url of ['http://example.com','https://name:secret@example.com','https://example.com/path'])assert.throws(()=>normalizeEndpoints([{id:'enam',url}]));
  assert.equal(normalizeEndpoints([{id:'enam',url:'https://example.com/'}])[0].url,'https://example.com');
});
test('region probing checks actual server identity and global selection prefers populated rooms',async()=>{
  const endpoints=[{id:'enam',url:'https://east.example'},{id:'weur',url:'https://europe.example'}];
  const probes=await probeRegions(endpoints,{fetchImpl:async url=>({ok:true,json:async()=>({ok:true,protocol:SERVER_PROTOCOL,build:SIM_BUILD,region:url.includes('east')?'enam':'weur',rooms:[]})})});
  assert.equal(probes.filter(p=>p.available).length,2);
  probes[0].latencyMs=20;probes[1].latencyMs=100;probes[1].rooms=[{pool:'global',arenaId:'coast',players:2,joinable:true}];
  assert.equal(selectRegion(probes,{pool:'regional'}).id,'enam');assert.equal(selectRegion(probes,{pool:'global'}).id,'weur');
  assert.equal(selectRegion(probes,{pool:'regional',region:'weur'}).id,'weur');
  const mismatch=await probeRegions(endpoints.slice(0,1),{fetchImpl:async()=>({ok:true,json:async()=>({ok:true,protocol:SERVER_PROTOCOL,build:SIM_BUILD,region:'wrong',rooms:[]})})});assert.equal(mismatch[0].available,false);
});
test('browser adapter connects two real clients, delivers control/snapshots and coalesces inputs',async()=>{
  const app=createGameServer({region:'enam',origins:[origin]}); const address=await app.listen(0,'127.0.0.1');
  const sent=[];
  class BrowserSocket extends WebSocket {constructor(url){super(url,{origin});}send(data){sent.push(JSON.parse(data));return super.send(data);}}
  const controls=[],snapshots=[];
  const a=createServerClient({onControl:c=>controls.push(c),onSnapshot:s=>snapshots.push(s)},{WebSocketImpl:BrowserSocket});
  const b=createServerClient({},{WebSocketImpl:BrowserSocket});
  try {
    const endpoint={id:'enam',url:`http://127.0.0.1:${address.port}`};await a.connect(endpoint,{pool:'global'});await b.connect(endpoint,{pool:'global'});
    assert.equal(a.state.role,'guest');assert.equal(controls[0].type,'start');assert.ok(a.sampleSnapshot());
    a.submitInput({throttle:1});a.submitInput({toggleGear:true,throttle:1});a.submitInput({throttle:1});const redundant=setInterval(()=>a.submitInput({throttle:1}),5);await delay(220);clearInterval(redundant);
    const packets=sent.filter(p=>p.t==='input');assert.ok(packets.length<=4);assert.equal(packets.filter(p=>p.input.toggleGear).length,1);
    const p=a.sampleSnapshot().pilots.find(p=>p.id===a.state.localId);assert.equal(typeof p.gearDown,'boolean');assert.ok(snapshots.length>1);
    assert.equal(a.getPlayerIds().length,2);
  } finally {a.disconnect();b.disconnect();await app.close();}
});

test('late dedicated joins start safely on their own runway, preserving match and aircraft resources',()=>{
 for(const arenaId of ['coast','valley']){
  const manager=createRoomManager({region:'enam',maxRooms:1}),first={};const room=manager.join(first,{pool:'global',arenaId});
  room.game.time=45;room.game.scores=[4,2];
  for(const p of room.game.pilots.filter(p=>!p.human))Object.assign(p,{grounded:false,pos:{...p.pos,y:p.pos.y+1500},speed:280,throttle:.9,gearDown:false,hp:83,fuel:.42,heat:1});
  const existing=JSON.stringify(room.game.pilots.find(p=>p.id===first.id)),late={};assert.equal(manager.join(late,{pool:'global',arenaId}),room);
  const p=room.game.pilots.find(p=>p.id===late.id),field=AIRFIELDS[p.homeBaseId],local=fieldCoordinates(field,p.pos);
  assert.equal(p.grounded,true);assert.equal(p.speed,0);assert.equal(p.throttle,0);assert.equal(p.gearDown,true);assert.equal(p.pos.y,field.elevation+3);assert(Math.abs(local.across)<1);assert(Math.abs(local.along)<field.halfLength);
  assert.equal(p.hp,83);assert.equal(p.fuel,.42);assert.equal(p.heat,1);assert.equal(room.game.time,45);assert.deepEqual(room.game.scores,[4,2]);assert.equal(JSON.stringify(room.game.pilots.find(p=>p.id===first.id)),existing);
  for(const q of room.game.pilots.filter(q=>q!==p&&!q.dead))assert(Math.hypot(q.pos.x-p.pos.x,q.pos.y-p.pos.y,q.pos.z-p.pos.z)>collisionRadius(p)+collisionRadius(q));
 }
});
test('occupied runway rejects a late join without claiming or moving the existing bot',()=>{
 const manager=createRoomManager({region:'enam',maxRooms:1}),first={};const room=manager.join(first,{pool:'global',arenaId:'coast'});
 for(const p of room.game.pilots.filter(p=>!p.human))Object.assign(p,{grounded:false,pos:{...p.pos,y:p.pos.y+1500},speed:280});
 for(const field of Object.values(AIRFIELDS))for(let along=-field.halfLength;along<=field.halfLength;along+=40)room.game.pilots.push({id:`obstacle-${field.id}-${along}`,human:true,team:0,dead:false,pos:fieldPoint(field,0,along,3)});
 const before=JSON.stringify(room.game.pilots),late={};assert.equal(manager.join(late,{pool:'global',arenaId:'coast'}),null);assert.match(late.joinError,/runway is busy/);assert.equal(late.id,undefined);assert.equal(room.clients.size,1);assert.equal(JSON.stringify(room.game.pilots),before);
});

test('server validates explicit teams and coop queue; capacity cannot spill friends onto enemies',()=>{
 assert.equal(validateJoin({...join,team:2},'enam'),null);assert.equal(validateJoin({...join,match:'coop',team:1},'enam'),null);assert.equal(validateJoin({...join,match:'spoof'},'enam'),null);
 const manager=createRoomManager({region:'enam',maxRooms:1}),clients=Array.from({length:3},()=>({}));
 for(const c of clients){assert(manager.join(c,{...join,match:'coop',team:0}));assert.equal(c.room.game.pilots.find(p=>p.id===c.id).team,0);}
 const room=clients[0].room;assert.equal(room.game.skirmish,false);assert(room.game.pilots.filter(p=>p.team===1).every(p=>!p.human));assert.equal(manager.join({},{...join,match:'coop',team:0}),null);
 const old=clients[1].id;manager.removeClient(clients[1]);assert.equal(room.game.pilots.find(p=>p.id===old).human,false);const rejoin={};assert(manager.join(rejoin,{...join,match:'coop',team:0}));assert.equal(rejoin.room.game.pilots.find(p=>p.id===rejoin.id).team,0);assert.notEqual(rejoin.id,old);
 assert.equal(manager.join({},{...join,match:'versus',team:1}),null,'cannot silently merge a versus pilot into coop');
});
test('two real WebSocket clients join same-team coop, share AI state and synchronized victory',async()=>{
 const app=createGameServer({region:'enam',origins:[origin]});const address=await app.listen(0,'127.0.0.1'),url=`ws://127.0.0.1:${address.port}/play`;let a,b;
 try{
  a=await connect(url,{...join,match:'coop',team:0});b=await connect(url,{...join,match:'coop',team:0});assert.equal(a.welcome.roomId,b.welcome.roomId);
  const [sa,sb]=await Promise.all([nextMessage(a.ws,'snapshot'),nextMessage(b.ws,'snapshot')]);for(const s of [sa,sb]){assert.equal(s.value.pilots.find(p=>p.id===a.welcome.id).team,0);assert.equal(s.value.pilots.find(p=>p.id===b.welcome.id).team,0);assert(s.value.pilots.filter(p=>p.team===1).every(p=>!p.human));}
  assert.deepEqual(sa.value.pilots.filter(p=>p.team===1).map(p=>p.id),sb.value.pilots.filter(p=>p.team===1).map(p=>p.id));
  a.ws.send(JSON.stringify({t:'input',q:1,input:{throttle:1}}));await delay(150);const room=[...app.manager.rooms.values()][0];assert(room.game.pilots.find(p=>p.id===a.welcome.id).throttle>0);
  // Controlled terminal fixture verifies server-owned victory replication, not a flown combat sortie.
  for(const p of room.game.pilots.filter(p=>p.team===1)){p.hp=0;p.dead=true;}const ended=async ws=>{for(let i=0;i<10;i++){const s=await nextMessage(ws,'snapshot');if(s.value.status==='complete')return s.value;}throw Error('No synchronized completion');};const [ea,eb]=await Promise.all([ended(a.ws),ended(b.ws)]);assert.equal(ea.result.winner,0);assert.deepEqual(ea.result,eb.result);
 }finally{a?.ws.close();b?.ws.close();await app.close();}
});
test('two real server clients preserve rapid counter presses and replicated separate inventory',async()=>{
 const app=createGameServer({region:'enam',origins:[origin]}),address=await app.listen(0,'127.0.0.1');
 class BrowserSocket extends WebSocket{constructor(url){super(url,{origin});}}
 const a=createServerClient({},{WebSocketImpl:BrowserSocket}),b=createServerClient({},{WebSocketImpl:BrowserSocket});
 try{const endpoint={id:'enam',url:`http://127.0.0.1:${address.port}`};await a.connect(endpoint,{pool:'global'});await b.connect(endpoint,{pool:'global'});
 for(let n=0;n<10;n++){assert(a.submitInput({flare:true}));assert(b.submitInput({chaff:true}));}
 await delay(600);const s=a.sampleSnapshot(),pa=s.pilots.find(p=>p.id===a.state.localId),pb=s.pilots.find(p=>p.id===b.state.localId);assert.deepEqual([pa.flares,pa.chaff],[50,60]);assert.deepEqual([pb.flares,pb.chaff],[60,50]);const other=b.sampleSnapshot();assert.equal(other.pilots.find(p=>p.id===a.state.localId).flares,50);
 }finally{a.disconnect();b.disconnect();await app.close();}
});
