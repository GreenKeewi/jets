// Run against local Wrangler by default. A live URL must be explicitly supplied.
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {SERVER_PROTOCOL,SIM_BUILD} from '../protocol.js';
const base=process.argv[2] || 'http://127.0.0.1:8787',origin='https://greenkeewi.github.io';
const health=await(await fetch(`${base}/health`,{headers:{Origin:origin}})).json();
assert.equal(health.ok,true);assert.equal(health.region,'enam');assert.equal(health.build,SIM_BUILD);
assert.equal((await fetch(`${base}/health`,{headers:{Origin:'https://evil.invalid'}})).status,403);
const clients=[];
const waitFor=(ws,type)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(`No ${type} after 8s`)),8000);
  function receive(data){const p=JSON.parse(data.toString());if(p.t===type){clearTimeout(timer);ws.off('message',receive);resolve(p);}}
  ws.on('message',receive);ws.once('error',reject);
});
try {
  for(let i=0;i<6;i++){
    const ws=new WebSocket(`${base.replace(/^http/,'ws')}/play`,{origin});clients.push({ws});
    const welcome=waitFor(ws,'welcome');ws.once('open',()=>ws.send(JSON.stringify({t:'join',protocol:SERVER_PROTOCOL,build:SIM_BUILD,pool:'global',region:'enam',arenaId:'coast'})));
    clients[i].welcome=await welcome;
  }
  assert.equal(new Set(clients.map(c=>c.welcome.id)).size,6);
  assert.equal(new Set(clients.map(c=>c.welcome.roomId)).size,1);
  assert.ok(clients.every(c=>c.ws.extensions.includes('permessage-deflate')), 'WebSocket compression negotiated');
  const rejected=await new Promise(resolve=>{const ws=new WebSocket(`${base.replace(/^http/,'ws')}/play`,{origin});ws.on('unexpected-response',(_,r)=>{r.resume();resolve(r.statusCode);ws.terminate();});ws.on('error',()=>{});});assert.equal(rejected,429);
  const start=await waitFor(clients[0].ws,'snapshot');assert.equal(start.value.pilots.filter(p=>p.human).length,6);
  let sequence=0;const timer=setInterval(()=>{for(const c of clients)c.ws.send(JSON.stringify({t:'input',q:sequence,input:{throttle:1,pitch:.2}}));sequence++;},50);
  await new Promise(resolve=>setTimeout(resolve,2000));clearInterval(timer);
  const end=await waitFor(clients[0].ws,'snapshot');assert.ok(end.value.tick-start.value.tick>=60,'simulation must advance independently of input');
  assert.ok(end.value.pilots.every(p=>[p.pos.x,p.pos.y,p.pos.z,p.hp,p.speed].every(Number.isFinite)));
  const malformed=clients[5].ws;const closed=new Promise(resolve=>malformed.once('close',(code)=>resolve(code)));malformed.send(JSON.stringify({t:'input',q:9999,id:clients[0].welcome.id,input:{throttle:1}}));
  const rejection=await waitFor(malformed,'rejected');assert.equal(rejection.q,9999);malformed.send('not-json');assert.equal(await closed,1008);
  console.log(JSON.stringify({ok:true,transport:'Cloudflare Workers local runtime',clients:6,roomId:clients[0].welcome.roomId,serverTicks:end.value.tick-start.value.tick,simulationSeconds:end.value.time-start.value.time,snapshotBytes:JSON.stringify(end.value).length,negotiatedExtensions:clients[0].ws.extensions,checks:['CORS allowlist','six shared unique pilots','seventh player rejected','server-owned simulation','finite state','identity spoof rejection','malformed packet close']},null,2));
} finally {for(const c of clients)c.ws.close();}
