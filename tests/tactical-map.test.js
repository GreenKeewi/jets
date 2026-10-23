import test from 'node:test';
import assert from 'node:assert/strict';
import {airportStatus,mapPoint,mapView,knownContacts,mapObjectives} from '../tactical-map.js';
import {createGame,AIRFIELDS} from '../sim.js';
test('airport ownership follows player team, valley bases and unique HOME service',()=>{
 for(const arenaId of ['coast','valley']){const g=createGame({arenaId,skirmish:true,teamSizes:[2,2,2]});for(const p of g.pilots){for(const f of Object.values(AIRFIELDS)){const s=airportStatus(g,p,f);assert.equal(s.kind==='home',f.id===p.homeBaseId);if(f.id!==p.homeBaseId)assert.equal(s.kind,'hostile');}}}
 const g=createGame({mode:'freeflight'}),p=g.pilots[0];assert.equal(airportStatus(g,p,AIRFIELDS.northpoint).kind,'friendly');assert.match(airportStatus(g,p,AIRFIELDS.northpoint).label,/no service/);
});
test('map uses north-up world coordinates and bounds airports/player/objectives',()=>{
 const g=createGame({mode:'strike'}),p=g.pilots[0],v=mapView(g,p);
 for(const q of [p.pos,...Object.values(AIRFIELDS),...mapObjectives(g)]){const a=mapPoint(q,v);assert(a.x>0&&a.x<600&&a.y>0&&a.y<600);}
 assert(mapPoint({x:v.x,z:v.z+1000},v).y<300);assert(mapPoint({x:v.x+1000,z:v.z},v).x<300);
 g.bombed=true;assert.equal(mapObjectives(g)[0].label,'ESCAPE');
});
test('map exposes teammates and radar/selected hostile contacts, not distant hidden enemies',()=>{
 const g=createGame({teamSize:2}),p=g.pilots[0];for(const q of g.pilots)if(q.team!==p.team)q.pos={x:p.pos.x+10000,y:1000,z:p.pos.z};
 assert(knownContacts(g,p).every(q=>q.team===p.team));const hostile=g.pilots.find(q=>q.team!==p.team);p.targetId=hostile.id;assert(knownContacts(g,p).includes(hostile));hostile.dead=true;assert(!knownContacts(g,p).includes(hostile));
});

test('only map HOME supports actual pavement restock and stopped landing repair',async()=>{
 const {fieldPoint}=await import('../missions.js'),{resupplyAtAirfield}=await import('../airfield-resupply.js'),{repairAtAirport}=await import('../airport-operations.js');
 const g=createGame({mode:'freeflight'}),p=g.pilots[0];g.time=20;
 for(const f of Object.values(AIRFIELDS)){
  Object.assign(p,{pos:fieldPoint(f,0,0,3),grounded:true,landed:true,runwayId:f.id,hp:50,gunAmmo:0,resupplyLatched:false,resupplyReadyAt:0,speed:0,throttle:0});
  const service=resupplyAtAirfield(g,p);repairAtAirport(g,p,1);
  assert.equal(!!service,airportStatus(g,p,f).kind==='home');assert.equal(p.hp>50,airportStatus(g,p,f).kind==='home');
 }
});
