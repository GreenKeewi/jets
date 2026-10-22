import {randomUUID, randomInt} from 'node:crypto';
import {createGame, step, snapshot, respawnPilot} from '../sim.js';
import {placePilotOnRunway} from '../airport-operations.js';
import {createInputBuffer} from './protocol.js';

export function createRoomManager({region = 'local', maxRooms = 8, playersPerRoom = 6, clock = () => performance.now()} = {}) {
  const rooms = new Map();
  function removeClient(client) {
    const room = client.room; if (!room) return;
    room.clients.delete(client.id);
    const pilot = room.game.pilots.find(p => p.id === client.id);
    if (pilot) pilot.human = false;
    client.room = null;
    if (!room.clients.size) rooms.delete(room.id);
  }
  return {
    rooms,
    join(client, {pool, arenaId}) {
      if (client.room) return null;
      client.joinError = null;
      let room = [...rooms.values()].find(r => r.pool === pool && r.arenaId === arenaId && r.game.status === 'playing' && r.clients.size < playersPerRoom && r.game.pilots.some(p => !p.human && !p.dead));
      if (!room) {
        if (rooms.size >= maxRooms) return null;
        const config = {mode:'dogfight', missionId:'dogfight', skirmish:true, teamSize:3, teamSizes:[3,3], arenaId, seed:randomInt(2**32), startingFuel:.75, difficulty:'normal'};
        const game = createGame(config); for (const p of game.pilots) p.human = false;
        room = {id:randomUUID(), region, pool, arenaId, config, game, clients:new Map(), completedAt:null};
        rooms.set(room.id, room);
      }
      const population = team => [...room.clients.values()].filter(c => room.game.pilots.find(p => p.id === c.id)?.team === team).length;
      const team = population(0) <= population(1) ? 0 : 1;
      const seat = room.game.pilots.filter(p => !p.human && !p.dead).sort((a,b) => Number(a.team !== team) - Number(b.team !== team))[0];
      if (!seat) return null;
      // Never hand an airborne AI aircraft to a new pilot. The same collision-
      // checked runway placement is used by Node and Cloudflare; failed joins
      // leave the existing bot and match unchanged, without a free rearm/refuel.
      if (!placePilotOnRunway(room.game, seat)) {
        client.joinError = 'The runway is busy. Wait for aircraft to clear it, then try again.';
        if (!room.clients.size) rooms.delete(room.id);
        return null;
      }
      const oldId = seat.id;
      client.id = `pilot-${randomUUID()}`; client.input = createInputBuffer(); client.room = room;
      seat.id = client.id; seat.human = true;
      for (const p of room.game.pilots) if (p.targetId === oldId) p.targetId = client.id;
      for (const m of room.game.missiles) { if (m.targetId === oldId) m.targetId = client.id; if (m.ownerId === oldId) m.ownerId = client.id; }
      room.clients.set(client.id, client); return room;
    },
    removeClient,
    respawn(client) { return !!client.room && respawnPilot(client.room.game, client.id); },
    step(dt = 1/60) {
      const now = clock();
      for (const room of rooms.values()) {
        const input = Object.fromEntries([...room.clients.values()].map(c => [c.id, c.input.take(now)]));
        step(room.game, input, dt);
        if (room.game.status !== 'playing') room.completedAt ??= now;
        if (room.completedAt !== null && now - room.completedAt > 30000) {
          for (const client of [...room.clients.values()]) { client.close?.(1000, 'Sortie complete. Join another match.'); removeClient(client); }
        }
      }
    },
    snapshot(room) { return snapshot(room.game); },
    occupancy() { return [...rooms.values()].map(r => ({pool:r.pool, arenaId:r.arenaId, players:r.clients.size, capacity:playersPerRoom, joinable:r.game.status === 'playing' && r.clients.size < playersPerRoom && r.game.pilots.some(p => !p.human && !p.dead)})); },
  };
}
