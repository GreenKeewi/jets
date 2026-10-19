// Combat objectives share the host's ordinary dogfight simulation and controls.
import {valleyPoint} from './arenas.js?v=valleyenergy1-1019';
export const COMBAT_MISSIONS=Object.freeze({
 dogfight:Object.freeze({name:'Dogfight',description:'Choose rival squads. They arrive in tight formations from changing directions. Watch your six, break locks, and keep flying.'}),
 escort:Object.freeze({name:'Escort',description:'Fly a fighter escort. Keep the marked transport alive until it reaches the exit corridor. No respawns; retry from the result or pause menu.'}),
 intercept:Object.freeze({name:'Intercept',description:'Stop the marked enemy transport before it reaches the exit corridor. Its escorts will protect it. No respawns; retry from the result or pause menu.'}),
 ambush:Object.freeze({name:'Survive an ambush',description:'Bandits start behind your squad. Survive for 90 seconds or eliminate the attackers. No respawns; retry from the result or pause menu.'}),
});
export const combatMission=id=>COMBAT_MISSIONS[id]||COMBAT_MISSIONS.dogfight;
export function missionRoute(arenaId){
 return arenaId==='valley'?[valleyPoint(-2700,0,240),valleyPoint(-800,0,240),valleyPoint(1100,0,240),valleyPoint(3300,0,240)]:[{x:-5900,y:800,z:-3000},{x:-5900,y:800,z:1000},{x:-5900,y:800,z:5700}];
}
export function missionObjective(g,p){
 const m=g.combatMission;if(!m)return null;
 const remaining=Math.max(0,Math.ceil(m.deadline-g.time));
 if(g.missionId==='ambush')return{tag:'AMBUSH',title:p.team===0?'Survive the ambush':'Stop the escaping squad',detail:p.team===0?`${remaining}s to safety · stay airborne or eliminate the attackers.`:`${remaining}s to stop every opposing fighter.`,point:null};
 const transport=g.pilots.find(q=>q.objectiveRole==='transport'),protect=transport?.team===p.team;
 return{tag:protect?'ESCORT':'INTERCEPT',title:protect?'Protect the transport':'Intercept the transport',detail:`Transport ${Math.max(0,transport?.hp||0)}% · ${Math.max(0,m.route.length-m.routeIndex)} route legs · ${remaining}s remaining.`,point:transport&&!transport.dead?transport.pos:null};
}
