import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {WebSocketServer, WebSocket} from 'ws';
import {createRoomManager} from './rooms.js';
import {SERVER_PROTOCOL, SIM_BUILD, validateJoin} from './protocol.js';

export function createGameServer({region = process.env.REGION || 'local', origins = (process.env.ALLOWED_ORIGINS || 'https://greenkeewi.github.io').split(',').map(s => s.trim()).filter(Boolean), maxRooms = 8, maxConnections = 64, autoTick = true} = {}) {
  const manager = createRoomManager({region, maxRooms});
  const clients = new Set(), upgradeAttempts = new Map();
  const allowed = origin => origins.includes(origin);
  const server = http.createServer((request, response) => {
    const origin = request.headers.origin;
    if (origin && !allowed(origin)) { response.writeHead(403); return response.end('Origin not allowed'); }
    if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary','Origin'); }
    response.setHeader('Cache-Control','no-store');
    if (request.method !== 'GET' || !['/health','/ping'].includes(request.url?.split('?')[0])) { response.writeHead(404); return response.end(); }
    response.writeHead(200, {'Content-Type':'application/json'});
    response.end(JSON.stringify({ok:true, protocol:SERVER_PROTOCOL, build:SIM_BUILD, region, rooms:manager.occupancy(), serverTime:Date.now()}));
  });
  const wss = new WebSocketServer({noServer:true, maxPayload:4096, perMessageDeflate:false});
  server.on('upgrade', (request, socket, head) => {
    // Browser origin is an abuse reduction measure, not authentication. Non-browser clients can spoof it.
    const now = Date.now(), ip = request.socket.remoteAddress || 'unknown';
    if (!upgradeAttempts.has(ip) && upgradeAttempts.size >= 4096) { socket.destroy(); return; }
    const record = upgradeAttempts.get(ip) || {at:now, count:0};
    if (now - record.at > 60000) { record.at = now; record.count = 0; }
    record.count++; upgradeAttempts.set(ip, record);
    if (request.url !== '/play' || !allowed(request.headers.origin) || clients.size >= maxConnections || record.count > 60) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws));
  });
  function send(client, packet) {
    if (client.ws.readyState !== WebSocket.OPEN) return false;
    if (client.ws.bufferedAmount > 262144) { client.close(1013, 'Connection too slow. Rejoin when your network improves.'); return false; }
    client.ws.send(JSON.stringify(packet)); return true;
  }
  wss.on('connection', ws => {
    const client = {ws, alive:true, joined:false, lastRespawn:-Infinity, messages:0, window:Date.now(), close:(code, text) => ws.close(code, text)};
    clients.add(client);
    const timeout = setTimeout(() => ws.close(1008, 'Join timed out'), 10000); timeout.unref();
    ws.on('pong', () => { client.alive = true; });
    ws.on('error', () => {});
    ws.on('close', () => { clearTimeout(timeout); clients.delete(client); manager.removeClient(client); });
    ws.on('message', (data, binary) => {
      const now = performance.now();
      if (Date.now() - client.window > 1000) { client.window = Date.now(); client.messages = 0; }
      if (++client.messages > 150) return ws.close(1008, 'Too many messages');
      let packet; try { if (binary) throw Error(); packet = JSON.parse(data.toString()); } catch { return ws.close(1008, 'Invalid JSON'); }
      if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return ws.close(1008, 'Invalid packet');
      if (!client.joined) {
        const join = validateJoin(packet, region);
        if (!join) { send(client,{t:'error',message:'Incompatible version or invalid region. Reload the game.'}); return ws.close(1008, 'Invalid join'); }
        const room = manager.join(client, join);
        if (!room) { send(client,{t:'error',message:client.joinError || 'This region is full. Choose another region or try later.'}); return ws.close(1013, client.joinError || 'Region full'); }
        client.joined = true; clearTimeout(timeout);
        send(client,{t:'welcome',protocol:SERVER_PROTOCOL,build:SIM_BUILD,id:client.id,roomId:room.id,region,pool:room.pool,config:room.config,value:manager.snapshot(room)});
      } else if (packet.t === 'input') {
        if (!client.input.accept(packet, now)) send(client,{t:'rejected',q:Number.isSafeInteger(packet.q) ? packet.q : null});
      } else if (packet.t === 'respawn' && Object.keys(packet).length === 1) {
        if (now - client.lastRespawn >= 1000) { client.lastRespawn = now; send(client,{t:'respawn',ok:manager.respawn(client)}); }
      } else if (packet.t === 'ping' && Object.keys(packet).length === 2 && Number.isSafeInteger(packet.q) && packet.q >= 0) send(client,{t:'pong',q:packet.q});
      else ws.close(1008, 'Unsupported packet');
    });
  });
  let last = performance.now(), accumulator = 0, ticks = 0;
  function tick() {
    const now = performance.now(); accumulator = Math.min(.1, accumulator + (now - last)/1000); last = now;
    while (accumulator >= 1/60) { manager.step(); accumulator -= 1/60; ticks++; }
    if (ticks >= 4) {
      ticks = 0;
      for (const room of manager.rooms.values()) {
        const packet = {t:'snapshot',value:manager.snapshot(room)};
        for (const client of room.clients.values()) send(client, packet);
      }
    }
  }
  const timer = autoTick ? setInterval(tick, 1000/60) : null;
  timer?.unref();
  const heartbeat = setInterval(() => {
    for (const client of clients) { if (!client.alive) client.ws.terminate(); else { client.alive = false; client.ws.ping(); } }
    for (const [ip, entry] of upgradeAttempts) if (Date.now() - entry.at > 60000) upgradeAttempts.delete(ip);
  },15000); heartbeat.unref();
  return {
    server, manager, clients,
    async listen(port = Number(process.env.PORT || 8080), host = '0.0.0.0') { await new Promise((resolve,reject) => { server.once('error',reject); server.listen(port,host,resolve); }); return server.address(); },
    async close() { clearInterval(timer); clearInterval(heartbeat); for (const c of clients) c.ws.terminate(); await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve)); },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = createGameServer();
  app.listen().then(address => console.log(`Skybreak ${SIM_BUILD} server listening on ${address.port} (${process.env.REGION || 'local'})`));
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,async () => { await app.close(); process.exit(0); });
}
