// Data-only WebRTC. Room codes use PeerJS Cloud signaling and public STUN.
// Advanced manual LAN pairing stays available without external services.
// Protocol: ordered reliable control/actions; unordered zero-retransmit axes/snapshots.
export const PROTOCOL = 'JETS7';
// Room handshake compatibility changes only when the transport/game protocol changes.
export const ROOM_BUILD = 'skybreak3-1022';
// Asset versions stay separate so fresh invites load the current page without
// rejecting an already connected player using compatible gameplay packets.
export const CLIENT_BUILD = new URL(import.meta.url).searchParams.get('v') || 'rooms3-1019';
export const ACTIONS = ['fireHeat', 'fireRadar', 'flare', 'chaff', 'bomb', 'toggleAirbrake', 'toggleGear', 'toggleManeuver'];
export { mountNetworkUI } from './network-ui.js?v=skybreak3-1022';
// PeerJS 1.5.5 registers its pass-through serializer as 'raw' (not 'none').
const ROOM_SERIALIZATION = 'raw';
const ROOM_ICE = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] };
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomPeerId = code => `skybreak-${PROTOCOL.toLowerCase()}-${code.toLowerCase()}`;
const roomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), n => ROOM_ALPHABET[n % ROOM_ALPHABET.length]).join('');
const ROOM_BLOCKED = 'The room was found, but a direct connection could not open. This network may block WebRTC or require a relay. Try a reachable home network or another permitted connection. A TURN relay is not configured.';
let peerLibrary;
async function loadPeer() {
  if (!globalThis.RTCPeerConnection) throw new Error('This browser does not support multiplayer WebRTC. Solo play still works.');
  if (!peerLibrary) peerLibrary = import('./vendor/peerjs/peerjs-1.5.5.min.js').then(() => globalThis.peerjs.Peer).catch(error => { peerLibrary = null; throw error; });
  try { return await peerLibrary; } catch { throw new Error('The room client could not load. Reload the game and try again.'); }
}
export function normalizeRoomCode(value) {
  let code = String(value || '').trim();
  if (/^https?:\/\//i.test(code)) {
    try { const url = new URL(code); code = new URLSearchParams(url.hash.slice(1)).get('room') || url.searchParams.get('room') || ''; } catch { code = ''; }
  }
  code = code.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) throw new Error('Enter the 8-character room code or paste the host’s invite link.');
  return code;
}
export function roomInviteLink(code, href = globalThis.location?.href) {
  const url = new URL(href); url.search = ''; url.searchParams.set('v', CLIENT_BUILD); url.hash = `room=${normalizeRoomCode(code)}`; return url.href;
}
const HELD = ['fireGun'];
const GUN_INPUT_EXPIRY = 250;
const AXES = ['pitch', 'roll', 'yaw', 'throttle'];
const COOLDOWN = { fireHeat: 250, fireRadar: 400, flare: 200, chaff: 200, bomb: 300, toggleAirbrake: 150, toggleGear: 150, toggleManeuver: 150 };
const MAX_PACKET = 60000;
const HIGH_WATER = 131072;
const neutral = () => Object.fromEntries([...AXES.map(k => [k, 0]), ...[...ACTIONS, ...HELD].map(k => [k, false]), ['brake', false], ['autopilot',false]]);
const now = () => performance.now();
const uuid = () => crypto.randomUUID();
const plain = o => !!o && typeof o === 'object' && !Array.isArray(o);
const validSeq = n => Number.isSafeInteger(n) && n >= 0;

// Keep SCTP messages below 60 kB even when all six pilots release countermeasures.
// Rounding affects presentation on guests only. The host retains full simulation precision.
export function serializePacket(packet, maxBytes = MAX_PACKET) {
  const world = ['snapshot', 'bootstrap'].includes(packet.t) && plain(packet.value);
  let value = packet.value;
  const stringify = () => JSON.stringify(world ? { ...packet, value } : packet,
    world ? (_, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 10000) / 10000 : v : undefined);
  let data = stringify();
  const size = () => new TextEncoder().encode(data).byteLength;
  if (world && size() > maxBytes) {
    value = { ...value };
    // These lists are cosmetic on guests; collision and weapon outcomes stay on the host.
    for (const key of ['countermeasures', 'effects', 'bullets']) {
      if (!Array.isArray(value[key])) continue;
      while (value[key].length && size() > maxBytes) {
        const count = Math.min(key === 'countermeasures' ? 144 : key === 'bullets' ? 48 : 24, Math.floor(value[key].length / 2));
        value[key] = count ? value[key].slice(-count) : [];
        data = stringify();
      }
      if (size() <= maxBytes) break;
    }
  }
  return size() <= maxBytes ? data : null;
}

export function validateInput(input) {
  if (!plain(input) || Object.keys(input).some(k => ![...AXES, ...ACTIONS, ...HELD, 'brake','autopilot'].includes(k))) return null;
  const out = neutral();
  for (const k of AXES) {
    if (input[k] !== undefined && (typeof input[k] !== 'number' || !Number.isFinite(input[k]) || Math.abs(input[k]) > 1)) return null;
    out[k] = input[k] ?? 0;
  }
  for (const k of [...ACTIONS, ...HELD, 'brake','autopilot']) {
    if (input[k] !== undefined && typeof input[k] !== 'boolean') return null;
    out[k] = input[k] ?? false;
  }
  return out;
}

export function decodePairing(code, expectedType) {
  const incompatible = () => new Error('This pairing code comes from a different version of Skybreak. Reload Jets on both devices, then create fresh offer and answer codes.');
  if (typeof code === 'string' && /^JETS\d+\./.test(code.trim()) && !code.trim().startsWith(`${PROTOCOL}.`)) throw incompatible();
  try {
    if (typeof code !== 'string' || code.length > 100000) throw Error();
    const trimmed = code.trim();
    if (!trimmed.startsWith(`${PROTOCOL}.`)) throw Error();
    const p = JSON.parse(atob(trimmed.slice(PROTOCOL.length + 1).replace(/\s/g, '')));
    if (plain(p) && Number.isInteger(p.v) && p.v !== 4) { const error=incompatible(); error.name='VersionMismatchError'; throw error; }
    if (!plain(p) || p.v !== 4 || !['offer', 'answer'].includes(p.type) || (expectedType && p.type !== expectedType)) throw Error();
    if (!/^[\w-]{16,64}$/.test(p.session) || !/^[\w-]{16,64}$/.test(p.pair) || !/^p[1-5]$/.test(p.slot)) throw Error();
    if (!plain(p.description) || p.description.type !== p.type || typeof p.description.sdp !== 'string' || p.description.sdp.length > MAX_PACKET) throw Error();
    if (!p.description.sdp.startsWith('v=0') || !p.description.sdp.includes('m=application') || /m=(audio|video)\s/.test(p.description.sdp)) throw Error();
    return p;
  } catch (error) {
    if (error.name === 'VersionMismatchError') throw error;
    throw new Error(`That is not a complete Jets ${expectedType || 'pairing'} code. Paste the whole ${PROTOCOL} code from the other player.`);
  }
}
const encodePairing = p => `${PROTOCOL}.${btoa(JSON.stringify(p))}`;

export function waitForIce(pc, timeout = 15000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const end = error => { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', changed); pc.removeEventListener('connectionstatechange', closed); error ? reject(error) : resolve(); };
    const changed = () => { if (pc.iceGatheringState === 'complete') end(); };
    const closed = () => { if (pc.connectionState === 'closed') end(new Error('Pairing was cancelled. Create a fresh offer.')); };
    const timer = setTimeout(() => end(new Error('Your browser did not finish gathering LAN candidates. No partial code was exported. Try a fresh offer.')), timeout);
    pc.addEventListener('icegatheringstatechange', changed);
    pc.addEventListener('connectionstatechange', closed);
    changed();
  });
}

function requireLocalCandidates(pc) {
  if (!pc.localDescription?.sdp.includes('a=candidate:')) {
    const error = new Error('This browser did not provide any LAN connection candidates. Browser privacy settings, a managed school/work policy or a disabled network interface may block direct WebRTC. Solo play still works. There is no relay fallback.');
    error.name = 'NoLocalCandidatesError';
    throw error;
  }
}

// Pure per-connection guard: identity is supplied by the connection, never by a packet.
export function createInputGuard(clock = now) {
  const sequences = { axes: -1, actions: -1 };
  const buckets = { axes: { tokens: 90, at: clock() }, actions: { tokens: 20, at: clock() } };
  const lastAction = Object.fromEntries(ACTIONS.map(k => [k, -Infinity]));
  return (packet, channel) => {
    if (!plain(packet) || !['axes', 'actions'].includes(channel) || packet.t !== channel || !validSeq(packet.q) || packet.q <= sequences[channel]) return null;
    if (Object.keys(packet).some(k => !['t', 'q', 'input', 'g'].includes(k)) || packet.g !== undefined && !validSeq(packet.g)) return null;
    const input = validateInput(packet.input);
    if (!input) return null;
    const t = clock(), b = buckets[channel], rate = channel === 'axes' ? 90 : 20;
    b.tokens = Math.min(rate, b.tokens + Math.max(0, t - b.at) * rate / 1000); b.at = t;
    if (b.tokens < 1) return null;
    b.tokens--; sequences[channel] = packet.q;
    if (channel !== 'axes') for (const k of HELD) input[k] = false;
    for (const k of ACTIONS) {
      if (channel === 'axes') input[k] = false;
      else if (input[k] && t - lastAction[k] >= COOLDOWN[k]) lastAction[k] = t;
      else input[k] = false;
    }
    return input;
  };
}

function validConfig(config) {
  return plain(config) && ['dogfight', 'strike', 'freeflight'].includes(config.mode) && [1, 2, 3].includes(config.teamSize) && ['attack', 'defend'].includes(config.role) && (config.seed === undefined || typeof config.seed === 'number' && Number.isFinite(config.seed)) && (config.startingFuel === undefined || Number.isFinite(config.startingFuel) && config.startingFuel >= .25 && config.startingFuel <= 1) && (config.difficulty === undefined || ['normal','ace'].includes(config.difficulty)) && (config.routeId === undefined || ['local','northpoint','westhaven'].includes(config.routeId)) && (config.arenaId === undefined || ['coast','valley'].includes(config.arenaId));
}

export function createNetwork(callbacks = {}) {
  const connections = new Map(), inputs = new Map(), listeners = new Set();
  let role = 'offline', localId = null, sessionId = null, diagnostic = 'Solo ready. Pairing is optional.', roster = [];
  let axesSeq = 0, actionsSeq = 0, snapshotSeq = 0, controlSeq = 0, lastAxes = -Infinity, lastSnapshot = -Infinity;
  let inputGeneration = 0;
  let room = null, roomPeer = null, roomEpoch = 0, roomOpening = false;
  let snapshots = [], currentControl = null, currentPaused = false, lastControlSeq = -1, lastSnapshotValue = null;
  const lastSentAction = Object.fromEntries(ACTIONS.map(k => [k, -Infinity]));
  const stats = { received: 0, rejected: 0, droppedSnapshots: 0, droppedInputs: 0 };
  const state = () => ({ role, localId, sessionId, inputGeneration, roomCode: room, roomOpening, roomOnline: !!roomPeer?.open, connecting: [...connections.values()].some(p => !p.ready), connected: role === 'host' || [...connections.values()].some(p => p.ready), peers: role === 'guest' ? roster.map(id => ({ id, connected: true, status: 'connected' })) : [...connections.values()].map(p => ({ id: p.id, connected: p.ready, status: p.pc.connectionState === 'new' ? (p.roomConnection ? 'joining' : 'awaiting answer') : p.pc.connectionState })), diagnostic, stats: { ...stats } });
  const emit = () => { const s = state(); for (const f of listeners) f(s); callbacks.onPeerChange?.(s.peers, s); callbacks.onState?.(s); };
  const setStatus = message => { diagnostic = message; emit(); };
  const playerIds = () => role === 'host' ? ['host', ...[...connections.values()].filter(p => p.ready).map(p => p.id).sort()] : role === 'guest' ? ['host', ...roster] : [];
  function resetInputs(generation = inputGeneration) {
    inputGeneration = generation; inputs.clear(); lastAxes = -Infinity;
    for (const k of ACTIONS) lastSentAction[k] = -Infinity;
    for (const p of connections.values()) {
      p.guard = createInputGuard();
      if (role === 'guest') p.queue.length = 0;
    }
  }
  function retryFlush(p) {
    if (p.flushTimer || connections.get(p.id) !== p) return;
    p.flushTimer = setTimeout(() => { p.flushTimer=null; flush(p); }, 100);
  }
  function send(p, channelName, packet, serialized) {
    const channel = p[channelName];
    if (!channel || channel.readyState !== 'open') return false;
    const data = serialized ?? serializePacket(packet);
    if (data === null) return false;
    if (channelName === 'realtime') {
      if (channel.bufferedAmount > HIGH_WATER) return false;
      try { channel.send(data); return true; } catch { return false; }
    }
    if (channel.bufferedAmount > HIGH_WATER || p.queue.length) {
      if (p.queue.length >= 64) { drop(p, 'Peer stopped reading control messages. Pair again to reconnect.'); return false; }
      p.queue.push(data); retryFlush(p); return true;
    }
    try { channel.send(data); return true; }
    catch (error) {
      if (error.name === 'OperationError') { p.queue.push(data); retryFlush(p); return true; }
      return false;
    }
  }
  function flush(p) {
    while (p.control?.readyState === 'open' && p.control.bufferedAmount < HIGH_WATER && p.queue.length) {
      try { p.control.send(p.queue[0]); p.queue.shift(); }
      catch (error) { if (error.name === 'OperationError') retryFlush(p); break; }
    }
    if (p.queue.length && p.control?.readyState === 'open') retryFlush(p);
  }
  function broadcastRoster() {
    if (role !== 'host') return;
    const ids = playerIds().slice(1);
    for (const p of connections.values()) if (p.ready) send(p, 'control', { t: 'roster', ids });
  }
  function drop(p, message) {
    if (connections.get(p.id) !== p) return;
    connections.delete(p.id); inputs.delete(p.id); p.ready = false;
    clearTimeout(p.timer); clearTimeout(p.disconnectTimer); clearTimeout(p.flushTimer);
    p.roomConnection?.close(); p.pc.close();
    if (role === 'guest') { localId = null; snapshots = []; roster = []; }
    if (message) diagnostic = message;
    broadcastRoster(); emit(); callbacks.onDisconnect?.(p.id, message || diagnostic);
  }
  function ready(p) {
    if (connections.get(p.id) !== p || p.ready || p.control?.readyState !== 'open' || p.realtime?.readyState !== 'open') return;
    p.ready = true; clearTimeout(p.timer);
    if (role === 'host') {
      send(p, 'control', { t: 'welcome', id: p.id, session: sessionId, g: inputGeneration, ...(p.roomConnection ? { build: ROOM_BUILD } : {}) });
      broadcastRoster();
      if (currentControl) {
        send(p, 'control', { t: 'game', q: ++controlSeq, g: inputGeneration, message: currentControl });
        if (currentPaused) send(p, 'control', { t: 'game', q: ++controlSeq, g: inputGeneration, message: { type: 'pause' } });
      }
      diagnostic = `${playerIds().length} pilots connected. Close this panel and launch the sortie.`;
    } else diagnostic = 'Connected to host. Waiting for the host to start a mission.';
    emit();
    // A joining guest needs a complete world even while the host is paused.
    // The reliable bootstrap follows start/roster and lets the application apply it once.
    if (role === 'host' && p.ready && currentControl) {
      const value = callbacks.getSnapshot?.() || lastSnapshotValue;
      if (plain(value)) send(p, 'control', { t: 'bootstrap', q: snapshotSeq++, g: inputGeneration, value });
    }
  }
  function handle(p, raw, channel) {
    if (connections.get(p.id) !== p) return;
    if (typeof raw !== 'string' || raw.length > MAX_PACKET) { stats.rejected++; return; }
    let packet;
    try { packet = JSON.parse(raw); } catch { stats.rejected++; return; }
    if (!plain(packet)) { stats.rejected++; return; }
    stats.received++;
    if (role === 'host') {
      if (packet.g !== inputGeneration || currentPaused) { stats.rejected++; return; }
      const kind = channel === 'realtime' ? 'axes' : 'actions';
      const input = p.guard(packet, kind);
      if (!input) { stats.rejected++; return; }
      const prior = inputs.get(p.id) || { axes: neutral(), actions: {}, axesAt: -Infinity };
      if (kind === 'axes') { prior.axes = { ...input }; prior.axesAt = now(); }
      for (const k of ACTIONS) { if (input[k]) prior.actions[k] = now(); prior.axes[k] = false; }
      inputs.set(p.id, prior);
      callbacks.onInput?.(p.id, input, { channel: kind });
      return;
    }
    if (channel === 'realtime' || packet.t === 'bootstrap') {
      if (!((channel === 'realtime' && packet.t === 'snapshot') || (channel === 'control' && packet.t === 'bootstrap')) || packet.g !== inputGeneration || !validSeq(packet.q) || packet.q <= p.lastSnapshot || !plain(packet.value) || !Array.isArray(packet.value.pilots) || packet.value.pilots.length > 12) { stats.rejected++; return; }
      p.lastSnapshot = packet.q;
      snapshots.push({ at: now(), value: packet.value });
      if (snapshots.length > 24) snapshots.shift();
      callbacks.onSnapshot?.(packet.value, { initial: packet.t === 'bootstrap' });
      return;
    }
    if (packet.t === 'welcome' && p.roomConnection && packet.build !== ROOM_BUILD) {
      drop(p, `The host is running an incompatible room protocol. Both players should reopen the latest game link and create a fresh room.`);
      return;
    }
    if (packet.t === 'reject' && p.roomConnection && !localId && ['full', 'version', 'closed'].includes(packet.reason)) {
      drop(p, packet.reason === 'full' ? 'This room has six pilots already. Ask the host to remove an unused seat.' : packet.reason === 'version' ? 'The host has a different game version. Both players should reload, then join the new room.' : 'This room is no longer accepting guests. Ask the host for a new invite.');
      return;
    }
    if (packet.t === 'welcome' && /^p[1-5]$/.test(packet.id) && /^[\w-]{16,64}$/.test(packet.session) && (p.roomConnection && !p.assignedId || packet.id === p.assignedId && packet.session === sessionId) && validSeq(packet.g) && packet.g >= inputGeneration) { p.assignedId = packet.id; sessionId = packet.session; localId = packet.id; resetInputs(packet.g); emit(); }
    else if (packet.t === 'roster' && Array.isArray(packet.ids) && packet.ids.length <= 5 && packet.ids.every(id => /^p[1-5]$/.test(id)) && new Set(packet.ids).size === packet.ids.length) { roster = packet.ids; emit(); }
    else if (packet.t === 'game' && validSeq(packet.q) && packet.q > lastControlSeq && validSeq(packet.g) && packet.g >= inputGeneration && plain(packet.message) && ((packet.message.type === 'start' && validConfig(packet.message.config)) || ['restart', 'pause', 'resume', 'return'].includes(packet.message.type))) {
      lastControlSeq = packet.q; resetInputs(packet.g); snapshots = []; callbacks.onControl?.(packet.message);
    } else stats.rejected++;
  }
  function bind(p, channel) {
    if (!['control', 'realtime'].includes(channel.label) || p[channel.label]) { channel.close(); return; }
    if (channel.label === 'control' && (!channel.ordered || channel.maxRetransmits !== null || channel.maxPacketLifeTime !== null)) { channel.close(); return; }
    if (channel.label === 'realtime' && (channel.ordered || channel.maxRetransmits !== 0)) { channel.close(); return; }
    p[channel.label] = channel; channel.bufferedAmountLowThreshold = HIGH_WATER / 2;
    const on = (event, fn) => p.roomConnection ? channel.addEventListener(event, fn) : channel[`on${event}`] = fn;
    on('bufferedamountlow', () => flush(p));
    on('open', () => ready(p));
    on('message', e => handle(p, e.data, channel.label));
    on('close', () => drop(p, p.roomConnection ? (role === 'guest' ? 'Host disconnected. Join the room again, or ask the host for a new invite.' : `${p.id} disconnected. The seat is available for another guest.`) : (role === 'guest' ? 'Host disconnected. Return to solo or paste a fresh host offer to reconnect.' : `${p.id} disconnected. Create a new offer to fill the seat.`)));
    on('error', () => { diagnostic = 'The connection was interrupted. If it closes, join again.'; emit(); });
    ready(p);
  }
  function makePeer(id, pair, assignedId = id, roomConnection = null) {
    if (!globalThis.RTCPeerConnection) throw new Error('This browser does not support WebRTC data channels. Solo play still works.');
    const pc = roomConnection?.peerConnection || new RTCPeerConnection({ iceServers: [] });
    const p = { id, assignedId, pair, pc, roomConnection, ready: false, queue: [], guard: createInputGuard(), lastSnapshot: -1, created: now() };
    connections.set(id, p);
    const peerJsDataChannel = pc.ondatachannel;
    pc.ondatachannel = e => {
      if (roomConnection && e.channel.label === 'control') peerJsDataChannel?.call(pc, e);
      bind(p, e.channel);
    };
    pc.onconnectionstatechange = () => {
      clearTimeout(p.disconnectTimer);
      if (pc.connectionState === 'failed') drop(p, roomConnection ? ROOM_BLOCKED : 'LAN connection failed. Check same Wi-Fi, guest-network/client isolation, local firewall and browser mDNS support. There is no relay fallback; create a fresh offer.');
      else if (pc.connectionState === 'disconnected') {
        diagnostic = 'Connection interrupted. Waiting briefly for recovery…'; emit();
        p.disconnectTimer = setTimeout(() => drop(p, roomConnection ? 'Connection lost. Join the room again or ask the host for a new invite.' : 'Connection lost. Create a fresh offer and answer to reconnect.'), 10000);
      } else emit();
    };
    p.timer = setTimeout(() => drop(p, roomConnection ? ROOM_BLOCKED : 'Pairing expired. Check both devices share a reachable LAN; disable guest/client isolation if you control the router. Firewalls or mDNS restrictions may block direct connections. Create a fresh offer.'), roomConnection ? 30000 : 300000);
    if (roomConnection) {
      roomConnection.on('error', () => drop(p, ROOM_BLOCKED));
      roomConnection.on('close', () => drop(p, role === 'guest' ? 'Host disconnected. Join the room again or ask for a new invite.' : `${id} disconnected. The seat is available.`));
      if (roomConnection.dataChannel) bind(p, roomConnection.dataChannel);
    }
    return p;
  }
  function rejectRoomConnection(connection, reason) {
    // Do not let PeerJS replace its control channel with the extra realtime channel.
    const receiveControl = connection.peerConnection.ondatachannel;
    connection.peerConnection.ondatachannel = event => {
      if (event.channel.label === 'control') receiveControl?.call(connection.peerConnection, event);
    };
    connection.on('error', () => {});
    connection.on('open', () => {
      connection.send(JSON.stringify({ t: 'reject', reason }));
      setTimeout(() => connection.close(), 300);
    });
    setTimeout(() => { if (!connection.open) connection.close(); }, 10000);
  }
  function acceptRoomConnection(connection) {
    if (role !== 'host' || !room) { connection.close(); return; }
    if (connection.label !== 'control' || connection.serialization !== ROOM_SERIALIZATION || !connection.reliable || connection.metadata?.protocol !== PROTOCOL || connection.metadata?.build !== ROOM_BUILD) {
      rejectRoomConnection(connection, 'version'); return;
    }
    const id = [1, 2, 3, 4, 5].map(n => `p${n}`).find(seat => !connections.has(seat));
    if (!id) { rejectRoomConnection(connection, 'full'); return; }
    makePeer(id, uuid(), id, connection);
    setStatus(`A guest is joining room ${room.slice(0, 4)} ${room.slice(4)}…`);
  }
  async function openRoomPeer(id, epoch) {
    const Peer = await loadPeer();
    if (epoch !== roomEpoch) throw new Error('Room setup was cancelled.');
    return new Promise((resolve, reject) => {
      const peer = new Peer(id, { debug: 0, config: ROOM_ICE });
      roomPeer = peer;
      let opened = false, settled = false;
      const fail = error => {
        if (settled) return;
        settled = true; clearTimeout(timer); reject(error);
      };
      const timer = setTimeout(() => fail(new Error('The room service did not respond. Check your connection and try again. School or work networks may block it.')), 15000);
      peer.on('connection', connection => {
        if (epoch !== roomEpoch || roomPeer !== peer) { connection.close(); return; }
        acceptRoomConnection(connection);
      });
      // This game never accepts audio/video calls or requests media permissions.
      peer.on('call', call => call.close());
      peer.on('open', () => {
        if (epoch !== roomEpoch || roomPeer !== peer) { peer.destroy(); return; }
        opened = true;
        if (!settled) { settled = true; clearTimeout(timer); resolve(peer); }
        else setStatus(role === 'host' ? 'Room is available again. Share the same invite with your friends.' : 'Room service reconnected.');
      });
      peer.on('error', error => {
        if (epoch !== roomEpoch || roomPeer !== peer) return;
        const message = error.type === 'peer-unavailable' ? 'Room not found. Check the code and ask the host to keep the room open. If they reloaded, ask for their new code.' :
          error.type === 'unavailable-id' ? 'That room code is already in use. Create a new room.' :
          error.type === 'browser-incompatible' ? 'This browser does not support multiplayer. Try a current WebRTC-capable browser.' :
          ['webrtc', 'network', 'socket-error', 'socket-closed'].includes(error.type) ? 'The room service or peer connection was interrupted. Try joining again. Restricted networks may need a TURN relay, which is not configured.' : 'Could not open the room connection. Try again or return to solo.';
        if (!opened) { const failure = new Error(message); failure.type = error.type; fail(failure); return; }
        const guest = connections.get('host');
        if (role === 'guest' && guest && !guest.ready) drop(guest, message);
        else setStatus(message);
      });
      peer.on('disconnected', () => {
        if (epoch !== roomEpoch || roomPeer !== peer) return;
        if (!opened) fail(new Error('The room service disconnected. Try creating or joining the room again.'));
        else setStatus('Room service disconnected. Connected pilots can keep flying. Use Reconnect room to let new guests join.');
      });
      peer.on('close', () => {
        if (!settled) fail(new Error('Room setup was cancelled.'));
      });
    });
  }
  function disconnect() {
    roomEpoch++; roomOpening = false; room = null; const oldPeer = roomPeer; roomPeer = null;
    role = 'offline'; localId = null; sessionId = null; roster = []; snapshots = []; currentControl = null; currentPaused = false; lastControlSeq = -1; lastSnapshotValue = null; inputGeneration = 0;
    for (const p of [...connections.values()]) drop(p);
    oldPeer?.destroy();
    inputs.clear(); diagnostic = 'Solo ready. Pairing is optional.'; emit();
  }
  const api = {
    protocol: PROTOCOL,
    build: CLIENT_BUILD,
    compatibility: ROOM_BUILD,
    normalizeRoomCode,
    inviteLink: code => roomInviteLink(code || room),
    async createRoom() {
      if (room && roomPeer && !roomPeer.destroyed) {
        if (roomPeer.disconnected) { roomPeer.reconnect(); setStatus('Reconnecting the room service…'); }
        return room;
      }
      if (role === 'guest') throw new Error('Leave the current room before creating your own.');
      if (roomOpening) throw new Error('Room setup is already in progress.');
      if (role === 'offline') api.host();
      roomOpening = true; const epoch = ++roomEpoch;
      setStatus('Creating your room…');
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const code = roomCode();
          try {
            await openRoomPeer(roomPeerId(code), epoch);
            if (epoch !== roomEpoch) throw new Error('Room setup was cancelled.');
            room = code;
            setStatus('Room ready. Share the invite link or room code. Friends join automatically; then you launch.');
            return room;
          } catch (error) {
            if (epoch !== roomEpoch) throw error;
            const failedPeer = roomPeer; roomPeer = null; failedPeer?.destroy();
            if (error.type !== 'unavailable-id' || attempt === 2) throw error;
          }
        }
      } catch (error) { if (epoch === roomEpoch) setStatus(error.message); throw error; }
      finally { if (epoch === roomEpoch) { roomOpening = false; emit(); } }
    },
    async joinRoom(value) {
      const code = normalizeRoomCode(value);
      if (role === 'host' && connections.size) throw new Error('Leave your room before joining another host.');
      if (role === 'guest' && [...connections.values()].some(p => p.ready)) throw new Error('Leave the current room before joining another one.');
      disconnect(); role = 'guest'; room = code; roomOpening = true; const epoch = roomEpoch;
      setStatus('Finding the host…');
      try {
        const peer = await openRoomPeer(`skybreak-guest-${uuid()}`, epoch);
        if (epoch !== roomEpoch) throw new Error('Joining was cancelled.');
        const connection = peer.connect(roomPeerId(code), { label: 'control', reliable: true, serialization: ROOM_SERIALIZATION, metadata: { protocol: PROTOCOL, build: ROOM_BUILD } });
        if (!connection) throw new Error('The room connection could not start. Try again.');
        const p = makePeer('host', uuid(), null, connection);
        // Use the same SCTP connection, but keep physics unreliable and unordered.
        bind(p, p.pc.createDataChannel('realtime', { ordered: false, maxRetransmits: 0 }));
        setStatus('Joining the room… The host does not need to paste or accept anything.');
        return code;
      } catch (error) {
        const failure = /serializers.*constructor/i.test(error.message) ? new Error(`This tab loaded an incompatible room client (build ${CLIENT_BUILD}). Close both game tabs, reopen the latest game link, then create a fresh room.`) : error;
        if (epoch === roomEpoch) {
          disconnect(); diagnostic = failure.message; emit();
        }
        throw failure;
      } finally { if (epoch === roomEpoch) { roomOpening = false; emit(); } }
    },
    get state() { return state(); },
    subscribe(fn) { listeners.add(fn); fn(state()); return () => listeners.delete(fn); },
    host() { if (role === 'host') return state(); disconnect(); role = 'host'; localId = 'host'; sessionId = uuid(); diagnostic = 'Host ready. Create a different offer for each guest, up to five.'; emit(); return state(); },
    async createOffer() {
      if (role === 'offline') api.host();
      if (role !== 'host') throw new Error('Leave the current session before hosting.');
      const id = [1, 2, 3, 4, 5].map(n => `p${n}`).find(id => !connections.has(id));
      if (!id) throw new Error('All five guest seats are connected or awaiting answers. Remove an unused seat first.');
      const p = makePeer(id, uuid());
      bind(p, p.pc.createDataChannel('control', { ordered: true }));
      bind(p, p.pc.createDataChannel('realtime', { ordered: false, maxRetransmits: 0 }));
      setStatus(`Gathering complete LAN offer for ${id}…`);
      try {
        await p.pc.setLocalDescription(await p.pc.createOffer()); await waitForIce(p.pc); requireLocalCandidates(p.pc);
        if (connections.get(id) !== p) throw new Error('Offer was cancelled. Create a fresh offer.');
        setStatus(`Offer for ${id} ready. Give it only to that guest, then paste their answer.`);
        return encodePairing({ v: 4, type: 'offer', session: sessionId, pair: p.pair, slot: id, description: p.pc.localDescription.toJSON() });
      } catch (error) { drop(p, error.message); throw error; }
    },
    async acceptAnswer(code) {
      const answer = decodePairing(code, 'answer');
      if (role !== 'host' || answer.session !== sessionId) throw new Error('This answer belongs to another host session. Ask for an answer to your current offer.');
      const p = connections.get(answer.slot);
      if (!p || answer.pair !== p.pair || p.pc.signalingState !== 'have-local-offer') throw new Error('This answer does not match a pending seat, or it was already used. Create a fresh offer for that guest.');
      await p.pc.setRemoteDescription(answer.description);
      clearTimeout(p.timer); p.timer = setTimeout(() => { if (!p.ready) drop(p, 'Pairing codes matched but the LAN connection did not open. Check Wi-Fi isolation, firewall and mDNS. No relay server is configured. Try fresh codes.'); }, 30000);
      setStatus(`Answer accepted for ${p.id}. Opening direct data channels…`);
      return p.id;
    },
    async acceptOffer(code) {
      const offer = decodePairing(code, 'offer');
      if (role === 'host' && connections.size) throw new Error('Leave your host session before joining another host.');
      disconnect(); role = 'guest'; sessionId = offer.session; localId = null;
      const p = makePeer('host', offer.pair, offer.slot);
      setStatus('Gathering your complete LAN answer…');
      try {
        await p.pc.setRemoteDescription(offer.description);
        await p.pc.setLocalDescription(await p.pc.createAnswer()); await waitForIce(p.pc); requireLocalCandidates(p.pc);
        if (connections.get('host') !== p) throw new Error('Pairing was cancelled. Ask for a fresh offer.');
        setStatus('Answer ready. Give the whole answer to the host, who must paste it into their pairing panel.');
        return encodePairing({ v: 4, type: 'answer', session: offer.session, pair: offer.pair, slot: offer.slot, description: p.pc.localDescription.toJSON() });
      } catch (error) { drop(p, error.message); throw error; }
    },
    submitInput(value) {
      if (role !== 'guest') return false;
      const input = validateInput(value), p = connections.get('host');
      if (!input || !p?.ready) return false;
      const t = now(); let sent = false;
      if (t - lastAxes >= 1000 / 30) {
        lastAxes = t;
        const axes = { ...input }; ACTIONS.forEach(k => axes[k] = false);
        sent = send(p, 'realtime', { t: 'axes', q: axesSeq++, g: inputGeneration, input: axes });
        if (!sent) stats.droppedInputs++;
      }
      const actions = { ...input }; let any = false;
      for (const k of ACTIONS) {
        actions[k] = input[k] && t - lastSentAction[k] >= COOLDOWN[k];
        if (actions[k]) { any = true; lastSentAction[k] = t; }
      }
      if (any) sent = send(p, 'control', { t: 'actions', q: actionsSeq++, g: inputGeneration, input: actions }) || sent;
      return sent;
    },
    consumeInputs() {
      const result = {};
      for (const [id, value] of inputs) {
        result[id] = now() - value.axesAt > 750 ? neutral() : { ...value.axes };
        // A lost release packet must not leave the gun firing until axes expiry.
        if (now() - value.axesAt > GUN_INPUT_EXPIRY) result[id].fireGun = false;
        for (const k of ACTIONS) result[id][k] = typeof value.actions[k] === 'number' && now() - value.actions[k] <= 750;
        value.actions = {};
      }
      return result;
    },
    broadcastSnapshot(value) {
      if (role !== 'host' || !plain(value) || now() - lastSnapshot < 45) return false;
      lastSnapshot = now(); lastSnapshotValue = value; const packet = { t: 'snapshot', q: snapshotSeq++, g: inputGeneration, value };
      const data = serializePacket(packet);
      for (const p of connections.values()) if (p.ready && (data === null || !send(p, 'realtime', packet, data))) stats.droppedSnapshots++;
      return true;
    },
    broadcastControl(message) {
      if (role !== 'host') return false;
      if (!plain(message) || !((message.type === 'start' && validConfig(message.config)) || ['restart', 'pause', 'resume', 'return'].includes(message.type))) throw new Error('Unsupported host game command.');
      resetInputs(inputGeneration + 1);
      if (message.type === 'start') currentControl = JSON.parse(JSON.stringify(message));
      if (message.type === 'return') currentControl = null;
      if (['start', 'restart', 'return'].includes(message.type)) lastSnapshotValue = null;
      if (message.type === 'pause') currentPaused = true;
      if (['start', 'restart', 'resume', 'return'].includes(message.type)) currentPaused = false;
      const packet = { t: 'game', q: ++controlSeq, g: inputGeneration, message };
      for (const p of connections.values()) if (p.ready) send(p, 'control', packet);
      return true;
    },
    getPlayerIds: playerIds,
    sampleSnapshot(time = now(), delay = 100) { return interpolateSnapshots(snapshots, time - delay); },
    removePeer(id) { const p = connections.get(id); if (p) drop(p, `${id} removed. That seat is available for a new offer.`); },
    disconnect,
    getDiagnostics() { return { ...state(), transport: [...connections.values()].map(p => ({ id: p.id, iceGathering: p.pc.iceGatheringState, connection: p.pc.connectionState, iceServers: p.pc.getConfiguration().iceServers, control: p.control && { state: p.control.readyState, ordered: p.control.ordered, maxRetransmits: p.control.maxRetransmits, bufferedAmount: p.control.bufferedAmount }, realtime: p.realtime && { state: p.realtime.readyState, ordered: p.realtime.ordered, maxRetransmits: p.realtime.maxRetransmits, bufferedAmount: p.realtime.bufferedAmount }, queuedControl: p.queue.length })) }; }
  };
  return api;
}

// Use arrival times: no clock synchronization required. Never extrapolate a stale guest.
export function interpolateSnapshots(frames, target) {
  if (!frames.length) return null;
  if (frames.length === 1 || target <= frames[0].at) return structuredClone(frames[0].value);
  let a = frames[0], b = frames[frames.length - 1];
  for (let i = 1; i < frames.length; i++) if (frames[i].at >= target) { a = frames[i - 1]; b = frames[i]; break; }
  if (target >= b.at) return structuredClone(b.value);
  const t = Math.max(0, Math.min(1, (target - a.at) / Math.max(1, b.at - a.at)));
  const out = structuredClone(b.value), before = new Map((a.value.pilots || []).map(p => [p.id, p]));
  for (const p of out.pilots || []) {
    const q = before.get(p.id); if (!q || p.dead !== q.dead || p.grounded !== q.grounded || p.deaths !== q.deaths || p.flightState !== q.flightState) continue;
    if (p.pos && q.pos) for (const k of ['x', 'y', 'z']) if (Number.isFinite(p.pos[k]) && Number.isFinite(q.pos[k])) p.pos[k] = q.pos[k] + (p.pos[k] - q.pos[k]) * t;
    for (const k of ['yaw', 'pitch', 'roll']) if (Number.isFinite(p[k]) && Number.isFinite(q[k])) { const d = Math.atan2(Math.sin(p[k] - q[k]), Math.cos(p[k] - q[k])); p[k] = q[k] + d * t; }
    if (Number.isFinite(p.speed) && Number.isFinite(q.speed)) p.speed = q.speed + (p.speed - q.speed) * t;
  }
  return out;
}
