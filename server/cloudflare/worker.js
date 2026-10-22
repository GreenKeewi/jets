import {DurableObject} from 'cloudflare:workers';
import {createRoomManager} from '../rooms.js';
import {SERVER_PROTOCOL, SIM_BUILD, validateJoin} from '../protocol.js';

const headersFor = origin => ({'Content-Type':'application/json','Cache-Control':'no-store', ...(origin ? {'Access-Control-Allow-Origin':origin,'Vary':'Origin'} : {})});
const allowed = (request, env) => (env.ALLOWED_ORIGINS || 'https://greenkeewi.github.io').split(',').map(s => s.trim()).includes(request.headers.get('Origin'));
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || !['/health','/ping','/play'].includes(url.pathname)) return new Response('Not found',{status:404});
    if (request.headers.has('Origin') && !allowed(request,env)) return new Response('Origin not allowed',{status:403});
    if (url.pathname === '/play' && (!allowed(request,env) || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')) return new Response('WebSocket required',{status:400});
    // One shared object keeps duration bounded. This is a best-effort eastern-North-America
    // placement hint, NOT a promise of Canadian residency or a per-player edge simulation.
    const id = env.SKY.idFromName('shared-sky-v1');
    return env.SKY.get(id,{locationHint:'enam'}).fetch(request);
  },
};

export class SkyRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx,env); this.env = env; this.region = env.REGION || 'enam';
    this.manager = createRoomManager({region:this.region,maxRooms:1,playersPerRoom:6,clock:()=>Date.now()});
    this.clients = new Map(); this.attempts = new Map(); this.timer = null; this.last = 0; this.accumulator = 0; this.snapshots = 0;
  }
  async fetch(request) {
    const url = new URL(request.url), origin = request.headers.get('Origin');
    if (origin && !allowed(request,this.env)) return new Response('Origin not allowed',{status:403});
    if (['/health','/ping'].includes(url.pathname)) return Response.json({ok:true,protocol:SERVER_PROTOCOL,build:SIM_BUILD,region:this.region,locationHint:'enam',locationGuaranteed:false,rooms:this.manager.occupancy(),serverTime:Date.now(),capacity:6},{headers:headersFor(origin)});
    if (!allowed(request,this.env) || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Forbidden',{status:403});
    const now = Date.now(), ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    for (const [key,value] of this.attempts) if (now-value.at > 60000) this.attempts.delete(key);
    if (!this.attempts.has(ip) && this.attempts.size >= 1024) return new Response('Please retry later',{status:429});
    const attempt = this.attempts.get(ip) || {at:now,count:0}; attempt.count++; this.attempts.set(ip,attempt);
    if (attempt.count > 30 || this.clients.size >= 6) return new Response('The shared sky is full. Try again later.',{status:429});
    const pair = new WebSocketPair(), browser = pair[0], socket = pair[1];
    // A real-time simulation cannot hibernate while pilots are flying. Stop the timer
    // and drop in-memory rooms when everyone leaves. No SQL writes, accounts or tokens.
    socket.accept();
    const client = {ws:socket,joined:false,lastMessage:now,lastRespawn:0,count:0,window:now,close:(code,text)=>this.drop(socket,code,text)};
    this.clients.set(socket,client);
    socket.addEventListener('message', event => this.message(socket,event.data));
    socket.addEventListener('close', () => this.drop(socket));
    socket.addEventListener('error', () => this.drop(socket));
    this.start();
    return new Response(null,{status:101,webSocket:browser});
  }
  send(client, packet) {
    try { client.ws.send(JSON.stringify(packet)); return true; }
    catch { this.drop(client.ws); return false; }
  }
  drop(socket, code = 1000, reason = 'Disconnected') {
    const client = this.clients.get(socket); if (!client) return;
    this.clients.delete(socket); this.manager.removeClient(client);
    try { socket.close(code,reason); } catch {}
    if (!this.clients.size) { clearInterval(this.timer); this.timer = null; this.accumulator = 0; }
  }
  message(socket, data) {
    const client = this.clients.get(socket); if (!client) return;
    const now = Date.now();
    if (typeof data !== 'string' || new TextEncoder().encode(data).byteLength > 4096) return this.drop(socket,1008,'Packet too large');
    if (now-client.window >= 1000) { client.window = now; client.count = 0; }
    if (++client.count > 45) return this.drop(socket,1008,'Too many messages');
    let packet; try { packet = JSON.parse(data); } catch { return this.drop(socket,1008,'Invalid JSON'); }
    if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return this.drop(socket,1008,'Invalid packet');
    client.lastMessage = now;
    if (!client.joined) {
      const join = validateJoin(packet,this.region);
      if (!join) return this.drop(socket,1008,'Incompatible version or region. Reload the game.');
      // One shared queue, not separate "global" and "regional" rooms. The transport's
      // regional option selects this endpoint; everybody here shares the same sky.
      join.pool = 'global';
      const room = this.manager.join(client,join);
      if (!room) return this.drop(socket,1013,'The shared sky is full or flying another arena. Try again later.');
      client.joined = true;
      this.send(client,{t:'welcome',protocol:SERVER_PROTOCOL,build:SIM_BUILD,id:client.id,roomId:room.id,region:this.region,pool:'global',config:room.config,value:this.manager.snapshot(room)});
    } else if (packet.t === 'input') {
      if (!client.input.accept(packet,now)) this.send(client,{t:'rejected',q:Number.isSafeInteger(packet.q) ? packet.q : null});
    } else if (packet.t === 'respawn' && Object.keys(packet).length === 1) {
      if (now-client.lastRespawn >= 1000) { client.lastRespawn = now; this.send(client,{t:'respawn',ok:this.manager.respawn(client)}); }
    } else if (packet.t === 'ping' && Object.keys(packet).length === 2 && Number.isSafeInteger(packet.q) && packet.q >= 0) this.send(client,{t:'pong',q:packet.q});
    else this.drop(socket,1008,'Unsupported packet');
  }
  start() {
    if (this.timer) return;
    this.last = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      this.accumulator = Math.min(.1,this.accumulator+(now-this.last)/1000); this.last = now;
      while (this.accumulator >= 1/60) { this.manager.step(); this.accumulator -= 1/60; this.snapshots++; }
      for (const [socket,client] of this.clients) if (now-client.lastMessage > (client.joined ? 15000 : 10000)) this.drop(socket,1001,'Connection idle. Rejoin the shared sky.');
      if (this.snapshots >= 6) {
        this.snapshots = 0;
        for (const room of this.manager.rooms.values()) {
          const packet = {t:'snapshot',value:this.manager.snapshot(room)};
          for (const client of room.clients.values()) this.send(client,packet);
        }
      }
    },1000/30);
  }
}
