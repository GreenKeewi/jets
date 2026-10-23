// Dedicated-server protocol, independent of the peer-to-peer transport.
export const SERVER_PROTOCOL = 'SKYBREAK-SERVER-1';
export const SIM_BUILD = 'skybreak13-1023';
export const AXES = ['pitch', 'roll', 'yaw', 'throttle'];
export const HELD = ['fireGun', 'brake', 'autopilot'];
export const ACTIONS = ['fireHeat', 'fireRadar', 'flare', 'chaff', 'bomb', 'toggleAirbrake', 'toggleGear', 'toggleManeuver'];
export const neutralInput = () => Object.fromEntries([...AXES.map(k => [k, 0]), ...[...HELD, ...ACTIONS].map(k => [k, false])]);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateInput(value) {
  if (!plain(value) || Object.keys(value).some(key => ![...AXES, ...HELD, ...ACTIONS].includes(key))) return null;
  if (value.autopilot === true) return null; // Route assist is not available in shared dogfights.
  const input = neutralInput();
  for (const key of AXES) {
    if (value[key] !== undefined && (!Number.isFinite(value[key]) || Math.abs(value[key]) > 1)) return null;
    input[key] = value[key] ?? 0;
  }
  for (const key of [...HELD, ...ACTIONS]) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') return null;
    input[key] = value[key] ?? false;
  }
  return input;
}
export function validateJoin(packet, region) {
  if (!plain(packet) || packet.t !== 'join' || packet.protocol !== SERVER_PROTOCOL || packet.build !== SIM_BUILD) return null;
  if (!['regional', 'global'].includes(packet.pool) || !['coast', 'valley'].includes(packet.arenaId)) return null;
  if (packet.pool === 'regional' && packet.region !== region) return null;
  if (packet.team!==undefined&&!['auto',0,1].includes(packet.team)) return null;
  if(packet.match!==undefined&&!['versus','coop'].includes(packet.match))return null;
  if(packet.match==='coop'&&packet.team!==undefined&&!['auto',0].includes(packet.team))return null;
  if (Object.keys(packet).some(key => !['t', 'protocol', 'build', 'pool', 'arenaId', 'region','team','match'].includes(key))) return null;
  return {pool: packet.pool, arenaId: packet.arenaId,...(packet.team!==undefined?{team:packet.team}:{}),...(packet.match!==undefined?{match:packet.match}:{})};
}
export function createInputBuffer() {
  let sequence = -1, at = -Infinity, held = neutralInput(), pending = neutralInput(), last = {}, tokens = 100, tokenAt = 0;
  return {
    accept(packet, now) {
      if (!plain(packet) || packet.t !== 'input' || Object.keys(packet).some(k => !['t', 'q', 'input'].includes(k)) || !Number.isSafeInteger(packet.q) || packet.q < 0 || packet.q <= sequence) return false;
      const next = validateInput(packet.input); if (!next) return false;
      tokens = Math.min(100, tokens + Math.max(0, now - tokenAt) * .09); tokenAt = now;
      if (tokens < 1) return false; tokens--; sequence = packet.q; at = now;
      held = next;
      for (const key of ACTIONS) if (next[key] && now - (last[key] ?? -Infinity) >= (['flare','chaff'].includes(key)?0:150)) { pending[key] = ['flare','chaff'].includes(key)?Math.min(240,(Number(pending[key])||0)+1):true; last[key] = now; }
      return true;
    },
    take(now) {
      const value = now - at <= 250 ? {...held} : neutralInput();
      for (const key of ACTIONS) { const burst=['flare','chaff'].includes(key),fresh=burst?now-(last[key]??-Infinity)<=5000:now-at<=250;value[key]=fresh&&!!pending[key];pending[key]=burst&&fresh?Math.max(0,Number(pending[key])-1):false; }
      return value;
    },
  };
}
