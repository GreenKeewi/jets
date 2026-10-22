import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createGameServer} from './index.js';
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
