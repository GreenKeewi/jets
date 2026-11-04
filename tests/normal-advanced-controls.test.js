import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step} from '../sim.js';
import {AIRFIELDS,fieldPoint} from '../missions.js';
import {automaticSystems} from '../airport-operations.js';
const flying=()=>{const g=createGame({mode:'freeflight'}),p=g.pilots[0];Object.assign(p,{grounded:false,landed:false,pos:fieldPoint(AIRFIELDS.home,0,0,1000),speed:220,throttle:.6,pitch:0,roll:0,departureActive:false});return {g,p};};
test('manual systems persist in both modes and override normal automatic gear',()=>{
 const {g,p}=flying();p.gearDown=false;step(g,{host:{toggleGear:true,toggleAirbrake:true}},1/60);assert.equal(p.gearDown,true);assert.equal(p.airbrake,true);assert.equal(p.gearManual,true);
 step(g,{host:{}},1/60);assert.equal(p.gearDown,true);assert.equal(p.airbrake,true);
 step(g,{host:{toggleManeuver:true,toggleGear:true,toggleAirbrake:true}},1/60);assert.equal(p.maneuverAssist,true);assert.equal(p.gearDown,false);assert.equal(p.airbrake,false);
 step(g,{host:{toggleAirbrake:true}},1/60);step(g,{host:{toggleManeuver:true}},1/60);assert.equal(p.maneuverAssist,false);assert.equal(p.airbrake,true);assert.equal(p.gearDown,false);
});
test('automatic gear protects slow home approach, not enemy airfields',()=>{
 const {p}=flying();p.pos=fieldPoint(AIRFIELDS.home,0,-500,100);p.speed=100;p.pitch=-.03;automaticSystems(p);assert.equal(p.gearDown,true);
 p.pos=fieldPoint(AIRFIELDS.northpoint,0,-500,100);automaticSystems(p);assert.equal(p.gearDown,false);
 p.pos=fieldPoint(AIRFIELDS.home,0,0,100);p.maneuverAssist=true;p.gearDown=false;automaticSystems(p);assert.equal(p.gearDown,false);
});
test('normal home touchdown automatically deploys gear and brakes at low power',()=>{
 const {g,p}=flying();Object.assign(p,{pos:fieldPoint(AIRFIELDS.home,0,0,3.1),speed:90,throttle:0,pitch:-.03,gearDown:false});
 for(let n=0;n<30&&!p.grounded;n++)step(g,{host:{}},1/60);
 assert.equal(p.dead,false);assert.equal(p.grounded,true);assert.equal(p.landed,true);assert.equal(p.gearDown,true);
 step(g,{host:{}},1/60);assert.equal(p.braking,true);assert.equal(p.airbrake,false);
});
test('normal flight self levels while advanced mode allows continuous full rolls',()=>{
 const normal=flying(),advanced=flying();advanced.p.maneuverAssist=true;
 for(let n=0;n<120;n++){step(normal.g,{host:{roll:1}},1/60);step(advanced.g,{host:{roll:1}},1/60);}
 assert(Math.abs(normal.p.roll)<=1.01);assert(Math.abs(advanced.p.roll-normal.p.roll)>.5);
 for(let n=0;n<180;n++)step(normal.g,{host:{}},1/60);
 assert(Math.abs(normal.p.roll)<.01);assert.equal(normal.p.dead,false);
});
