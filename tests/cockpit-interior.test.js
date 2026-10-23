import test from 'node:test';
import assert from 'node:assert/strict';
import {CockpitInterior} from '../cockpit-interior.js';
test('cockpit follows live stick, rudder and throttle; neutral controls recover',()=>{
 const cockpit=new CockpitInterior();
 for(let i=0;i<60;i++)cockpit.update({controlInput:{pitch:1,roll:-1,yaw:1},throttle:1},1/60);
 assert(cockpit.stick.rotation.x>.23);assert(cockpit.stick.rotation.z<-.26);
 assert(cockpit.feet[0].position.z<cockpit.feet[1].position.z);
 assert(cockpit.throttle.position.z< -1.21);
 for(let i=0;i<60;i++)cockpit.update({controlInput:{pitch:0,roll:0,yaw:0},throttle:0},1/60);
 assert(Math.abs(cockpit.stick.rotation.x)<1e-5);assert(Math.abs(cockpit.stick.rotation.z)<1e-5);
 assert(Math.abs(cockpit.feet[0].position.z-cockpit.feet[1].position.z)<1e-5);
 assert(cockpit.throttle.position.z>-.881);
});
test('cockpit motion is frame-rate independent and ignores missing remote controls safely',()=>{
 const results=[30,60,144].map(fps=>{const c=new CockpitInterior();for(let i=0;i<fps;i++)c.update({controlInput:{pitch:.7,roll:.3,yaw:-.5},throttle:.8},1/fps);return c.pose;});
 for(const key of ['pitch','roll','yaw','throttle'])assert(Math.abs(results[0][key]-results[2][key])<1e-9);
 const c=new CockpitInterior();c.update({},1/60);assert(Object.values(c.pose).every(Number.isFinite));
});
test('bomber selects a separate two-seat deck with synchronized sticks and four levers per station',()=>{
 const c=new CockpitInterior(),fighterChildren=c.fighterRoot.children.length;
 for(let i=0;i<60;i++)c.update({bomber:true,controlInput:{pitch:.8,roll:-.6,yaw:.5},throttle:.9},1/60);
 assert.equal(c.activeType,'bomber');assert.equal(c.fighterRoot.visible,false);assert.equal(c.bomber.root.visible,true);
 assert.equal(c.bomber.sticks.length,2);assert.equal(c.bomber.throttles.length,8);
 assert(c.bomber.seat.position.x>1);assert(c.bomber.sticks[0].rotation.x>.15);assert(c.bomber.sticks[0].rotation.z<-.14);
 assert(c.bomber.throttles.every(t=>Math.abs(t.rotation.x-.28)<1e-5));
 c.update({bomber:false,throttle:0});assert.equal(c.fighterRoot.visible,true);assert.equal(c.bomber.root.visible,false);assert.equal(c.fighterRoot.children.length,fighterChildren);
});
