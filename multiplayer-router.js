import {createNetwork} from './network.js?v=skybreak4-1022';
import {createServerClient} from './server-client.js?v=skybreak4-1022';

// Exactly one simulation transport owns the game at a time. Friend-room UI retains
// its original API, while dedicated matches reuse the existing guest render path.
export function createMultiplayerRouter(callbacks = {}, {createPeer = createNetwork, createServer = createServerClient} = {}) {
  let active = 'peer', operation = 0;
  const peers = {};
  const routed = name => Object.fromEntries(Object.entries(callbacks).map(([key,fn]) => [key,
    (...args) => { if (active === name) return fn(...args); }
  ]));
  peers.peer = createPeer(routed('peer'));
  peers.server = createServer(routed('server'));
  const notify = () => callbacks.onState?.(api.state);
  function selectPeer() {
    operation++;
    if (active === 'server') {
      const previous = peers.server.state;
      peers.server.disconnect();
      if (previous.connected) callbacks.onDisconnect?.(previous.localId,'Left the shared sky.');
      active = 'peer'; notify();
    }
  }
  const actions = new Set(['createRoom','joinRoom','host','createOffer','acceptOffer','acceptAnswer']);
  const peerUI = new Proxy(peers.peer, {get(target,key) {
    const value = target[key];
    if (typeof value !== 'function') return value;
    return (...args) => { if (actions.has(key)) selectPeer(); return value.apply(target,args); };
  }});
  const api = {
    peer:peerUI, server:peers.server,
    get state() { return {...peers[active].state,transport:active}; },
    async connectServer(endpoint,options) {
      if (peers.peer.state.role !== 'offline' || peers.peer.state.connecting) throw new Error('Leave your friend room before joining the shared sky.');
      const current = ++operation; active = 'server'; notify();
      try { return await peers.server.connect(endpoint,options); }
      catch (error) { if (current === operation) { peers.server.disconnect(error.message); active = 'peer'; notify(); } throw error; }
    },
    disconnect() { operation++; peers[active].disconnect(); active = 'peer'; notify(); },
    selectPeer,
  };
  for (const key of ['getPlayerIds','consumeInputs','broadcastControl','broadcastSnapshot','sampleSnapshot','submitInput','requestRespawn']) {
    api[key] = (...args) => peers[active][key]?.(...args);
  }
  return api;
}
