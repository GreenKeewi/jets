import test from 'node:test';
import assert from 'node:assert/strict';
import {keyboardInput,rosterConfig} from '../controls.js';
import {viewAxes,flightForward,radarPoint,turnHint,compassHeading} from '../view-axes.js';
import {GUN,advanceGunRounds} from '../guns.js';
import {createGame,step,configurePlayers,snapshot} from '../sim.js';
import {createInputGuard,serializePacket} from '../network.js';
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
function air(g){g.pilots.forEach((p,i)=>Object.assign(p,{human:true,pos:{x:0,y:3000,z:i?8000:0},yaw:0,pitch:0,roll:0,speed:110,throttle:.6,grounded:false}));return g;}
function run(g,seconds,input){for(let n=0;n<seconds*60&&g.status==='playing';n++)step(g,input,1/60);}
test('A/D and horizontal arrows turn to the matching screen side at every cardinal heading',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const [key,sign] of [['KeyA',-1],['ArrowLeft',-1],['KeyD',1],['ArrowRight',1]]){
  const g=air(createGame()),p=g.pilots[0];p.yaw=yaw;const right=viewAxes(p).right;run(g,.65,{host:keyboardInput(new Set([key]))});assert(dot(flightForward(p),right)*sign>.08,`${yaw} ${key}`);assert(p.roll*sign<0);
 }
});
test('Up/Down change only power, W/S pitch, and Q/E never become axes or held missile fire',()=>{
 assert.equal(keyboardInput(new Set(['ArrowUp'])).throttle,1);assert.equal(keyboardInput(new Set(['ArrowUp'])).pitch,0);assert.equal(keyboardInput(new Set(['ArrowDown'])).throttle,-1);assert.equal(keyboardInput(new Set(['KeyW'])).pitch,1);assert.equal(keyboardInput(new Set(['KeyS'])).pitch,-1);
 for(const key of ['KeyQ','KeyE']){const held=keyboardInput(new Set([key]));assert.equal(held.roll,0);assert.equal(held.yaw,0);assert.equal(held.throttle,0);assert.equal(held.fireHeat,false);assert.equal(held.fireRadar,false);}
 assert.equal(keyboardInput(new Set(),new Set(['fireHeat'])).fireHeat,true);assert.equal(keyboardInput(new Set(),new Set(['fireRadar'])).fireRadar,true);assert.equal(keyboardInput(new Set(['Space'])).fireGun,true);assert.equal(keyboardInput(new Set(['KeyF','KeyC','KeyB'])).flare,true);
});
test('camera up, heading, radar and turn hints share pilot-relative left/right at cardinal headings',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const pitch of [-.3,0,.3]){
  const p={pos:{x:0,y:1000,z:0},yaw,pitch},level=viewAxes(p);for(const bank of [-.6,.6]){const a=viewAxes(p,bank);assert(Math.abs(dot(a.up,a.forward))<1e-10);assert(Math.abs(dot(a.up,a.up)-1)<1e-10);assert(dot(a.up,level.right)*bank<0);}
  for(const sign of [-1,1]){const target={x:level.forward.x*1000+level.right.x*500*sign,y:1000,z:level.forward.z*1000+level.right.z*500*sign};assert(radarPoint(p,target).x*sign>0);assert.equal(turnHint(p,target).key,sign<0?'A':'D');}
 }assert.equal(compassHeading(-Math.PI/2),90);assert.equal(compassHeading(Math.PI/2),270);
});
test('both replay paths can use a nonmutating roster-normalized configuration for late guests',()=>{
 for(const mode of ['dogfight','strike','freeflight'])for(const count of [1,2,3,4,5,6]){const ids=['host',...Array.from({length:count-1},(_,i)=>'p'+(i+1))],original={mode,teamSize:1,role:'attack',seed:42},c=rosterConfig(original,ids),g=createGame(c);configurePlayers(g,ids);assert.equal(original.teamSize,1);assert(ids.every(id=>g.pilots.some(p=>p.id===id&&p.human)));assert.equal(c.teamSize,mode==='freeflight'?1:Math.ceil(count/2));}
});
test('held gun fires ten rounds per second without lock and preserves missile stocks',()=>{
 const g=air(createGame({mode:'freeflight'})),p=g.pilots[0];run(g,2,{host:{fireGun:true}});assert.equal(p.gunShots,20);assert.equal(p.gunAmmo,GUN.capacity-20);assert.equal(p.heat,6);assert.equal(p.radar,4);assert(g.bullets.length>0&&g.bullets.length<=GUN.maxRounds);
});
test('unguided gun rounds damage an aimed hostile and can complete combat, but miss off-axis aircraft',()=>{
 const g=air(createGame()),p=g.pilots[0],q=g.pilots[1];q.pos={x:0,y:3000,z:500};run(g,3,{host:{fireGun:true}});assert.equal(q.dead,true);assert.equal(g.result.winner,0);assert.equal(p.hp,100);
 const miss=air(createGame());miss.pilots[1].pos={x:150,y:3000,z:500};run(miss,1.5,{host:{fireGun:true}});assert.equal(miss.pilots[1].hp,100);
});
test('swept rounds hit between frames, respect terrain occlusion, and ignore friendly aircraft',()=>{
 const fixture=(team=1)=>({serial:1,bullets:[{id:1,ownerId:'host',team:0,pos:{x:0,y:500,z:0},dir:{x:0,y:0,z:1},speed:20000,age:0,life:1}],effects:[],pilots:[{id:'target',team,hp:100,pos:{x:0,y:500,z:500},dead:false}]});
 let g=fixture();advanceGunRounds(g,.05,{ground:()=>0});assert.equal(g.pilots[0].hp,90);assert.equal(g.bullets.length,0);
 g=fixture();advanceGunRounds(g,.05,{ground:(x,z)=>z>=200&&z<=300?900:0});assert.equal(g.pilots[0].hp,100);assert.equal(g.bullets.length,0);
 g=fixture(0);advanceGunRounds(g,.05,{ground:()=>0});assert.equal(g.pilots[0].hp,100);assert.equal(g.bullets.length,1);
});
test('held gun input is isolated from pulse actions and six simultaneous streams stay inside the snapshot budget',()=>{
 let now=0;const guard=createInputGuard(()=>now);assert.equal(guard({t:'axes',q:0,input:{fireGun:true}},'axes').fireGun,true);now=99;assert.equal(guard({t:'axes',q:1,input:{fireGun:true}},'axes').fireGun,true);assert.equal(guard({t:'actions',q:0,input:{fireGun:true}},'actions').fireGun,false);
 const g=air(createGame({teamSize:3})),ids=['host','p1','p2','p3','p4','p5'];configurePlayers(g,ids);run(g,2,Object.fromEntries(ids.map(id=>[id,{fireGun:true,flare:true,chaff:true}])));const before=JSON.stringify(snapshot(g)),packet={t:'snapshot',q:1,value:snapshot(g)},encoded=serializePacket(packet);assert(encoded);assert(new TextEncoder().encode(encoded).length<=60000);assert.equal(JSON.stringify(snapshot(g)),before);
});
