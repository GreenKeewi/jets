import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,BOMBER_SIGNATURE,bomberCruiseTarget,strikeTarget} from '../sim.js';
function fixture(bomber=true,range=2000){
 const g=createGame({mode:'dogfight',teamSize:1,seed:23}),[p,q]=g.pilots;g.time=20;
 for(const a of [p,q])Object.assign(a,{human:true,grounded:false,departureActive:false,gearDown:false,speed:220,throttle:.7,pitch:0,roll:0,yaw:0});
 q.bomber=bomber;return{g,p,q,range};
}
function tick(f,dt,input={}){const {g,p,q,range}=f;p.pos={x:0,y:3500,z:0};q.pos={x:0,y:3500,z:range};p.yaw=0;p.pitch=0;p.roll=0;q.yaw=0;q.pitch=0;q.roll=0;step(g,{[p.id]:input},dt);}
for(const dt of [1/30,1/60,1/144])test(`bomber acquisition is shorter and twice as slow, still launchable at ${1/dt}Hz`,()=>{
 const far=fixture(true,3300);tick(far,dt);assert.equal(far.p.targetId,null);
 const fighter=fixture(false,3300);tick(fighter,dt);assert.equal(fighter.p.targetId,fighter.q.id);
 const f=fixture();for(let i=0;i<Math.round(.6/dt);i++)tick(f,dt);assert(f.p.lock<.45);tick(f,dt,{fireHeat:true});assert.equal(f.g.missiles.length,0);
 for(let i=0;i<Math.ceil(3/dt);i++)tick(f,dt);assert(f.p.lock>=1.45);tick(f,dt,{fireRadar:true});assert.equal(f.g.missiles[0].targetId,f.q.id);assert.equal(f.p.radar,3);
});
test('lock cannot transfer from a fighter to a bomber or survive leaving its range',()=>{
 const f=fixture(false);for(let i=0;i<120;i++)tick(f,1/60);const old=f.q.id;
 const b={...f.q,id:'new-bomber',bomber:true};f.q.dead=true;f.g.pilots.push(b);f.q=b;tick(f,1/60,{fireRadar:true});assert.notEqual(f.p.targetId,old);assert(f.p.lock<.02);assert.equal(f.g.missiles.length,0);
 f.range=3000;tick(f,1/60);assert.equal(f.p.lock,0);assert.equal(f.p.targetId,null);
});
test('higher AI cruise descends for bombing and climbs again for escape',()=>{
 const g=createGame({mode:'strike'}),p=g.pilots.find(p=>p.bomber),target=strikeTarget(g);
 p.pos={x:target.x,y:1000,z:target.z-15000};assert.equal(bomberCruiseTarget(g,p).y,BOMBER_SIGNATURE.cruiseAltitude);
 p.pos.z=target.z-4000;assert(bomberCruiseTarget(g,p).y<target.y+1600);
 g.bombed=true;assert.equal(bomberCruiseTarget(g,p).y,2900);
});
for(const dt of [1/30,1/60,1/144])test(`player bomber climbs above AI cruise without forced pitch at ${1/dt}Hz`,()=>{
 const g=createGame({mode:'strike'}),p=g.pilots[0];g.pilots=[p];Object.assign(p,{grounded:false,departureActive:false,gearDown:false,pos:{x:0,y:3100,z:0},speed:260,throttle:1,pitch:.18,roll:0});
 for(let n=0;n<5/dt;n++)step(g,{[p.id]:{pitch:.25}},dt);
 assert(p.pos.y>3300);assert(p.pitch>0);assert(!p.dead);
});
