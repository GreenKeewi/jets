// Body-axis attitude controls. The orthonormal basis avoids Euler pole clamps,
// so a pilot can roll through 360 degrees and remain inverted in either mode.
import {viewAxes} from './view-axes.js';
import {limitFlightEnvelope} from './pilot-g.js';
import {pitchRateLimit,turnAuthority,fuelMassRatio} from './flight.js';
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const rotate=(v,a,t)=>{const c=Math.cos(t),s=Math.sin(t),d=dot(a,v)*(1-c),q=cross(a,v);return{x:v.x*c+q.x*s+a.x*d,y:v.y*c+q.y*s+a.y*d,z:v.z*c+q.z*s+a.z*d};};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function advanceAttitude(p,i,dt){
 const previous={pitch:p.pitch,yaw:p.yaw,roll:p.roll};
 let {forward:f,up:u}=viewAxes(p,p.roll),right=cross(f,u);
 const assist=!!p.maneuverAssist,damage=.4+.6*(p.controlHealth??1),mass=fuelMassRatio(p);
 const roll=clamp(Number(i.roll)||0,-1,1)*(p.bomber?.65:assist?2.5:1.65)*damage*mass;
 u=rotate(u,f,-roll*dt);right=cross(f,u);
 const pitch=clamp(Number(i.pitch)||0,-1,1)*pitchRateLimit(p)*clamp(p.speed/95,.18,1);
 f=rotate(f,right,pitch*dt);u=rotate(u,right,pitch*dt);
 // A modest coordinated-turn aid keeps bank-only steering approachable.
 const yaw=(Math.sin(p.roll)*.5*turnAuthority(p.speed,p)+clamp(Number(i.yaw)||0,-1,1)*.2)*dt;
 f=rotate(f,{x:0,y:1,z:0},yaw);u=rotate(u,{x:0,y:1,z:0},yaw);
 p.pitch=Math.asin(clamp(f.y,-1,1));p.yaw=Math.atan2(f.x,f.z);
 const levelRight={x:-Math.cos(p.yaw),y:0,z:Math.sin(p.yaw)},levelUp={x:-Math.sin(p.yaw)*Math.sin(p.pitch),y:Math.cos(p.pitch),z:-Math.cos(p.yaw)*Math.sin(p.pitch)};
 p.roll=Math.atan2(-dot(u,levelRight),dot(u,levelUp));
 limitFlightEnvelope(p,previous,dt);
}
