import {flightForward,gunMuzzle} from './view-axes.js?v=squads7-1019';
export const GUN={capacity:300,interval:.1,speed:850,life:1.35,damage:10,maxRounds:96,tracerLength:42};
export function fireGunRound(g,p){
 const rounds=g.bullets||(g.bullets=[]);if(p.dead||!Number.isFinite(p.gunAmmo)||p.gunAmmo<=0||p.gunCD>1e-8||rounds.length>=GUN.maxRounds)return false;
 p.gunAmmo--;p.gunShots=(p.gunShots||0)+1;p.gunCD=GUN.interval;
 rounds.push({id:++g.serial,ownerId:p.id,team:p.team,pos:gunMuzzle(p),dir:flightForward(p),speed:GUN.speed+p.speed,age:0,life:GUN.life});return true;
}
export function segmentSphere(from,to,center,radius){
 const d={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},m={x:from.x-center.x,y:from.y-center.y,z:from.z-center.z},a=d.x*d.x+d.y*d.y+d.z*d.z,c=m.x*m.x+m.y*m.y+m.z*m.z-radius*radius;
 if(c<=0)return 0;if(a<1e-12)return null;const b=m.x*d.x+m.y*d.y+m.z*d.z,disc=b*b-a*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/a;return t>=0&&t<=1?t:null;
}
export function advanceGunRounds(g,dt,{ground,onHit,onKill,canHit=()=>true}){
 const live=[];for(const round of g.bullets||[]){
  round.age+=dt;if(round.age>=round.life)continue;
  const from=round.pos,to={x:from.x+round.dir.x*round.speed*dt,y:from.y+round.dir.y*round.speed*dt,z:from.z+round.dir.z*round.speed*dt};
  const samples=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)/8));let barrier=Infinity;
  for(let i=0;i<=samples;i++){const t=i/samples,x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t,z=from.z+(to.z-from.z)*t;if(y<=ground(x,z)+.3){barrier=t;break;}}
  let target=null,hit=barrier;for(const pilot of g.pilots){if(pilot.dead||pilot.team===round.team||pilot.id===round.ownerId||!canHit(pilot))continue;const t=segmentSphere(from,to,pilot.pos,pilot.bomber?22:14);if(t!==null&&t<hit){hit=t;target=pilot;}}
  if(target){const impact={x:from.x+(to.x-from.x)*hit,y:from.y+(to.y-from.y)*hit,z:from.z+(to.z-from.z)*hit};target.hp=Math.max(0,target.hp-GUN.damage);g.effects.push({id:++g.serial,type:'gun-hit',pos:impact,age:0,life:.16});onHit?.(round,target);if(target.hp<=0)onKill?.(target,round.ownerId);continue;}
  if(barrier!==Infinity)continue;round.pos=to;live.push(round);
 }g.bullets=live;
}
