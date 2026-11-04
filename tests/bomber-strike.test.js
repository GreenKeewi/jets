import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step} from '../sim.js';
for(const aircraftId of ['f16','fa18e','su27','f14'])test(`AI ${aircraftId} takes off, bombs three times, and lands home continuously`,()=>{
 const g=createGame({mode:'strike',aircraftId,seed:23}),p=g.pilots[0];g.pilots=[p];p.human=false;let airborne=false,released=0;
 for(let n=0;n<720*60&&g.status==='playing';n++){const bombs=p.bombs;step(g,{});airborne||=!p.grounded;if(p.bombs<bombs)released+=bombs-p.bombs;assert(!p.dead,`${g.time} ${JSON.stringify(p.pos)}`);}
 assert(airborne);assert(released>=3);assert.equal(g.bombHits,3);assert.equal(g.status,'complete');assert.equal(g.result.winner,p.team);assert(p.landed&&p.grounded);assert.equal(p.runwayId,p.homeBaseId);
});
test('unopposed airborne strike AI can actually destroy the defended friendly field',()=>{const g=createGame({mode:'strike',role:'defend'});g.pilots[0].human=true;for(let n=0;n<120*60&&g.status==='playing';n++)step(g,{});assert.equal(g.bombHits,3);assert.equal(g.result.winner,1);});
