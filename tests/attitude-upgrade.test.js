import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAttitude} from '../attitude.js';
import {initializeFuel} from '../flight.js';
import {freshPilotG,updatePilotG} from '../pilot-g.js';
import {viewAxes} from '../view-axes.js';
const plane=(v={})=>initializeFuel({yaw:0,pitch:0,roll:0,speed:240,throttle:.78,...freshPilotG(),...v});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
test('manual roll crosses inverted and completes a full revolution without a bank clamp',()=>{
 const p=plane();let inverted=false,crossed=false,last=p.roll;
 for(let i=0;i<360;i++){advanceAttitude(p,{roll:1},1/60);inverted||=viewAxes(p,p.roll).up.y<-.9;crossed||=last>2.9&&p.roll< -2.9;last=p.roll;}
 assert(inverted);assert(crossed);assert(Number.isFinite(p.yaw+p.pitch+p.roll));
});
test('neutral input preserves an inverted airframe',()=>{
 const p=plane({roll:Math.PI});for(let i=0;i<120;i++)advanceAttitude(p,{},1/60);
 assert(viewAxes(p,p.roll).up.y<-.999);assert(Math.abs(p.pitch)<.001);
});
test('pitch pulls toward body up when inverted rather than always world up',()=>{
 const upright=plane(),inverted=plane({roll:Math.PI});advanceAttitude(upright,{pitch:1},.02);advanceAttitude(inverted,{pitch:1},.02);
 assert(upright.pitch>0);assert(inverted.pitch<0);
});
test('body axes remain orthonormal through assisted loops and rolls',()=>{
 const p=plane({maneuverAssist:true});let inverted=false;
 for(let i=0;i<1800;i++){advanceAttitude(p,{pitch:1,roll:.3,yaw:.1},1/60);const{forward:f,up:u}=viewAxes(p,p.roll);assert(Math.abs(dot(f,u))<1e-9);assert(Math.abs(dot(f,f)-1)<1e-9);assert(Math.abs(dot(u,u)-1)<1e-9);assert(Number.isFinite(p.yaw+p.pitch+p.roll));inverted||=u.y<-.8;}
 assert(inverted);
});
test('actual body-axis pull and push produce positive and negative normal load',()=>{
 for(const sign of[1,-1]){const p=plane();for(let i=0;i<30;i++){const before=viewAxes(p,p.roll).forward;advanceAttitude(p,{pitch:sign},1/60);updatePilotG(p,before,viewAxes(p,p.roll).forward,1/60,false);}assert(sign*p.normalLoad>0);assert(sign*p.gLoad>0);}
});
