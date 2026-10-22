// World-positive yaw/roll turns toward +X, which is screen-left when looking +Z.
// Keep that simulation/AI convention; translate pilot-facing keys at this boundary.
export const ACTION_KEYS={Space:'fireGun',KeyQ:'fireHeat',KeyE:'fireRadar',KeyF:'flare',KeyC:'chaff',KeyB:'bomb',KeyX:'toggleAirbrake',KeyG:'toggleGear',KeyK:'toggleManeuver'};
export const NEUTRAL_INPUT={pitch:0,roll:0,yaw:0,throttle:0,brake:false,fireGun:false,fireHeat:false,fireRadar:false,flare:false,chaff:false,bomb:false,toggleAirbrake:false,toggleGear:false,toggleManeuver:false};
export function keyboardInput(keys,pulses=new Set()){
 return{pitch:+keys.has('KeyW')-+keys.has('KeyS'),roll:+(keys.has('KeyA')||keys.has('ArrowLeft'))-+(keys.has('KeyD')||keys.has('ArrowRight')),yaw:0,
 throttle:+(keys.has('ArrowUp')||keys.has('ShiftLeft')||keys.has('ShiftRight'))-+(keys.has('ArrowDown')||keys.has('KeyZ')||keys.has('Minus')),brake:false,
 fireGun:keys.has('Space')||pulses.has('fireGun'),fireHeat:pulses.has('fireHeat'),fireRadar:pulses.has('fireRadar'),flare:keys.has('KeyF')||pulses.has('flare'),chaff:keys.has('KeyC')||pulses.has('chaff'),bomb:keys.has('KeyB')||pulses.has('bomb'),toggleAirbrake:pulses.has('toggleAirbrake'),toggleGear:pulses.has('toggleGear'),toggleManeuver:pulses.has('toggleManeuver')};
}
export function rosterConfig(config,playerIds=[]){
 const count=Math.min(6,Math.max(1,playerIds.length)),requested=Math.min(3,Math.max(1,Math.floor(config.teamSize)||1));
 return{...config,teamSize:config.mode==='freeflight'?1:Math.max(requested,Math.ceil(count/2))};
}
