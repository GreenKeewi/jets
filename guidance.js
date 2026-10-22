import {gunIntercept} from './guns.js?v=skybreak4-1022';
import {turnHint} from './view-axes.js?v=skybreak4-1022';
import {angle,dist,horizontal,clamp} from './sim.js?v=skybreak4-1022';
export function waypointScreenPosition(projected,forwardDot,width,height,cockpit=false){
 let x=forwardDot>0?clamp(projected.x,80,width-80):width/2,y=forwardDot>0?clamp(projected.y,140,height-190):height*.7;
 // Keep edge-clamped guidance clear of the task card and essential flight instruments.
 if(x<380&&y<190)y=Math.min(height-150,205);
 if(!cockpit&&x<230&&y>height*.34&&y<height*.66)x=Math.min(width-80,260);
 return{x,y};
}
export function combatCue(game,p){
 if(game.mode==='freeflight'||p.dead||game.mode==='strike'&&p.bomber)return null;
 const enemies=game.pilots.filter(q=>q.team!==p.team&&!q.dead);if(!enemies.length)return null;
 const target=enemies.find(q=>q.id===p.targetId)||enemies.find(q=>game.mode==='strike'&&q.bomber)||enemies.sort((a,b)=>dist(a.pos,p.pos)-dist(b.pos,p.pos))[0];
 if(target.id===p.targetId&&p.lock>.45)return null;
 const heading=angle(Math.atan2(target.pos.x-p.pos.x,target.pos.z-p.pos.z)-p.yaw),vertical=Math.atan2(target.pos.y-p.pos.y,Math.max(1,horizontal(target.pos,p.pos)))-p.pitch;
 const range=dist(target.pos,p.pos),distance=range>=1000?`${(range/1000).toFixed(1)} km`:`${Math.round(range/10)*10} m`;
 if(Math.abs(heading)>.48)return{...turnHint(p,target.pos),distance,kind:target.bomber?'BOMBER':'BANDIT'};
 if(Math.abs(vertical)>.28)return{key:vertical>0?'W':'S',text:vertical>0?'Climb toward target':'Descend toward target',distance,kind:target.bomber?'BOMBER':'BANDIT'};
 return null;
}
export function nearestThreat(game,p){
 let nearest=null,range=1100;
 for(const m of game.missiles){if(m.targetId!==p.id||m.decoyed||m.seekerLost||m.age>=m.life)continue;const d=dist(m.pos,p.pos);if(d<range){nearest=m;range=d;}}
 return nearest;
}

// Only the current nearby weapon target gets a small, non-steering lead cue.
export function gunLeadCue(game,p){
 if(game.mode==='freeflight'||p.dead||p.gunAmmo<=0)return null;
 const target=game.pilots.find(q=>q.id===p.targetId&&q.team!==p.team&&!q.dead&&game.time>=(q.spawnProtectedUntil||0));
 return gunIntercept(p,target);
}
