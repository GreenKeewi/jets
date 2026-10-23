// Optional authoritative multiplayer transport. No endpoints are active by default.
// Populate only with verified, deployed endpoints. A label alone is not a server region.
import {SERVER_PROTOCOL, SIM_BUILD, validateInput, ACTIONS, AXES, HELD} from './server/protocol.js?v=skybreak14-1023';
import {interpolateSnapshots} from './network.js?v=skybreak14-1023';
export const SERVER_ENDPOINTS = Object.freeze([]);

export function normalizeEndpoints(endpoints) {
  const ids = new Set();
  return endpoints.map(endpoint => {
    if (!endpoint || typeof endpoint.id !== 'string' || !/^[a-z0-9-]{1,32}$/.test(endpoint.id) || ids.has(endpoint.id)) throw new Error('Each region needs a unique ID.');
    ids.add(endpoint.id);
    const url = new URL(endpoint.url);
    const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Game servers require HTTPS outside local tests.');
    if (url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname)) throw new Error('Use a server origin without credentials or a path.');
    return {id:endpoint.id, label:typeof endpoint.label === 'string' ? endpoint.label : endpoint.id, url:url.origin};
  });
}

export async function probeRegions(endpoints = SERVER_ENDPOINTS, {fetchImpl = globalThis.fetch, timeoutMs = 4000, clock = () => performance.now()} = {}) {
  return Promise.all(normalizeEndpoints(endpoints).map(async endpoint => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs), started = clock();
    try {
      const response = await fetchImpl(`${endpoint.url}/health`, {signal:controller.signal, credentials:'omit', cache:'no-store'});
      if (!response.ok) throw new Error('Region unavailable');
      const health = await response.json();
      if (!health.ok || health.protocol !== SERVER_PROTOCOL || health.build !== SIM_BUILD || health.region !== endpoint.id || !Array.isArray(health.rooms)) throw new Error('Region version/configuration mismatch');
      const rooms = health.rooms.filter(r => r && ['global','regional'].includes(r.pool) && ['coast','valley'].includes(r.arenaId) && Number.isInteger(r.players) && r.players >= 0 && r.players <= 6 && typeof r.joinable === 'boolean');
      return {...endpoint, available:true, latencyMs:Math.max(0,Math.round(clock()-started)), rooms};
    } catch (error) { return {...endpoint, available:false, latencyMs:null, rooms:[], error:error.name === 'AbortError' ? 'Timed out. A sleeping demo server may need a minute, then retry.' : error.message}; }
    finally { clearTimeout(timer); }
  }));
}

export function selectRegion(probes, {pool = 'regional', region = 'auto', arenaId = 'coast'} = {}) {
  if (!['regional','global'].includes(pool) || !['coast','valley'].includes(arenaId)) throw new Error('Invalid matchmaking choice.');
  let candidates = probes.filter(p => p.available && Number.isFinite(p.latencyMs));
  if (pool === 'regional' && region !== 'auto') candidates = candidates.filter(p => p.id === region);
  if (!candidates.length) throw new Error('No configured game server is reachable. Solo and friend rooms are still available.');
  const active = p => p.rooms.filter(r => r.pool === pool && r.arenaId === arenaId && r.joinable).reduce((sum,r) => sum+r.players,0);
  // Global explicitly widens the search to populated rooms in every configured region.
  // Every match still runs on one authoritative server, never on multiple regions at once.
  candidates.sort((a,b) => pool === 'global' ? Number(active(b)>0)-Number(active(a)>0) || a.latencyMs-b.latencyMs : a.latencyMs-b.latencyMs);
  return candidates[0];
}

export function createServerClient(callbacks = {}, {WebSocketImpl = globalThis.WebSocket, clock = () => performance.now()} = {}) {
  let pendingBursts={flare:0,chaff:0};
  let inputTimer = null, pendingInput = null, lastInput = -Infinity, lastSentInput = null;
  let ws = null, sequence = 0, epoch = 0, frames = [], latencyMs = null, pingTimer = null, pendingPing = null, connectionTimer = null;
  let state = {role:'offline',transport:'server',localId:null,sessionId:null,connected:false,connecting:false,peers:[],diagnostic:'Dedicated servers are not configured.'};
  const listeners = new Set();
  const emit = () => { const current = {...state,latencyMs}; callbacks.onState?.(current); for (const fn of listeners) fn(current); };
  const send = packet => { if (ws?.readyState !== 1 || ws.bufferedAmount > 65536) return false; ws.send(JSON.stringify(packet)); return true; };
  function disconnect(reason = 'Disconnected from server.') {
    epoch++; clearTimeout(inputTimer); inputTimer = null; pendingInput = null; pendingBursts={flare:0,chaff:0}; lastInput = -Infinity; lastSentInput = null; clearInterval(pingTimer); clearTimeout(connectionTimer); pingTimer = null; connectionTimer = null; pendingPing = null;
    const previous = ws; ws = null; previous?.close(1000,'Leaving match'); frames = [];
    state = {...state,role:'offline',localId:null,sessionId:null,connected:false,connecting:false,peers:[],diagnostic:reason}; emit();
  }
  return {
    get state() { return {...state,latencyMs}; },
    subscribe(fn) { listeners.add(fn); fn({...state,latencyMs}); return () => listeners.delete(fn); },
    disconnect,
    async connect(endpoint, {pool = 'regional',arenaId = 'coast',team='auto',match='versus',timeoutMs = 15000} = {}) {
      const target = normalizeEndpoints([endpoint])[0];
      if (!['regional','global'].includes(pool) || !['coast','valley'].includes(arenaId)) throw new Error('Invalid matchmaking choice.');
      if(!['auto',0,1].includes(team)||!['versus','coop'].includes(match)||(match==='coop'&&team===1))throw new Error('Invalid team choice.');
      disconnect(); const current = epoch; sequence = 0; latencyMs = null;
      state = {...state,connecting:true,diagnostic:`Connecting to ${target.label}…`,region:target.id,pool}; emit();
      return new Promise((resolve,reject) => {
        let settled = false;
        const fail = message => { if (!settled) { settled = true; reject(new Error(message)); } };
        try { ws = new WebSocketImpl(`${target.url.replace(/^http/,'ws')}/play`); } catch (error) { disconnect(error.message); fail(error.message); return; }
        const socket = ws;
        connectionTimer = setTimeout(() => { if (current !== epoch) return; disconnect('Server connection timed out.'); fail('Server connection timed out.'); },timeoutMs);
        socket.addEventListener('open', () => { if (current === epoch) send({t:'join',protocol:SERVER_PROTOCOL,build:SIM_BUILD,pool,region:target.id,arenaId,team,match}); });
        socket.addEventListener('message', event => {
          if (current !== epoch) return;
          let packet; try { packet = JSON.parse(event.data); } catch { disconnect('Invalid server response.'); fail('Invalid server response.'); return; }
          if (packet?.t === 'welcome') {
            if (settled || packet.protocol !== SERVER_PROTOCOL || packet.build !== SIM_BUILD || packet.region !== target.id || typeof packet.id !== 'string' || !packet.value?.pilots?.some(p => p.id === packet.id)) { disconnect('Incompatible server response.'); fail('Incompatible server response.'); return; }
            clearTimeout(connectionTimer); connectionTimer = null; settled = true;
            state = {...state,role:'guest',localId:packet.id,sessionId:packet.roomId,pool:packet.pool,connected:true,connecting:false,diagnostic:`${target.label} · ${packet.pool === 'global' ? 'shared sky' : 'regional matchmaking'}`};
            frames = [{at:clock(),value:packet.value}]; emit();
            callbacks.onControl?.({type:'start',config:packet.config});
            callbacks.onSnapshot?.(packet.value,{initial:true});
            pingTimer = setInterval(() => { if (current !== epoch) return; pendingPing = {q:sequence++,at:clock()}; send({t:'ping',q:pendingPing.q}); },2000);
            resolve({...state});
          } else if (packet?.t === 'snapshot' && state.connected && packet.value?.version === 2 && Array.isArray(packet.value.pilots)) {
            frames.push({at:clock(),value:packet.value}); if (frames.length > 8) frames.shift();
            state.peers = packet.value.pilots.filter(p => p.human && p.id !== state.localId).map(p => ({id:p.id,connected:true,status:'connected'}));
            callbacks.onSnapshot?.(packet.value,{initial:false});
          } else if (packet?.t === 'pong' && pendingPing?.q === packet.q) { latencyMs = Math.max(0,Math.round(clock()-pendingPing.at)); pendingPing = null; emit(); }
          else if (packet?.t === 'error') { const message = typeof packet.message === 'string' ? packet.message : 'Server unavailable.'; disconnect(message); fail(message); }
        });
        socket.addEventListener('close', event => {
          if (current !== epoch) { fail('Connection cancelled.'); return; }
          const connected = state.connected, id = state.localId;
          const reason = event.reason || 'Server disconnected. Rejoin to enter a new match.';
          disconnect(reason); fail(reason); if (connected) callbacks.onDisconnect?.(id,reason);
        });
        socket.addEventListener('error', () => { if (current === epoch && !state.connected) { disconnect('Could not reach the game server.'); fail('Could not reach the game server.'); } });
      });
    },
    submitInput(input) {
      const value = validateInput(input); if (!state.connected || !value) return false;
      for (const key of ['flare','chaff']) if(value[key])pendingBursts[key]=Math.min(240,pendingBursts[key]+1);
      for (const key of ACTIONS) value[key] ||= !!pendingInput?.[key];
      const changed = !lastSentInput || [...AXES,...HELD].some(key => value[key] !== lastSentInput[key]) || ACTIONS.some(key => value[key]);
      // Suppress redundant controls, but refresh held controls within the server's
      // 250ms expiry. No timer repeats stale controls if the caller stops updating.
      if (!pendingInput && !changed && clock()-lastInput < 100) return true;
      pendingInput = value;
      const flush = () => {
        inputTimer = null; if (!state.connected || !pendingInput) return;
        const input=pendingInput;pendingInput=null;lastInput=clock();
        do { for(const key of ['flare','chaff']) { input[key]=pendingBursts[key]>0;if(input[key])pendingBursts[key]--; }
          lastSentInput={...input};send({t:'input',q:sequence++,input:{...input}});
          for(const key of ACTIONS)input[key]=false;
        } while(pendingBursts.flare||pendingBursts.chaff);
      };
      if (pendingBursts.flare||pendingBursts.chaff||clock()-lastInput >= 50) { clearTimeout(inputTimer); flush(); }
      else if (!inputTimer) inputTimer = setTimeout(flush,Math.max(1,50-(clock()-lastInput)));
      return true;
    },
    requestRespawn() { return state.connected && send({t:'respawn'}); },
    sampleSnapshot() { return interpolateSnapshots(frames,clock()-100); },
    getPlayerIds() { return frames.at(-1)?.value.pilots.filter(p => p.human).map(p => p.id) || []; },
  };
}
