import test from 'node:test';
import assert from 'node:assert/strict';
import {GUN,gunWorldSpeed,gunIntercept,fireGunRound,advanceGunRounds} from '../guns.js';
import {TRAVEL,worldSpeed,worldVelocity} from '../arcade-travel.js';
import {gunMuzzle} from '../view-axes.js';
const pilot=(overrides={})=>({id:'host',team:0,pos:{x:0,y:1000,z:0},yaw:0,pitch:0,roll:0,speed:300,grounded:false,gearDown:false,gunAmmo:10,gunCD:0,hp:100,...overrides});
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('gun world speed inherits arcade translation without changing nominal gun or aircraft airspeed',()=>{
 for(const p of [pilot(),pilot({grounded:true}),pilot({gearDown:true}),pilot({speed:170})]){
  const original=p.speed,g={serial:0,bullets:[]};assert(fireGunRound(g,p));
  near(g.bullets[0].speed,GUN.speed*TRAVEL.maxMultiplier+worldSpeed(p));
  near(g.bullets[0].speed,gunWorldSpeed(p));assert.equal(p.speed,original);
 }
 assert.equal(GUN.speed,850);
});

test('gun lead matches a boosted moving target including vertical velocity and stall sink',()=>{
 const p=pilot(),target=pilot({id:'target',team:1,pos:{x:120,y:1050,z:650},yaw:Math.PI/2,pitch:.12,stallSink:7});
 const solution=gunIntercept(p,target);assert(solution);const muzzle=gunMuzzle(p),velocity=worldVelocity(target);
 for(const axis of ['x','y','z'])near(solution.point[axis],target.pos[axis]+velocity[axis]*solution.time);
 near(Math.hypot(solution.point.x-muzzle.x,solution.point.y-muzzle.y,solution.point.z-muzzle.z),gunWorldSpeed(p)*solution.time);
 assert(solution.time<GUN.life);
});

const crossing=()=>({serial:1,bullets:[{id:1,ownerId:'host',team:0,pos:{x:0,y:500,z:0},dir:{x:0,y:0,z:1},speed:2000,age:0,life:1}],effects:[],pilots:[pilot({id:'target',team:1,pos:{x:100,y:500,z:100}})]});
const previous=new Map([['target',{x:-100,y:500,z:100}]]);
test('relative swept gun collision catches a target crossing between both endpoints',()=>{
 const g=crossing();advanceGunRounds(g,.1,{ground:()=>0,previous});assert.equal(g.pilots[0].hp,90);assert.equal(g.bullets.length,0);
 const noHistory=crossing();advanceGunRounds(noHistory,.1,{ground:()=>0});assert.equal(noHistory.pilots[0].hp,100);
});
test('moving-target gun collision still respects earlier terrain and friendly immunity',()=>{
 const terrain=crossing();advanceGunRounds(terrain,.1,{ground:(x,z)=>z>=40&&z<=60?900:0,previous});assert.equal(terrain.pilots[0].hp,100);assert.equal(terrain.bullets.length,0);
 const friendly=crossing();friendly.pilots[0].team=0;advanceGunRounds(friendly,.1,{ground:()=>0,previous});assert.equal(friendly.pilots[0].hp,100);assert.equal(friendly.bullets.length,1);
});
