import {flightForward} from './view-axes.js?v=skybreak13-1023';
// Intentional arcade world travel, NOT indicated airspeed or simulated G.
// Takeoff, gear-down flight and free-flight final approach retain normal distances.
export const TRAVEL=Object.freeze({maxMultiplier:1.5,blendStart:120,blendEnd:220});
export function travelMultiplier(p){
 if(p.grounded||p.gearDown||p.departureActive||p.travelApproach)return 1;
 const t=Math.max(0,Math.min(1,((Number(p.speed)||0)-TRAVEL.blendStart)/(TRAVEL.blendEnd-TRAVEL.blendStart)));
 return 1+(TRAVEL.maxMultiplier-1)*t*t*(3-2*t);
}
export function worldSpeed(p){return Math.max(0,Number(p.speed)||0)*travelMultiplier(p);}
export function worldVelocity(p){
 const f=flightForward({yaw:p.yaw||0,pitch:p.pitch||0}),speed=worldSpeed(p);
 return{x:f.x*speed,y:p.grounded?0:f.y*speed-(p.stallSink||0),z:f.z*speed};
}
