import {AIRFIELDS,routeFor,approachFor,fieldPoint} from './missions.js?v=skybreak12-1023';
import {airportForTeam} from './airport-operations.js?v=skybreak12-1023';
import {terrainHeight,SEA_LEVEL} from './world.js?v=skybreak12-1023';
import {strikeTarget,strikeEscape} from './sim.js?v=skybreak12-1023';
import {relativePosition} from './view-axes.js?v=skybreak12-1023';

export function airportStatus(g,p,field){
 if(field.id===p.homeBaseId)return{kind:'home',symbol:'H',label:'HOME · service',color:'#d5f58c'};
 const teams=[...new Set(g.pilots.map(q=>q.team))];
 const owners=teams.filter(team=>airportForTeam(g,team).id===field.id);
 if(g.mode==='freeflight'||owners.includes(p.team))return{kind:'friendly',symbol:'F',label:'FRIENDLY · no service',color:'#9de3df'};
 if(owners.length)return{kind:'hostile',symbol:'X',label:'HOSTILE · no service',color:'#ffb290'};
 return{kind:'neutral',symbol:'—',label:'UNASSIGNED · no service',color:'#c9ced0'};
}
export function mapObjectives(g){
 if(g.mode==='strike')return[{...(g.bombed?strikeEscape(g):strikeTarget(g)),label:g.bombed?'ESCAPE':'TARGET'}];
 if(g.mode==='freeflight'){const q=g.flightStage==='approach'?approachFor(g)[g.approachIndex]:routeFor(g)[g.routeIndex];return q?[{...q,label:'NEXT ROUTE GATE'}]:[];}
 return g.pilots.filter(q=>q.objectiveRole==='transport'&&!q.dead).map(q=>({...q.pos,label:'TRANSPORT'}));
}
export function knownContacts(g,p){return g.pilots.filter(q=>q.id!==p.id&&!q.dead&&(q.team===p.team||q.id===p.targetId||Math.hypot(q.pos.x-p.pos.x,q.pos.z-p.pos.z)<=3280));}
export function mapView(g,p){
 const points=[p.pos,...Object.values(AIRFIELDS),...mapObjectives(g)];if(g.arenaId==='valley')points.push({x:-14000,z:18000},{x:7000,z:18000});
 const minX=Math.min(...points.map(q=>q.x)),maxX=Math.max(...points.map(q=>q.x)),minZ=Math.min(...points.map(q=>q.z)),maxZ=Math.max(...points.map(q=>q.z));
 return{x:(minX+maxX)/2,z:(minZ+maxZ)/2,span:Math.max(24000,maxX-minX+10000,maxZ-minZ+10000)};
}
export function mapPoint(point,view,size=600){return{x:size/2-(point.x-view.x)*size/view.span,y:size/2-(point.z-view.z)*size/view.span};}
export function homeGuidance(g,p){const f=AIRFIELDS[p.homeBaseId];if(!f)return'HOME unavailable';const rel=relativePosition(p,f),bearing=Math.round((Math.atan2(-rel.right,rel.forward)*180/Math.PI+360)%360);return`HOME ${f.shortName} · ${(Math.hypot(f.x-p.pos.x,f.z-p.pos.z)/1000).toFixed(1)} km · ${Math.min(bearing,360-bearing)<5?'ahead':`${bearing<180?'left':'right'} ${Math.round(Math.min(bearing,360-bearing))}°`}`;}
export class TacticalMap{
 constructor(canvas){this.canvas=canvas;this.cache=null;}
 draw(g,p){
  const c=this.canvas.getContext('2d'),size=600,v=mapView(g,p);this.canvas.width=this.canvas.height=size;
  // One world raster, reused for every heading, position and map opening.
  if(!this.cache){const n=320,t=document.createElement('canvas');t.width=t.height=n;const ctx=t.getContext('2d'),data=ctx.createImageData(n,n);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const h=terrainHeight(36000-(x+.5)*72000/n,36000-(y+.5)*72000/n),i=(y*n+x)*4,land=h>SEA_LEVEL,k=Math.min(1,Math.max(0,h)/1400);data.data.set(land?[61+70*k,102+65*k,88+60*k,255]:[20,52,68,255],i);}ctx.putImageData(data,0,0);this.cache=t;
  }
  c.fillStyle='#143444';c.fillRect(0,0,size,size);const a=mapPoint({x:36000,z:36000},v),scale=size/v.span;c.drawImage(this.cache,a.x,a.y,72000*scale,72000*scale);
  c.strokeStyle='#d9f1e21c';c.lineWidth=1;for(let i=0;i<=size;i+=100){c.beginPath();c.moveTo(i,0);c.lineTo(i,size);c.moveTo(0,i);c.lineTo(size,i);c.stroke();}
  c.font='bold 15px system-ui';c.textAlign='center';
  for(const f of Object.values(AIRFIELDS)){const q=mapPoint(f,v),s=airportStatus(g,p,f);c.fillStyle='#10252ee8';c.fillRect(q.x-13,q.y-13,26,26);c.strokeStyle=s.color;c.lineWidth=2;c.strokeRect(q.x-13,q.y-13,26,26);c.fillStyle=s.color;c.fillText(s.symbol,q.x,q.y+5);c.font='12px system-ui';c.textAlign='left';c.fillText(f.shortName,q.x+18,q.y+5);c.textAlign='center';c.font='bold 15px system-ui';}
  for(const q of knownContacts(g,p)){const at=mapPoint(q.pos,v);c.fillStyle=q.team===p.team?'#9de3df':'#ffb290';c.beginPath();if(q.team===p.team)c.arc(at.x,at.y,4,0,Math.PI*2);else{c.moveTo(at.x,at.y-6);c.lineTo(at.x+6,at.y);c.lineTo(at.x,at.y+6);c.lineTo(at.x-6,at.y);c.closePath();}c.fill();}
  for(const q of mapObjectives(g)){const at=mapPoint(q,v);c.strokeStyle='#ffe6a0';c.lineWidth=2;c.beginPath();c.arc(at.x,at.y,10,0,Math.PI*2);c.stroke();c.fillStyle='#ffe6a0';c.fillText(q.label,at.x,at.y-16);}
  const at=mapPoint(p.pos,v);c.save();c.translate(at.x,at.y);c.rotate(-p.yaw);c.fillStyle='#fff';c.strokeStyle='#10252e';c.lineWidth=2;c.beginPath();c.moveTo(0,-12);c.lineTo(-8,9);c.lineTo(0,5);c.lineTo(8,9);c.closePath();c.fill();c.stroke();c.restore();c.fillStyle='#fff';c.textAlign='left';c.font='13px system-ui';c.fillText('N ↑',15,25);c.fillText(`${Math.round(v.span/1000)} km across`,15,size-15);
 }
}
