import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,horizontal,TARGET} from '../sim.js';
import {groundSpawn} from '../airport-operations.js';

// The third base is not currently offered by strike's two-team menu. Seed its
// normal parked departure once; never move the aircraft during the simulation.
for(const [base,role,team] of [['home','attack',0],['northpoint','defend',1],['westhaven','attack',2]]){
 for(const dt of [1/60,1/30])test(`AI bomber flies from ${base}, hits the target and escapes at ${1/dt} Hz`,()=>{
  const g=createGame({mode:'strike',role,teamSize:1,seed:23}),p=g.pilots.find(p=>p.bomber);
  if(team===2){p.team=team;Object.assign(p,groundSpawn(g,p));}
  p.human=false;g.pilots=[p];
  assert.equal(p.homeBaseId,base);assert.equal(p.grounded,true);assert.equal(p.speed,0);
  let airborne=false,travel=0,previous={...p.pos},released=0,impact=false;
  for(let n=0;n<240/dt&&g.status==='playing';n++){
   const stores=p.bombs;step(g,{},dt);
   const distance=horizontal(p.pos,previous);travel+=distance;
   assert(distance<=p.speed*dt+1,'aircraft must fly continuously, never teleport');previous={...p.pos};
   airborne||=!p.grounded;
   if(p.bombs<stores){released+=stores-p.bombs;assert(airborne);assert(p.pos.y>100);assert(horizontal(p.pos,TARGET)>400,'release leads the target rather than dropping overhead');}
   impact||=g.bombed;
   assert.equal(p.dead,false,`bomber crashed at ${g.time.toFixed(1)} seconds`);
   assert.equal(p.heat,0);assert.equal(p.radar,0);assert.equal(g.missiles.length,0);
  }
  assert(airborne);assert(travel>4000);assert(impact,'an actual falling bomb must destroy target');
  assert.equal(released,1,'wait for a good solution and impact instead of wasting the bomb load');
  assert.equal(p.bombs,2);assert.equal(g.escaped,true);assert.equal(g.result.winner,p.team);
 });
}
