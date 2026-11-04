import {AIRCRAFT_DEFINITIONS,validLoadout,normalizeLoadout} from './loadouts.js?v=skybreak122-1104';
export function validEquipment(e){return !!e&&typeof e==='object'&&!Array.isArray(e)&&Object.keys(e).every(k=>['aircraftId','loadout','startingFuel'].includes(k))&&Object.hasOwn(AIRCRAFT_DEFINITIONS,e.aircraftId)&&validLoadout(e.aircraftId,e.loadout)&&[.25,.5,.75,1].includes(e.startingFuel);}
export function copyEquipment(e){return {aircraftId:e.aircraftId,loadout:normalizeLoadout(e.aircraftId,e.loadout),startingFuel:e.startingFuel};}
export function validEquipmentRoster(map){return !!map&&typeof map==='object'&&!Array.isArray(map)&&Object.keys(map).length<=6&&Object.entries(map).every(([id,e])=>/^(host|p[1-5])$/.test(id)&&validEquipment(e));}
