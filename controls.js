import {fillTeams,validAssignments} from './lobby-teams.js?v=skybreak120-1104';
// World-positive yaw/roll turns toward +X, which is screen-left when looking +Z.
// Keep that simulation/AI convention; translate pilot-facing keys at this boundary.
export const ACTION_KEYS={Space:'fireGun',KeyQ:'fireHeat',KeyE:'fireRadar',KeyF:'flare',KeyC:'chaff',KeyB:'bomb',KeyX:'toggleAirbrake',KeyG:'toggleGear',KeyK:'toggleManeuver',KeyO:'toggleAoaLimiter',KeyT:'jettisonTanks',BracketLeft:'sweepOut',BracketRight:'sweepIn'};
export const NEUTRAL_INPUT={pitch:0,roll:0,yaw:0,throttle:0,brake:false,fireGun:false,fireHeat:false,fireRadar:false,flare:false,chaff:false,bomb:false,toggleAirbrake:false,toggleGear:false,toggleManeuver:false,toggleAoaLimiter:false,jettisonTanks:false,sweepOut:false,sweepIn:false};
export function keyboardInput(keys,pulses=new Set()){
 return{pitch:+keys.has('KeyW')-+keys.has('KeyS'),roll:+(keys.has('KeyA')||keys.has('ArrowLeft'))-+(keys.has('KeyD')||keys.has('ArrowRight')),yaw:0,
 throttle:+(keys.has('ArrowUp')||keys.has('ShiftLeft')||keys.has('ShiftRight'))-+(keys.has('ArrowDown')||keys.has('KeyZ')||keys.has('Minus')),brake:false,
 fireGun:keys.has('Space')||pulses.has('fireGun'),fireHeat:pulses.has('fireHeat'),fireRadar:pulses.has('fireRadar'),flare:pulses.has('flare'),chaff:pulses.has('chaff'),bomb:keys.has('KeyB')||pulses.has('bomb'),toggleAirbrake:pulses.has('toggleAirbrake'),toggleGear:pulses.has('toggleGear'),toggleManeuver:pulses.has('toggleManeuver'),toggleAoaLimiter:pulses.has('toggleAoaLimiter'),jettisonTanks:pulses.has('jettisonTanks'),sweepOut:pulses.has('sweepOut'),sweepIn:pulses.has('sweepIn')};
}
export function rosterConfig(config,playerIds=[],requestedTeams){
 config={...config,enemyRespawnSeconds:[120,180,300].includes(config.enemyRespawnSeconds)?30:config.enemyRespawnSeconds};
 const count=Math.min(6,Math.max(1,playerIds.length)),requested=Math.min(3,Math.max(1,Math.floor(config.teamSize)||1));
 const ids=playerIds.slice(0,6),playerTeams=fillTeams(validAssignments(requestedTeams,ids)?{...requestedTeams}:{},ids),capacity=Math.max(1,...[0,1].map(team=>Object.values(playerTeams).filter(t=>t===team).length));
 const coopTeam=ids.length && ids.every(id=>playerTeams[id]===playerTeams[ids[0]]) ? playerTeams[ids[0]] : undefined;
 const dogfight=config.mode==='dogfight'&&(!config.missionId||config.missionId==='dogfight');
 const enemyRespawnSeconds=dogfight && coopTeam!==undefined && [15,30,60].includes(config.enemyRespawnSeconds) ? config.enemyRespawnSeconds : 0;
 const {coopTeam:previousCoopTeam,enemyTeamSize:requestedEnemies,teamSizes:previousSizes,...base}=config;
 const teamSize=config.mode==='freeflight'?1:Math.max(requested,capacity,Math.ceil(count/2));
 // Extra enemy seats are opt-in and belong only to a same-team co-op lobby.
 // Keep legacy symmetric PvP and the three-human limit unchanged.
 const enemyTeamSize=dogfight&&coopTeam!==undefined&&Number.isInteger(requestedEnemies)&&requestedEnemies>=1&&requestedEnemies<=4?requestedEnemies:undefined;
 return{...base,playerTeams,enemyRespawnSeconds,...(enemyRespawnSeconds||enemyTeamSize?{coopTeam}:{}),teamSize,...(enemyTeamSize?{enemyTeamSize,teamSizes:coopTeam===0?[teamSize,enemyTeamSize]:[enemyTeamSize,teamSize]}:{})};
}

// Keep discrete F/C presses even when several arrive between animation frames.
// Other actions retain their existing once-per-frame semantics.
export class ActionQueue extends Set{
 constructor(){super();this.bursts={flare:0,chaff:0};}
 add(action){if(action==='flare'||action==='chaff')this.bursts[action]=Math.min(240,this.bursts[action]+1);return super.add(action);}
 clear(){super.clear();if(this.bursts)this.bursts={flare:0,chaff:0};}
 consume(){const next={...this.bursts};this.clear();for(const key of ['flare','chaff'])if(next[key]>1){this.bursts[key]=next[key]-1;super.add(key);}}
}
